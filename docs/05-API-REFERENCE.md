# SST-Resolve: API Documentation

## 🔐 Authentication

All API routes require Clerk authentication. Include session token in requests.

```typescript
// Automatic in Next.js server components
const { userId } = await auth();

// Client-side with fetch
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${await getToken()}`,
  },
});
```

## 📋 Response Format

### Success
```json
{
  "success": true,
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
```

## 🎫 Tickets API

### GET `/api/tickets`
Fetch tickets for current user (filtered by role).

**Query Parameters:**
- `status` - Filter by status
- `category` - Filter by category ID
- `search` - Search in title/description
- `page` - Page number (default: 1)
- `limit` - Results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": {
    "tickets": [...],
    "pagination": {
      "page": 1,
      "totalPages": 5,
      "totalCount": 100
    }
  }
}
```

### POST `/api/tickets`
Create new ticket.

**Body:**
```json
{
  "title": "Broken fan in Room 204",
  "description": "The ceiling fan is not working",
  "categoryId": 3,
  "subcategoryId": 12,
  "location": "Hostel Block A",
  "details": {
    "roomNumber": "204",
    "priority": "high"
  },
  "attachments": ["url1", "url2"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "status": "OPEN",
    ...
  }
}
```

### GET `/api/tickets/[id]`
Get single ticket details.

**Authorization:** Owner or assigned admin

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 123,
    "title": "...",
    "status": "IN_PROGRESS",
    "creator": { "name": "...", "email": "..." },
    "assignedTo": { "name": "...", "email": "..." },
    "comments": [...],
    "activityLog": [...]
  }
}
```

### PATCH `/api/tickets/[id]`
Update ticket (admin only).

**Body:**
```json
{
  "status": "RESOLVED",
  "comment": "Issue fixed, replaced fan"
}
```

### DELETE `/api/tickets/[id]`
Delete ticket (super-admin only).

## 📂 Categories API

### GET `/api/categories`
Get category hierarchy.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Hostel",
      "subcategories": [
        {
          "id": 2,
          "name": "Maintenance",
          "subSubcategories": [...]
        }
      ]
    }
  ]
}
```

### GET `/api/filters/categories`
Get flattened categories for  filtering.

### POST `/api/admin/categories`
Create category (super-admin only).

## 👥 Users API

### GET `/api/users/me`
Get current user profile.

### PATCH `/api/users/me`
Update own profile.

## 🎚️ Admin APIs

### Super Admin Only

#### GET `/api/admin/ticket-statuses`
Get all ticket statuses.

#### POST `/api/admin/ticket-statuses`
Create new status.

**Body:**
```json
{
  "value": "ON_HOLD",
  "label": "On Hold",
  "progress_percent": 40,
  "badge_color": "outline",
  "is_active": true,
  "is_final": false
}
```

#### PATCH `/api/admin/ticket-statuses/[id]`
Update status.

#### DELETE `/api/admin/ticket-statuses/[id]`
Delete status (fails if tickets exist).

### Admin/Super Admin

#### GET `/api/admin/stats`
Get dashboard statistics.

#### POST `/api/admin/assign`
Assign ticket to admin.

#### POST `/api/admin/escalate`
Escalate ticket.

## 📊 Analytics API

### GET `/api/analytics/tickets`
Get ticket analytics.

**Query:**
- `domain` - Filter by domain
- `dateFrom` - Start date
- `dateTo` - End date
- `groupBy` - day/week/month/category

## 🔔 Notifications API (Coming Soon)

### GET `/api/notifications`
Get user notifications.

### PATCH `/api/notifications/[id]/read`
Mark as read.

## ⚠️ Rate Limits

- **Students**: 5 tickets/week
- **API**: 100 requests/minute per user
- **Upload**: 4MB per file, 5 files per ticket

## 🧪 Testing

Use tools like:
- **Postman** / **Insomnia** - API testing
- **curl** - Command line

Example:
```bash
curl -X POST http://localhost:3000/api/tickets \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Test","description":"Test desc","categoryId":1}'
```

## 📝 Notes

- All timestamps in ISO 8601 format
- IDs are numeric (serial)
- Soft deletes used where applicable
- JSONB fields for flexible metadata
