// Client-safe type exports only
// This file exports only types, no runtime code
// Use this for type-only imports in client components

import type { tickets } from './schema';

// Re-export the inferred type to avoid module evaluation
export type Ticket = typeof tickets.$inferSelect;

