// Server-only database connection
// This file should NEVER be imported in client components
// import 'server-only'; // Commented out due to Turbopack build issues - serverExternalPackages in next.config.ts handles this
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString, { ssl: 'require' });

export const db = drizzle(client, { schema });

// Re-export schema and types for server components
// WARNING: Client components must use '@/db/schema-only' instead
export * from './schema';
export * from './types';
