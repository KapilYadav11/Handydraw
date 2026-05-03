import dotenv from "dotenv";
import path from "path";

dotenv.config({ 
  path: path.resolve(__dirname, "../.env")  // dist/client.js → packages/db/.env
});

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

console.log("DATABASE_URL:", process.env.DATABASE_URL);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

export const prismaClient = new PrismaClient({ adapter });