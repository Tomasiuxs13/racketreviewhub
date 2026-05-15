import "dotenv/config";
import { setDefaultResultOrder } from "node:dns";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Render instances don't have IPv6 egress, but some managed Postgres
// providers (e.g. Supabase) return IPv6 addresses first. Force IPv4
// resolution order so database connections succeed instead of throwing
// ENETUNREACH when Node tries IPv6 first.
setDefaultResultOrder("ipv4first");

const app = express();

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Trust the platform proxy (Render/Cloudflare) so req.protocol reflects
// the original scheme via X-Forwarded-Proto.
app.set("trust proxy", true);

const CANONICAL_HOST = process.env.CANONICAL_HOST || "racketreviewhub.com";
const SUPPORTED_LOCALES = ["en", "es", "pt", "it", "fr"];

// Force HTTPS + canonical host for the production domain only.
// - http://racketreviewhub.com/x -> https://racketreviewhub.com/x
// - https://www.racketreviewhub.com/x -> https://racketreviewhub.com/x
// Skips localhost (dev) and unrelated hosts (Render preview, custom domains).
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  const host = (req.headers.host || "").toLowerCase().split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return next();

  const normalizedHost = host.replace(/^www\./, "");
  const isCanonicalDomain = normalizedHost === CANONICAL_HOST;
  if (!isCanonicalDomain) return next();

  const proto = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0].trim() || req.protocol;
  const isHttps = proto === "https";
  const hostMismatch = host !== CANONICAL_HOST;
  if (!isHttps || hostMismatch) {
    return res.redirect(301, `https://${CANONICAL_HOST}${req.originalUrl}`);
  }
  next();
});

// Handle SEO redirects for legacy ?lang= parameter
app.use((req, res, next) => {
  // Only redirect page requests, not API calls — API routes handle ?lang= themselves
  if (req.method === 'GET' && req.query.lang && !req.path.startsWith('/api/')) {
    const lang = req.query.lang as string;

    if (SUPPORTED_LOCALES.includes(lang)) {
      try {
        const urlObj = new URL(req.originalUrl, `http://${req.headers.host || 'localhost'}`);
        urlObj.searchParams.delete('lang');

        let newPath = urlObj.pathname;
        // Remove existing locale prefix to avoid double prefixes like /pt/pt/
        newPath = newPath.replace(/^\/[a-z]{2}(\/|$)/, (_, sep) => sep || "/");

        if (lang !== "en") {
          newPath = `/${lang}${newPath.startsWith("/") ? newPath : "/" + newPath}`;
        } else if (!newPath.startsWith("/")) {
          newPath = "/" + newPath;
        }

        // Clean up multiple slashes just in case
        newPath = newPath.replace(/\/\/+/g, '/');

        const search = urlObj.search;
        return res.redirect(301, `${newPath}${search}`);
      } catch (err) {
        console.error("Error processing lang redirect:", err);
      }
    }
  }
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
