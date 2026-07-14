import { z } from "zod";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupSchema,
  verifyOtpSchema,
} from "../schemas/auth.schema.js";

/** Request bodies are generated from the same Zod schemas the routes validate with. */
const body = (schema: z.ZodType, example?: Record<string, unknown>) => ({
  required: true,
  content: {
    "application/json": {
      schema: z.toJSONSchema(schema, { target: "openapi-3.0" }),
      ...(example ? { example } : {}),
    },
  },
});

const json = (ref: string) => ({
  content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } },
});

const secured = [{ bearerAuth: [] }];

const errors = {
  400: { description: "Validation failed or bad request", ...json("Error") },
  401: { description: "Not authenticated, or the token was revoked by a password change", ...json("Error") },
  403: { description: "Token invalid/expired, or email not verified", ...json("Error") },
  429: { description: "Rate limited (resend cooldown or too many OTP attempts)", ...json("Error") },
  500: { description: "Internal Server Error", ...json("Error") },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Ecom API",
    version: "1.0.0",
    description: [
      "### Testing a protected route",
      "1. `POST /api/auth/signup` (or `/login`) and copy the `token` from the response.",
      "2. Click **Authorize** at the top right and paste the token — no `Bearer ` prefix needed.",
      "3. Protected endpoints will now send it automatically.",
      "",
      "**Note:** changing or resetting a password revokes every token issued before it,",
      "so you'll need to log in again and re-Authorize afterwards.",
    ].join("\n"),
  },
  servers: [{ url: "http://localhost:{port}", variables: { port: { default: String(process.env.PORT || 3000) } } }],
  tags: [
    { name: "Auth", description: "Signup, login, and session" },
    { name: "Email verification", description: "OTP codes sent to the user's inbox" },
    { name: "Password", description: "Reset (forgotten) and change (known) password flows" },
    { name: "Catalog", description: "Products and users" },
    { name: "System", description: "Health check" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the raw token from /login or /signup.",
      },
    },
    schemas: {
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          email: { type: "string", format: "email", example: "user@example.com" },
          name: { type: "string", nullable: true, example: "Alice" },
          role: { type: "string", enum: ["USER", "ADMIN"], example: "USER" },
          emailVerified: { type: "boolean", example: false },
        },
      },
      AuthResponse: {
        type: "object",
        properties: {
          token: { type: "string", description: "JWT — valid for 30 days.", example: "eyJhbGciOiJIUzI1NiIs..." },
          user: { $ref: "#/components/schemas/User" },
        },
      },
      Message: {
        type: "object",
        properties: { message: { type: "string", example: "Verification code sent to your email" } },
      },
      Error: {
        type: "object",
        description: "`error` for a single failure; `errors` for per-field validation failures.",
        properties: {
          error: { type: "string", example: "Invalid email or password" },
          errors: {
            type: "object",
            additionalProperties: { type: "array", items: { type: "string" } },
            example: { password: ["Password must be at least 8 characters"] },
          },
        },
      },
      Product: {
        type: "object",
        properties: {
          id: { type: "integer" },
          name: { type: "string" },
          description: { type: "string", nullable: true },
          price: { type: "number" },
          stock: { type: "integer" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        responses: {
          200: {
            description: "Server is up",
            content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } },
          },
        },
      },
    },

    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create an account",
        description: "Creates the user, emails a 6-digit verification code, and returns a token. The account starts with `emailVerified: false`.",
        requestBody: body(signupSchema, { email: "user@example.com", password: "supersecret", name: "Alice" }),
        responses: {
          201: { description: "Account created", ...json("AuthResponse") },
          400: errors[400],
          409: { description: "Email already in use", ...json("Error") },
          500: errors[500],
        },
      },
    },

    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in",
        description: "Email matching is case-insensitive.",
        requestBody: body(loginSchema, { email: "user@example.com", password: "supersecret" }),
        responses: {
          200: { description: "Logged in", ...json("AuthResponse") },
          400: errors[400],
          401: { description: "Invalid email or password", ...json("Error") },
          500: errors[500],
        },
      },
    },

    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current user",
        security: secured,
        responses: {
          200: {
            description: "The authenticated user",
            content: { "application/json": { schema: { type: "object", properties: { user: { $ref: "#/components/schemas/User" } } } } },
          },
          401: errors[401],
          403: errors[403],
        },
      },
    },

    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Log out",
        description: "Tokens are stateless: this confirms the request, but the client must discard the token. It stays valid until it expires.",
        security: secured,
        responses: { 200: { description: "Client should discard the token", ...json("Message") }, 401: errors[401], 403: errors[403] },
      },
    },

    "/api/auth/send-otp": {
      post: {
        tags: ["Email verification"],
        summary: "Send (or resend) the email verification code",
        description: "Limited to one send per minute. Fails if the email is already verified.",
        security: secured,
        responses: {
          200: { description: "Code sent", ...json("Message") },
          400: { description: "Email is already verified", ...json("Error") },
          401: errors[401],
          403: errors[403],
          429: { description: "A code was just sent — wait before requesting another", ...json("Error") },
          500: errors[500],
        },
      },
    },

    "/api/auth/verify-otp": {
      post: {
        tags: ["Email verification"],
        summary: "Verify the email with the code",
        description: "The code expires after 5 minutes and allows 5 wrong attempts before it is discarded. It is burned on success.",
        security: secured,
        requestBody: body(verifyOtpSchema, { otp: "123456" }),
        responses: {
          200: {
            description: "Email verified",
            content: {
              "application/json": {
                schema: { type: "object", properties: { message: { type: "string" }, user: { $ref: "#/components/schemas/User" } } },
              },
            },
          },
          400: { description: "Invalid, expired, or already-used code", ...json("Error") },
          401: errors[401],
          403: errors[403],
          429: { description: "Too many incorrect attempts — request a new code", ...json("Error") },
          500: errors[500],
        },
      },
    },

    "/api/auth/forgot-password": {
      post: {
        tags: ["Password"],
        summary: "Email a password-reset code",
        description: "Always answers 200 with the same message, whether or not the account exists — this prevents probing for registered emails.",
        requestBody: body(forgotPasswordSchema, { email: "user@example.com" }),
        responses: { 200: { description: "Generic acknowledgement", ...json("Message") }, 400: errors[400], 500: errors[500] },
      },
    },

    "/api/auth/reset-password": {
      patch: {
        tags: ["Password"],
        summary: "Reset a forgotten password using the emailed code",
        description: "No token needed. Revokes every token issued before the reset, so log in again afterwards.",
        requestBody: body(resetPasswordSchema, { email: "user@example.com", otp: "123456", newPassword: "newsupersecret" }),
        responses: {
          200: { description: "Password reset — log in again", ...json("Message") },
          400: { description: "Invalid/expired code, or the new password matches the old one", ...json("Error") },
          429: errors[429],
          500: errors[500],
        },
      },
    },

    "/api/auth/change-password": {
      patch: {
        tags: ["Password"],
        summary: "Change a known password",
        description: "Requires a verified email. Revokes every token issued before the change, including the one used to make this call.",
        security: secured,
        requestBody: body(changePasswordSchema, { currentPassword: "supersecret", newPassword: "newsupersecret" }),
        responses: {
          200: { description: "Password changed — log in again", ...json("Message") },
          400: { description: "New password matches the old one", ...json("Error") },
          401: { description: "Current password is incorrect, or the token was revoked", ...json("Error") },
          403: { description: "Email not verified, or token invalid", ...json("Error") },
          500: errors[500],
        },
      },
    },

    "/api/products": {
      get: {
        tags: ["Catalog"],
        summary: "List products",
        responses: {
          200: {
            description: "All products",
            content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Product" } } } },
          },
        },
      },
    },

    "/api/users": {
      get: {
        tags: ["Catalog"],
        summary: "List users (not implemented)",
        description: "The handler is currently an empty stub and returns no body.",
        responses: { 200: { description: "Empty response" } },
      },
    },
  },
} as const;
