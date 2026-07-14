import type { UserType } from "../generated/prisma/enums.js";

// Lets every route read a typed `req.user` without re-declaring an
// AuthRequest interface per file. Populated by authMiddleware.
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name: string | null;
        role: UserType;
        emailVerified: boolean;
      };
    }
  }
}

export {};
