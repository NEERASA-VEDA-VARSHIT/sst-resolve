"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditStudentDialog } from "@/components/admin/students/EditStudentDialog";
import { useSearchParams, useRouter as useNextRouter } from "next/navigation";

interface Student {
  student_id: number;
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  room_no: string | null;
  hostel: string | null;
  class_section: string | null;
  batch_year: number | null;
  blood_group?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface Hostel {
  id: number;
  name: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface BatchStudentsManagementProps {
  batchYear: string;
  initialStudents: Student[];
  initialHostels: Hostel[];
  initialPagination: PaginationInfo;
  initialSearch?: string;
  initialHostelFilter?: string;
}

export function BatchStudentsManagement({
  batchYear,
  initialStudents,
  initialHostels,
  initialPagination,
  initialSearch = "",
  initialHostelFilter = "all",
}: BatchStudentsManagementProps) {
  const router = useRouter();
  const nextRouter = useNextRouter();
  const searchParams = useSearchParams();
  
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [hostels, setHostels] = useState<Hostel[]>(initialHostels);
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
  const [search, setSearch] = useState(initialSearch);
  const [hostelFilter, setHostelFilter] = useState(initialHostelFilter);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const updateURL = (newSearch: string, newHostelFilter: string, newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSearch) {
      params.set("search", newSearch);
    } else {
      params.delete("search");
    }
    if (newHostelFilter !== "all") {
      params.set("hostel", newHostelFilter);
    } else {
      params.delete("hostel");
    }
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    nextRouter.push(`?${params.toString()}`);
  };

  // Debounced search to reduce API calls
  const debouncedSearch = useDebouncedCallback(
    (value: string) => {
      updateURL(value, hostelFilter, 1);
      router.refresh();
    },
    300 // Wait 300ms after user stops typing
  );

  const handleSearch = () => {
    updateURL(search, hostelFilter, 1);
    router.refresh();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleSearchChange = (value: string) => {
    setSearch(value);
    // Debounce the search update
    debouncedSearch(value);
  };

  const handleHostelFilterChange = (value: string) => {
    setHostelFilter(value);
    updateURL(search, value, 1);
    router.refresh();
  };

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const toggleAll = () => {
    if (selectedStudents.length === students.length && students.length > 0) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(students.map((s) => s.student_id));
    }
  };

  const handleDelete = async (studentId: number) => {
    if (!studentId) return;

    try {
      const response = await fetch(`/api/superadmin/students/${studentId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || "Student deleted successfully");
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete student");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete student");
    }
  };

  const handlePageChange = (newPage: number) => {
    updateURL(search, hostelFilter, newPage);
    router.refresh();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => router.push("/superadmin/students")}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to all batches
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Batch {batchYear} Students</h1>
            <p className="text-muted-foreground text-sm">
              All students belonging to Batch {batchYear}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
          <CardDescription>
            Filtering within batch {batchYear}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Select value={hostelFilter} onValueChange={handleHostelFilterChange}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by hostel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hostels</SelectItem>
                {hostels.map((hostel) => (
                  <SelectItem key={hostel.id} value={hostel.name}>
                    {hostel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Students Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Students in Batch {batchYear} ({pagination.total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No students found for this batch</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedStudents.length === students.length && students.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Blood Group</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => (
                    <TableRow key={student.student_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedStudents.includes(student.student_id)}
                          onCheckedChange={() => toggleStudent(student.student_id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{student.full_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{student.email}</TableCell>
                      <TableCell>
                        {student.hostel ? (
                          <Badge variant="outline">{student.hostel}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.room_no || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {student.class_section ? (
                          <Badge variant="secondary">{student.class_section}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {student.blood_group ? (
                          <Badge variant="secondary">{student.blood_group}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {student.phone || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingStudentId(student.student_id);
                              setShowEditDialog(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(student.student_id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to {" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {" "}
                {pagination.total} students
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                >
                  Next
                  <ChevronLeft className="w-4 h-4 rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Student Dialog */}
      {showEditDialog && editingStudentId && (
        <EditStudentDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          studentId={editingStudentId}
          onSuccess={() => {
            router.refresh();
            setShowEditDialog(false);
            setEditingStudentId(null);
          }}
        />
      )}
    </div>
  );
}
