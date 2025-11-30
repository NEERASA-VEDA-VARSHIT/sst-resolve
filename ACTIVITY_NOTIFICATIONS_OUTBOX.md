# The Trio: Activity, Notifications, and Outbox

## 🎯 The Big Picture

You are using a **Transactional Outbox Pattern**. This is a professional way to ensure **reliability**.

### 1. The Problem (Without Outbox) ❌
Imagine this code:
```typescript
await db.update(ticket).set({ status: 'resolved' });
await sendSlackNotification(); // What if this fails? Or takes 10 seconds?
```
- If Slack is down, the request hangs or fails.
- If the server crashes *after* DB update but *before* Slack, the user never gets notified.

### 2. The Solution (With Outbox) ✅

We split the work into two parts:

#### Part A: The Transaction (Instant & Safe)
When a user resolves a ticket, we do this in **ONE database transaction**:
1.  **Update Ticket**: Status → Resolved.
2.  **Log Activity**: Insert into `ticket_activity` ("Resolved by John").
3.  **Queue Event**: Insert into `outbox` ("ticket.resolved" event).

**Result**: The user gets an immediate "Success!" response. No waiting for Slack/Email.

#### Part B: The Worker (Async & Reliable)
A background worker (separate process) watches the `outbox` table:
1.  Picks up the "ticket.resolved" event.
2.  **Sends Notifications**: Emails student, Slacks admin.
3.  Marks event as `processed`.

If Slack is down? The worker **retries later**. The user request is already done and happy.

---

## Summary of Roles

| Table | Role | Analogy |
|-------|------|---------|
| **ticket_activity** | **Audit Log** | The Ship's Logbook 📖 (History) |
| **outbox** | **Reliability Queue** | The Outgoing Mailbox 📮 (Pending Delivery) |
| **notifications** | **User Alert** | The Letter in your Hand ✉️ (Final Delivery) |

### The Flow
1.  **User Action** → Updates **Ticket** + Writes to **Activity** + Writes to **Outbox**.
2.  **Worker** → Reads **Outbox** → Sends **Notifications**.

**Verdict**: This is a robust architecture. **Keep all three.**
