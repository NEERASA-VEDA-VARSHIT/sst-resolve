// Force dynamic rendering for authenticated routes
export const dynamic = 'force-dynamic';

/**
 * Super Admin Dashboard Layout
 * Note: Auth and role checks are handled by parent superadmin/layout.tsx
 */
export default async function SuperAdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pb-16 lg:pb-0 pt-16 lg:pt-0">
      <main className="min-h-screen p-4 md:p-6 lg:p-8">{children}</main>
    </div>
  );
}


