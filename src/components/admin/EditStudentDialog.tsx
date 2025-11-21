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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditStudentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    studentId: number;
    onSuccess: () => void;
}

interface StudentData {
    student_id: number;
    user_id: string;
    roll_no: string;
    full_name: string;
    email: string;
    phone: string | null;
    room_no: string | null;
    hostel_id: number | null;
    batch_id: number | null;
    class_section_id: number | null;
    batch_year: number | null;
    department: string | null;
    hostel_name: string | null;
    batch_display: string | null;
    section_name: string | null;
}

interface MasterData {
    hostels: Array<{ id: number; name: string }>;
    batches: Array<{ id: number; batch_year: number; display_name: string }>;
    sections: Array<{ id: number; name: string }>;
}

export function EditStudentDialog({
    open,
    onOpenChange,
    studentId,
    onSuccess,
}: EditStudentDialogProps) {
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [student, setStudent] = useState<StudentData | null>(null);
    const [masterData, setMasterData] = useState<MasterData>({
        hostels: [],
        batches: [],
        sections: [],
    });

    const [formData, setFormData] = useState({
        full_name: "",
        phone: "",
        roll_no: "",
        room_no: "",
        hostel_id: null as number | null,
        batch_id: null as number | null,
        class_section_id: null as number | null,
        batch_year: null as number | null,
        department: "",
    });

    // Fetch student data when dialog opens
    useEffect(() => {
        if (open && studentId) {
            fetchStudentData();
            fetchMasterData();
        }
    }, [open, studentId]);

    const fetchStudentData = async () => {
        setFetching(true);
        try {
            const response = await fetch(`/api/superadmin/students/${studentId}`);
            if (!response.ok) throw new Error("Failed to fetch student");

            const data = await response.json();
            setStudent(data.student);

            // Populate form
            setFormData({
                full_name: data.student.full_name || "",
                phone: data.student.phone || "",
                roll_no: data.student.roll_no || "",
                room_no: data.student.room_no || "",
                hostel_id: data.student.hostel_id,
                batch_id: data.student.batch_id,
                class_section_id: data.student.class_section_id,
                batch_year: data.student.batch_year,
                department: data.student.department || "",
            });
        } catch (error) {
            console.error("Error fetching student:", error);
            toast.error("Failed to load student data");
        } finally {
            setFetching(false);
        }
    };

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
        setLoading(true);

        try {
            const response = await fetch(`/api/superadmin/students/${studentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to update student");
            }

            toast.success("Student updated successfully");
            onSuccess();
            onOpenChange(false);
        } catch (error: unknown) {
            console.error("Error updating student:", error);
            const errorMessage = error instanceof Error ? error.message : "Failed to update student";
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Edit Student Information</DialogTitle>
                    <DialogDescription>
                        Update student details. Changes will not affect previous ticket data.
                    </DialogDescription>
                </DialogHeader>

                {fetching ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Basic Information */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm">Basic Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="full_name">Full Name *</Label>
                                    <Input
                                        id="full_name"
                                        value={formData.full_name}
                                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                        required
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="roll_no">Roll Number *</Label>
                                    <Input
                                        id="roll_no"
                                        value={formData.roll_no}
                                        onChange={(e) => setFormData({ ...formData, roll_no: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="email">Email (Read-only)</Label>
                                    <Input
                                        id="email"
                                        value={student?.email || ""}
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="Optional"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Hostel Information */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm">Hostel Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="hostel">Hostel</Label>
                                    <Select
                                        value={formData.hostel_id?.toString() || ""}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, hostel_id: value ? parseInt(value) : null })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select hostel" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            {masterData.hostels.map((hostel) => (
                                                <SelectItem key={hostel.id} value={hostel.id.toString()}>
                                                    {hostel.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor="room_no">Room Number</Label>
                                    <Input
                                        id="room_no"
                                        value={formData.room_no || ""}
                                        onChange={(e) => setFormData({ ...formData, room_no: e.target.value })}
                                        placeholder="e.g., 101"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Academic Information */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sm">Academic Information</h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="batch">Batch</Label>
                                    <Select
                                        value={formData.batch_id?.toString() || ""}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, batch_id: value ? parseInt(value) : null })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select batch" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
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
                                        value={formData.class_section_id?.toString() || ""}
                                        onValueChange={(value) =>
                                            setFormData({ ...formData, class_section_id: value ? parseInt(value) : null })
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select section" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">None</SelectItem>
                                            {masterData.sections.map((section) => (
                                                <SelectItem key={section.id} value={section.id.toString()}>
                                                    {section.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="batch_year">Batch Year</Label>
                                    <Input
                                        id="batch_year"
                                        type="number"
                                        value={formData.batch_year || ""}
                                        onChange={(e) =>
                                            setFormData({ ...formData, batch_year: e.target.value ? parseInt(e.target.value) : null })
                                        }
                                        placeholder="e.g., 2027"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="department">Department</Label>
                                    <Input
                                        id="department"
                                        value={formData.department || ""}
                                        onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                        placeholder="e.g., Computer Science"
                                    />
                                </div>
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
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
