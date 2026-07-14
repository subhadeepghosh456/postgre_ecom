import crypto from "node:crypto";
import bcrypt from "bcryptjs";

export const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// Math.random() is seeded predictably and must never gate account access.
export const generateOTP = (): string =>
  crypto
    .randomInt(0, 10 ** OTP_LENGTH)
    .toString()
    .padStart(OTP_LENGTH, "0");

export const hashOTP = (otp: string): Promise<string> => bcrypt.hash(otp, 10);

export const compareOTP = (input: string, hash: string): Promise<boolean> =>
  bcrypt.compare(input, hash);

export const otpExpiry = (): Date => new Date(Date.now() + OTP_TTL_MS);
