import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

interface TokenPayload {
  userId: string;
}

export interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured",
    });
  }

  try {
    const payload = jwt.verify(
      token,
      secret
    ) as TokenPayload;

    req.user = {
      id: payload.userId,
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Session is invalid or expired",
    });
  }
}