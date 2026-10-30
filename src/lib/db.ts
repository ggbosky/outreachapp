import { PrismaClient } from "@prisma/client";

// Jediná instance Prisma klienta (v dev režimu přežije hot-reload).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
