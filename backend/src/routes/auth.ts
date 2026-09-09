import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User";
import { requireAuth, type AuthRequest } from "../middleware/auth";

const router = Router();

function isHttpsRequest(req: Request): boolean {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : Array.isArray(forwarded)
        ? forwarded[0]
        : undefined;

  return req.secure || proto === "https";
}

/**
 * First-party cookies via the Next.js /api proxy.
 * sameSite:lax is enough; secure only when the browser
 * request is HTTPS (production). Avoids broken local cookies
 * when NODE_ENV=production in .env.
 */
function authCookieOptions(req: Request) {
  const secure = isHttpsRequest(req);

  return {
    httpOnly: true,
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    secure,
    sameSite: "lax" as const,
  };
}

function createToken(userId: string) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  return jwt.sign(
    { userId },
    secret,
    { expiresIn: "7d" }
  );
}

/**
 * POST /api/auth/register
 */
router.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User already exists",
      });
    }

    const passwordHash =
      await bcrypt.hash(password, 12);

    const user = await User.create({
      email: normalizedEmail,
      passwordHash,
    });

    const token = createToken(
      user._id.toString()
    );

    res.cookie("token", token, authCookieOptions(req));

    return res.status(201).json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Register error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not register user",
    });
  }
});

/**
 * POST /api/auth/login
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = email
      .trim()
      .toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const validPassword =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createToken(
      user._id.toString()
    );

    res.cookie("token", token, authCookieOptions(req));

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not log in",
    });
  }
});

/**
 * POST /api/auth/logout
 */
router.post("/logout", (req: Request, res: Response) => {
  res.clearCookie("token", authCookieOptions(req));

  return res.json({
    success: true,
  });
});

router.get(
  "/me",
  requireAuth,
  async (req: AuthRequest, res) => {
    const user = await User.findById(req.user!.id).select(
      "_id email createdAt"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User no longer exists",
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  }
);

export default router;
