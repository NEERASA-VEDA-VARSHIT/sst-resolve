# UI Components and Patterns

## Overview

SST-Resolve uses shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The UI follows modern React patterns with TypeScript for type safety.

## Technology Stack

### Component Library
- **shadcn/ui** - Pre-built components
- **Radix UI** - Headless UI primitives
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Icon library

### State Management
- **React useState** - Local state
- **React useEffect** - Side effects
- **React Context** - Global state (minimal)
- **URL state** - Filters and pagination

### Form Management
- **React Hook Form** - Form state
- **Zod** - Validation
- **@hookform/resolvers** - Integration

## Core Components

### Button

```typescript
import { Button } from "@/components/ui/button";

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Cancel</Button>
<Button variant="ghost">Ghost</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>

// With icon
<Button>
  <Plus className="w-4 h-4 mr-2" />
  Create Ticket
</Button>

// Loading state
<Button disabled={loading}>
  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
  Submit
</Button>
```

### Dialog/Modal

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function MyDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Open Dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Make changes to student information
          </DialogDescription>
        </DialogHeader>
        {/* Content */}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Form Components

```typescript
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";

export function MyForm() {
  const form = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Enter title" />
              </FormControl>
              <FormDescription>
                Brief description of the issue
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  );
}
```

### Select Dropdown

```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="hostel">Hostel</SelectItem>
    <SelectItem value="food">Food</SelectItem>
    <SelectItem value="academic">Academic</SelectItem>
  </SelectContent>
</Select>
```

### Table

```typescript
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>ID</TableHead>
      <TableHead>Title</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {tickets.map((ticket) => (
      <TableRow key={ticket.id}>
        <TableCell>{ticket.id}</TableCell>
        <TableCell>{ticket.title}</TableCell>
        <TableCell>
          <Badge>{ticket.status}</Badge>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Common Patterns

### Loading States

```typescript
export function TicketList() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    async function fetchTickets() {
      setLoading(true);
      const response = await fetch("/api/tickets");
      const data = await response.json();
      setTickets(data.tickets);
      setLoading(false);
    }
    fetchTickets();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {tickets.map((ticket) => (
        <TicketCard key={ticket.id} ticket={ticket} />
      ))}
    </div>
  );
}
```

### Error Handling

```typescript
export function TicketForm() {
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(data: FormData) {
    try {
      setError(null);
      const response = await fetch("/api/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      toast.success("Ticket created!");
    } catch (err) {
      setError(err.message);
      toast.error("Failed to create ticket");
    }
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Form onSubmit={onSubmit} />
    </div>
  );
}
```

### Optimistic Updates

```typescript
export function TicketStatus({ ticket }: Props) {
  const [optimisticStatus, setOptimisticStatus] = useState(ticket.status);

  async function updateStatus(newStatus: string) {
    // Update UI immediately
    setOptimisticStatus(newStatus);

    try {
      await fetch(`/api/tickets/${ticket.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      toast.success("Status updated");
    } catch (error) {
      // Revert on error
      setOptimisticStatus(ticket.status);
      toast.error("Failed to update status");
    }
  }

  return (
    <Select value={optimisticStatus} onValueChange={updateStatus}>
      {/* Options */}
    </Select>
  );
}
```

### Pagination

```typescript
export function PaginatedList() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get("page") || "1");

  const goToPage = (newPage: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", newPage.toString());
    router.push(`?${params.toString()}`);
  };

  return (
    <div>
      {/* List content */}
      <div className="flex items-center justify-between">
        <Button
          onClick={() => goToPage(page - 1)}
          disabled={page === 1}
        >
          Previous
        </Button>
        <span>Page {page}</span>
        <Button onClick={() => goToPage(page + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
```

## Responsive Design

### Mobile-First Approach

```typescript
<div className="
  grid 
  grid-cols-1 
  md:grid-cols-2 
  lg:grid-cols-3 
  gap-4
">
  {/* Responsive grid */}
</div>

<div className="
  flex 
  flex-col 
  md:flex-row 
  gap-4
">
  {/* Stack on mobile, row on desktop */}
</div>
```

### Breakpoints

```typescript
// Tailwind breakpoints
sm: 640px   // Small devices
md: 768px   // Medium devices
lg: 1024px  // Large devices
xl: 1280px  // Extra large
2xl: 1536px // 2X large
```

## Accessibility

### Keyboard Navigation

```typescript
<Button
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }}
>
  Click me
</Button>
```

### ARIA Labels

```typescript
<button
  aria-label="Close dialog"
  aria-describedby="dialog-description"
>
  <X className="w-4 h-4" />
</button>
```

### Focus Management

```typescript
import { useRef, useEffect } from "react";

export function Dialog({ open }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      closeButtonRef.current?.focus();
    }
  }, [open]);

  return (
    <div>
      <button ref={closeButtonRef}>Close</button>
    </div>
  );
}
```

## Summary

### Technologies:
- ✅ shadcn/ui - Component library
- ✅ Radix UI - Primitives
- ✅ Tailwind CSS - Styling
- ✅ Lucide React - Icons
- ✅ React Hook Form - Forms

### Patterns:
- Loading states with Skeleton
- Error handling with Alert
- Optimistic updates
- URL-based state
- Responsive design
- Accessibility features
