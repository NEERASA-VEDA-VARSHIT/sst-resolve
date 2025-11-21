# SST-Resolve: Architecture & Technical Stack

## 🏗️ System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Student Portal  │  Admin Dashboard  │  Super Admin Panel   │
│  (Next.js Pages) │  (Next.js Pages)  │  (Next.js Pages)     │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────┤
│  • API Routes (Next.js Route Handlers)                      │
│  • Server Components (RSC)                                   │
│  • Server Actions                                            │
│  • Middleware (Auth, RBAC)                                   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     BUSINESS LOGIC LAYER                     │
├─────────────────────────────────────────────────────────────┤
│  • Ticket Management                                         │
│  • Role-Based Access Control                                │
│  • Escalation Engine                                         │
│  • Notification Service                                      │
│  • Analytics Engine                                          │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                       DATA LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  • Drizzle ORM                                              │
│  • PostgreSQL Database                                       │
│  • File Storage (Uploadthing)                               │
│  • Cache Layer (Next.js Cache)                              │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                         │
├─────────────────────────────────────────────────────────────┤
│  • Clerk (Authentication)                                    │
│  • Uploadthing (File Storage)                               │
│  • Resend (Email)                                           │
│  • Slack (Optional notifications)                           │
└─────────────────────────────────────────────────────────────┘
```

## 💻 Technology Stack

### Frontend

#### Core Framework
- **Next.js 14** (App Router)
  - React Server Components (RSC)
  - Server Actions
  - Route Handlers
  - Edge Runtime support

#### UI/UX
- **React 18** - Component library
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
  - Radix UI primitives
  - Customizable, composable components
- **Lucide React** - Icon library
- **date-fns** - Date manipulation

#### Form Management
- **React Hook Form** - Form state management
- **Zod** - Schema validation

#### State Management
- **React Hooks** - Local state
- **URL State** - Filter persistence
- **Server State** - Database queries via RSC

### Backend

#### Framework
- **Next.js API Routes** - RESTful endpoints
- **Server Actions** - Form mutations
- **Edge Runtime** - Fast, global execution

#### Database
- **PostgreSQL** - Primary database
- **Drizzle ORM** - Type-safe SQL builder
  - Schema definition
  - Migrations
  - Query builder
  - Type inference

#### Authentication & Authorization
- **Clerk** - User authentication
  - OAuth providers
  - Session management
- **Custom RBAC** - Role-based access control
  - Database-driven roles
  - Domain/scope based permissions

#### File Storage
- **Uploadthing** - File uploads
  - Image optimization
  - Secure URLs
  - Size limits

### Infrastructure

#### Hosting
- **Vercel** (Recommended)
  - Serverless functions
  - Edge functions
  - Automatic scaling
  - CDN

#### Database Hosting
- **Neon** / **Supabase** / **Railway**
  - PostgreSQL as a service
  - Automatic backups
  - Connection pooling

#### Monitoring
- **Vercel Analytics** - Performance monitoring
- **PostgreSQL Logs** - Query performance
- **Error Tracking** - Server-side errors

## 🗄️ Database Schema

### Core Tables

#### Users & Authentication
```
users
├── id (uuid, PK)
├── clerk_id (unique)
├── email (unique)
├── name
├── phone
└── timestamps

user_roles
├── id (serial, PK)
├── user_id (FK → users)
├── role_id (FK → roles)
├── domain (e.g., "Hostel", "College")
├── scope (e.g., "Neeladri", "Computer Science")
└── granted_by (FK → users)
```

#### Students
```
students
├── id (serial, PK)
├── student_uid (uuid, unique)
├── user_id (FK → users)
├── roll_no (unique)
├── room_no
├── hostel_id (FK → hostels)
├── class_section_id (FK → class_sections)
├── batch_id (FK → batches)
├── active (boolean)
└── rate limiting fields
```

#### Staff & Admins
```
staff
├── id (serial, PK)
├── user_id (FK → users)
├── full_name
├── email
├── slack_user_id
├── phone
├── domain (Hostel/College)
├── scope (specific area)
└── timestamps
```

#### Tickets
```
tickets
├── id (serial, PK)
├── title
├── description
├── location
├── status (enum)
├── category_id (FK → categories)
├── created_by (FK → users)
├── assigned_to (FK → staff)
├── acknowledged_by (FK → staff)
├── group_id (FK → ticket_groups)
├── escalation_level
├── due_at
├── metadata (JSONB)
├── attachments (JSONB)
└── timestamps
```

#### Categories & Fields
```
categories
├── id (serial, PK)
├── name
├── slug (unique)
├── description
├── icon
├── color
├── sla_hours
├── default_authority (FK → staff)
├── committee_id (FK → committees)
├── parent_category_id (self-FK)
├── active
└── display_order

category_fields
├── id (serial, PK)
├── subcategory_id (FK)
├── name
├── slug
├── field_type (text/select/date/etc.)
├── required
├── validation_rules (JSONB)
├── display_order
└── active
```

#### Dynamic Configuration
```
ticket_statuses ⭐ (NEW - Dynamic!)
├── id (serial, PK)
├── value (unique)
├── label
├── description
├── progress_percent (0-100)
├── badge_color
├── is_active
├── is_final
└── display_order
```

### Relationships

```
users ──1:N→ students
users ──1:N→ staff
users ──N:M→ roles (via user_roles)
users ──1:N→ tickets (created_by)

staff ──1:N→ tickets (assigned_to)
staff ──1:N→ categories (default_authority)

categories ──1:N→ subcategories
subcategories ──1:N→ sub_subcategories
subcategories ──1:N→ category_fields

tickets ──1:N→ comments
tickets ──1:N→ escalations
tickets ──1:N→ activity_logs
```

## 🔧 Key Design Patterns

### 1. Server Components First
- Data fetching in server components
- Reduce client-side JavaScript
- Faster initial page loads

### 2. Parallel Data Fetching
```typescript
const [tickets, categories, stats] = await Promise.all([
  getTickets(),
  getCategories(),
  getStats(),
]);
```

### 3. Dynamic Imports
```typescript
const TicketForm = dynamic(() => import('@/components/TicketForm'), {
  ssr: false,
});
```

### 4. URL State Management
- Filters persist in URL query params
- Shareable URLs
- Browser back/forward works naturally

### 5. Optimistic UI Updates
- Immediate feedback on actions
- Background sync with server
- Rollback on errors

### 6. Type Safety End-to-End
```typescript
// Drizzle schema → TypeScript types
type Ticket = typeof tickets.$inferSelect;

// API responses typed
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## 📁 Project Structure

```
sst-resolve/
├── src/
│   ├── app/
│   │   ├── (app)/              # Authenticated routes
│   │   │   ├── student/
│   │   │   ├── admin/
│   │   │   └── superadmin/
│   │   ├── api/                # API routes
│   │   │   ├── tickets/
│   │   │   ├── categories/
│   │   │   └── admin/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                 # shadcn components
│   │   ├── layout/             # Layout components
│   │   ├── student/
│   │   ├── admin/
│   │   └── dashboard/
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── db-roles.ts
│   │   ├── user-sync.ts
│   │   ├── status/
│   │   ├── ticket/
│   │   └── filters/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── drizzle/
│   │       └── migrations/
│   ├── hooks/
│   │   └── use-toast.ts
│   └── types/
├── public/
├── docs/                       # Documentation (NEW!)
├── drizzle.config.ts
├── next.config.js
├── tailwind.config.ts
└── package.json
```

## 🔄 Data Flow

### Ticket Creation Flow
```
1. Student fills form → Client validation (Zod)
2. Form submit → Server Action
3. Server Action → Validate data
4. Server Action → Create ticket in DB
5. Server Action → Assign to POC (based on category)
6. Server Action → Send notification
7. Server Action → Return success
8. Client → Show toast, redirect to ticket view
```

### Filtering Flow
```
1. User changes filter → Update URL params
2. URL change → Trigger server component re-render
3. Server component → Parse URL params
4. Server component → Build DB query
5. Server component → Fetch filtered data
6. Server component → Return JSX with data
```

## ⚡ Performance Optimizations

### Caching Strategy
- **Static Pages**: ISR for public pages
- **Dynamic Data**: Unstable_cache with tags
- **CDN**: Static assets via Vercel Edge
- **Database**: Connection pooling, indexed queries

### Code Splitting
- Route-based splitting (automatic)
- Dynamic imports for heavy components
- Lazy loading for below-the-fold content

### Database Optimization
- Indexes on frequently queried columns
- JSONB for flexible metadata (indexed)
- Partial indexes for filtered queries
- Query optimization (select only needed columns)

### Edge Runtime
- Fast global response times
- Reduced cold starts
- Automatic scaling

## 🔒 Security Implementation

### Authentication Flow
```
Clerk → JWT → Middleware → DB Role Lookup → Route Access
```

### Authorization Layers
1. **Route Level**: Middleware checks authentication
2. **Component Level**: Server components check role
3. **Data Level**: Queries filter by user domain/scope
4. **API Level**: Route handlers validate permissions

### SQL Injection Prevention
```typescript
// Drizzle ORM parameterizes all queries
const tickets = await db
  .select()
  .from(tickets)
  .where(eq(tickets.id, id)); // Safe, parameterized
```

### XSS Prevention
- React auto-escapes by default
- CSP headers configured
- Sanitize user input

## 🧪 Testing Strategy (Recommended)

### Unit Tests
- Helper functions
- Utility functions
- Validation schemas

### Integration Tests
- API routes
- Server actions
- Database operations

### E2E Tests (Playwright)
- Critical user flows
- Ticket creation
- Status updates
- Admin operations

---

**This architecture provides**: Scalability, maintainability, type safety, and excellent developer experience.
