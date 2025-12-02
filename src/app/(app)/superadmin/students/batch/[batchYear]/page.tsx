"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Search, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditStudentDialog } from "@/components/admin/EditStudentDialog";

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

export default function SuperAdminBatchStudentsPage() {
  const params = useParams<{ batchYear: string }>();
  const router = useRouter();
  const batchYear = params?.batchYear;

  const [students, setStudents] = useState<Student[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [hostelFilter, setHostelFilter] = useState<string>("all");
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const fetchStudents = async () => {
    if (!batchYear) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        batch_year: batchYear,
      });
      if (search) params.append("search", search);
      if (hostelFilter !== "all") params.append("hostel", hostelFilter);

      const response = await fetch(`/api/superadmin/students?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch students");
      }

      const data = await response.json();
      setStudents(data.students || []);
      setHostels(data.hostels || []);
      setPagination(data.pagination);
      setSelectedStudents([]);
    } catch (error) {
      console.error("Fetch error:", error);
      toast.error("Failed to load students");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchYear, pagination.page, hostelFilter, search]);

  const handleSearch = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
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
        fetchStudents();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to delete student");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete student");
    }
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
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPagination((prev) => ({ ...prev, page: 1 }));
                  }}
                  onKeyPress={handleKeyPress}
                />
                <Button onClick={handleSearch}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Select value={hostelFilter} onValueChange={setHostelFilter}>
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
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableHead key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from({ length: 5 }).map((_, k) => (
                        <TableRow key={k}>
                          {Array.from({ length: 9 }).map((_, l) => (
                            <TableCell key={l}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          ) : students.length === 0 ? (
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
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
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
            fetchStudents();
            setShowEditDialog(false);
            setEditingStudentId(null);
          }}
        />
      )}
    </div>
  );
}
