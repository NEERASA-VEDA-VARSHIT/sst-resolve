# API Routes Specification

Complete documentation of all ticket-related API endpoints in the SST Resolve system.

---

## 1. `/api/tickets`

### POST - Create Ticket
**Purpose**: Create a new support ticket  
**Auth**: Required (Student, Admin, Committee)  
**Request Body**:
```json
{
  "categoryId": number,
  "subcategoryId": number,
  "subSubcategoryId": number | null,
  "description": string,
  "details": {
    "profile": { "rollNo": string, "name": string, ... },
    "images": string[],
    // ... dynamic fields based on category
  }
}
```
**Response**: `201 Created` with ticket object

---

### GET - List Tickets
**Purpose**: List tickets based on user role  
**Auth**: Required  
**Query Params**:
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `status` (string, optional)
- `category` (number, optional)

**Role-based filtering**:
- **Student**: Their tickets only
- **Admin**: Assigned tickets + unassigned
- **Super Admin**: All tickets
- **Committee**: Category-tagged tickets

**Response**: `200 OK` with paginated ticket list

---

## 2. `/api/tickets/[id]`

### GET - Get Ticket Detail
**Purpose**: Fetch full ticket details including creator, assignee, category info  
**Auth**: Required  
**Access Control**:
- Student: Own tickets only
- Admin: Assigned + viewable tickets
- Super Admin: All tickets
- Committee: Tagged tickets

**Response**: `200 OK` with ticket object including:
- Ticket fields
- Creator info
- Assigned staff info
- Category/subcategory names
- Status, priority, escalation level
- Timestamps

---

### PATCH - Update Ticket
**Purpose**: Update ticket description or metadata  
**Auth**: Required (Admin+)  
**Request Body**:
```json
{
  "description": string (optional),
  "location": string (optional),
  "priority": string (optional),
  "details": object (optional)
}
```
**Response**: `200 OK` with updated ticket

---

### DELETE - Delete Ticket
**Purpose**: Hard delete a ticket (admin only, use sparingly)  
**Auth**: Required (Super Admin only)  
**Response**: `200 OK` with success message

---

## 3. `/api/tickets/[id]/comments`

### POST - Add Comment
**Purpose**: Add a comment or internal note to a ticket  
**Auth**: Required  
**Request Body**:
```json
{
  "comment": string,
  "is_internal": boolean (optional, default: false)
}
```

**Comment Types**:
- **Student comments**: Public, visible to all
- **Admin comments**: Can be public or internal
- **Committee internal notes**: Only visible to committee + admins
- **Super Admin internal notes**: Visible to all staff

**Response**: `201 Created` with comment object

---

### GET - List Comments
**Purpose**: Get all comments for a ticket (filtered by role)  
**Auth**: Required  
**Access Control**:
- Students: See only public comments
- Staff: See public + internal notes

**Response**: `200 OK` with array of comments

---

## 4. `/api/tickets/[id]/status`

### PATCH - Update Ticket Status
**Purpose**: Change ticket status with role-based permissions  
**Auth**: Required  
**Request Body**:
```json
{
  "status": "OPEN" | "IN_PROGRESS" | "PENDING" | "RESOLVED" | "CLOSED" | "REOPENED"
}
```

**Permissions**:
- **Admin**: Update to ANY status
- **Committee**: Can resolve/close only their tagged tickets
- **Student**: Can only reopen their own closed/resolved tickets

**Response**: `200 OK` with updated ticket

---

## 5. `/api/tickets/[id]/assign`

### PATCH - Assign/Unassign Staff
**Purpose**: Assign or unassign SPOC/staff to a ticket  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "assignedTo": string | null  // staff UUID or null to unassign
}
```

**Response**: `200 OK` with updated ticket

---

## 6. `/api/tickets/[id]/escalate`

### POST - Escalate Ticket
**Purpose**: Manually escalate a ticket  
**Auth**: Required  
**Permissions**:
- **Student**: Can escalate their own tickets
- **Admin**: Can escalate any ticket

**Behavior**:
- Increments `escalation_level` by 1
- Triggers worker notifications (email/Slack)
- Updates `escalated_at` timestamp

**Response**: `200 OK` with updated ticket

---

## 7. `/api/tickets/[id]/activity`

### GET - Get Activity Timeline
**Purpose**: Fetch chronological timeline of all ticket events  
**Auth**: Required  
**Returns**:
- Status changes
- Comments (filtered by role)
- Staff assignments
- Escalations
- Email/Slack delivery logs (optional)

**Response**: `200 OK` with array of activity events sorted by timestamp

---

## 8. `/api/tickets/categories`

### GET - Get Categories Schema
**Purpose**: Fetch all categories with dynamic form configuration  
**Auth**: Required  
**Returns**:
- Categories
- Subcategories
- Sub-subcategories
- Dynamic fields (by subcategory)
- Profile fields (by category)
- Field options (for dropdowns)

**Use Case**: Powers the dynamic create-ticket form

**Response**: `200 OK` with nested category structure

---

## 9. `/api/tickets/attachments/upload`

### POST - Upload Image
**Purpose**: Upload an image to Cloudinary  
**Auth**: Required  
**Request**: `multipart/form-data` with `file` field  
**File Constraints**:
- Max size: 10MB
- Formats: JPEG, PNG, WebP

**Response**: `200 OK`
```json
{
  "url": "https://res.cloudinary.com/...",
  "publicId": "sst-resolve/..."
}
```

---

## 10. `/api/tickets/attachments/delete`

### DELETE - Delete Attachment
**Purpose**: Remove an image from Cloudinary  
**Auth**: Required (Admin+)  
**Request Body**:
```json
{
  "publicId": string
}
```

**Response**: `200 OK` with success message

---

## 11. `/api/tickets/metrics`

### GET - Get Ticket Metrics
**Purpose**: Fetch dashboard metrics (Admin only)  
**Auth**: Required (Admin+)  
**Returns**:
- Total ticket counts
- Counts by status
- Counts by category
- SLA metrics (avg resolution time)
- Overdue ticket count
- Reopened ticket count
- Today's stats (created, resolved)

**Response**: `200 OK` with metrics object

---

## 12. `/api/tickets/search`

### GET - Search/Filter Tickets
**Purpose**: Advanced search with multiple filters (Admin only)  
**Auth**: Required (Admin+)  
**Query Params**:
- `query` (string): Text search in description
- `status` (string): Filter by status
- `category` (number): Filter by category ID
- `assignedTo` (string): Filter by staff UUID
- `createdBy` (string): Filter by student UUID
- `dateFrom` (string): ISO date
- `dateTo` (string): ISO date
- `page` (number)
- `limit` (number)

**Response**: `200 OK` with paginated search results

---

## 13. `/api/tickets/[id]/rate`

### POST - Submit Student Rating
**Purpose**: Allow students to rate ticket resolution  
**Auth**: Required (Student only - own tickets)  
**Request Body**:
```json
{
  "rating": number (1-5),
  "feedback": string (optional)
}
```

**Response**: `200 OK` with updated ticket

---

## 14. `/api/tickets/[id]/tat`

### POST - Set TAT (Turnaround Time)
**Purpose**: Admin sets expected resolution time commitment  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "tat_hours": number,
  "tat_reason": string (optional)
}
```

**Behavior**:
- Calculates `expected_resolution_date`
- Notifies student of commitment
- Tracks SLA metrics

**Response**: `200 OK` with updated ticket

---

## 15. `/api/tickets/[id]/reassign`

### POST - Reassign Ticket
**Purpose**: Reassign ticket to different staff member  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "staffId": string (UUID),
  "reason": string (optional)
}
```

**Behavior**:
- Transfers ownership to new staff
- Notifies both old and new assignee
- Updates assignment history

**Response**: `200 OK` with updated ticket

---

## 16. `/api/tickets/[id]/committee-tags`

### GET - Get Committee Tags
**Purpose**: List committees tagged on a ticket  
**Auth**: Required (Admin, Committee)  
**Response**: `200 OK` with array of committee tags

---

### POST - Add Committee Tag
**Purpose**: Tag a committee to handle the ticket  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "committeeId": number
}
```
**Response**: `201 Created` with tag object

---

### DELETE - Remove Committee Tag
**Purpose**: Remove committee tag from ticket  
**Auth**: Required (Admin only)  
**Query Param**: `?tagId=number`  
**Response**: `200 OK` with success message

---

## 17. `/api/tickets/[id]/full`

### GET - Get Fully Hydrated Ticket
**Purpose**: Fetch complete ticket data in one optimized request  
**Auth**: Required  
**Returns**:
- Ticket details
- Creator (student) info with profile fields
- Assigned staff info
- Category/subcategory names
- All comments with author details
- Activity timeline
- Committee tags

**Optimization**: Reduces DB queries from 17+ to ~5-7 queries

**Use Case**: Ticket detail pages requiring all data at once

**Response**: `200 OK` with fully hydrated ticket object

---

## 18. `/api/tickets/bulk-close`

### POST - Bulk Close Tickets
**Purpose**: Close multiple tickets at once  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "ticketIds": number[],
  "reason": string (optional)
}
```

**Behavior**:
- Updates status to CLOSED for all specified tickets
- Notifies affected students
- Logs bulk action

**Response**: `200 OK` with count of closed tickets

---

## 19. `/api/tickets/reminders`

### GET - Send TAT Reminders (Cron Job)
**Purpose**: Automated reminder system for TAT deadlines  
**Auth**: None (internal cron endpoint)  
**Should be called by**: Automated cron job (daily)

**Behavior**:
- Checks tickets where TAT date is today or has passed
- Sends reminder emails to:
  - Assigned staff (approaching TAT deadline)
  - Students (TAT commitment updates)

**Response**: `200 OK` with count of reminders sent

**Security Note**: Consider adding secret token authentication

---

## 20. `/api/tickets/groups`

### POST - Create Ticket Group
**Purpose**: Group multiple tickets for bulk management  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "name": string,
  "ticketIds": number[],
  "description": string (optional)
}
```

**Use Case**: Handle related tickets together (e.g., hostel-wide issue)

**Response**: `201 Created` with group object

---

### GET - List Ticket Groups
**Purpose**: List all ticket groups with ticket counts  
**Auth**: Required (Admin only)  
**Response**: `200 OK` with array of groups

---

## 21. `/api/tickets/groups/[groupId]`

### GET - Get Specific Ticket Group
**Purpose**: Fetch group with all associated tickets  
**Auth**: Required (Admin only)  
**Response**: `200 OK` with group object including tickets array

---

### PATCH - Update Ticket Group
**Purpose**: Update group name, description, or modify tickets  
**Auth**: Required (Admin only)  
**Request Body**:
```json
{
  "name": string,
  "description": string,
  "ticketIds": number[]
}
```
**Response**: `200 OK` with updated group

---

### DELETE - Delete Ticket Group
**Purpose**: Remove group (tickets remain, just ungroup them)  
**Auth**: Required (Admin only)  
**Response**: `200 OK` with success message

---

## Workers (Background Processing)

These are not API routes but background workers using the outbox pattern:

### Location
```
src/workers/
  processOutboxPoller.ts           # Main poller
  handlers/
    processTicketCreatedWorker.ts        # On ticket creation
    processTicketStatusUpdatedWorker.ts  # On status change
    processTicketCommentAddedWorker.ts   # On new comment
    processTicketEscalatedWorker.ts      # On escalation
  utils.ts                         # Shared utilities
```

### Worker Responsibilities
- Send email notifications
- Send Slack notifications
- Update external integrations
- Log delivery status
- Handle retries and failures

---

## Routes NOT in Specification (Legacy/Unused)

**`/api/tickets/[id]/acknowledge`** - Unused, candidate for removal

**Recommendation**: Audit and remove this route if not needed.

---

## Summary Table

| Route | Methods | Purpose | Auth Level |
|-------|---------|---------|------------|
| `/api/tickets` | POST, GET | Create & list tickets | All authenticated |
| `/api/tickets/[id]` | GET, PATCH, DELETE | Single ticket operations | Role-based |
| `/api/tickets/[id]/comments` | POST, GET | Comments & notes | All authenticated |
| `/api/tickets/[id]/status` | PATCH | Status updates | Admin, Committee (limited), Student (reopen only) |
| `/api/tickets/[id]/assign` | PATCH | Staff assignment | Admin only |
| `/api/tickets/[id]/escalate` | POST | Manual escalation | Student (own), Admin (any) |
| `/api/tickets/[id]/activity` | GET | Activity timeline | All authenticated |
| `/api/tickets/[id]/rate` | POST | Student rating | Student (own tickets) |
| `/api/tickets/[id]/tat` | POST | Set TAT commitment | Admin only |
| `/api/tickets/[id]/reassign` | POST | Reassign to different staff | Admin only |
| `/api/tickets/[id]/committee-tags` | GET, POST, DELETE | Committee tagging | Admin, Committee (read) |
| `/api/tickets/[id]/full` | GET | Fully hydrated ticket data | All authenticated |
| `/api/tickets/categories` | GET | Category schema | All authenticated |
| `/api/tickets/attachments/upload` | POST | Upload image | All authenticated |
| `/api/tickets/attachments/delete` | DELETE | Delete image | Admin+ |
| `/api/tickets/metrics` | GET | Dashboard metrics | Admin+ |
| `/api/tickets/search` | GET | Advanced search | Admin+ |
| `/api/tickets/bulk-close` | POST | Close multiple tickets | Admin only |
| `/api/tickets/reminders` | GET | TAT reminders (cron) | Internal (no auth) |
| `/api/tickets/groups` | POST, GET | Ticket grouping | Admin only |
| `/api/tickets/groups/[groupId]` | GET, PATCH, DELETE | Manage specific group | Admin only |

---

## Implementation Status

✅ **Implemented & Documented**: All 21 ticket routes are documented with proper headers

⚠️ **Needs Security Enhancement**: 
- `/api/tickets/reminders` should add secret token authentication for cron access

🔧 **Pre-existing Issues** (not introduced by documentation):
- `/api/tickets/[id]/rate` has TypeScript errors in validation logic
- `/api/tickets/metrics` has Drizzle ORM type mismatch

❌ **Candidate for Removal**: `/api/tickets/[id]/acknowledge` (unused)

---

## Next Steps

1. **Audit Legacy Routes**: Review and remove unused routes
2. **Implement Workers**: Set up outbox polling and notification workers
3. **Add Tests**: API integration tests for all routes
4. **OpenAPI Spec**: Generate Swagger/OpenAPI documentation
5. **Rate Limiting**: Add rate limits per route
6. **Logging**: Enhance audit logging for all operations
