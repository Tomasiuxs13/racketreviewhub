import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";
import { resolveSeoMeta, injectSeoMeta } from "./lib/seoInjector.js";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      // Inject server-side SEO meta tags for crawlers
      const urlPath = url.split("?")[0];
      const seoMeta = await resolveSeoMeta(urlPath);
      if (seoMeta) {
        template = injectSeoMeta(template, seoMeta);
      }

      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, the client build is at dist/public (relative to project root)
  // The server runs from dist/server/index.js, so we need to go up one level
  const distPath = path.resolve(import.meta.dirname, "..", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve hashed Vite assets (JS/CSS) with long-lived cache — filenames change on rebuild
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    }),
  );

  // Serve other static files (images, fonts, etc.) with moderate caching
  app.use(
    express.static(distPath, {
      maxAge: "1h",
      // Don't serve index.html from here — we handle it below with no-cache
      index: false,
    }),
  );

  // fall through to index.html with injected SEO meta tags
  // IMPORTANT: Always set no-cache on HTML so browsers check for new bundles
  const indexHtml = fs.readFileSync(path.resolve(distPath, "index.html"), "utf-8");

  app.use("*", async (req, res) => {
    try {
      const urlPath = req.originalUrl.split("?")[0];
      const seoMeta = await resolveSeoMeta(urlPath);
      const headers = {
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      };
      if (seoMeta) {
        const html = injectSeoMeta(indexHtml, seoMeta);
        res.status(200).set(headers).end(html);
      } else {
        res.status(200).set(headers).end(indexHtml);
      }
    } catch {
      res.status(200).set({
        "Content-Type": "text/html",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      }).end(indexHtml);
    }
  });
}
