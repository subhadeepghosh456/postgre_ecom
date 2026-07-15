import {z} from "zod";

export const productSchema = z.object({
    name: z.string().min(1,"Product name is required"),
    description: z.string().min(8,"Product description is required"),
    price: z.number().min(1,"Product price must be greater than or equal to 0"),
    stock: z.number().min(0,"Product stock must be greater than or equal to 0"),
    // image: z.string(),
    category: z.string().min(1,"Product category is required"),
})

export const productImageSchema = z.object({
    image: z.string().min(1,"Product image is required"),
})