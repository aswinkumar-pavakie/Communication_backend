import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

// Used by the Prisma CLI only (migrate, studio, db seed, etc.) - the running
// application connects via the @prisma/adapter-pg driver adapter instead (see
// src/prisma/prisma.service.ts), which reads DATABASE_URL through ConfigService.
// Migrations run against DIRECT_URL (the non-pooled connection) since DDL and
// Prisma's shadow-database diffing don't play well with a transaction pooler.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
