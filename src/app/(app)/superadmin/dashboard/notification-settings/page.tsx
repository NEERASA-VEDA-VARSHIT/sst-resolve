import { NotificationSettingsManager } from "@/components/superadmin/NotificationSettingsManager";

export const dynamic = "force-dynamic";

/**
 * Super Admin Notification Settings Page
 * Note: Auth and role checks are handled by superadmin/layout.tsx
 */
export default async function NotificationSettingsPage() {

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
          Notification Settings
        </h1>
        <p className="text-muted-foreground">
          Manage Slack channels and email CC recipients for ticket notifications
        </p>
      </div>

      <NotificationSettingsManager />
    </div>
  );
}
