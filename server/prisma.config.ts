import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  // Point at the FOLDER (not a single file). Every *.prisma file inside
  // prisma/schema is merged, so each table can live in its own file.
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
