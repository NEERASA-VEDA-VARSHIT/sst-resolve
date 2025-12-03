/**
 * Committee Dashboard Layout
 * Note: Auth and role checks are handled by parent committee/layout.tsx
 */
export default async function CommitteeDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  return (
    <div className="min-h-screen pt-16 lg:pt-0">
      {children}
    </div>
  );
}

