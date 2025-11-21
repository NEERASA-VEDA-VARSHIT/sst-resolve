# Database Schema Reference

**Generated**: 2025-11-21  
**Purpose**: Reference for code audit to identify schema mismatches

## Key Schema Changes (Recent Refactoring)

### ❌ REMOVED FIELDS
These fields NO LONGER EXIST in the database:

1. **`users.name`** → Split into `users.first_name` and `users.last_name`
2. **`tickets.status`** → Replaced by `tickets.status_id` (FK to `ticket_statuses.id`)
3. **`tickets.category`** → Never existed, use `tickets.category_id`
4. **`tickets.subcategory`** → Never existed, use `tickets.subcategory_id`

### ✅ CURRENT SCHEMA

#### Users Table
```typescript
users {
  id: uuid (PK)
  clerk_id: varchar
  email: varchar
  phone: varchar
  first_name: varchar          // ← Use this instead of "name"
  last_name: varchar            // ← Use this instead of "name"
  avatar_url: varchar
  role_id: integer (FK → roles.id)
  user_type: enum (human|system|bot)
  primary_domain_id: integer (FK → domains.id)
  primary_scope_id: integer (FK → scopes.id)
  slack_user_id: varchar
  created_at: timestamp
  updated_at: timestamp
}
```

#### Tickets Table
```typescript
tickets {
  id: serial (PK)
  title: varchar
  description: text
  location: varchar
  status_id: integer (FK → ticket_statuses.id)  // ← Use this, NOT "status"
  category_id: integer (FK → categories.id)
  subcategory_id: integer (FK → subcategories.id)
  sub_subcategory_id: integer (FK → sub_subcategories.id)
  created_by: uuid (FK → users.id)
  assigned_to: uuid (FK → users.id)
  acknowledged_by: uuid (FK → users.id)
  group_id: integer (FK → ticket_groups.id)
  escalation_level: integer
  tat_extended_count: integer
  last_escalation_at: timestamp
  acknowledgement_tat_hours: integer
  resolution_tat_hours: integer
  acknowledgement_due_at: timestamp
  resolution_due_at: timestamp
  acknowledged_at: timestamp
  reopened_at: timestamp
  sla_breached_at: timestamp
  reopen_count: integer
  rating: integer (1-5)
  feedback_type: varchar
  rating_submitted: timestamp
  feedback: text
  is_public: boolean
  admin_link: varchar
  student_link: varchar
  slack_thread_id: varchar
  external_ref: varchar
  metadata: jsonb                               // ← Stores subcategory name, etc.
  created_at: timestamp
  updated_at: timestamp
  resolved_at: timestamp
}
```

#### Ticket Statuses Table (NEW)
```typescript
ticket_statuses {
  id: serial (PK)
  value: varchar (UNIQUE)                       // ← "OPEN", "IN_PROGRESS", etc.
  label: varchar                                // ← "Open", "In Progress", etc.
  description: text
  progress_percent: integer
  badge_color: varchar                          // ← "default", "secondary", etc.
  is_active: boolean
  is_final: boolean                             // ← Indicates resolved/closed states
  display_order: integer
  created_at: timestamp
  updated_at: timestamp
}
```

#### Roles Table
```typescript
roles {
  id: serial (PK)
  name: varchar (UNIQUE)                        // ← "student", "admin", "super_admin", "committee"
  description: text
  created_at: timestamp
}
```

#### Domains & Scopes
```typescript
domains {
  id: serial (PK)
  name: varchar (UNIQUE)                        // ← "Hostel", "College", etc.
  description: text
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}

scopes {
  id: serial (PK)
  domain_id: integer (FK → domains.id)
  name: varchar                                 // ← "Velankani", "Neeladri", etc.
  description: text
  is_active: boolean
  created_at: timestamp
  updated_at: timestamp
}
```

#### Students Table
```typescript
students {
  id: serial (PK)
  student_uid: uuid (UNIQUE)
  user_id: uuid (FK → users.id, UNIQUE)
  roll_no: varchar (UNIQUE)
  room_no: varchar
  hostel_id: integer (FK → hostels.id)
  class_section_id: integer (FK → class_sections.id)
  batch_id: integer (FK → batches.id)
  batch_year: integer
  department: varchar
  active: boolean
  source: varchar
  last_synced_at: timestamp
  tickets_this_week: integer
  last_ticket_date: timestamp
  created_at: timestamp
  updated_at: timestamp
}
```

#### Categories Table
```typescript
categories {
  id: serial (PK)
  name: varchar
  slug: varchar (UNIQUE)
  description: text
  icon: varchar
  color: varchar
  domain_id: integer (FK → domains.id)
  scope_id: integer (FK → scopes.id)
  default_admin_id: uuid (FK → users.id)
  committee_id: integer (FK → committees.id)
  parent_category_id: integer (FK → categories.id)
  sla_hours: integer
  active: boolean
  display_order: integer
  created_at: timestamp
  updated_at: timestamp
}
```

## Common Query Patterns

### ✅ CORRECT: Get ticket with status
```typescript
const ticket = await db
  .select({
    id: tickets.id,
    title: tickets.title,
    status_value: ticket_statuses.value,
    status_label: ticket_statuses.label,
  })
  .from(tickets)
  .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
  .where(eq(tickets.id, ticketId));
```

### ❌ WRONG: Selecting non-existent status field
```typescript
const ticket = await db
  .select({
    id: tickets.id,
    status: tickets.status,  // ← ERROR: field doesn't exist
  })
  .from(tickets);
```

### ✅ CORRECT: Get user with full name
```typescript
const user = await db
  .select({
    id: users.id,
    full_name: sql<string>`CONCAT(${users.first_name}, ' ', ${users.last_name})`,
    // OR construct in application code:
    first_name: users.first_name,
    last_name: users.last_name,
  })
  .from(users);
```

### ❌ WRONG: Selecting non-existent name field
```typescript
const user = await db
  .select({
    id: users.id,
    name: users.name,  // ← ERROR: field doesn't exist
  })
  .from(users);
```

## Audit Focus Areas

1. **Search for `tickets.status`** - Should be `ticket_statuses.value` with proper join
2. **Search for `users.name`** - Should be `users.first_name` and `users.last_name`
3. **Search for hardcoded status values** - Should reference `ticket_statuses` table
4. **Search for hardcoded user names** - Should use UUIDs or proper lookups
5. **Check all `.select()` statements** - Ensure all fields exist in schema
6. **Check status comparisons** - Ensure using `ticket_statuses.value` not enum
