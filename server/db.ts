import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv"
import fs from 'fs';

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Decide SSL usage
const isProduction = process.env.NODE_ENV === 'production';
const sslForced = process.env.POSTGRES_SSL === 'true';
const shouldUseSSL = isProduction || sslForced;

let sslConfig: any = false;

if (shouldUseSSL) {
  try {
    const caCertPath = './ca-certificate.crt';
    if (fs.existsSync(caCertPath)) {
      sslConfig = {
        ca: fs.readFileSync(caCertPath).toString(),
        rejectUnauthorized: true,
      };
    } else {
      sslConfig = { rejectUnauthorized: false };
    }
  } catch {
    sslConfig = { rejectUnauthorized: false };
  }
}

// ✅ Optimized pool config
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,

  // Reduce max clients to avoid too many DB connections
  max: parseInt(process.env.PGPOOL_MAX || '10', 10),

  // Keep connections alive longer (5 min)
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '300000', 10),

  // Reasonable connection timeout
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),

  allowExitOnIdle: true,
};

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle client:', err);
  process.exit(-1);
});

// 🔇 Only log connections in development
if (process.env.NODE_ENV !== 'production') {
  pool.on('connect', () => {
    console.log('✅ New database connection established successfully');
  });
}

export const db = drizzle(pool, { schema });

export const closeDatabase = async (): Promise<void> => {
  try {
    console.log('Closing database connection pool...');
    await pool.end();
    console.log('✅ Database connection pool closed successfully');
  } catch (error) {
    console.error('❌ Error closing database pool:', error);
    throw error;
  }
};
