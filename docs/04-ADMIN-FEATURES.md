# Admin Features and Dashboard

## Overview

The admin dashboard provides comprehensive tools for managing tickets, viewing analytics, and performing bulk operations. It includes role-based features for admins, senior admins, and super admins.

## Technology Stack

### Data Visualization
- **Recharts** - Charts and graphs
- **date-fns** - Date manipulation
- **Custom calculations** - Performance metrics

### UI Components
- **shadcn/ui** - Dashboard components
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

### Data Fetching
- **Next.js Server Components** - Server-side rendering
- **Drizzle ORM** - Database queries
- **PostgreSQL** - Aggregations and analytics

## Dashboard Analytics

### Performance Metrics

**File**: `src/app/(app)/admin/dashboard/analytics/page.tsx`

```typescript
export default async function AdminAnalyticsPage() {
  const { userId } = await auth();
  const user = await getOrCreateUser(userId);
  const staffMember = await db.query.staff.findFirst({
    where: eq(staff.user_id, user.id)
  });

  // Fetch tickets assigned to this admin
  const tickets = await db.query.tickets.findMany({
    where: eq(tickets.assigned_to, staffMember.id),
    with: {
      category: true,
      created_by_user: true,
    },
  });

  // Calculate metrics
  const metrics = {
    total: tickets.length,
    open: tickets.filter(t => t.status === "OPEN").length,
    in_progress: tickets.filter(t => t.status === "IN_PROGRESS").length,
    resolved: tickets.filter(t => t.status === "RESOLVED").length,
    avg_resolution_time: calculateAvgResolutionTime(tickets),
    sla_compliance: calculateSLACompliance(tickets),
  };

  return (
    <div className="space-y-6">
      <StatsCards metrics={metrics} />
      <TicketsByCategory tickets={tickets} />
      <ResolutionTimeChart tickets={tickets} />
      <RecentActivity tickets={tickets} />
    </div>
  );
}
```

**Technologies:**
- Server Components for data fetching
- Drizzle ORM with relations
- Custom metric calculations

### Charts with Recharts

```typescript
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TicketsByCategory({ tickets }: Props) {
  const data = tickets.reduce((acc, ticket) => {
    const category = ticket.category.name;
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(data).map(([name, count]) => ({
    name,
    count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tickets by Category</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Technologies:**
- Recharts for visualization
- Responsive containers
- Custom data aggregation

## Ticket Filtering

### Advanced Filters

**File**: `src/components/admin/TicketFilters.tsx`

```typescript
"use client";

export function TicketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [filters, setFilters] = useState({
    status: searchParams.get("status") || "all",
    category: searchParams.get("category") || "all",
    priority: searchParams.get("priority") || "all",
    dateRange: searchParams.get("dateRange") || "all",
  });

  const applyFilters = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "all") {
        params.set(key, value);
      }
    });
    router.push(`?${params.toString()}`);
  };

  return (
    <Card>
      <CardContent className="grid grid-cols-4 gap-4 p-4">
        <Select
          value={filters.status}
          onValueChange={(value) => setFilters({ ...filters, status: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
          </SelectContent>
        </Select>

        {/* More filters... */}

        <Button onClick={applyFilters}>Apply Filters</Button>
      </CardContent>
    </Card>
  );
}
```

## Escalation System

### Escalate API

**File**: `src/app/api/tickets/[id]/escalate/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: Props) {
  const { userId } = await auth();
  const { id } = await params;
  const ticketId = parseInt(id);

  const ticket = await db.query.tickets.findFirst({
    where: eq(tickets.id, ticketId),
  });

  // Find next level admin
  const currentAdmin = await db.query.staff.findFirst({
    where: eq(staff.id, ticket.assigned_to),
  });

  const nextAdmin = await db.query.staff.findFirst({
    where: and(
      eq(staff.domain, currentAdmin.domain),
      // Find senior admin or super admin
    ),
  });

  // Update ticket
  await db.transaction(async (tx) => {
    await tx.update(tickets).set({
      status: "ESCALATED",
      assigned_to: nextAdmin.id,
      escalation_level: ticket.escalation_level + 1,
      last_escalation_at: new Date(),
    }).where(eq(tickets.id, ticketId));

    // Log escalation
    await tx.insert(escalations).values({
      ticket_id: ticketId,
      escalated_by: user.id,
      escalated_to: nextAdmin.id,
      level: ticket.escalation_level + 1,
    });

    // Create notification
    await tx.insert(outbox).values({
      event_type: "ticket.escalated",
      payload: { ticket_id: ticketId, admin_id: nextAdmin.id },
    });
  });

  return NextResponse.json({ success: true });
}
```

## Forwarding System

**File**: `src/app/api/tickets/[id]/forward/route.ts`

```typescript
export async function POST(request: NextRequest, { params }: Props) {
  // Similar to escalate but:
  // - Sets status to FORWARDED (not ESCALATED)
  // - Doesn't increment escalation_level
  // - Used for workflow progression, not urgent issues

  await db.update(tickets).set({
    status: "FORWARDED",
    assigned_to: nextAdmin.id,
  }).where(eq(tickets.id, ticketId));
}
```

## Bulk Operations

### Bulk Status Update

**File**: `src/app/api/tickets/bulk-update/route.ts`

```typescript
const BulkUpdateSchema = z.object({
  ticket_ids: z.array(z.number()),
  action: z.enum(["status", "assign", "category"]),
  value: z.any(),
});

export async function PATCH(request: NextRequest) {
  const { userId } = await auth();
  const role = await getUserRoleFromDB(userId);

  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = BulkUpdateSchema.safeParse(body);

  const { ticket_ids, action, value } = parsed.data;

  if (action === "status") {
    await db.update(tickets)
      .set({ status: value, updated_at: new Date() })
      .where(inArray(tickets.id, ticket_ids));
  } else if (action === "assign") {
    await db.update(tickets)
      .set({ assigned_to: value, updated_at: new Date() })
      .where(inArray(tickets.id, ticket_ids));
  }

  return NextResponse.json({
    success: true,
    updated: ticket_ids.length,
  });
}
```

**Technologies:**
- Zod for validation
- Drizzle `inArray` for bulk operations
- Transaction support

## Summary

### Technologies:
- ✅ Recharts - Data visualization
- ✅ Server Components - SSR
- ✅ Drizzle ORM - Database
- ✅ shadcn/ui - UI components
- ✅ Zod - Validation

### Features:
- Performance analytics
- Advanced filtering
- Escalation workflows
- Forwarding system
- Bulk operations
- Real-time metrics
