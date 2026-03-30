import pkg from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } from '../config.js';

const { PrismaClient } = pkg;
const { Pool } = pg;

function buildConnectionString() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = encodeURIComponent(DB_USER);
  const password = encodeURIComponent(DB_PASSWORD);

  return `postgresql://${user}:${password}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

const connectionString = buildConnectionString();
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
