"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StudentBulkUpload } from "@/components/admin/StudentBulkUpload";
import { AddSingleStudentDialog } from "@/components/admin/AddSingleStudentDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEditDialog } from "@/components/admin/BulkEditDialog";
import { Edit2, Users, Upload, Search, ChevronLeft, ChevronRight, UserPlus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

interface Student {
	student_id: number;
	user_id: string;
	full_name: string;
	email: string;
	phone: string | null;
	roll_no: string;
	room_no: string | null;
	hostel: "Neeladri" | "Velankani" | null;
	class_section: "A" | "B" | "C" | "D" | null;
	batch_year: number | null;
	department: string | null;
	created_at: Date;
	updated_at: Date;
}

interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

export default function SuperAdminStudentsPage() {
	const [students, setStudents] = useState<Student[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");
	const [hostelFilter, setHostelFilter] = useState<string>("all");
	const [batchYearFilter, setBatchYearFilter] = useState<string>("all");
	const [pagination, setPagination] = useState<PaginationInfo>({
		page: 1,
		limit: 50,
		total: 0,
		totalPages: 0,
	});
	const [showUploadView, setShowUploadView] = useState(false);
	const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
	const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
	const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);

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

	const clearSelection = () => {
		setSelectedStudents([]);
	};

	const fetchStudents = async () => {
		setLoading(true);
		try {
			const params = new URLSearchParams({
				page: pagination.page.toString(),
				limit: pagination.limit.toString(),
			});

			if (search) params.append("search", search);
			if (hostelFilter !== "all") params.append("hostel", hostelFilter);
			if (batchYearFilter !== "all") params.append("batch_year", batchYearFilter);

			const response = await fetch(`/api/superadmin/students?${params}`);
			if (!response.ok) {
				throw new Error("Failed to fetch students");
			}

			const data = await response.json();
			setStudents(data.students);
			setPagination(data.pagination);
			// Clear selection on page change or filter change
			setSelectedStudents([]);
		} catch (error) {
			console.error("Fetch error:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStudents();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pagination.page, hostelFilter, batchYearFilter]);

	const handleSearch = () => {
		setPagination({ ...pagination, page: 1 });
		fetchStudents();
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	if (showUploadView) {
		return (
			<div className="container mx-auto py-6 space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-3xl font-bold">Student Bulk Upload</h1>
						<p className="text-muted-foreground">
							Upload CSV to create or update student profiles
						</p>
					</div>
					<Button variant="outline" onClick={() => setShowUploadView(false)}>
						Back to List
					</Button>
				</div>
				<StudentBulkUpload />
			</div>
		);
	}

	return (
		<div className="container mx-auto py-6 space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-bold">Student Management</h1>
					<p className="text-muted-foreground">
						Manage student profiles, add individual students, or bulk upload via CSV
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" onClick={() => setShowAddStudentDialog(true)}>
						<UserPlus className="w-4 h-4 mr-2" />
						Add Student
					</Button>
					<Button onClick={() => setShowUploadView(true)}>
						<Upload className="w-4 h-4 mr-2" />
						Bulk Upload
					</Button>
				</div>
			</div>

			{/* Filters */}
			<Card>
				<CardHeader>
					<CardTitle>Search & Filter</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
						<div className="md:col-span-2">
							<div className="flex gap-2">
								<Input
									placeholder="Search by name, email, or roll number..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
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
								<SelectItem value="Neeladri">Neeladri</SelectItem>
								<SelectItem value="Velankani">Velankani</SelectItem>
							</SelectContent>
						</Select>
						<Select value={batchYearFilter} onValueChange={setBatchYearFilter}>
							<SelectTrigger>
								<SelectValue placeholder="Filter by batch" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Batches</SelectItem>
								<SelectItem value="2027">2027</SelectItem>
								<SelectItem value="2026">2026</SelectItem>
								<SelectItem value="2025">2025</SelectItem>
								<SelectItem value="2024">2024</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Students Table */}
			<Card>
				<CardHeader>
					<CardTitle>Students ({pagination.total})</CardTitle>
					<CardDescription>
						All student profiles managed by the system
					</CardDescription>
				</CardHeader>
				<CardContent>
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
									<TableHead>Roll No</TableHead>
									<TableHead>Name</TableHead>
									<TableHead>Email</TableHead>
									<TableHead>Hostel</TableHead>
									<TableHead>Room</TableHead>
									<TableHead>Section</TableHead>
									<TableHead>Batch</TableHead>
									<TableHead>Phone</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{loading ? (
									Array.from({ length: 10 }).map((_, i) => (
										<TableRow key={i}>
											{Array.from({ length: 9 }).map((_, j) => (
												<TableCell key={j}>
													<Skeleton className="h-4 w-full" />
												</TableCell>
											))}
										</TableRow>
									))
								) : students.length === 0 ? (
									<TableRow>
										<TableCell colSpan={9} className="text-center py-8">
											No students found
										</TableCell>
									</TableRow>
								) : (
									students.map((student) => (
										<TableRow key={student.student_id}>
											<TableCell>
												<Checkbox
													checked={selectedStudents.includes(student.student_id)}
													onCheckedChange={() => toggleStudent(student.student_id)}
												/>
											</TableCell>
											<TableCell className="font-mono text-sm">
												{student.roll_no}
											</TableCell>
											<TableCell className="font-medium">
												{student.full_name}
											</TableCell>
											<TableCell className="text-sm text-muted-foreground">
												{student.email}
											</TableCell>
											<TableCell>
												{student.hostel ? (
													<Badge variant="outline">{student.hostel}</Badge>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>
												{student.room_no || (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>
												{student.class_section ? (
													<Badge variant="secondary">
														{student.class_section}
													</Badge>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell>{student.batch_year || "—"}</TableCell>
											<TableCell className="text-sm">
												{student.phone || (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
										</TableRow>
									))
								)}
							</TableBody>
						</Table>
					</div>

					{/* Pagination */}
					{pagination.totalPages > 1 && (
						<div className="flex items-center justify-between mt-4">
							<p className="text-sm text-muted-foreground">
								Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
								{Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
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
									<ChevronRight className="w-4 h-4" />
								</Button>
							</div>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Bulk Actions Bar */}
			{selectedStudents.length > 0 && (
				<div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
					<Card className="shadow-lg border-2">
						<CardContent className="flex items-center gap-4 p-4">
							<div className="flex items-center gap-2">
								<Users className="w-5 h-5 text-primary" />
								<span className="font-semibold">
									{selectedStudents.length} student{selectedStudents.length !== 1 ? "s" : ""} selected
								</span>
							</div>
							<div className="flex gap-2">
								<Button
									variant="default"
									size="sm"
									onClick={() => setShowBulkEditDialog(true)}
								>
									<Edit2 className="w-4 h-4 mr-2" />
									Bulk Edit
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={clearSelection}
								>
									Clear Selection
								</Button>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			{/* Add Student Dialog */}
			<AddSingleStudentDialog
				open={showAddStudentDialog}
				onOpenChange={setShowAddStudentDialog}
				onSuccess={() => {
					fetchStudents();
				}}
			/>

			{/* Bulk Edit Dialog */}
			<BulkEditDialog
				open={showBulkEditDialog}
				onOpenChange={setShowBulkEditDialog}
				selectedStudentIds={selectedStudents}
				onSuccess={() => {
					fetchStudents();
					setSelectedStudents([]);
					setShowBulkEditDialog(false);
				}}
			/>
		</div>
	);
}
