import { z } from "zod";

// Single source of truth: the routes validate against these, and the OpenAPI
// spec is generated from them, so the docs can't drift from the real rules.

export const emailSchema = z.email();
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters");
export const otpSchema = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({ otp: otpSchema });

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
