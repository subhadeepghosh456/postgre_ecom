import { Router, Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { signToken } from "../utils/jwt.js";
import {
  authMiddleware,
  requireVerifiedEmail,
} from "../middleware/auth.middleware.js";
import { sendEmail } from "../utils/sendEmail.js";
import {
  compareOTP,
  generateOTP,
  hashOTP,
  otpExpiry,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
} from "../utils/otp.js";
import { OtpPurpose } from "../generated/prisma/enums.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema.js";

const router = Router();

const SALT_ROUNDS = 10;
const OTP_TTL_MINUTES = OTP_TTL_MS / 60_000;

/** Emails are case-insensitive in practice; store and look them up in one shape. */
const normalizeEmail = (email: string) => email.trim().toLowerCase();

const fieldErrors = (error: z.ZodError) => z.flattenError(error).fieldErrors;

const publicUser = (user: {
  id: number;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  emailVerified: user.emailVerified,
});

const OTP_EMAIL_COPY: Record<OtpPurpose, { subject: string; intro: string }> = {
  EMAIL_VERIFICATION: {
    subject: "Verify your email",
    intro: "Use this code to verify your email address.",
  },
  PASSWORD_RESET: {
    subject: "Reset your password",
    intro:
      "Use this code to reset your password. If you didn't request this, you can ignore this email.",
  },
};

/**
 * Replaces any outstanding code for (user, purpose) and emails a fresh one.
 * Returns false when the previous code is still within its resend cooldown.
 */
async function issueOtp(
  userId: number,
  email: string,
  purpose: OtpPurpose,
): Promise<boolean> {
  const existing = await prisma.otp.findUnique({
    where: { userId_purpose: { userId, purpose } },
  });

  if (
    existing &&
    Date.now() - existing.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
  ) {
    return false;
  }

  const otp = generateOTP();
  const otpHash = await hashOTP(otp);

  await prisma.otp.upsert({
    where: { userId_purpose: { userId, purpose } },
    create: { userId, purpose, otpHash, expiresAt: otpExpiry() },
    update: { otpHash, expiresAt: otpExpiry(), attempts: 0 },
  });

  const { subject, intro } = OTP_EMAIL_COPY[purpose];
  try {
    await sendEmail(
      email,
      subject,
      `<p>${intro}</p><p>Your code is <b>${otp}</b>. It expires in ${OTP_TTL_MINUTES} minutes.</p>`,
    );
  } catch (error) {
    // Drop the row we just wrote: a code nobody received must not sit there
    // holding the resend cooldown against the user.
    await prisma.otp.deleteMany({ where: { userId, purpose } });
    throw error;
  }

  return true;
}

type OtpCheck =
  | { ok: true }
  | { ok: false; status: number; error: string };

/** Validates a code and burns it on success. Wrong codes count against the attempt limit. */
async function consumeOtp(
  userId: number,
  purpose: OtpPurpose,
  code: string,
): Promise<OtpCheck> {
  const record = await prisma.otp.findUnique({
    where: { userId_purpose: { userId, purpose } },
  });

  if (!record) {
    return {
      ok: false,
      status: 400,
      error: "No code was requested. Please request a new one.",
    };
  }

  const discard = () =>
    prisma.otp.deleteMany({ where: { userId, purpose } });

  if (record.expiresAt.getTime() < Date.now()) {
    await discard();
    return {
      ok: false,
      status: 400,
      error: "This code has expired. Please request a new one.",
    };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await discard();
    return {
      ok: false,
      status: 429,
      error: "Too many incorrect attempts. Please request a new code.",
    };
  }

  if (!(await compareOTP(code, record.otpHash))) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP_MAX_ATTEMPTS - (record.attempts + 1);
    return {
      ok: false,
      status: 400,
      error: `Invalid code. ${left} attempt${left === 1 ? "" : "s"} remaining.`,
    };
  }

  await discard();
  return { ok: true };
}

/* --------------------------------- signup -------------------------------- */

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: fieldErrors(parsed.error) });
    }
    const email = normalizeEmail(parsed.data.email);
    const { password, name,role } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
      data: { email, password: hashedPassword, name,role },
    });

    // A dead mailbox or bad SMTP config must not lose us the account — the user
    // can always re-request the code from /send-otp.
    try {
      await issueOtp(user.id, user.email, OtpPurpose.EMAIL_VERIFICATION);
    } catch (error) {
      console.error("Failed to send verification email:", error);
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* --------------------------------- login --------------------------------- */

router.post("/login", async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: fieldErrors(parsed.error) });
    }
    const email = normalizeEmail(parsed.data.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken({ userId: user.id, role: user.role });
    res.status(200).json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ----------------------------- current session ---------------------------- */

router.get("/me", authMiddleware, async (req: Request, res: Response) => {
  res.status(200).json({ user: req.user });
});

router.post("/logout", authMiddleware, async (_req: Request, res: Response) => {
  // Tokens are stateless and stay valid until they expire — the client must
  // discard it. Revocation on demand would need a token blocklist table.
  res.status(200).json({ message: "Logged out. Please discard your token." });
});

/* --------------------------- email verification --------------------------- */

router.post("/send-otp", authMiddleware, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.emailVerified) {
      return res.status(400).json({ error: "Email is already verified" });
    }

    const sent = await issueOtp(
      user.id,
      user.email,
      OtpPurpose.EMAIL_VERIFICATION,
    );
    if (!sent) {
      return res.status(429).json({
        error: "A code was just sent. Please wait before requesting another.",
      });
    }

    res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post(
  "/verify-otp",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const parsed = verifyOtpSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: fieldErrors(parsed.error) });
      }
      const user = req.user!;

      if (user.emailVerified) {
        return res.status(400).json({ error: "Email is already verified" });
      }

      const check = await consumeOtp(
        user.id,
        OtpPurpose.EMAIL_VERIFICATION,
        parsed.data.otp,
      );
      if (!check.ok) {
        return res.status(check.status).json({ error: check.error });
      }

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      });

      res
        .status(200)
        .json({ message: "Email verified", user: publicUser(updated) });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

/* ----------------------------- password reset ----------------------------- */

router.post("/forgot-password", async (req: Request, res: Response) => {
  // Always answers the same way: a differing response would let anyone probe
  // which emails have accounts.
  const generic = {
    message: "If that email has an account, a reset code has been sent.",
  };

  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: fieldErrors(parsed.error) });
    }
    const email = normalizeEmail(parsed.data.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      try {
        await issueOtp(user.id, user.email, OtpPurpose.PASSWORD_RESET);
      } catch (error) {
        console.error("Failed to send reset email:", error);
      }
    }

    res.status(200).json(generic);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch("/reset-password", async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ errors: fieldErrors(parsed.error) });
    }
    const email = normalizeEmail(parsed.data.email);
    const { otp, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Same wording as a bad code — don't confirm the address exists.
      return res.status(400).json({ error: "Invalid or expired code" });
    }

    const check = await consumeOtp(user.id, OtpPurpose.PASSWORD_RESET, otp);
    if (!check.ok) {
      return res.status(check.status).json({ error: check.error });
    }

    if (await bcrypt.compare(newPassword, user.password)) {
      return res
        .status(400)
        .json({ error: "New password must differ from the old password" });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: await bcrypt.hash(newPassword, SALT_ROUNDS),
        updatePasswordAt: new Date(),
      },
    });

    res
      .status(200)
      .json({ message: "Password reset successfully. Please log in again." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

router.patch(
  "/change-password",
  authMiddleware,
  requireVerifiedEmail,
  async (req: Request, res: Response) => {
    try {
      const parsed = changePasswordSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ errors: fieldErrors(parsed.error) });
      }
      const { currentPassword, newPassword } = parsed.data;

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });
      if (!user || !(await bcrypt.compare(currentPassword, user.password))) {
        return res
          .status(401)
          .json({ error: "Current password is incorrect" });
      }

      if (currentPassword === newPassword) {
        return res
          .status(400)
          .json({ error: "New password must differ from the old password" });
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: await bcrypt.hash(newPassword, SALT_ROUNDS),
          updatePasswordAt: new Date(),
        },
      });

      res
        .status(200)
        .json({ message: "Password changed successfully. Please log in again." });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  },
);

export default router;
