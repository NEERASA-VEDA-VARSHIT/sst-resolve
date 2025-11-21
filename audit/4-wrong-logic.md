# Audit Report: Wrong Logic & Bugs

**Generated**: 2025-11-21  
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This report documents bugs, incorrect implementations, and logic errors that could cause runtime failures or incorrect behavior.

**Total Issues Found**: 6  
**Critical**: 3 | **High**: 2 | **Medium**: 1 | **Low**: 0

---

## 🔴 CRITICAL: Schema Mismatches Causing Runtime Errors

### 1. Metrics API - Non-Existent Field Access

**Impact**: API will fail with database errors  
**File**: `src/app/api/tickets/metrics/route.ts`  
**Lines**: 54-59, 107, 127, 137

**Bug**: Selecting and filtering on `tickets.status` which doesn't exist in schema

```typescript
// ❌ WILL FAIL
const statusCountsQuery = await db
  .select({
    status: tickets.status,  // ← Column doesn't exist
    count: sql<number>`COUNT(*)`,
  })
  .from(tickets)
  .where(inArray(tickets.status, statusList))  // ← Column doesn't exist
  .groupBy(tickets.status);  // ← Column doesn't exist
```

**Expected Error**: `column tickets.status does not exist`

**Fix**: Use `status_id` with join to `ticket_statuses` table (see `1-outdated-code.md`)

---

### 2. Auto-Escalate Cron - Field Name Mismatches

**Impact**: Auto-escalation will fail or use wrong data  
**File**: `src/app/api/cron/auto-escalate/route.ts`  
**Lines**: 35-38, 50, 109, 118, 124-126, 148

**Bug 1**: Accessing non-existent `tickets.status` field
```typescript
// ❌ WRONG - Lines 35-38
.where(
  and(
    or(
      ne(tickets.status, "closed"),  // ← Doesn't exist
      isNull(tickets.status)
    ),
    ne(tickets.status, "resolved")  // ← Doesn't exist
  )
)
```

**Bug 2**: Using camelCase field names instead of snake_case
```typescript
// ❌ POTENTIALLY WRONG
const lastUpdate = ticket.updatedAt || ticket.createdAt;  // Line 50
const lastEscalation = ticket.escalatedAt;  // Line 109
const currentEscalationCount = parseInt(ticket.escalationCount || "0", 10);  // Line 118
```

**Schema Uses**: `updated_at`, `created_at`, `last_escalation_at`, `escalation_level`

**Fix**: 
1. Use `status_id` with join
2. Use correct snake_case field names from schema

---

### 3. TAT Reminders Cron - Non-Existent Field

**Impact**: TAT reminders won't work correctly  
**File**: `src/app/api/cron/tat-reminders/route.ts`  
**Line**: 60

**Bug**: Filtering on non-existent `tickets.status`

```typescript
// ❌ WRONG
ne(tickets.status, "RESOLVED")
```

**Fix**: Use `status_id` with join to `ticket_statuses`

---

## 🟠 HIGH: Incorrect Status Handling

### 4. Hardcoded Status String Comparisons

**Impact**: Breaks if status values in database don't match exactly  
**Files Affected**: Multiple

**Bug**: Code assumes status values match hardcoded strings, but:
- Database uses `ticket_statuses` table with `value` column
- No validation that constants match database values
- Case sensitivity issues ("RESOLVED" vs "resolved", "closed" vs "CLOSED")

**Examples**:
```typescript
// src/app/api/tickets/metrics/route.ts:107
.where(eq(tickets.status, "REOPENED"))  // ← Assumes exact match

// src/app/api/cron/auto-escalate/route.ts:35
ne(tickets.status, "closed")  // ← Lowercase, but constants use UPPERCASE

// src/app/api/cron/auto-escalate/route.ts:38
ne(tickets.status, "resolved")  // ← Lowercase variant
```

**Fix**: 
1. Fetch status IDs from database
2. Use `TICKET_STATUS` constants consistently
3. Add validation that constants match database

---

### 5. Status Update Without Validation

**Impact**: Could set invalid status values  
**File**: `src/app/api/cron/auto-escalate/route.ts`  
**Line**: 148

**Bug**: Directly setting status to constant without verifying it exists in database

```typescript
// ❌ POTENTIALLY WRONG
status: TICKET_STATUS.ESCALATED,  // What if this value doesn't exist in ticket_statuses?
```

**Fix**: Look up status ID from `ticket_statuses` table before setting

---

## 🟡 MEDIUM: Missing Auth Check in Metrics

### 6. Incomplete Authentication Logic

**Impact**: Metrics endpoint might be accessible without proper auth  
**File**: `src/app/api/tickets/metrics/route.ts`  
**Lines**: 28-34

**Bug**: Auth check is incomplete/malformed

```typescript
// ❌ INCOMPLETE - Line 28-34
const { userId } = await auth();
    );  // ← Syntax error? Orphaned closing paren
}
```

**Issue**: The code appears to have a syntax error or missing logic between auth check and the next section

**Fix**: Verify auth logic is complete:
```typescript
const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

const role = await getUserRoleFromDB(userId);
if (role !== "admin" && role !== "super_admin") {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
```

---

## Summary of Required Fixes

### Immediate (Critical)
1. ✅ Fix `tickets.status` references in `/api/tickets/metrics/route.ts`
2. ✅ Fix `tickets.status` references in `/api/cron/auto-escalate/route.ts`
3. ✅ Fix field name casing in `/api/cron/auto-escalate/route.ts`
4. ✅ Fix `tickets.status` reference in `/api/cron/tat-reminders/route.ts`

### High Priority
5. ✅ Implement status value validation against database
6. ✅ Use status IDs instead of string comparisons
7. ✅ Standardize status value casing

### Medium Priority
8. ✅ Complete auth logic in metrics endpoint
9. ✅ Add role-based access control to metrics

---

## Root Cause Analysis

**Primary Issue**: Schema refactoring from `tickets.status` (string) to `tickets.status_id` (FK) was not completed across all files

**Contributing Factors**:
1. No TypeScript type checking for Drizzle queries
2. No integration tests catching these errors
3. Commented code left in place causing confusion

**Prevention**:
1. Enable strict TypeScript checking for database queries
2. Add integration tests for all API routes
3. Remove commented code immediately after refactoring
4. Use database migrations with validation

---

## Testing Recommendations

After fixes:
1. **Unit Tests**: Test each fixed endpoint with mocked database
2. **Integration Tests**: Test with real database queries
3. **E2E Tests**: Test full workflows (create ticket → escalate → resolve)
4. **Load Tests**: Verify metrics endpoint performance
5. **Cron Tests**: Manually trigger cron jobs and verify behavior
