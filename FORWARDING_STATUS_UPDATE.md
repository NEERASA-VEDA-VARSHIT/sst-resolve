# Forwarding Feature - Status Update

## Changes Implemented

### 1. Added FORWARDED Status
- **Constants** (`src/conf/constants.ts`):
  - Added `FORWARDED: "FORWARDED"` to `TICKET_STATUS`
  - Added display name: `"Forwarded"`
  - Added badge variant: `"outline"`

- **Database Schema** (`src/db/schema.ts`):
  - Added `"FORWARDED"` to `ticketStatus` enum
  - **Migration Required**: Run `pnpm drizzle-kit generate` and `pnpm drizzle-kit push` to update database

### 2. Forward API Updates
- **File**: `src/app/api/tickets/[id]/forward/route.ts`
- Now sets `status` to `FORWARDED` when forwarding tickets
- Creates outbox event for notifications

### 3. UI Components
- **AdminActions** component already has Forward button
- Forward button appears for all non-resolved tickets
- Separate from Escalate button

## Database Migration Required

⚠️ **IMPORTANT**: You need to run a database migration to add the FORWARDED status to the enum:

```bash
# Generate migration
pnpm drizzle-kit generate

# Apply migration
pnpm drizzle-kit push
```

Or manually run this SQL:

```sql
ALTER TYPE ticket_status ADD VALUE 'FORWARDED';
```

## How Forwarded Tickets Appear

### For Admins:
- Forwarded tickets will show status badge "Forwarded" (outline variant)
- Will appear in their ticket list with FORWARDED status

### For Super Admins:
- Forwarded tickets will appear in their dashboard
- Can filter by FORWARDED status
- Shows in analytics

## Status Flow

```
OPEN → IN_PROGRESS → FORWARDED (new level admin)
                   → ESCALATED (urgent)
                   → AWAITING_STUDENT
                   → RESOLVED
```

## Next Steps

1. Run database migration (see above)
2. Test forwarding functionality
3. Verify forwarded tickets appear in super admin dashboard
4. Add FORWARDED to status filters if needed
