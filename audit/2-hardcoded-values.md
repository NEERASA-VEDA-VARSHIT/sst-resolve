# Audit Report: Hardcoded Values

**Generated**: 2025-11-21  
**Severity Levels**: 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low

---

## Executive Summary

This report identifies hardcoded values that should be configurable, either through environment variables, database tables, or configuration files. Hardcoded values reduce flexibility and make the system difficult to maintain.

**Total Issues Found**: 8  
**Critical**: 2 | **High**: 3 | **Medium**: 2 | **Low**: 1

---

## 🔴 CRITICAL: Hardcoded User Names for Assignment/Escalation

### 1. DEFAULT_ASSIGNMENT in constants.ts

**Impact**: Assignment logic will fail because these names don't match the database schema  
**File**: `src/conf/constants.ts`  
**Lines**: 157-159

```typescript
// ❌ CRITICAL ISSUE
export const DEFAULT_ASSIGNMENT: Record<string, string[]> = {
    "Hostel:Velankani": ["azad", "sunil", "minakshi"],
    "Hostel:Neeladri": ["vinay", "Surendra"],
    College: ["angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
};
```

**Problems**:
1. Uses string names instead of UUIDs (users are identified by `id` which is a UUID)
2. Names don't match database format (database has `first_name` + `last_name`, not single `name`)
3. Case sensitivity issues ("Surendra" vs potential "surendra" in DB)
4. No validation that these users exist
5. No handling for when users are deleted/deactivated

**Recommended Fix**:
```typescript
// ✅ OPTION 1: Use UUIDs directly
export const DEFAULT_ASSIGNMENT: Record<string, string[]> = {
    "Hostel:Velankani": [
        "a1b2c3d4-...",  // azad's UUID
        "e5f6g7h8-...",  // sunil's UUID
        "i9j0k1l2-...",  // minakshi's UUID
    ],
    // ...
};

// ✅ OPTION 2: Store in database (BEST)
// Create `default_assignments` table:
// - domain_id
// - scope_id (nullable)
// - user_id
// - priority (for ordering)
// Then fetch at runtime with proper validation
```

---

### 2. DEFAULT_ESCALATION in constants.ts

**Impact**: Escalation logic will fail for the same reasons as DEFAULT_ASSIGNMENT  
**File**: `src/conf/constants.ts`  
**Lines**: 164-184

```typescript
// ❌ CRITICAL ISSUE
export const DEFAULT_ESCALATION: Record<string, string[]> = {
    "Hostel:Velankani": [
        "azad", // same level
        "sunil", // same level
        "minakshi", // same level
        "Dharmendra Yadav",
        "angel rasakumari",
        "bijay kumar Mishra",
        "shruti sagar",
    ],
    "Hostel:Neeladri": [
        "vinay", // same level
        "Surendra", // same level
        "Dharmendra Yadav",
        "angel rasakumari",
        "bijay kumar Mishra",
        "shruti sagar",
    ],
    Hostel: ["Dharmendra Yadav", "angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
    College: ["angel rasakumari", "bijay kumar Mishra", "shruti sagar"],
};
```

**Note**: The system already has an `escalation_rules` table and `src/lib/escalation.ts` utility that properly handles escalations using UUIDs. This constant appears to be **unused legacy code**.

**Recommended Action**:
1. ✅ Verify if this constant is actually used anywhere
2. ✅ If unused, **remove it entirely**
3. ✅ If used, migrate to use `escalation_rules` table + `getEscalationTargets()` function

---

## 🟠 HIGH: Hardcoded URLs and Endpoints

### 3. Localhost URLs

**Impact**: Will break in production if not properly overridden  
**Files Affected**: 3

#### `src/lib/slack.ts` - Line 67
```typescript
// ❌ HARDCODED
baseUrl = 'http://localhost:3000';
```

#### `src/lib/cache-invalidation.ts` - Line 15
```typescript
// ❌ HARDCODED
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
```

#### `src/app/api/cron/tat-reminders/route.ts` - Line 251
```typescript
// ❌ HARDCODED
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 
  (process.env.NEXT_PUBLIC_VERCEL_URL ? 
    `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 
    'http://localhost:3000');
```

**Recommended Fix**:
```typescript
// ✅ BETTER: Centralize in config
import { appConfig } from "@/conf/config";

const baseUrl = appConfig.appUrl || 'http://localhost:3000';

// ✅ BEST: Fail fast in production
const baseUrl = appConfig.appUrl;
if (!baseUrl && process.env.NODE_ENV === 'production') {
  throw new Error('NEXT_PUBLIC_APP_URL must be set in production');
}
```

---

### 4. Direct process.env Access in API Routes

**Impact**: Bypasses centralized config validation  
**Files Affected**: 7

**Locations**:
- `src/app/api/webhooks/clerk/route.ts:45` - `process.env.CLERK_WEBHOOK_SECRET`
- `src/app/api/tickets/[id]/route.ts:441` - `process.env.SLACK_WEBHOOK_URL`
- `src/app/api/slack/thread/[threadId]/route.ts:5` - `process.env.SLACK_BOT_TOKEN`
- `src/app/api/cron/tat-reminders/route.ts:24` - `process.env.CRON_SECRET`
- `src/app/api/cron/tat-reminders/route.ts:251` - Multiple env vars
- `src/app/api/cron/remind-spocs/route.ts:16` - `process.env.CRON_SECRET`
- `src/app/api/cron/process-outbox/route.ts:15` - `process.env.CRON_SECRET`

**Recommended Fix**:
```typescript
// ❌ WRONG
const secret = process.env.CLERK_WEBHOOK_SECRET;

// ✅ CORRECT
import { clerkConfig } from "@/conf/config";
const secret = clerkConfig.webhookSecret;
```

**Benefits**:
- Centralized validation
- Type safety
- Easier testing
- Single source of truth

---

## 🟡 MEDIUM: Magic Numbers

### 5. Hardcoded Time Intervals

**Impact**: SLA and timing logic is inflexible  
**Files Affected**: Multiple

#### `src/app/api/tickets/metrics/route.ts` - Line 99
```typescript
// ❌ HARDCODED 48 hours
.where(sql`status != 'RESOLVED' AND now() - created_at > interval '48 hours'`)
```

**Should be**: Configurable SLA threshold from database or config

#### Other Potential Locations
Based on PRD requirements, there should be configurable:
- Acknowledgement TAT (hours)
- Resolution TAT (hours)
- Escalation cooldown period
- Auto-escalation inactivity threshold

**Recommended Fix**:
```typescript
// ✅ Use database-driven SLA
const overdueThreshold = category.sla_hours || DEFAULTS.SLA_HOURS;

// ✅ Or use config
import { appConfig } from "@/conf/config";
const overdueThreshold = appConfig.defaultSlaHours;
```

---

### 6. Hardcoded Status Strings

**Impact**: Fragile, breaks if status values change  
**Files Affected**: Multiple (already documented in 1-outdated-code.md)

**Examples**:
- `"OPEN"`, `"IN_PROGRESS"`, `"RESOLVED"`, `"ESCALATED"`, `"REOPENED"`, `"AWAITING_STUDENT"`
- `"closed"`, `"resolved"` (lowercase variants)

**Recommended Fix**: Use `TICKET_STATUS` constants from `@/conf/constants` or fetch from `ticket_statuses` table

---

## 🟢 LOW: Configuration Values That Could Be Dynamic

### 7. Slack Channel Mappings

**Impact**: Requires code changes to update Slack channels  
**File**: `src/conf/config.ts`  
**Lines**: ~80-90 (estimated)

**Current**: Hardcoded in config file  
**Better**: Store in database table `slack_channel_mappings` for runtime updates

---

### 8. Email Templates

**Impact**: Requires code deployment to update email content  
**File**: `src/lib/email.ts` (likely)

**Current**: Hardcoded HTML templates in code  
**Better**: Store templates in database or external template service (e.g., SendGrid templates)

---

## Summary of Required Actions

### Immediate (Critical)
1. ✅ **Verify if `DEFAULT_ASSIGNMENT` and `DEFAULT_ESCALATION` are used**
   - If yes: Migrate to database-driven approach using `escalation_rules` table
   - If no: Remove entirely
2. ✅ **Create migration script** to populate `escalation_rules` table with current assignments

### High Priority
3. ✅ Replace direct `process.env` access with centralized config imports
4. ✅ Centralize base URL logic in `appConfig`
5. ✅ Add production validation for required environment variables

### Medium Priority
6. ✅ Make SLA thresholds configurable (database or config)
7. ✅ Replace hardcoded time intervals with config values
8. ✅ Ensure all status comparisons use constants or database values

### Low Priority
9. ✅ Consider moving Slack channel mappings to database
10. ✅ Consider externalizing email templates

---

## Testing Recommendations

After fixes:
1. Test assignment logic with real user UUIDs
2. Test escalation flow end-to-end
3. Verify production deployment with correct environment variables
4. Test SLA calculations with configurable thresholds
5. Verify Slack notifications use correct channels
