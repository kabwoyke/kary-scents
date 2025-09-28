import { Pool, PoolConfig } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import dotenv from "dotenv"

dotenv.config()

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Determine if SSL should be enabled
const isProduction = process.env.NODE_ENV === 'production';
const sslForced = process.env.POSTGRES_SSL === 'true';
const shouldUseSSL = isProduction || sslForced;

// Configure connection pool with environment variables
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL,
  
  // SSL Configuration (corrected for DigitalOcean)
  ssl: shouldUseSSL
    ? {
        rejectUnauthorized: false
      }
    : false,
  
  max: parseInt(process.env.PGPOOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),
  allowExitOnIdle: true,
};

// Log configuration in development
if (process.env.NODE_ENV !== 'production') {
  console.log('PostgreSQL Pool Configuration:', {
    ssl: shouldUseSSL,
    max: poolConfig.max,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  });
}

export const pool = new Pool(poolConfig);

// Add error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Add connection success logging
pool.on('connect', (client) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('New database connection established');
  }
});

export const db = drizzle(pool, { schema });

// Graceful shutdown function
export const closeDatabase = async (): Promise<void> => {
  try {
    await pool.end();
    console.log('Database connection pool closed');
  } catch (error) {
    console.error('Error closing database pool:', error);
    throw error;
  }
};