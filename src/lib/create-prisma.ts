import { PrismaClient } from "@prisma/client";
import { PrismaClient as PostgresPrismaClient } from "@prisma-postgres/client";

export function isPostgresUrl(url: string | undefined): boolean {
  return url?.startsWith("postgresql://") === true || url?.startsWith("postgres://") === true;
}

export function createPrismaClient(url = process.env.DATABASE_URL): PrismaClient {
  if (!isPostgresUrl(url)) return new PrismaClient();
  return new PostgresPrismaClient({
    datasources: { db: { url } },
  }) as unknown as PrismaClient;
}
