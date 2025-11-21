# Escalation & SLA Logic

## Overview

Service Level Agreements (SLAs) and Escalation Rules are the backbone of SST-Resolve's accountability system. They ensure that no ticket is ignored and that complex issues are automatically routed to senior authorities.

## ⏱️ Service Level Agreement (SLA)

### What is an SLA?
An SLA defines the maximum time allowed to resolve a ticket before it is considered "Overdue".

### How it Works
1. **Category Based**: Each category (e.g., "Hostel - Electrical") has a configured `sla_hours` (default: 48 hours).
2. **Due Date Calculation**:
   - When a ticket is created: `due_at = created_at + sla_hours`.
   - Weekends and holidays are currently *included* in this calculation (can be configured to exclude).
3. **TAT (Turnaround Time)**: The actual time taken to resolve.
   - `TAT = resolved_at - created_at`.

### SLA Statuses
- **On Track**: Current time < `due_at`.
- **At Risk**: < 4 hours remaining.
- **Breached**: Current time > `due_at`.

---

## 📈 Escalation Matrix

Escalation is the process of moving a ticket up the chain of command when it is not resolved within a specific timeframe or requires higher authority.

### Escalation Levels

| Level | Role | Responsibility | Trigger |
|-------|------|----------------|---------|
| **Level 0** | **Assigned Admin** | Initial investigation & resolution | Ticket Creation |
| **Level 1** | **Senior Admin** | Review delayed tickets, resource allocation | SLA Breach + 24h |
| **Level 2** | **Super Admin** | Policy decisions, critical failures | Manual Escalation |
| **Level 3** | **Committee** | Disciplinary/Policy review | Tagged by Admin |

### Automatic Escalation (Planned)
Currently, escalation is primarily **manual** or **notification-based** (TAT reminders). Future updates will implement auto-reassignment:
- If `status` is OPEN for > SLA + 24h -> Reassign to Level 1.

### Domain-Based Routing
Escalation rules are scoped by **Domain** (Hostel/College) and **Scope** (Block A, Dept CS).
- A ticket in "Hostel - Block A" escalates to the "Warden of Block A".
- A ticket in "College - CS Dept" escalates to the "HOD of CS".

## 🛠️ Configuration

Super Admins can configure these rules in the **Category Builder**:
1. Select Category.
2. Go to "Escalation Rules" tab.
3. Define Staff for Level 1, 2, 3.
4. Set notification channels (Slack/Email) for each level.
