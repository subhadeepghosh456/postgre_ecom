import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/products
router.get("/", async (_req, res) => {
  const products = await prisma.product.findMany();
  res.json(products);
});


// router.post("/", async (req, res) => {
//   const { name, description, price, stock } = req.body;
//   const product = await prisma.product.create({
//     data: { name, description, price, stock },
//   });
//   res.status(201).json(product);
// });

export default router;
