import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { RequestHandler } from "express";
import { storage } from "./storage";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN = "7d";

export interface JWTPayload {
  userId: string;
  username: string;
  role: string;
}

export function generateToken(payload: JWTPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Attach user info to request
  (req as any).user = payload;
  next();
};

export const requireRole = (allowedRoles: string[]): RequestHandler => {
  return async (req, res, next) => {
    const user = (req as any).user as JWTPayload;
    
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    
    next();
  };
};
