// Client-safe exports - schema and types only (no database connection)
// Use this file in client components that only need type definitions
// This file must NOT import from @/db/index.ts or any server-only modules

// Direct imports to avoid any potential circular dependencies
export * from './schema';
export * from './types';

