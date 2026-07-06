import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/users
router.get("/", async (_req, res) => {
  // const users = await prisma.user.findMany({ include: { orders: true } });
  // res.json(users);

});

// POST /api/users  { "email": "a@b.com", "name": "Alice" }
// router.post("/", async (req, res) => {
//   const { email, name } = req.body;
//   const user = await prisma.user.create({ data: { email, name } });
//   res.status(201).json(user);
// });

export default router;
