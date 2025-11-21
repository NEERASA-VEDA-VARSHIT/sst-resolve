"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Bell, 
  Users, 
  Settings, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface NotificationSettings {
  slack_enabled: boolean;
  email_enabled: boolean;
  tat_reminders_enabled: boolean;
  committee_notifications_enabled: boolean;
  slack_config: {
    hostel_channel?: string;
    college_channel?: string;
    committee_channel?: string;
  };
}

interface Category {
  id: number;
  name: string;
  slug: string;
  default_admin_id: string | null;
  domain_id: number | null;
  scope_id: number | null;
}

interface Assignment {
  id: number;
  category_id: number;
  user_id: string;
  is_primary: boolean;
  priority: number;
  user: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
}

export function TicketAssignmentManager() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Fetch notification settings
      const notifResponse = await fetch("/api/superadmin/settings/notifications");
      if (notifResponse.ok) {
        const notifData = await notifResponse.json();
        setNotificationSettings(notifData);
      }

      // Fetch categories
      const catResponse = await fetch("/api/admin/categories");
      if (catResponse.ok) {
        const catData = await catResponse.json();
        setCategories(catData.categories || []);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="assignments">Admin Assignments</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        {/* Assignment Priority Explanation */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Ticket Assignment Priority
            </CardTitle>
            <CardDescription>
              When a new ticket is created, the system assigns it to an admin using this priority order:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">1</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Sub-subcategory Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    Most specific: If a sub-subcategory has an assigned admin, that admin gets the ticket.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">2</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Subcategory Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    If subcategory has an assigned admin, that admin gets the ticket.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">3</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Dynamic Field Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    If a category field has an assigned admin based on field value, that admin gets the ticket.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">4</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Category Assignments (Many-to-Many)</p>
                  <p className="text-sm text-muted-foreground">
                    Checks <code className="text-xs bg-background px-1 py-0.5 rounded">category_assignments</code> table.
                    Priority: Primary assignments first, then by priority number, then by creation date.
                  </p>
                  <Button variant="link" size="sm" className="mt-2 p-0 h-auto" asChild>
                    <Link href="/superadmin/dashboard/categories">
                      Manage Category Assignments <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">5</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Category Default Admin</p>
                  <p className="text-sm text-muted-foreground">
                    Fallback: If category has a <code className="text-xs bg-background px-1 py-0.5 rounded">default_admin_id</code>, that admin gets the ticket.
                  </p>
                  <Button variant="link" size="sm" className="mt-2 p-0 h-auto" asChild>
                    <Link href="/superadmin/dashboard/categories">
                      Set Default Admin <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <Badge variant="default" className="mt-0.5">6</Badge>
                <div className="flex-1">
                  <p className="font-semibold">Domain + Scope Matching</p>
                  <p className="text-sm text-muted-foreground">
                    Final fallback: Matches ticket category/location to admin&apos;s domain/scope assignment.
                  </p>
                  <Button variant="link" size="sm" className="mt-2 p-0 h-auto" asChild>
                    <Link href="/superadmin/dashboard/staff">
                      Manage Domain/Scope Assignments <ArrowRight className="w-3 h-3 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                If no admin is found through any of these methods, the ticket remains <strong>unassigned</strong> and can be manually assigned later.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categories.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Total categories</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {notificationSettings?.slack_enabled && notificationSettings?.email_enabled ? "Both" : 
                 notificationSettings?.slack_enabled ? "Slack" :
                 notificationSettings?.email_enabled ? "Email" : "None"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active channels</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                {notificationSettings?.slack_enabled || notificationSettings?.email_enabled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                <span className="text-sm font-medium">
                  {notificationSettings?.slack_enabled || notificationSettings?.email_enabled 
                    ? "Configured" 
                    : "Not Configured"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="assignments" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Manage Admin Assignments</CardTitle>
            <CardDescription>
              Assign admins to categories for automatic ticket assignment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-semibold">Category Assignments</h3>
              <p className="text-sm text-muted-foreground">
                Assign multiple admins to categories with priority levels. Primary assignments are used first.
              </p>
              <Button asChild>
                <Link href="/superadmin/dashboard/categories">
                  <Users className="w-4 h-4 mr-2" />
                  Manage Category Assignments
                </Link>
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <h3 className="font-semibold">Domain/Scope Assignments</h3>
              <p className="text-sm text-muted-foreground">
                Set primary domain (Hostel/College) and scope (specific hostel) for admins. Used as fallback assignment.
              </p>
              <Button asChild variant="outline">
                <Link href="/superadmin/dashboard/staff">
                  <Settings className="w-4 h-4 mr-2" />
                  Manage Staff Domain/Scope
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="notifications" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
            <CardDescription>
              Configure Slack and email notifications for ticket events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/superadmin/settings/notifications">
                <Bell className="w-4 h-4 mr-2" />
                Open Notification Settings
              </Link>
            </Button>
          </CardContent>
        </Card>

        {notificationSettings && (
          <Card>
            <CardHeader>
              <CardTitle>Current Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Slack Notifications</span>
                <Badge variant={notificationSettings.slack_enabled ? "default" : "secondary"}>
                  {notificationSettings.slack_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Email Notifications</span>
                <Badge variant={notificationSettings.email_enabled ? "default" : "secondary"}>
                  {notificationSettings.email_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">TAT Reminders</span>
                <Badge variant={notificationSettings.tat_reminders_enabled ? "default" : "secondary"}>
                  {notificationSettings.tat_reminders_enabled ? "Enabled" : "Disabled"}
                </Badge>
              </div>
              {notificationSettings.slack_config && (
                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-medium">Slack Channels:</p>
                  {notificationSettings.slack_config.hostel_channel && (
                    <div className="text-sm text-muted-foreground">
                      Hostel: <code className="bg-muted px-1 py-0.5 rounded">{notificationSettings.slack_config.hostel_channel}</code>
                    </div>
                  )}
                  {notificationSettings.slack_config.college_channel && (
                    <div className="text-sm text-muted-foreground">
                      College: <code className="bg-muted px-1 py-0.5 rounded">{notificationSettings.slack_config.college_channel}</code>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

