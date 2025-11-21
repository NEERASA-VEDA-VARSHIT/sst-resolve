# 🚨 Breaking Changes Log & Fix Guide

This document tracks specific files and fields broken by the schema migration and how to fix them.

## 1. Database Seeding (Required First)

**Action:** Run these 3 SQL files in Neon SQL Editor:
1. `migrations/seed_roles.sql`
2. `migrations/seed_ticket_statuses.sql`
3. `migrations/seed_domains_scopes.sql`

---

## 2. Broken Files & Fixes

### ❌ `src/app/api/slack/interactions/route.ts`

**Errors:**
- `Property 'details' does not exist`
- `Property 'category' does not exist`
- `Property 'userNumber' does not exist`
- `Property 'status' does not exist` (should be `status_id`)

**Fix Strategy:**
1. **Join Tables:** Update queries to join `categories`, `ticket_statuses`, and `users`.
2. **Map Fields:**
   - `ticket.status` → `ticket_status.label` (via join)
   - `ticket.category` → `category.name` (via join)
   - `ticket.userNumber` → Remove or replace with `ticket.id`
   - `ticket.details` → Remove (field deleted)

### ❌ `src/app/api/tickets/[id]/route.ts`

**Errors:**
- `assigned_to` type mismatch (Integer vs UUID)
- `status` field missing

**Fix Strategy:**
- Update `assigned_to` to accept UUID string.
- Return `status_id` and join `ticket_statuses` to return status details object.

### ❌ Dashboard Pages (Admin/Committee/SuperAdmin)

**Files:**
- `src/app/(app)/admin/dashboard/ticket/[ticketId]/page.tsx`
- `src/app/(app)/committee/dashboard/ticket/[ticketId]/page.tsx`
- `src/app/(app)/superadmin/dashboard/ticket/[ticketId]/page.tsx`

**Errors:**
- Synchronous usage of `enumToStatus(ticket.status)`
- `ticket.staff` references

**Fix Strategy:**
- Update `getTicket` queries to join `ticket_statuses` and `users`.
- Pass full status object to `TicketStatusBadge`.
- Replace `ticket.staff` with `ticket.assignedUser`.

---

## 3. Schema Field Mappings

| Old Field | New Field / Path | Notes |
|-----------|------------------|-------|
| `ticket.status` (enum) | `ticket.status_id` | Join `ticket_statuses` table |
| `ticket.assigned_to` (int) | `ticket.assigned_to` (uuid) | Join `users` table |
| `staff.full_name` | `users.first_name` + `users.last_name` | |
| `staff.domain` | `domains.name` | Join `domains` via `users.primary_domain_id` |
| `ticket.attachments` (jsonb) | `ticket_attachments` table | Query separate table |

## 4. Next Steps

1. **Run Seed Files** (User Action)
2. **Fix Slack Interaction API** (High Priority)
3. **Fix Ticket Detail Pages** (High Priority)
