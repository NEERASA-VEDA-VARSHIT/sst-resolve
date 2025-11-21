# Notification System

## Overview

The SST-Resolve Notification System is designed to ensure timely communication between students, admins, and committees. It uses a multi-channel approach (Slack + Email) to guarantee that critical updates are never missed.

## 🧠 Logical View

### Triggers & Recipients

| Event | Trigger | Recipient | Channel | Content |
|-------|---------|-----------|---------|---------|
| **Ticket Created** | Student submits form | Assigned Admin | Slack, Email | New ticket alert with details |
| **Comment Added** | User posts comment | Thread Participants | Slack Thread, Email | Comment text + Link |
| **Status Change** | Admin updates status | Student | Email | Status update (e.g., "In Progress") |
| **TAT Breach** | Due date passed | Assigned Admin | Slack, Email | Urgent reminder |
| **Committee Tag** | Admin tags committee | Committee Channel | Slack, Email | Request for review |

### Threading Model

To keep conversations organized, we use a **Threaded Model**:
- **Slack**: Every ticket creates a parent message in the domain channel (e.g., `#hostel-tickets`). All subsequent updates (comments, status changes) are posted as **replies** to that thread.
- **Email**: We use `Message-ID` and `In-Reply-To` headers to group emails into a single conversation thread in the user's inbox.

---

## ⚙️ Technical Architecture

The system is built on an **Event-Driven Architecture** using asynchronous workers to prevent blocking the main UI.

### 1. The Outbox Pattern
When an action occurs (e.g., comment added), we don't send notifications immediately. Instead:
1. The action is saved to the DB.
2. An event is inserted into the `outbox` table.
3. The API response is returned immediately (fast UI).
4. A background worker processes the `outbox` event.

### 2. Worker System
Located in `src/workers/handlers/`:

- **`processTicketCreatedWorker.ts`**:
  - Fetches ticket details.
  - Determines assigned admin.
  - Posts parent message to Slack.
  - Saves `slack_thread_ts` to ticket metadata.

- **`processTicketCommentAddedWorker.ts`**:
  - Reads `slack_thread_ts` from ticket.
  - Posts comment as a reply using Slack API.
  - Sends email to student/admin.

- **`processTicketStatusChangedWorker.ts`**:
  - Posts status update to Slack thread.
  - Sends formal email notification.

### 3. Scheduled Tasks (Cron)
Located in `src/app/api/cron/`:

- **`tat-reminders/route.ts`**:
  - Runs daily at 9:00 AM (configured in `vercel.json`).
  - Queries tickets where `due_at` < NOW and `status` != RESOLVED.
  - Sends summary digest to assigned admins.

### 4. Integration Libraries
- **Slack**: `@slack/web-api` for robust API interaction.
- **Email**: `nodemailer` with SMTP configuration.

## 🔧 Configuration

Super Admins can configure notification settings via the dashboard:
- **Toggle Channels**: Enable/Disable Slack or Email globally.
- **Channel Mapping**: Map domains (Hostel, College) to specific Slack channels.
- **User Preferences**: Individual admins can opt-out of specific notification types (coming soon).

## 🛡️ Error Handling

- **Retries**: If Slack/Email API fails, the worker marks the event as `failed` and retries up to 3 times.
- **Dead Letter Queue**: Permanently failed events are logged for manual inspection.
