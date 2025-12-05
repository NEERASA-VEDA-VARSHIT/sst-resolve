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
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Assignment {
    id: number;
    category_id: number;
    user_id: string; // UUID
    assignment_type: string | null;
    created_at: Date | string;
    user: {
        id: string; // UUID
        full_name: string | null;
        email: string | null;
        external_id: string | null;
    };
}

interface Admin {
    id: string; // Database UUID (matches category_assignments.user_id)
    external_id?: string; // Clerk ID (optional, for display)
    name: string;
    email: string;
    domain: string | null;
    scope: string | null;
}

export function CategoryAssignmentsManager({ categoryId }: { categoryId: number }) {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [admins, setAdmins] = useState<Admin[]>([]);
    const [isAdding, setIsAdding] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form state
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [assignmentType, setAssignmentType] = useState<string>("");

    useEffect(() => {
        fetchAssignments();
        fetchAdmins();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [categoryId]);

    async function fetchAssignments() {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/categories/${categoryId}/assignments`);
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    setAssignments(data.assignments || []);
                } else {
                    console.error("Server returned non-JSON response when fetching assignments");
                }
            } else {
                toast.error("Failed to load assignments");
            }
        } catch (error) {
            console.error("Error fetching assignments:", error);
            toast.error("Failed to load assignments");
        } finally {
            setLoading(false);
        }
    }

    async function fetchAdmins() {
        try {
            const response = await fetch("/api/admin/list");
            if (response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const data = await response.json();
                    setAdmins(data.admins || []);
                } else {
                    console.error("Server returned non-JSON response when fetching admins");
                }
            }
        } catch (error) {
            console.error("Error fetching admins:", error);
        }
    }

    async function handleAddAssignment() {
        if (!selectedUserId) {
            toast.error("Please select an admin");
            return;
        }

        try {
            setSaving(true);
            const response = await fetch(`/api/admin/categories/${categoryId}/assignments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_id: selectedUserId,
                    assignment_type: assignmentType || null,
                }),
            });

            if (response.ok) {
                toast.success("Admin assigned successfully");
                setIsAdding(false);
                setSelectedUserId(null);
                setAssignmentType("");
                await fetchAssignments();
            } else {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const error = await response.json();
                    toast.error(error.error || "Failed to add assignment");
                } else {
                    toast.error(`Failed to add assignment (${response.status} ${response.statusText})`);
                }
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
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const error = await response.json();
                    toast.error(error.error || "Failed to remove assignment");
                } else {
                    toast.error(`Failed to remove assignment (${response.status} ${response.statusText})`);
                }
            }
        } catch (error) {
            console.error("Error removing assignment:", error);
            toast.error("Failed to remove assignment");
        }
    }

    // Filter out already assigned admins
    const availableAdmins = admins.filter(
        (a) => !assignments.some((assignment) => assignment.user_id === a.id)
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
                            {assignments.map((assignment) => {
                                // Find matching admin for domain/scope display
                                const matchingAdmin = admins.find(a => a.id === assignment.user_id);
                                const userName = assignment.user.full_name || assignment.user.email || "Unknown";
                                const userEmail = assignment.user.email || "";
                                
                                return (
                                    <div
                                        key={assignment.id}
                                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <Avatar>
                                                <AvatarFallback>
                                                    {userName.charAt(0).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <p className="font-medium">{userName}</p>
                                                    {assignment.assignment_type && (
                                                        <Badge variant="outline" className="text-xs">
                                                            {assignment.assignment_type}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {userEmail}
                                                </p>
                                                {matchingAdmin && (matchingAdmin.domain || matchingAdmin.scope) && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            {matchingAdmin.domain || ""}
                                                            {matchingAdmin.scope && ` - ${matchingAdmin.scope}`}
                                                        </Badge>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveAssignment(assignment.id)}
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
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
                                value={selectedUserId || ""}
                                onValueChange={(value) => setSelectedUserId(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose an admin..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableAdmins.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground">
                                            All admins are already assigned
                                        </div>
                                    ) : (
                                        availableAdmins.map((admin) => (
                                            <SelectItem key={admin.id} value={admin.id}>
                                                {admin.name} - {admin.email}
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="assignment_type">Assignment Type (Optional)</Label>
                            <Input
                                id="assignment_type"
                                type="text"
                                value={assignmentType}
                                onChange={(e) => setAssignmentType(e.target.value)}
                                placeholder="e.g., primary, backup, escalation"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional label for this assignment (e.g., &quot;primary&quot;, &quot;backup&quot;)
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsAdding(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddAssignment} disabled={saving || !selectedUserId}>
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
