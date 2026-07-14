import { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { verifyToken, type DecodedToken } from "../utils/jwt.js";
import type { UserType } from "../generated/prisma/enums.js";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided.",
    });
  }

  let payload: DecodedToken;
  try {
    payload = verifyToken(token);
  } catch {
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      emailVerified: true,
      updatePasswordAt: true,
    },
  });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Account no longer exists.",
    });
  }

  // A password change revokes every token minted before it. `iat` is whole
  // seconds, so compare at second granularity — otherwise a token signed in the
  // same second as the change would be rejected by sub-second rounding.
  if (
    user.updatePasswordAt &&
    payload.iat < Math.floor(user.updatePasswordAt.getTime() / 1000)
  ) {
    return res.status(401).json({
      success: false,
      message: "Password was changed. Please log in again.",
    });
  }

  const { updatePasswordAt, ...authUser } = user;
  req.user = authUser;

  next();
}

/** Route guard: `router.post("/", authMiddleware, requireRole("ADMIN"), handler)` */
export function requireRole(...roles: UserType[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, message: "Access denied. No token provided." });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to perform this action.",
      });
    }
    next();
  };
}

/** Route guard for actions that must not run on an unverified email. */
export function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res
      .status(401)
      .json({ success: false, message: "Access denied. No token provided." });
  }
  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: "Please verify your email address first.",
    });
  }
  next();
}
