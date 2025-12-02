"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedStudentIds: number[];
    onSuccess: () => void;
}

interface MasterData {
    hostels: Array<{ id: number; name: string }>;
    batches: Array<{ id: number; batch_year: number; display_name: string }>;
    sections: Array<{ id: number; name: string }>;
}

export function BulkEditDialog({
    open,
    onOpenChange,
    selectedStudentIds,
    onSuccess,
}: BulkEditDialogProps) {
    const [loading, setLoading] = useState(false);
    const [masterData, setMasterData] = useState<MasterData>({
        hostels: [],
        batches: [],
        sections: [],
    });

    const [formData, setFormData] = useState({
        hostel_id: "no-change" as string,
        batch_id: "no-change" as string,
        class_section_id: "no-change" as string,
        batch_year: "no-change" as string,
    });

    // Fetch master data when dialog opens
    useEffect(() => {
        if (open) {
            fetchMasterData();
            // Reset form
            setFormData({
                hostel_id: "no-change",
                batch_id: "no-change",
                class_section_id: "no-change",
                batch_year: "no-change",
            });
        }
    }, [open]);

    const fetchMasterData = async () => {
        try {
            // Fetch hostels
            const hostelsRes = await fetch("/api/master/hostels");
            if (hostelsRes.ok) {
                const hostelsData = await hostelsRes.json();
                setMasterData((prev) => ({ ...prev, hostels: hostelsData.hostels || [] }));
            }

            // Fetch batches
            const batchesRes = await fetch("/api/master/batches");
            if (batchesRes.ok) {
                const batchesData = await batchesRes.json();
                setMasterData((prev) => ({ ...prev, batches: batchesData.batches || [] }));
            }

            // Fetch sections
            const sectionsRes = await fetch("/api/master/class-sections");
            if (sectionsRes.ok) {
                const sectionsData = await sectionsRes.json();
                setMasterData((prev) => ({ ...prev, sections: sectionsData.sections || [] }));
            }
        } catch (error) {
            console.error("Error fetching master data:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Build updates object with only changed fields
        const updates: Record<string, unknown> = {};

        if (formData.hostel_id && formData.hostel_id !== "no-change") {
            updates.hostel_id = formData.hostel_id === "null" ? null : parseInt(formData.hostel_id);
        }
        if (formData.batch_id && formData.batch_id !== "no-change") {
            updates.batch_id = formData.batch_id === "null" ? null : parseInt(formData.batch_id);
        }
        if (formData.class_section_id && formData.class_section_id !== "no-change") {
            updates.class_section_id = formData.class_section_id === "null" ? null : parseInt(formData.class_section_id);
        }
        if (formData.batch_year && formData.batch_year !== "no-change") {
            updates.batch_year = formData.batch_year === "null" ? null : parseInt(formData.batch_year);
        }

        // Check if at least one field is selected
        if (Object.keys(updates).length === 0) {
            toast.error("Please select at least one field to update");
            return;
        }

        setLoading(true);

        try {
            const response = await fetch("/api/superadmin/students/bulk-edit", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    student_ids: selectedStudentIds,
                    updates,
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update students");
            }

            const data = await response.json();
            toast.success(`Successfully updated ${data.updated_count} students`);
            onSuccess();
            onOpenChange(false);
        } catch (error: unknown) {
            console.error("Error bulk editing students:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to update students";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Bulk Edit Students
                    </DialogTitle>
                    <DialogDescription>
                        Update {selectedStudentIds.length} selected student{selectedStudentIds.length !== 1 ? "s" : ""}.
                        Only fields you change will be updated.
                    </DialogDescription>
                </DialogHeader>

                <Alert>
                    <AlertDescription className="text-sm">
                        <strong>Note:</strong> Changes will apply to all {selectedStudentIds.length} selected students.
                        Previous ticket data will be preserved automatically.
                    </AlertDescription>
                </Alert>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="hostel">Hostel</Label>
                            <Select
                                value={formData.hostel_id}
                                onValueChange={(value) => setFormData({ ...formData, hostel_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No change" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-change">No change</SelectItem>
                                    <SelectItem value="null">Clear (set to none)</SelectItem>
                                    {masterData.hostels.map((hostel) => (
                                        <SelectItem key={hostel.id} value={hostel.id.toString()}>
                                            {hostel.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="batch">Batch</Label>
                            <Select
                                value={formData.batch_id}
                                onValueChange={(value) => setFormData({ ...formData, batch_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No change" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-change">No change</SelectItem>
                                    <SelectItem value="null">Clear (set to none)</SelectItem>
                                    {masterData.batches.map((batch) => (
                                        <SelectItem key={batch.id} value={batch.id.toString()}>
                                            {batch.display_name || batch.batch_year}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="section">Class Section</Label>
                            <Select
                                value={formData.class_section_id}
                                onValueChange={(value) => setFormData({ ...formData, class_section_id: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No change" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-change">No change</SelectItem>
                                    <SelectItem value="null">Clear (set to none)</SelectItem>
                                    {masterData.sections.map((section) => (
                                        <SelectItem key={section.id} value={section.id.toString()}>
                                            {section.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <Label htmlFor="batch_year">Batch Year</Label>
                            <Select
                                value={formData.batch_year}
                                onValueChange={(value) => setFormData({ ...formData, batch_year: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No change" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="no-change">No change</SelectItem>
                                    <SelectItem value="null">Clear (set to none)</SelectItem>
                                    <SelectItem value="2027">2027</SelectItem>
                                    <SelectItem value="2026">2026</SelectItem>
                                    <SelectItem value="2025">2025</SelectItem>
                                    <SelectItem value="2024">2024</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Updating...
                                </>
                            ) : (
                                `Update ${selectedStudentIds.length} Student${selectedStudentIds.length !== 1 ? "s" : ""}`
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
