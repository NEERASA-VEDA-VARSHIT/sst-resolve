"use client";

import { useEffect, useState } from "react";

// Force dynamic rendering to prevent static generation
export const dynamic = "force-dynamic";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, ChevronUp, ChevronDown, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

interface TicketStatus {
    id: number;
    value: string;
    label: string;
    description: string | null;
    progress_percent: number;
    badge_color: string | null;
    is_active: boolean;
    is_final: boolean;
    display_order: number;
}

export default function StatusManagementClientPage() {
    const [statuses, setStatuses] = useState<TicketStatus[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingStatus, setEditingStatus] = useState<TicketStatus | null>(null);
    const [formData, setFormData] = useState({
        value: "",
        label: "",
        description: "",
        progress_percent: 0,
        badge_color: "default",
        is_active: true,
        is_final: false,
    });

    useEffect(() => {
        fetchStatuses();
    }, []);

    const fetchStatuses = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/admin/ticket-statuses");
            const data = await res.json();

            if (data.success) {
                setStatuses(data.data);
            } else {
                toast.error(data.error || "Failed to fetch statuses");
            }
		} catch {
            toast.error("Failed to fetch statuses");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingStatus(null);
        setFormData({
            value: "",
            label: "",
            description: "",
            progress_percent: 0,
            badge_color: "default",
            is_active: true,
            is_final: false,
        });
        setIsDialogOpen(true);
    };

    const handleEdit = (status: TicketStatus) => {
        setEditingStatus(status);
        setFormData({
            value: status.value,
            label: status.label,
            description: status.description || "",
            progress_percent: status.progress_percent,
            badge_color: status.badge_color || "default",
            is_active: status.is_active,
            is_final: status.is_final,
        });
        setIsDialogOpen(true);
    };

    const handleSave = async () => {
        try {
            const url = editingStatus
                ? `/api/admin/ticket-statuses/${editingStatus.id}`
                : "/api/admin/ticket-statuses";

            const method = editingStatus ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();

            if (data.success) {
                toast.success(editingStatus ? "Status updated successfully" : "Status created successfully");
                setIsDialogOpen(false);
                fetchStatuses();
            } else {
                toast.error(data.error || "Failed to save status");
            }
		} catch {
            toast.error("Failed to save status");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this status? This action cannot be undone.")) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/ticket-statuses/${id}`, {
                method: "DELETE",
            });

            const data = await res.json();

            if (data.success) {
                toast.success("Status deleted successfully");
                fetchStatuses();
            } else {
                toast.error(data.error || "Failed to delete status");
            }
		} catch {
            toast.error("Failed to delete status");
        }
    };

    const handleReorder = async (id: number, direction: "up" | "down") => {
        const currentIndex = statuses.findIndex(s => s.id === id);
        const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex < 0 || targetIndex >= statuses.length) return;

        const currentStatus = statuses[currentIndex];
        const targetStatus = statuses[targetIndex];

        // Swap display_order
        try {
            await Promise.all([
                fetch(`/api/admin/ticket-statuses/${currentStatus.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ display_order: targetStatus.display_order }),
                }),
                fetch(`/api/admin/ticket-statuses/${targetStatus.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ display_order: currentStatus.display_order }),
                }),
            ]);

            fetchStatuses();
		} catch {
            toast.error("Failed to reorder statuses");
        }
    };

    const getBadgeVariant = (color: string | null): "default" | "secondary" | "destructive" | "outline" => {
        switch (color) {
            case "secondary": return "secondary";
            case "destructive": return "destructive";
            case "outline": return "outline";
            default: return "default";
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Ticket Status Management</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage all ticket statuses and their properties
                    </p>
                </div>
                <Button onClick={handleCreate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Status
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Statuses</CardTitle>
                    <CardDescription>
                        Configure ticket statuses, their labels, progress values, and display order
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Order</TableHead>
                                    <TableHead>Value</TableHead>
                                    <TableHead>Label</TableHead>
                                    <TableHead>Progress</TableHead>
                                    <TableHead>Badge</TableHead>
                                    <TableHead>Active</TableHead>
                                    <TableHead>Final</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statuses.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                            No statuses found. Click &quot;Add Status&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    statuses.map((status, index) => (
                                        <TableRow key={status.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleReorder(status.id, "up")}
                                                        disabled={index === 0}
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        <ChevronUp className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleReorder(status.id, "down")}
                                                        disabled={index === statuses.length - 1}
                                                        className="h-6 w-6 p-0"
                                                    >
                                                        <ChevronDown className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-mono text-sm">{status.value}</TableCell>
                                            <TableCell className="font-medium">{status.label}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary"
                                                            style={{ width: `${status.progress_percent}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-sm text-muted-foreground">{status.progress_percent}%</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={getBadgeVariant(status.badge_color)}>
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {status.is_active ? (
                                                    <Check className="w-4 h-4 text-green-600" />
                                                ) : (
                                                    <X className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {status.is_final ? (
                                                    <Check className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <X className="w-4 h-4 text-muted-foreground" />
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(status)}
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleDelete(status.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>{editingStatus ? "Edit Status" : "Create New Status"}</DialogTitle>
                        <DialogDescription>
                            {editingStatus
                                ? "Update the status properties below"
                                : "Add a new ticket status to the system"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="value">
                                Value {!editingStatus && <span className="text-destructive">*</span>}
                            </Label>
                            <Input
                                id="value"
                                value={formData.value}
                                onChange={(e) => setFormData({ ...formData, value: e.target.value.toUpperCase().replace(/[^A-Z_]/g, "") })}
                                placeholder="OPEN, IN_PROGRESS, etc."
                                disabled={!!editingStatus}
                            />
                            <p className="text-xs text-muted-foreground">
                                Uppercase letters and underscores only. Cannot be changed after creation.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="label">Label <span className="text-destructive">*</span></Label>
                            <Input
                                id="label"
                                value={formData.label}
                                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                                placeholder="Open, In Progress, etc."
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="description">Description</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Optional description..."
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="progress">Progress (%)</Label>
                                <Input
                                    id="progress"
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={formData.progress_percent}
                                    onChange={(e) => setFormData({ ...formData, progress_percent: parseInt(e.target.value) || 0 })}
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="badge_color">Badge Color</Label>
                                <Select
                                    value={formData.badge_color}
                                    onValueChange={(value) => setFormData({ ...formData, badge_color: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default</SelectItem>
                                        <SelectItem value="secondary">Secondary</SelectItem>
                                        <SelectItem value="destructive">Destructive</SelectItem>
                                        <SelectItem value="outline">Outline</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Switch
                                    id="is_active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                                <Label htmlFor="is_active">Active</Label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Switch
                                    id="is_final"
                                    checked={formData.is_final}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_final: checked })}
                                />
                                <Label htmlFor="is_final">Final State</Label>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave}>
                            {editingStatus ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
