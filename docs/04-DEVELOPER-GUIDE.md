# SST-Resolve: Developer Guide

## 🛠️ Quick Setup

### Prerequisites
- Node.js v18+
- pnpm v8+
- PostgreSQL v14+

### Installation

```bash
# Clone and install
git clone <repo-url>
cd sst-resolve
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Setup database
pnpm drizzle-kit push
npx tsx src/scripts/seed-ticket-statuses.ts

# Start dev server
pnpm dev
```

## 📁 Key Directories

```
src/
├── app/           # Next.js pages & API routes
├── components/    # React components
├── lib/           # Utilities & business logic
├── db/            # Database schema & migrations
└── hooks/         # Custom React hooks
```

## 🔧 Common Tasks

### Add New Component
```bash
npx shadcn-ui@latest add [component-name]
```

### Database Changes
```bash
# 1. Edit src/db/schema.ts
# 2. Generate migration
pnpm drizzle-kit generate
# 3. Apply
pnpm drizzle-kit push
```

### Create API Route
File: `src/app/api/[route]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  
  // Your logic here
  return NextResponse.json({ success: true, data: [] });
}
```

## 🎨 Code Style

- **Files**: PascalCase for components, camelCase for utilities
- **Imports**: Group by external → internal → relative
- **Types**: Always explicit, avoid `any`
- **Tailwind**: Mobile-first, organized classes

## 🐛 Debugging

- Server logs: Terminal
- Client logs: Browser DevTools
- DB queries: Set `logger: true` in drizzle config
- API: Network tab + console.log

## 🚀 Deployment

**Vercel** (recommended):
1. Connect GitHub repo
2. Add environment variables
3. Deploy (automatic on push)

**Database**: Use managed Postgres (Neon/Supabase/Railway)

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Drizzle ORM](https://orm.drizzle.team/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [Clerk Auth](https://clerk.com/docs)
