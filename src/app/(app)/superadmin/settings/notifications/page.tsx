"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Save, TestTube } from "lucide-react";

export default function NotificationSettingsPage() {
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);

    const [settings, setSettings] = useState({
        slack_enabled: true,
        email_enabled: true,
        tat_reminders_enabled: true,
        committee_notifications_enabled: true,
    });

    const [slackConfig, setSlackConfig] = useState({
        hostel_channel: "#tickets-hostel",
        college_channel: "#tickets-college",
        committee_channel: "#tickets-committee",
    });

    async function saveSettings() {
        try {
            setLoading(true);
            const response = await fetch("/api/superadmin/settings/notifications", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings, slackConfig }),
            });

            if (!response.ok) throw new Error("Failed to save");
            toast.success("Settings saved successfully");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    }

    async function testSlackConnection() {
        try {
            setTesting(true);
            const response = await fetch("/api/superadmin/settings/test-slack", {
                method: "POST",
            });

            if (!response.ok) throw new Error("Connection test failed");
            toast.success("Slack connection successful!");
        } catch (error) {
            toast.error("Slack connection failed");
        } finally {
            setTesting(false);
        }
    }

    return (
        <div className="container mx-auto py-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-3xl font-bold">Notification Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Configure Slack and email notifications for ticket events
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>General Settings</CardTitle>
                    <CardDescription>
                        Enable or disable notification channels
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Slack Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Send ticket updates to Slack channels
                            </p>
                        </div>
                        <Switch
                            checked={settings.slack_enabled}
                            onCheckedChange={(checked: boolean) =>
                                setSettings({ ...settings, slack_enabled: checked })
                            }
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Email Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Send email updates to students and admins
                            </p>
                        </div>
                        <Switch
                            checked={settings.email_enabled}
                            onCheckedChange={(checked: boolean) =>
                                setSettings({ ...settings, email_enabled: checked })
                            }
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">TAT Reminders</Label>
                            <p className="text-sm text-muted-foreground">
                                Daily reminders at 9 AM for tickets due today
                            </p>
                        </div>
                        <Switch
                            checked={settings.tat_reminders_enabled}
                            onCheckedChange={(checked: boolean) =>
                                setSettings({ ...settings, tat_reminders_enabled: checked })
                            }
                        />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base">Committee Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Email notifications when committees are tagged
                            </p>
                        </div>
                        <Switch
                            checked={settings.committee_notifications_enabled}
                            onCheckedChange={(checked: boolean) =>
                                setSettings({ ...settings, committee_notifications_enabled: checked })
                            }
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Slack Channels</CardTitle>
                    <CardDescription>
                        Configure default Slack channels for each category
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="hostel-channel">Hostel Channel</Label>
                        <Input
                            id="hostel-channel"
                            value={slackConfig.hostel_channel}
                            onChange={(e) =>
                                setSlackConfig({ ...slackConfig, hostel_channel: e.target.value })
                            }
                            placeholder="#tickets-hostel"
                        />
                        <p className="text-xs text-muted-foreground">
                            Channel for hostel-related tickets
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="college-channel">College Channel</Label>
                        <Input
                            id="college-channel"
                            value={slackConfig.college_channel}
                            onChange={(e) =>
                                setSlackConfig({ ...slackConfig, college_channel: e.target.value })
                            }
                            placeholder="#tickets-college"
                        />
                        <p className="text-xs text-muted-foreground">
                            Channel for college-related tickets
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="committee-channel">Committee Channel</Label>
                        <Input
                            id="committee-channel"
                            value={slackConfig.committee_channel}
                            onChange={(e) =>
                                setSlackConfig({ ...slackConfig, committee_channel: e.target.value })
                            }
                            placeholder="#tickets-committee"
                        />
                        <p className="text-xs text-muted-foreground">
                            Channel for committee-tagged tickets
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button
                            variant="outline"
                            onClick={testSlackConnection}
                            disabled={testing}
                        >
                            {testing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <TestTube className="w-4 h-4 mr-2" />
                                    Test Connection
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={saveSettings} disabled={loading} size="lg">
                    {loading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Save Settings
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
