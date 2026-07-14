import "dotenv/config";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { prisma } from "./lib/prisma.js";
import { openApiSpec } from "./docs/openapi.js";
import usersRouter from "./routes/users.js";
import productsRouter from "./routes/products.js";
import authRouter from "./routes/auth.js";

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => res.json({ status: "ok" }));

// Interactive API docs — http://localhost:3000/docs
app.get("/docs.json", (_req, res) => res.json(openApiSpec));
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: "Ecom API docs",
    // Keeps the token you paste into "Authorize" across page reloads.
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true },
  }),
);

// Feature routes
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/products", productsRouter);

// Central error handler (Express 5 forwards async rejections here)
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
  },
);

const port = Number(process.env.PORT) || 3000;

const server = app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});

// Graceful shutdown
const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
