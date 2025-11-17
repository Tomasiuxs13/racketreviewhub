import type { Request, Response, NextFunction } from "express";
import { createSupabaseClient } from "../lib/supabaseClient.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    isAdmin?: boolean;
  };
}

type AuthOptions = {
  requireAdmin?: boolean;
};

function createAuthMiddleware(options: AuthOptions = {}) {
  return async function authMiddleware(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
      }

      const token = authHeader.replace("Bearer ", "");
      const supabase = createSupabaseClient(req);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
      }

      const email = user.email || "";
      const isAdmin = email
        ? ADMIN_EMAILS.includes(email.toLowerCase())
        : false;

      if (options.requireAdmin && !isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      req.user = {
        id: user.id,
        email,
        isAdmin,
      };

      next();
    } catch (error) {
      console.error("Auth middleware error:", error);
      return res.status(401).json({ error: "Unauthorized: Authentication failed" });
    }
  };
}

export const requireAuth = createAuthMiddleware();
export const requireAdmin = createAuthMiddleware({ requireAdmin: true });
