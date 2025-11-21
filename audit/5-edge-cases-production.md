# Audit Report: Edge Cases & Production Readiness

**Generated**: 2025-11-21  
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This report identifies production readiness gaps, missing error handling, security concerns, and edge cases that could cause issues in production.

**Total Issues Found**: 12  
**Critical**: 3 | **High**: 5 | **Medium**: 3 | **Low**: 1

---

## 🔴 CRITICAL: Security & Data Integrity

### 1. Direct Environment Variable Access (Bypasses Validation)

**Impact**: Missing env vars won't be caught until runtime in production  
**Files Affected**: 7 API routes

**Issue**: API routes access `process.env` directly instead of using validated config

**Locations**:
- `src/app/api/webhooks/clerk/route.ts:45` - `CLERK_WEBHOOK_SECRET`
- `src/app/api/tickets/[id]/route.ts:441` - `SLACK_WEBHOOK_URL`
- `src/app/api/slack/thread/[threadId]/route.ts:5` - `SLACK_BOT_TOKEN`
- `src/app/api/cron/tat-reminders/route.ts:24` - `CRON_SECRET`
- `src/app/api/cron/remind-spocs/route.ts:16` - `CRON_SECRET`
- `src/app/api/cron/process-outbox/route.ts:15` - `CRON_SECRET`

**Risk**: Production deployment could fail silently or expose undefined behavior

**Fix**: Use centralized config with startup validation
```typescript
// ✅ CORRECT
import { clerkConfig, cronConfig } from "@/conf/config";

// Add to config.ts:
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'CRON_SECRET',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
```

---

### 2. No Input Validation on Critical Endpoints

**Impact**: SQL injection, XSS, or data corruption  
**Files Affected**: Multiple

**Missing Validation**:
1. **Ticket ID validation**: Some routes parse `parseInt(id)` without checking `isNaN`
2. **User input sanitization**: No HTML/script tag stripping in ticket descriptions
3. **File upload validation**: No MIME type or size checks visible
4. **Email validation**: No validation before sending emails

**Example Risk**:
```typescript
// ❌ VULNERABLE
const ticketId = parseInt(params.id);  // What if params.id is "abc"?
// Later: WHERE tickets.id = NaN → SQL error or wrong results
```

**Fix**: Use Zod schemas for all inputs
```typescript
// ✅ SAFE
const ParamsSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const parsed = ParamsSchema.safeParse(params);
if (!parsed.success) {
  return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
}
```

---

### 3. Hardcoded User Names for Assignment (Data Integrity Risk)

**Impact**: Assignment/escalation will fail, tickets unassigned  
**File**: `src/conf/constants.ts`  
**Lines**: 157-184

**Issue**: `DEFAULT_ASSIGNMENT` and `DEFAULT_ESCALATION` use string names that don't match database schema

**Risk**:
- Names won't match UUIDs in database
- Case sensitivity issues
- Users could be deleted/renamed
- No validation that users exist

**Fix**: See `2-hardcoded-values.md` for detailed recommendations

---

## 🟠 HIGH: Missing Error Handling

### 4. No Database Transaction Rollback Handling

**Impact**: Partial updates could leave data in inconsistent state  
**Files Affected**: Multiple routes using transactions

**Issue**: Many routes use `db.transaction()` but don't handle rollback scenarios

**Example**:
```typescript
// ❌ INCOMPLETE
const updatedTicket = await db.transaction(async (tx) => {
  const [t] = await tx.update(tickets).set({...}).returning();
  await tx.insert(outbox).values({...});  // What if this fails?
  return t;
});
```

**Fix**: Add explicit error handling
```typescript
// ✅ BETTER
try {
  const updatedTicket = await db.transaction(async (tx) => {
    const [t] = await tx.update(tickets).set({...}).returning();
    if (!t) throw new Error("Ticket update failed");
    
    await tx.insert(outbox).values({...});
    return t;
  });
} catch (error) {
  console.error("Transaction failed, rolled back:", error);
  return NextResponse.json({ error: "Update failed" }, { status: 500 });
}
```

---

### 5. Missing Null Checks on Database Queries

**Impact**: Runtime errors when data doesn't exist  
**Files Affected**: Multiple

**Pattern**:
```typescript
// ❌ UNSAFE
const [ticket] = await db.select().from(tickets).where(...).limit(1);
const categoryName = ticket.category_id;  // What if ticket is undefined?
```

**Fix**: Always check for null/undefined
```typescript
// ✅ SAFE
const [ticket] = await db.select().from(tickets).where(...).limit(1);
if (!ticket) {
  return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
}
```

---

### 6. No Rate Limiting on Public Endpoints

**Impact**: DDoS vulnerability, resource exhaustion  
**Files Affected**: All API routes

**Issue**: No rate limiting visible in code

**Fix**: Implement rate limiting middleware
```typescript
// Example with upstash/ratelimit
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  
  // ... rest of handler
}
```

---

### 7. Unhandled Promise Rejections in Slack/Email

**Impact**: Silent failures, users not notified  
**Files Affected**: Multiple routes sending notifications

**Pattern**:
```typescript
// ❌ FIRE AND FORGET
try {
  await sendEmail({...});
  console.log("Email sent");
} catch (error) {
  console.error("Email failed:", error);
  // ← No retry, no fallback, no user notification
}
```

**Fix**: Use outbox pattern (already implemented in some routes)
```typescript
// ✅ RELIABLE
await db.insert(outbox).values({
  event_type: "email.send",
  payload: { to, subject, html },
});
// Worker will retry on failure
```

---

### 8. No Timeout on External API Calls

**Impact**: Hanging requests, resource exhaustion  
**Files Affected**: Slack, Email, Clerk API calls

**Issue**: No timeout configuration visible

**Fix**: Add timeouts
```typescript
// ✅ WITH TIMEOUT
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  await fetch(url, { signal: controller.signal });
} catch (error) {
  if (error.name === 'AbortError') {
    console.error("Request timed out");
  }
} finally {
  clearTimeout(timeout);
}
```

---

## 🟡 MEDIUM: Data Consistency

### 9. No Optimistic Locking for Concurrent Updates

**Impact**: Lost updates in race conditions  
**Example**: Two admins update same ticket simultaneously

**Fix**: Add version field or use database-level locking
```typescript
// ✅ WITH OPTIMISTIC LOCKING
const [updated] = await db
  .update(tickets)
  .set({ status_id: newStatus, version: sql`version + 1` })
  .where(and(
    eq(tickets.id, ticketId),
    eq(tickets.version, currentVersion)  // Only update if version matches
  ))
  .returning();

if (!updated) {
  return NextResponse.json({ 
    error: "Ticket was modified by another user" 
  }, { status: 409 });
}
```

---

### 10. Missing Cascade Delete Handling

**Impact**: Orphaned records when users/tickets deleted  
**Schema**: Foreign keys exist but cascade behavior unclear

**Recommendation**: Verify cascade delete rules in schema:
```typescript
// Ensure proper cascade rules
created_by: uuid("created_by")
  .references(() => users.id, { onDelete: "set null" })  // ✅ Good
  .notNull(),

// vs

created_by: uuid("created_by")
  .references(() => users.id)  // ❌ What happens on delete?
  .notNull(),
```

---

### 11. No Idempotency Keys for Critical Operations

**Impact**: Duplicate tickets/comments on retry  
**Files Affected**: POST endpoints

**Fix**: Use idempotency keys
```typescript
// ✅ IDEMPOTENT
const idempotencyKey = request.headers.get("idempotency-key");
if (idempotencyKey) {
  const existing = await db
    .select()
    .from(tickets)
    .where(eq(tickets.idempotency_key, idempotencyKey))
    .limit(1);
  
  if (existing[0]) {
    return NextResponse.json(existing[0], { status: 200 });
  }
}
```

---

## 🟢 LOW: Observability

### 12. Excessive Console.log Statements

**Impact**: Log noise, potential performance impact  
**Files Affected**: 200+ console.log statements found

**Recommendation**: Use structured logging
```typescript
// ❌ NOISY
console.log("Email sent to", email);
console.error("Error:", error);

// ✅ STRUCTURED
logger.info("email_sent", { recipient: email, ticket_id: ticketId });
logger.error("email_failed", { error: error.message, ticket_id: ticketId });
```

---

## Summary of Required Actions

### Immediate (Critical)
1. ✅ Centralize env var access and add startup validation
2. ✅ Add input validation (Zod schemas) to all endpoints
3. ✅ Fix hardcoded user name assignments

### High Priority
4. ✅ Add transaction error handling
5. ✅ Add null checks on all database queries
6. ✅ Implement rate limiting
7. ✅ Add timeouts to external API calls
8. ✅ Use outbox pattern for all notifications

### Medium Priority
9. ✅ Implement optimistic locking for concurrent updates
10. ✅ Verify cascade delete rules in schema
11. ✅ Add idempotency keys to POST endpoints

### Low Priority
12. ✅ Replace console.log with structured logging

---

## Production Readiness Checklist

### Security
- [ ] All environment variables validated at startup
- [ ] Input validation on all endpoints (Zod schemas)
- [ ] Rate limiting implemented
- [ ] CORS configured correctly
- [ ] Authentication on all protected routes
- [ ] Authorization checks for role-based access

### Reliability
- [ ] Database transactions with error handling
- [ ] Null checks on all queries
- [ ] Timeouts on external API calls
- [ ] Retry logic for critical operations
- [ ] Circuit breakers for external services

### Data Integrity
- [ ] Optimistic locking for concurrent updates
- [ ] Cascade delete rules verified
- [ ] Idempotency keys for critical operations
- [ ] Foreign key constraints enforced

### Observability
- [ ] Structured logging implemented
- [ ] Error tracking (e.g., Sentry)
- [ ] Performance monitoring (e.g., New Relic)
- [ ] Health check endpoint
- [ ] Metrics endpoint for monitoring

### Testing
- [ ] Unit tests for business logic
- [ ] Integration tests for API routes
- [ ] E2E tests for critical workflows
- [ ] Load tests for performance
- [ ] Security tests (OWASP Top 10)

---

## Testing Recommendations

1. **Load Testing**: Test with 1000+ concurrent users
2. **Chaos Engineering**: Simulate database failures, network issues
3. **Security Audit**: Run OWASP ZAP or similar tools
4. **Penetration Testing**: Hire security firm for audit
5. **Disaster Recovery**: Test backup/restore procedures
