# Escalation Rules Policy

This document defines the automatic triggers that will escalate a ticket to the next level (e.g., from Admin to Committee Head/Warden).

## 🚨 Core Escalation Triggers (User Defined)

### 1. TAT Extension Limit
- **Trigger**: Admin requests a TAT extension for the **3rd time**.
- **Reason**: Repeated delays indicate the issue is complex or being ignored.
- **Action**: Escalate to Level 2 immediately.

### 2. Ticket Overdue (SLA Breach)
- **Trigger**: The `resolution_due_at` time has passed, and status is not `resolved`.
- **Reason**: Commitment to the student has been broken.
- **Action**: Escalate to Level 2.

### 3. Repeated Reopening
- **Trigger**: Student reopens the ticket for the **3rd time**.
- **Reason**: The solution provided is clearly not satisfying the student or the fix is temporary.
- **Action**: Escalate to Level 2 (needs oversight).

### 4. Negative Feedback (Low Rating)
- **Trigger**: Student rates a resolved ticket **1 or 2 stars**.
- **Reason**: Quality control. A resolved ticket with a bad rating is a failure.
- **Action**: Flag for review or escalate to Level 2.

### 5. "Ping-Pong" Forwarding
- **Trigger**: Ticket has been forwarded **> 3 times**.
- **Reason**: No one is taking ownership, or the ticket is being passed around.
- **Action**: Escalate to Domain Head to assign a definitive owner.

### 6. Stalled "In Progress"
- **Trigger**: Status is `in_progress` but **no activity** (comments/updates) for **48 hours**.
- **Reason**: Ticket might be forgotten or stuck.
- **Action**: Send reminder to Admin; if no response in 24h, Escalate.