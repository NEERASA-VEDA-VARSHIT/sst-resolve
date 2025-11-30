# Database Module Structure

This directory contains the database schema, types, and connection logic.

## Files

### Core Files (Required)

1. **`schema.ts`** - Main Drizzle ORM schema definition
   - Defines all database tables, columns, relationships
   - Source of truth for database structure
   - Server-only (imports drizzle-orm)

2. **`index.ts`** - Server-only database connection
   - Exports `db` connection instance
   - Re-exports schema and types for server components
   - **Never import this in client components!**

3. **`inferred-types.ts`** - Drizzle-inferred types + metadata
   - All `*Select` and `*Insert` types from schema (auto-generated)
   - `TicketMetadata` interface (JSONB structure)
   - `parseTicketMetadata()` utility function
   - Server-only (imports from schema)

4. **`types-only.ts`** - Client-safe type definitions
   - `Ticket` interface (used in client components)
   - `StudentProfile` interface
   - `Hostel` interface
   - `TicketMetadata` interface (duplicate for client components)
   - **Use this in client components** (no server dependencies)

## Usage

### Server Components / API Routes
```typescript
import { db, tickets, users } from '@/db';
import type { TicketMetadata, TicketInsert } from '@/db/inferred-types';
```

### Client Components
```typescript
import type { Ticket, StudentProfile, TicketMetadata } from '@/db/types-only';
```

## Why 4 Files?

- **Separation of concerns**: Server vs client code
- **Type safety**: Different type needs for different contexts
- **Bundle size**: Client components don't need server dependencies
- **Auto-inference**: Drizzle types stay in sync with schema automatically
- **Consolidation**: `types.ts` merged into `inferred-types.ts` (both server-only)
