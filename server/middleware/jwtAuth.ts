import type { Request, Response, NextFunction } from "express";
import { verifyToken, isAdminEmail, type JwtPayload } from "../lib/jwt.js";

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
      const payload = verifyToken(token);

      if (!payload) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired token" });
      }

      const isAdmin = isAdminEmail(payload.email);

      if (options.requireAdmin && !isAdmin) {
        return res.status(403).json({ error: "Forbidden: Admin access required" });
      }

      req.user = {
        id: payload.userId,
        email: payload.email,
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


