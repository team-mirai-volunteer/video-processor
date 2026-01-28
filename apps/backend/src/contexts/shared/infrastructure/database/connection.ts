import { PrismaClient } from '@prisma/client';

// Build DATABASE_URL from individual environment variables if not set
function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DATABASE_HOST;
  const name = process.env.DATABASE_NAME;
  const user = process.env.DATABASE_USER;
  const password = process.env.DATABASE_PASSWORD;

  if (host && name && user && password) {
    return `postgresql://${user}:${encodeURIComponent(password)}@localhost/${name}?host=${host}`;
  }

  throw new Error(
    'Database connection not configured. Set DATABASE_URL or DATABASE_HOST/NAME/USER/PASSWORD'
  );
}

// Set DATABASE_URL for Prisma
process.env.DATABASE_URL = getDatabaseUrl();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
