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

// Debug logging
console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('POSTGRES_SSL:', process.env.POSTGRES_SSL);
console.log('DATABASE_URL (masked):', process.env.DATABASE_URL ? 'Set' : 'Not Set');

// Determine if SSL should be enabled
const isProduction = process.env.NODE_ENV === 'production';
const sslForced = process.env.POSTGRES_SSL === 'true';
const shouldUseSSL = isProduction || sslForced;

console.log('SSL Configuration:');
console.log('isProduction:', isProduction);
console.log('sslForced:', sslForced);
console.log('shouldUseSSL:', shouldUseSSL);

// Handle DigitalOcean connection string with SSL parameters
let connectionString = process.env.DATABASE_URL;

// Configure connection pool with environment variables
const poolConfig: PoolConfig = {
  connectionString: connectionString,
  
  // SSL Configuration - always enable for DigitalOcean managed databases
  // Since connection string has sslmode=require, we must configure SSL
  ssl: {
    rejectUnauthorized: false, // Required for DigitalOcean managed PostgreSQL
    sslmode: 'require'
  },
  
  // Configurable connection pool settings
  max: parseInt(process.env.PGPOOL_MAX || '20', 10), // Maximum number of clients in the pool
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10), // Close idle clients after timeout
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10), // Connection timeout
  
  // Additional production optimizations
  allowExitOnIdle: true, // Allow the process to exit when all clients are idle
};

// Enhanced logging
console.log('Final Pool Configuration:');
console.log('- SSL enabled:', !!poolConfig.ssl);
console.log('- SSL config:', poolConfig.ssl);
console.log('- Max connections:', poolConfig.max);
console.log('- Idle timeout:', poolConfig.idleTimeoutMillis);
console.log('- Connection timeout:', poolConfig.connectionTimeoutMillis);

export const pool = new Pool(poolConfig);

// Enhanced error handling for the pool
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client:', err.message);
  console.error('Error code:', err.code);
  console.error('Full error:', err);
  process.exit(-1);
});

// Add connection success logging
pool.on('connect', (client) => {
  console.log('✅ New database connection established successfully');
  if (process.env.NODE_ENV !== 'production') {
    console.log('Connection details available in development mode');
  }
});

export const db = drizzle(pool, { schema });

// Graceful shutdown function
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
