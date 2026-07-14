import "dotenv/config";
import jwt from "jsonwebtoken";
import type { UserType } from "../generated/prisma/enums.js";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set — refusing to start.");
}

const EXPIRES_IN = (process.env.JWT_EXPIRES ??
  "30d") as jwt.SignOptions["expiresIn"];

export interface TokenPayload {
  userId: number;
  role: UserType;
}

/** `iat`/`exp` are seconds since epoch, added by jsonwebtoken itself. */
export type DecodedToken = TokenPayload & { iat: number; exp: number };

export const signToken = (payload: TokenPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN });

/** Throws (JsonWebTokenError / TokenExpiredError) when the token is not usable. */
export const verifyToken = (token: string): DecodedToken =>
  jwt.verify(token, JWT_SECRET) as DecodedToken;
