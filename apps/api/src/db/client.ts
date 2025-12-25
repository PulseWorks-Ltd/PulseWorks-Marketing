import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Middleware to enforce tenant isolation
prisma.$use(async (params, next) => {
  // This middleware can be used to add global tenant filtering if needed
  // For now, we enforce it at the query level in controllers
  return next(params);
});
