"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Assignment {
    id: number;
    category_id: number;
    staff_id: number;
    is_primary: boolean;
    priority: number;
    staff: {
        id: number;
        full_name: string;
        email: string;
        domain: string;
        scope: string | null;
    };
}

interface Staff {
    id: number;
    full_name: string;
    email: string;
    domain: string;
    scope: string | null;
}

export function CategoryAssignmentsManager({ categoryId }: { categoryId: number }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
    const [isPrimary, setIsPrimary] = useState(false);
    const [priority, setPriority] = useState(0);

    useEffect(() => {
        fetchAssignments();
        fetchStaff();
    }, [categoryId]);

    async function fetchAssignments() {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/categories/${categoryId}/assignments`);
            if (response.ok) {
                const data = await response.json();
                setAssignments(data.assignments || []);
            }
        } catch (error) {
            console.error("Error fetching assignments:", error);
            toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    }

    async function fetchStaff() {
        try {
            const response = await fetch("/api/admin/master-data");
            if (response.ok) {
                const data = await response.json();
                setStaff(data.staff || []);
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
        }
    }

    async function handleAddAssignment() {
        if (!selectedStaffId) {
            toast.error("Please select an admin");
            return;
        }

        try {
            setSaving(true);
            const response = await fetch(`/api/admin/categories/${categoryId}/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    staff_id: selectedStaffId,
                    is_primary: isPrimary,
                    priority,
                }),
            });

            if (response.ok) {
                toast.success("Admin assigned successfully");
                setIsAdding(false);
                setSelectedStaffId(null);
                setIsPrimary(false);
                setPriority(0);
                await fetchAssignments();
            } else {
                const error = await response.json();
                toast.error(error.error || "Failed to add assignment");
            }
        } catch (error) {
            console.error("Error adding assignment:", error);
            toast.error("Failed to add assignment");
        } finally {
            setSaving(false);
        }
    }

    async function handleRemoveAssignment(assignmentId: number) {
        if (!confirm("Are you sure you want to remove this admin assignment?")) {
            return;
        }

        try {
            const response = await fetch(
                `/api/admin/categories/${categoryId}/assignments/${assignmentId}`,
                { method: "DELETE" }
            );

            if (response.ok) {
                toast.success("Assignment removed");
                await fetchAssignments();
            } else {
                toast.error("Failed to remove assignment");
            }
        } catch (error) {
            console.error("Error removing assignment:", error);
            toast.error("Failed to remove assignment");
        }
    }

    async function handleTogglePrimary(assignment: Assignment) {
        try {
            const response = await fetch(
                `/api/admin/categories/${categoryId}/assignments/${assignment.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        is_primary: !assignment.is_primary,
                    }),
                }
            );

            if (response.ok) {
                toast.success(assignment.is_primary ? "Primary status removed" : "Set as primary admin");
                await fetchAssignments();
            } else {
                toast.error("Failed to update assignment");
            }
        } catch (error) {
            console.error("Error updating assignment:", error);
            toast.error("Failed to update assignment");
        }
    }

    // Filter out already assigned staff
    const availableStaff = staff.filter(
        (s) => !assignments.some((a) => a.staff_id === s.id)
    );

    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Admin Assignments</CardTitle>
                            <CardDescription>
                                Assign multiple admins to this category. Primary admin gets tickets first.
                            </CardDescription>
                        </div>
                        <Button onClick={() => setIsAdding(true)} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Admin
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : assignments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            <p>No admins assigned to this category yet</p>
                            <p className="text-sm mt-1">Click &quot;Add Admin&quot; to assign admins</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {assignments.map((assignment) => (
                                <div
                                    key={assignment.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex items-center gap-3 flex-1">
                                        <Avatar>
                                            <AvatarFallback>
                                                {assignment.staff.full_name.charAt(0).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-medium">{assignment.staff.full_name}</p>
                                                {assignment.is_primary && (
                                                    <Badge variant="default" className="gap-1">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        Primary
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {assignment.staff.email}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant="outline" className="text-xs">
                                                    {assignment.staff.domain}
                                                    {assignment.staff.scope && ` - ${assignment.staff.scope}`}
                                                </Badge>
                                                <Badge variant="secondary" className="text-xs">
                                                    Priority: {assignment.priority}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleTogglePrimary(assignment)}
                                            title={assignment.is_primary ? "Remove primary status" : "Set as primary"}
                                        >
                                            <Star
                                                className={`w-4 h-4 ${assignment.is_primary ? "fill-current text-yellow-500" : ""
                                                    }`}
                                            />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveAssignment(assignment.id)}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={isAdding} onOpenChange={setIsAdding}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add Admin Assignment</DialogTitle>
                        <DialogDescription>
                            Assign an admin to this category. You can set one as primary for default ticket assignment.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Admin</Label>
                            <Select
                                value={selectedStaffId?.toString()}
                                onValueChange={(value) => setSelectedStaffId(parseInt(value))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose an admin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableStaff.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground">
                                            All admins are already assigned
                                        </div>
                                    ) : (
                                        availableStaff.map((s) => (
                                            <SelectItem key={s.id} value={s.id.toString()}>
                                                {s.full_name} - {s.email}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="primary"
                                checked={isPrimary}
                                onCheckedChange={(checked: boolean) => setIsPrimary(checked)}
                            />
                            <Label htmlFor="primary" className="cursor-pointer">
                                Set as primary admin (gets tickets by default)
                            </Label>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority (0-100)</Label>
                            <Input
                                id="priority"
                                type="number"
                                min="0"
                                max="100"
                                value={priority}
                                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                                placeholder="0"
                            />
                            <p className="text-xs text-muted-foreground">
                                Higher priority admins are preferred for ticket assignment
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAdding(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddAssignment} disabled={saving || !selectedStaffId}>
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    "Add Assignment"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
