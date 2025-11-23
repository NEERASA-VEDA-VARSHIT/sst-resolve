# Production Readiness Roadmap

**Project**: SST-Resolve Ticket Management System  
**Generated**: 2025-11-23  
**Status**: Pre-Production Audit Complete

---

## 📋 Executive Summary

This document consolidates findings from comprehensive code audits and provides a prioritized roadmap to make the SST-Resolve project production-ready. The system currently has **48 identified issues** across 5 categories that must be addressed before deployment.

### Issue Breakdown by Severity

| Severity | Count | Category |
|----------|-------|----------|
| 🔴 Critical | 19 | Security, Data Integrity, Schema Mismatches |
| 🟠 High | 12 | Error Handling, Hardcoded Values |
| 🟡 Medium | 7 | Data Consistency, Configuration |
| 🟢 Low | 2 | Observability, Code Quality |
| 🔧 Build | 8 | TypeScript, Build Configuration |

---

## 🎯 Production Deployment Blockers

These issues **MUST** be resolved before production deployment:

### 1. Schema Field Mismatches (🔴 Critical)

**Impact**: Runtime database errors, application crashes  
**Affected Files**: 3 API routes, 2 cron jobs

#### Issues

- `tickets.status` field no longer exists (replaced with `status_id` FK)
- Multiple queries still reference the old field
- Hardcoded status string comparisons instead of using `ticket_statuses` table

#### Files to Fix

1. [`src/app/api/tickets/metrics/route.ts`](file:///c:/Users/INFINIX/Desktop/sst/sst-resolve/src/app/api/tickets/metrics/route.ts) - Lines 54, 58, 59, 107, 127, 137
2. [`src/app/api/cron/tat-reminders/route.ts`](file:///c:/Users/INFINIX/Desktop/sst/sst-resolve/src/app/api/cron/tat-reminders/route.ts) - Line 60
3. [`src/app/api/cron/auto-escalate/route.ts`](file:///c:/Users/INFINIX/Desktop/sst/sst-resolve/src/app/api/cron/auto-escalate/route.ts) - Lines 35, 36, 38, 148

#### Fix Pattern

```typescript
// ❌ WRONG - Will cause database errors
const tickets = await db
  .select({ status: tickets.status })
  .from(tickets)
  .where(eq(tickets.status, "RESOLVED"));

// ✅ CORRECT - Use status_id with join
import { ticket_statuses } from "@/db/schema";

const tickets = await db
  .select({ 
    status: ticket_statuses.value,
    statusId: tickets.status_id 
  })
  .from(tickets)
  .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
  .where(eq(ticket_statuses.value, "RESOLVED"));
```

---

### 2. Hardcoded User Names for Assignment (🔴 Critical)

**Impact**: Assignment and escalation logic will fail completely  
**File**: [`src/conf/constants.ts`](file:///c:/Users/INFINIX/Desktop/sst/sst-resolve/src/conf/constants.ts) - Lines 157-184

#### Problem

```typescript
// ❌ CRITICAL ISSUE - Lines 157-159
export const DEFAULT_ASSIGNMENT: Record<string, string[]> = {
    "Hostel:Velankani": ["azad", "sunil", "minakshi"],
    "Hostel:Neeladri": ["vinay", "Surendra"],
    College: ["angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
};
```

**Why This Fails**:
- Uses string names instead of UUIDs (users table uses UUID primary keys)
- Names don't match database schema (DB has `first_name` + `last_name`)
- Case sensitivity issues
- No validation that users exist
- No handling for deleted/deactivated users

#### Solution Options

**Option A: Use UUIDs (Quick Fix)**
```typescript
export const DEFAULT_ASSIGNMENT: Record<string, string[]> = {
    "Hostel:Velankani": [
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890", // azad's UUID
        "b2c3d4e5-f6a7-8901-bcde-f12345678901", // sunil's UUID
    ],
};
```

**Option B: Database-Driven (Recommended)**
```sql
-- Create new table
CREATE TABLE default_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_value TEXT NOT NULL,
  scope_value TEXT,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 3. Missing Environment Variable Validation (🔴 Critical)

**Impact**: Silent failures in production, undefined behavior  
**Affected Files**: 7 API routes

#### Issues

- Direct `process.env` access bypasses validation
- Missing env vars won't be caught until runtime
- No centralized configuration

#### Files Affected

- `src/app/api/webhooks/clerk/route.ts:45` - `CLERK_WEBHOOK_SECRET`
- `src/app/api/tickets/[id]/route.ts:441` - `SLACK_WEBHOOK_URL`
- `src/app/api/slack/thread/[threadId]/route.ts:5` - `SLACK_BOT_TOKEN`
- `src/app/api/cron/tat-reminders/route.ts:24` - `CRON_SECRET`
- `src/app/api/cron/remind-spocs/route.ts:16` - `CRON_SECRET`
- `src/app/api/cron/process-outbox/route.ts:15` - `CRON_SECRET`

#### Fix Required

**Step 1**: Create centralized config with validation

```typescript
// src/conf/config.ts
export function validateConfig() {
  const required = [
    'DATABASE_URL',
    'CLERK_SECRET_KEY',
    'CLERK_WEBHOOK_SECRET',
    'CRON_SECRET',
    'SLACK_BOT_TOKEN',
    'SLACK_WEBHOOK_URL',
    'NEXT_PUBLIC_APP_URL',
  ];
  
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export const clerkConfig = {
  secretKey: process.env.CLERK_SECRET_KEY!,
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET!,
};

export const cronConfig = {
  secret: process.env.CRON_SECRET!,
};

export const slackConfig = {
  botToken: process.env.SLACK_BOT_TOKEN!,
  webhookUrl: process.env.SLACK_WEBHOOK_URL!,
};

export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  nodeEnv: process.env.NODE_ENV || 'development',
};
```

**Step 2**: Call validation at startup

```typescript
// src/app/layout.tsx or instrumentation.ts
import { validateConfig } from '@/conf/config';

// Validate on startup
if (process.env.NODE_ENV === 'production') {
  validateConfig();
}
```

**Step 3**: Replace direct env access

```typescript
// ❌ WRONG
const secret = process.env.CLERK_WEBHOOK_SECRET;

// ✅ CORRECT
import { clerkConfig } from '@/conf/config';
const secret = clerkConfig.webhookSecret;
```

---

### 4. No Input Validation (🔴 Critical)

**Impact**: SQL injection, XSS, data corruption  
**Affected**: All POST/PUT/PATCH endpoints

#### Missing Validation

1. **Ticket ID validation** - `parseInt(id)` without `isNaN` check
2. **User input sanitization** - No HTML/script tag stripping
3. **File upload validation** - No MIME type or size checks
4. **Email validation** - No format validation

#### Fix Pattern

```typescript
import { z } from 'zod';

// Define schemas for all inputs
const TicketParamsSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

const CreateTicketSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  category_id: z.number().int().positive(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  attachments: z.array(z.object({
    url: z.string().url(),
    filename: z.string(),
    size: z.number().max(10 * 1024 * 1024), // 10MB max
  })).optional(),
});

// Use in route handlers
export async function POST(request: NextRequest) {
  const body = await request.json();
  
  const parsed = CreateTicketSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.errors },
      { status: 400 }
    );
  }
  
  // Use validated data
  const validatedData = parsed.data;
  // ...
}
```

---

## 🟠 High Priority Issues

### 5. Missing Database Transaction Error Handling

**Impact**: Partial updates, inconsistent data state  
**Affected**: All routes using `db.transaction()`

#### Fix Pattern

```typescript
// ❌ INCOMPLETE
const updatedTicket = await db.transaction(async (tx) => {
  const [t] = await tx.update(tickets).set({...}).returning();
  await tx.insert(outbox).values({...}); // What if this fails?
  return t;
});

// ✅ COMPLETE
try {
  const updatedTicket = await db.transaction(async (tx) => {
    const [t] = await tx.update(tickets).set({...}).returning();
    if (!t) throw new Error("Ticket update failed");
    
    await tx.insert(outbox).values({...});
    return t;
  });
} catch (error) {
  console.error("Transaction failed, rolled back:", error);
  return NextResponse.json(
    { error: "Update failed" }, 
    { status: 500 }
  );
}
```

---

### 6. Missing Null Checks on Database Queries

**Impact**: Runtime errors when data doesn't exist

#### Fix Pattern

```typescript
// ❌ UNSAFE
const [ticket] = await db.select().from(tickets).where(...).limit(1);
const categoryName = ticket.category_id; // Crashes if ticket is undefined

// ✅ SAFE
const [ticket] = await db.select().from(tickets).where(...).limit(1);
if (!ticket) {
  return NextResponse.json(
    { error: "Ticket not found" }, 
    { status: 404 }
  );
}
const categoryName = ticket.category_id;
```

---

### 7. No Rate Limiting

**Impact**: DDoS vulnerability, resource exhaustion  
**Affected**: All API routes

#### Implementation

```typescript
// Install: pnpm add @upstash/ratelimit @upstash/redis

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
  analytics: true,
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success, limit, remaining } = await ratelimit.limit(ip);
  
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" }, 
      { status: 429, headers: {
        'X-RateLimit-Limit': limit.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
      }}
    );
  }
  
  // ... rest of handler
}
```

---

### 8. No Timeout on External API Calls

**Impact**: Hanging requests, resource exhaustion  
**Affected**: Slack, Email, Clerk API calls

#### Fix Pattern

```typescript
// ✅ WITH TIMEOUT
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 5000);

try {
  const response = await fetch(url, { 
    signal: controller.signal,
    headers: { ... }
  });
  
  if (!response.ok) {
    throw new Error(`API call failed: ${response.status}`);
  }
  
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.error("Request timed out");
    throw new Error("External service timeout");
  }
  throw error;
} finally {
  clearTimeout(timeout);
}
```

---

### 9. Hardcoded Localhost URLs

**Impact**: Will break in production  
**Files**: 3

#### Locations

- `src/lib/slack.ts:67` - `'http://localhost:3000'`
- `src/lib/cache-invalidation.ts:15` - `'http://localhost:3000'`
- `src/app/api/cron/tat-reminders/route.ts:251` - `'http://localhost:3000'`

#### Fix

```typescript
// ✅ CORRECT - Centralize in config
import { appConfig } from "@/conf/config";

const baseUrl = appConfig.appUrl;
if (!baseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
}
```

---

## 🟡 Medium Priority Issues

### 10. No Optimistic Locking for Concurrent Updates

**Impact**: Lost updates in race conditions

#### Example Scenario

Two admins update the same ticket simultaneously → one update is lost

#### Solution

```typescript
// Add version field to tickets table
ALTER TABLE tickets ADD COLUMN version INTEGER DEFAULT 1;

// Use optimistic locking
const [updated] = await db
  .update(tickets)
  .set({ 
    status_id: newStatus, 
    version: sql`version + 1` 
  })
  .where(and(
    eq(tickets.id, ticketId),
    eq(tickets.version, currentVersion)
  ))
  .returning();

if (!updated) {
  return NextResponse.json({ 
    error: "Ticket was modified by another user. Please refresh." 
  }, { status: 409 });
}
```

---

### 11. Missing Cascade Delete Handling

**Impact**: Orphaned records when users/tickets deleted

#### Verify Schema

```typescript
// Ensure proper cascade rules
created_by: uuid("created_by")
  .references(() => users.id, { onDelete: "set null" })
  .notNull(),

assigned_to: uuid("assigned_to")
  .references(() => users.id, { onDelete: "set null" }),
```

---

### 12. No Idempotency Keys

**Impact**: Duplicate tickets/comments on retry

#### Implementation

```typescript
const CreateTicketSchema = z.object({
  // ... other fields
  idempotencyKey: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  const { idempotencyKey, ...data } = await request.json();
  
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
  
  // Create new ticket with idempotency key
  const [ticket] = await db.insert(tickets).values({
    ...data,
    idempotency_key: idempotencyKey,
  }).returning();
  
  return NextResponse.json(ticket, { status: 201 });
}
```

---

### 13. Hardcoded Time Intervals (SLA)

**Impact**: Inflexible SLA logic

#### Current Issue

```typescript
// ❌ HARDCODED - src/app/api/tickets/metrics/route.ts:99
.where(sql`status != 'RESOLVED' AND now() - created_at > interval '48 hours'`)
```

#### Fix

```typescript
// ✅ Use category-specific SLA
const category = await db
  .select()
  .from(categories)
  .where(eq(categories.id, ticket.category_id))
  .limit(1);

const slaHours = category[0]?.sla_hours || 48;

const overdueTickets = await db
  .select()
  .from(tickets)
  .where(sql`
    status_id != (SELECT id FROM ticket_statuses WHERE value = 'RESOLVED')
    AND now() - created_at > interval '${slaHours} hours'
  `);
```

---

## 🟢 Low Priority Issues

### 14. Excessive Console.log Statements

**Impact**: Log noise, potential performance impact  
**Count**: 200+ statements

#### Recommendation

Replace with structured logging:

```typescript
// Install: pnpm add pino

import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: { colorize: true }
  }
});

// ❌ NOISY
console.log("Email sent to", email);
console.error("Error:", error);

// ✅ STRUCTURED
logger.info({ recipient: email, ticketId }, "email_sent");
logger.error({ error: error.message, ticketId }, "email_failed");
```

---

## 🔧 Build & Configuration Issues

### 15. TypeScript Errors (Resolved ✅)

**Status**: Fixed by user  
**Previous Count**: 152 errors → 5 errors → 0 errors

---

### 16. Server-Only Import Issue

**Status**: Partially resolved  
**File**: `src/db/index.ts`

#### Current Workaround

`import 'server-only'` is commented out

#### Permanent Fix

Ensure `next.config.ts` has:

```typescript
const nextConfig = {
  serverExternalPackages: ['postgres', 'pg', 'drizzle-orm'],
};
```

---

## 📋 Implementation Checklist

### Phase 1: Critical Fixes (Week 1)

- [ ] Fix all `tickets.status` references (Issues #1)
  - [ ] Update `src/app/api/tickets/metrics/route.ts`
  - [ ] Update `src/app/api/cron/tat-reminders/route.ts`
  - [ ] Update `src/app/api/cron/auto-escalate/route.ts`
- [ ] Fix hardcoded user assignments (Issue #2)
  - [ ] Create `default_assignments` table
  - [ ] Migrate existing assignments to UUIDs
  - [ ] Update assignment logic
- [ ] Implement centralized config validation (Issue #3)
  - [ ] Create `validateConfig()` function
  - [ ] Update all routes to use config
  - [ ] Add startup validation
- [ ] Add input validation with Zod (Issue #4)
  - [ ] Create schemas for all endpoints
  - [ ] Implement validation in route handlers

### Phase 2: High Priority (Week 2)

- [ ] Add transaction error handling (Issue #5)
- [ ] Add null checks on all queries (Issue #6)
- [ ] Implement rate limiting (Issue #7)
- [ ] Add timeouts to external API calls (Issue #8)
- [ ] Fix hardcoded URLs (Issue #9)

### Phase 3: Medium Priority (Week 3)

- [ ] Implement optimistic locking (Issue #10)
- [ ] Verify cascade delete rules (Issue #11)
- [ ] Add idempotency keys (Issue #12)
- [ ] Make SLA thresholds configurable (Issue #13)

### Phase 4: Polish (Week 4)

- [ ] Replace console.log with structured logging (Issue #14)
- [ ] Add error tracking (Sentry)
- [ ] Add performance monitoring
- [ ] Create health check endpoint
- [ ] Add metrics endpoint

---

## 🧪 Testing Requirements

### Before Production Deployment

#### 1. Unit Tests
- [ ] Test input validation schemas
- [ ] Test database query functions
- [ ] Test utility functions

#### 2. Integration Tests
- [ ] Test all API routes
- [ ] Test cron jobs
- [ ] Test webhook handlers
- [ ] Test email/Slack notifications

#### 3. E2E Tests
- [ ] Student creates ticket
- [ ] Admin assigns ticket
- [ ] Ticket escalation flow
- [ ] Ticket resolution flow
- [ ] Analytics dashboard

#### 4. Load Tests
- [ ] 100 concurrent users
- [ ] 1000 concurrent users
- [ ] Database connection pooling
- [ ] API response times

#### 5. Security Tests
- [ ] OWASP Top 10 scan
- [ ] SQL injection tests
- [ ] XSS tests
- [ ] CSRF protection
- [ ] Rate limiting verification

---

## 🚀 Deployment Checklist

### Environment Setup

- [ ] Set all required environment variables
- [ ] Verify database connection
- [ ] Test Clerk authentication
- [ ] Test Slack integration
- [ ] Test email service

### Database

- [ ] Run all migrations
- [ ] Verify schema matches code
- [ ] Set up database backups
- [ ] Configure connection pooling
- [ ] Set up read replicas (if needed)

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Set up performance monitoring
- [ ] Set up uptime monitoring
- [ ] Configure alerts
- [ ] Set up log aggregation

### Security

- [ ] Enable HTTPS
- [ ] Configure CORS
- [ ] Set security headers
- [ ] Enable rate limiting
- [ ] Review authentication flows

### Performance

- [ ] Enable caching
- [ ] Optimize database queries
- [ ] Set up CDN for static assets
- [ ] Configure compression
- [ ] Optimize images

---

## 📊 Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Schema mismatch errors | High | Critical | Fix all `tickets.status` references immediately |
| Assignment logic fails | High | Critical | Migrate to UUID-based assignments |
| Missing env vars in prod | Medium | Critical | Implement startup validation |
| DDoS attack | Medium | High | Implement rate limiting |
| Data corruption | Low | Critical | Add transaction error handling |
| Concurrent update conflicts | Medium | Medium | Implement optimistic locking |

---

## 📚 Additional Resources

### Documentation to Create

1. **API Documentation** - OpenAPI/Swagger spec
2. **Database Schema Documentation** - ER diagrams
3. **Deployment Guide** - Step-by-step deployment
4. **Runbook** - Common issues and solutions
5. **Security Policy** - Security best practices

### Tools to Consider

1. **Error Tracking**: Sentry
2. **Logging**: Pino + LogTail
3. **Monitoring**: New Relic / DataDog
4. **Load Testing**: k6 / Artillery
5. **Security Scanning**: Snyk / OWASP ZAP

---

## 🎯 Success Criteria

The project is production-ready when:

- ✅ All critical issues are resolved
- ✅ All high priority issues are resolved
- ✅ Input validation is implemented on all endpoints
- ✅ Rate limiting is active
- ✅ Error handling is comprehensive
- ✅ All tests pass (unit, integration, E2E)
- ✅ Load testing shows acceptable performance
- ✅ Security audit passes
- ✅ Monitoring and alerting are configured
- ✅ Documentation is complete

---

## 📞 Support

For questions or issues during implementation:

1. Review audit reports in `/audit` directory
2. Check schema reference: `audit/SCHEMA_REFERENCE.md`
3. Review build errors: `audit/6-build-errors.md`

---

**Last Updated**: 2025-11-23  
**Next Review**: After Phase 1 completion
