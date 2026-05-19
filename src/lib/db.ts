import { PrismaClient } from '@prisma/client';

type DatabaseHealth =
  | {
      ok: true;
    }
  | {
      ok: false;
      reason: string;
    };

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error']
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

export async function verifyDatabaseConnection(): Promise<DatabaseHealth> {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      reason: 'DATABASE_URL is not configured.'
    };
  }

  try {
    await db.$queryRaw`SELECT 1`;

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : 'Database connection failed.'
    };
  }
}
