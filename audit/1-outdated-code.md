# Audit Report: Outdated Code

**Generated**: 2025-11-21  
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This report documents code patterns that are outdated or conflict with recent schema changes, particularly the `first_name`/`last_name` refactoring and the new `ticket_statuses` table implementation.

**Total Issues Found**: 14  
**Critical**: 11 | **High**: 2 | **Medium**: 1 | **Low**: 0

---

## 🔴 CRITICAL: Schema Field Mismatches

### 1. `tickets.status` References (Should use `status_id` + join)

**Impact**: Runtime errors, incorrect data queries  
**Files Affected**: 3

#### `src/app/api/tickets/metrics/route.ts`
**Lines**: 54, 58, 59, 107, 127, 137  
**Issue**: Directly selecting and filtering on `tickets.status` which no longer exists

```typescript
// ❌ WRONG - Line 54-59
const statusCountsQuery = await db
  .select({
    status: tickets.status,  // ← Field doesn't exist
    count: sql<number>`COUNT(*)`,
  })
  .from(tickets)
  .where(inArray(tickets.status, statusList))  // ← Field doesn't exist
  .groupBy(tickets.status);  // ← Field doesn't exist
```

**Recommended Fix**:
```typescript
// ✅ CORRECT
import { ticket_statuses } from "@/db/schema";

const statusCountsQuery = await db
  .select({
    status: ticket_statuses.value,
    count: sql<number>`COUNT(*)`,
  })
  .from(tickets)
  .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
  .where(inArray(ticket_statuses.value, statusList))
  .groupBy(ticket_statuses.value);
```

**Additional Occurrences**:
- Line 107: `.where(eq(tickets.status, "REOPENED"))`
- Line 127: `.where(and(eq(tickets.status, "RESOLVED"), ...))`
- Line 137: `.where(and(eq(tickets.status, "ESCALATED"), ...))`

---

#### `src/app/api/cron/tat-reminders/route.ts`
**Line**: 60  
**Issue**: Filtering on non-existent `tickets.status`

```typescript
// ❌ WRONG - Line 60
ne(tickets.status, "RESOLVED")
```

**Recommended Fix**:
```typescript
// ✅ CORRECT
import { ticket_statuses } from "@/db/schema";

// In query:
.leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
.where(ne(ticket_statuses.value, "RESOLVED"))
```

---

#### `src/app/api/cron/auto-escalate/route.ts`
**Lines**: 35, 36, 38, 148  
**Issue**: Multiple references to non-existent `tickets.status`

```typescript
// ❌ WRONG - Lines 35-38
.where(
  and(
    or(
      ne(tickets.status, "closed"),
      isNull(tickets.status)
    ),
    ne(tickets.status, "resolved")
  )
)

// ❌ WRONG - Line 148
status: TICKET_STATUS.ESCALATED,  // Setting status directly
```

**Recommended Fix**:
```typescript
// ✅ CORRECT
import { ticket_statuses } from "@/db/schema";
import { getStatusIdByValue } from "@/lib/status/getTicketStatuses";

// In query:
.leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
.where(
  and(
    ne(ticket_statuses.value, "CLOSED"),
    ne(ticket_statuses.value, "RESOLVED")
  )
)

// For updates:
const escalatedStatusId = await getStatusIdByValue("ESCALATED");
const updateData: any = {
  status_id: escalatedStatusId,
  // ... other fields
};
```

---

### 2. `tickets.category` and `tickets.subcategory` References

**Impact**: These fields never existed in the schema  
**Files Affected**: 1

#### `src/app/api/tickets/[id]/escalate/route.ts`
**Lines**: 44-45 (commented out)  
**Issue**: Commented code references non-existent fields

```typescript
// ❌ WRONG - Lines 44-45 (commented)
// category: tickets.category,
// subcategory: tickets.subcategory,
```

**Recommended Action**: Remove commented code or update to use `category_id` with proper join

---

### 3. `users.name` Reference

**Impact**: Field no longer exists, should use `first_name` + `last_name`  
**Files Affected**: 1

#### `src/app/api/tickets/route.ts`
**Line**: 518 (commented out)  
**Issue**: Commented code references removed field

```typescript
// ❌ WRONG - Line 518 (commented)
// name: users.name,
```

**Recommended Action**: Remove commented code entirely

---

## 🟠 HIGH: Hardcoded Status Values

### 4. Direct Status String Comparisons

**Impact**: Fragile code that breaks if status values change in database  
**Files Affected**: 3

#### Multiple Files Using Hardcoded Status Strings

**Issue**: Code uses hardcoded strings like `"RESOLVED"`, `"ESCALATED"`, `"REOPENED"` instead of fetching from `ticket_statuses` table

**Locations**:
- `src/app/api/tickets/metrics/route.ts`: Lines 43-50 (statusList array)
- `src/app/api/cron/tat-reminders/route.ts`: Line 60
- `src/app/api/cron/auto-escalate/route.ts`: Lines 35, 38, 148

**Recommended Fix**:
```typescript
// ✅ BETTER: Use constants from config
import { TICKET_STATUS } from "@/conf/constants";

// ✅ BEST: Fetch active statuses from database
import { getAllTicketStatuses } from "@/lib/status/getTicketStatuses";

const activeStatuses = await getAllTicketStatuses();
const statusList = activeStatuses
  .filter(s => s.is_active)
  .map(s => s.value);
```

---

## 🟡 MEDIUM: Deprecated Field References in Auto-Escalate

### 5. Legacy Field Usage

**Impact**: Code relies on old field names that may not exist  
**Files Affected**: 1

#### `src/app/api/cron/auto-escalate/route.ts`
**Lines**: 50, 109, 118, 124-126, 160  
**Issue**: Uses camelCase field names instead of snake_case

```typescript
// ❌ POTENTIALLY WRONG
const lastUpdate = ticket.updatedAt || ticket.createdAt;  // Line 50
const lastEscalation = ticket.escalatedAt;  // Line 109
const currentEscalationCount = parseInt(ticket.escalationCount || "0", 10);  // Line 118
ticket.category || "College"  // Line 124
ticket.location || null  // Line 125
```

**Recommended Fix**: Verify field names match schema exactly:
- `updatedAt` → `updated_at`
- `createdAt` → `created_at`
- `escalatedAt` → `last_escalation_at`
- `escalationCount` → `escalation_level`

---

## Summary of Required Actions

### Immediate (Critical)
1. ✅ Fix all `tickets.status` references in `/api/tickets/metrics/route.ts`
2. ✅ Fix `tickets.status` reference in `/api/cron/tat-reminders/route.ts`
3. ✅ Fix `tickets.status` references in `/api/cron/auto-escalate/route.ts`
4. ✅ Remove commented `tickets.category`/`tickets.subcategory` code
5. ✅ Remove commented `users.name` code

### High Priority
6. ✅ Replace hardcoded status strings with database-driven approach
7. ✅ Verify field name casing in auto-escalate worker

### Cleanup
8. ✅ Remove all commented-out outdated code

---

## Testing Recommendations

After fixes:
1. Test `/api/tickets/metrics` endpoint
2. Test TAT reminders cron job
3. Test auto-escalation cron job
4. Verify all status-based queries return correct results
5. Check analytics dashboards for data accuracy
