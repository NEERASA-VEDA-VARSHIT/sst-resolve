# Project Structure

This document describes the organized project structure following Next.js and shadcn/ui best practices.

## Directory Structure

```
sst-resolve/
├── src/
│   ├── app/                    # Next.js App Router pages and layouts
│   │   ├── (app)/             # Protected dashboard routes (route group)
│   │   │   └── dashboard/     # Dashboard routes
│   │   │       ├── superadmin/ # Super admin dashboard
│   │   │       ├── admin/      # Admin dashboard
│   │   │       ├── student/    # Student dashboard
│   │   │       ├── layout.tsx  # Dashboard layout (Sidebar wrapper)
│   │   │       └── page.tsx    # Dashboard entry (redirects by role)
│   │   ├── (auth)/            # Authentication pages (route group)
│   │   │   └── login/         # Login/auth pages
│   │   ├── api/               # API routes
│   │   │   ├── profile/       # Profile API endpoints
│   │   │   ├── slack/         # Slack integration endpoints
│   │   │   └── tickets/       # Ticket management endpoints
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   ├── components/            # Reusable UI components
│   │   ├── admin/             # Admin-specific components
│   │   ├── layout/             # Layout components (Sidebar, Navigation, etc.)
│   │   ├── tickets/           # Ticket-related components
│   │   └── ui/                # shadcn/ui components
│   ├── conf/                  # Configuration files
│   ├── db/                    # Database configuration and schemas
│   │   ├── drizzle/           # Drizzle migrations
│   │   │   └── migrations/   # Generated migration files
│   │   ├── index.ts           # Database connection and exports
│   │   ├── migrate.ts          # Migration utilities
│   │   └── schema.ts          # Drizzle ORM schema definitions
│   ├── hook/                  # React hooks
│   ├── lib/                   # Utility functions and configurations
│   │   ├── categories.ts       # Category and location definitions
│   │   ├── db.ts              # Deprecated - use @/db instead
│   │   ├── email.ts           # Email utilities (Nodemailer)
│   │   ├── slack.ts           # Slack integration utilities
│   │   └── utils.ts           # General utilities (cn function, etc.)
│   ├── model/                 # Data models
│   ├── provider/              # React context providers
│   ├── schema/                # Zod validation schemas
│   ├── types/                 # TypeScript type definitions
│   │   └── globals.d.ts       # Global type declarations (Clerk roles, etc.)
│   └── utils/                 # Helper functions
├── public/                     # Static assets (images, icons)
├── components.json             # shadcn/ui configuration
├── drizzle.config.ts           # Drizzle Kit configuration
└── package.json                # Dependencies and scripts
```

## Key Directories Explained

- **src/app/** - Next.js App Router pages and layouts
  - **(app)/dashboard/** - Protected dashboard routes
    - **superadmin/** - Super admin dashboard (full access)
    - **admin/** - Admin dashboard (ticket management)
    - **student/** - Student dashboard (own tickets)
    - **layout.tsx** - Dashboard layout wrapper (includes Sidebar)
    - **page.tsx** - Entry point that redirects based on user role
  - **(auth)/login/** - Authentication pages
- **src/components/** - Reusable UI components
  - **ui/** - shadcn/ui components
- **src/db/** - Database configuration and schemas
  - **drizzle/** - Migration files
- **src/lib/** - Utility functions and configurations
- **src/schema/** - Zod validation schemas
- **src/types/** - TypeScript type definitions
- **src/utils/** - Helper functions
- **src/conf/** - Configuration files
- **src/hook/** - React hooks
- **src/model/** - Data models
- **src/provider/** - React context providers
- **public/** - Static assets (images, icons)

## Import Paths

All imports use the `@/` alias which maps to `src/`:

- `@/db` - Database connection and schema exports
- `@/components` - UI components
- `@/lib` - Utility functions
- `@/types` - TypeScript types
- `@/schema` - Zod validation schemas
- `@/utils` - Helper functions

## Tech Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM
- **Styling**: Tailwind CSS
- **UI Library**: shadcn/ui
- **Data Validator**: Zod
- **Icons**: Lucide Icons
- **Package Manager**: pnpm
- **Linting**: ESLint 9