"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, TestTube, Plus, Trash2, Building2 } from "lucide-react";

interface Hostel {
    id: number;
    name: string;
    code: string | null;
}

interface SlackConfig {
    hostel_channel?: string;
    college_channel?: string;
    committee_channel?: string;
    hostel_channels?: Record<string, string>; // Map of hostel name -> channel
}

export default function NotificationSettingsPage() {
    const [loading, setLoading] = useState(false);
    const [testing, setTesting] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [hostels, setHostels] = useState<Hostel[]>([]);
    const [selectedHostel, setSelectedHostel] = useState<string>("");

    const [settings, setSettings] = useState({
        slack_enabled: true,
        email_enabled: true,
        tat_reminders_enabled: true,
        committee_notifications_enabled: true,
    });

    const [slackConfig, setSlackConfig] = useState<SlackConfig>({
        hostel_channel: "#tickets-velankani",
        college_channel: "#tickets-college",
        committee_channel: "#tickets-committee",
        hostel_channels: {},
    });

    // Load existing settings and hostels on mount
    useEffect(() => {
        async function loadSettings() {
            try {
                setInitialLoading(true);
                const [settingsRes, hostelsRes] = await Promise.all([
                    fetch("/api/superadmin/settings/notifications"),
                    fetch("/api/master/hostels"),
                ]);

                if (settingsRes.ok) {
                    const data = await settingsRes.json();
                    if (data.slack_enabled !== undefined) {
                        setSettings({
                            slack_enabled: data.slack_enabled ?? true,
                            email_enabled: data.email_enabled ?? true,
                            tat_reminders_enabled: data.tat_reminders_enabled ?? true,
                            committee_notifications_enabled: data.committee_notifications_enabled ?? true,
                        });
                    }
                    if (data.slack_config) {
                        setSlackConfig({
                            hostel_channel: data.slack_config.hostel_channel || "#tickets-velankani",
                            college_channel: data.slack_config.college_channel || "#tickets-college",
                            committee_channel: data.slack_config.committee_channel || "#tickets-committee",
                            hostel_channels: data.slack_config.hostel_channels || {},
                        });
                    }
                }

                if (hostelsRes.ok) {
                    const hostelsData = await hostelsRes.json();
                    setHostels(hostelsData.hostels || []);
                }
            } catch (error) {
                console.error("Error loading settings:", error);
                toast.error("Failed to load settings");
            } finally {
                setInitialLoading(false);
            }
        }
        loadSettings();
    }, []);

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
        } catch {
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
        } catch {
            toast.error("Slack connection failed");
        } finally {
            setTesting(false);
        }
    }

    function addHostelChannel() {
        if (!selectedHostel) {
            toast.error("Please select a hostel");
            return;
        }

        const channel = prompt(`Enter Slack channel for ${selectedHostel} (e.g., #tickets-velankani):`);
        if (!channel) return;

        const normalizedChannel = channel.startsWith("#") ? channel : `#${channel}`;
        setSlackConfig({
            ...slackConfig,
            hostel_channels: {
                ...slackConfig.hostel_channels,
                [selectedHostel]: normalizedChannel,
            },
        });
        setSelectedHostel("");
        toast.success(`Added channel mapping for ${selectedHostel}`);
    }

    function removeHostelChannel(hostelName: string) {
        const newHostelChannels = { ...slackConfig.hostel_channels };
        delete newHostelChannels[hostelName];
        setSlackConfig({
            ...slackConfig,
            hostel_channels: newHostelChannels,
        });
        toast.success(`Removed channel mapping for ${hostelName}`);
    }

    function updateHostelChannel(hostelName: string, newChannel: string) {
        const normalizedChannel = newChannel.startsWith("#") ? newChannel : `#${newChannel}`;
        setSlackConfig({
            ...slackConfig,
            hostel_channels: {
                ...slackConfig.hostel_channels,
                [hostelName]: normalizedChannel,
            },
        });
    }

    if (initialLoading) {
        return (
            <div className="container mx-auto py-6 space-y-6 max-w-4xl">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center space-y-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
                        <p className="text-sm text-muted-foreground">Loading settings...</p>
                    </div>
                </div>
            </div>
        );
    }

    const availableHostelsForMapping = hostels.filter(
        (h) => !slackConfig.hostel_channels?.[h.name]
    );

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
                    <CardTitle>Default Slack Channels</CardTitle>
                    <CardDescription>
                        Configure default Slack channels for each category. These are used when no specific hostel channel is configured.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="hostel-channel">Default Hostel Channel</Label>
                        <Input
                            id="hostel-channel"
                            value={slackConfig.hostel_channel || ""}
                            onChange={(e) =>
                                setSlackConfig({ ...slackConfig, hostel_channel: e.target.value })
                            }
                            placeholder="#tickets-velankani"
                        />
                        <p className="text-xs text-muted-foreground">
                            Default channel for hostel-related tickets (used when no specific hostel channel is configured)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="college-channel">College Channel</Label>
                        <Input
                            id="college-channel"
                            value={slackConfig.college_channel || ""}
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
                            value={slackConfig.committee_channel || ""}
                            onChange={(e) =>
                                setSlackConfig({ ...slackConfig, committee_channel: e.target.value })
                            }
                            placeholder="#tickets-committee"
                        />
                        <p className="text-xs text-muted-foreground">
                            Channel for committee-tagged tickets
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Hostel-Specific Channels</CardTitle>
                    <CardDescription>
                        Configure specific Slack channels for individual hostels. When a ticket is created for a specific hostel, it will use the mapped channel instead of the default.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Existing mappings */}
                    {slackConfig.hostel_channels && Object.keys(slackConfig.hostel_channels).length > 0 && (
                        <div className="space-y-3">
                            <Label>Configured Mappings</Label>
                            {Object.entries(slackConfig.hostel_channels).map(([hostelName, channel]) => (
                                <div key={hostelName} className="flex items-center gap-3 p-3 border rounded-lg">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Building2 className="w-4 h-4 text-muted-foreground" />
                                        <span className="font-medium">{hostelName}</span>
                                        <span className="text-muted-foreground">→</span>
                                        <Input
                                            value={channel}
                                            onChange={(e) => updateHostelChannel(hostelName, e.target.value)}
                                            className="flex-1 max-w-xs"
                                            placeholder="#tickets-..."
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeHostelChannel(hostelName)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add new mapping */}
                    {availableHostelsForMapping.length > 0 && (
                        <div className="space-y-3 pt-4 border-t">
                            <Label>Add New Hostel Channel Mapping</Label>
                            <div className="flex gap-2">
                                <Select value={selectedHostel} onValueChange={setSelectedHostel}>
                                    <SelectTrigger className="flex-1">
                                        <SelectValue placeholder="Select a hostel" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableHostelsForMapping.map((hostel) => (
                                            <SelectItem key={hostel.id} value={hostel.name}>
                                                {hostel.name} {hostel.code ? `(${hostel.code})` : ""}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    onClick={addHostelChannel}
                                    disabled={!selectedHostel}
                                    variant="outline"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Mapping
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Select a hostel and click "Add Mapping" to configure its Slack channel
                            </p>
                        </div>
                    )}

                    {availableHostelsForMapping.length === 0 && Object.keys(slackConfig.hostel_channels || {}).length > 0 && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm text-muted-foreground">
                                All hostels have channel mappings configured.
                            </p>
                        </div>
                    )}

                    {hostels.length === 0 && (
                        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-sm text-amber-800 dark:text-amber-200">
                                No hostels found. Please add hostels first before configuring channel mappings.
                            </p>
                        </div>
                    )}

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
                                    Test Slack Connection
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
