import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 connects through a driver adapter. The connection string lives in
// .env (DATABASE_URL) — see prisma.config.ts for CLI/migrations.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

// Reuse a single client across the app (and across dev hot-reloads).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
