"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StudentBulkUpload } from "@/components/admin/StudentBulkUpload";
import { AddSingleStudentDialog } from "@/components/admin/AddSingleStudentDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkEditDialog } from "@/components/admin/BulkEditDialog";
import { Edit2, Users, Upload, Search, ChevronLeft, ChevronRight, UserPlus, Pencil, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { EditStudentDialog } from "@/components/admin/EditStudentDialog";
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
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Student {
	student_id: number;
	user_id: string
	full_name: string;
	email: string;
	phone: string | null;
	room_no: string | null;
	hostel: string | null;
	class_section: string | null;
	batch_year: number | null;
	// Optional fields coming from API (may be null / undefined)
	blood_group?: string | null;
	created_at: Date;
	updated_at: Date;
}

interface Batch {
	batch_year: number;
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

export default function SuperAdminStudentsPage() {
	const [students, setStudents] = useState<Student[]>([]);
	const [batches, setBatches] = useState<Batch[]>([]);
	const [hostels, setHostels] = useState<Hostel[]>([]);
	const [loading, setLoading] = useState(false);
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
	const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
	const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
			setStudents(data.students || []);
			setBatches(data.batches || []); // Set batches from API
			setHostels(data.hostels || []); // Set hostels from API
			setPagination(data.pagination);
			// Clear selection on page change or filter change
			setSelectedStudents([]);
			
			// Auto-expand batches that have students
			if (batchYearFilter === "all" && data.students.length > 0) {
				const batchesWithStudents = new Set<number>(
					data.students
						.map((s: Student) => s.batch_year)
						.filter((year: number | null): year is number => year !== null)
				);
				setExpandedBatches(batchesWithStudents);
			}
		} catch (error) {
			console.error("Fetch error:", error);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchStudents();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pagination.page, hostelFilter, batchYearFilter, search]);

	const handleSearch = () => {
		setPagination((prev) => ({ ...prev, page: 1 }));
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	const toggleBatch = (batchYear: number) => {
		setExpandedBatches((prev) => {
			const newSet = new Set(prev);
			if (newSet.has(batchYear)) {
				newSet.delete(batchYear);
			} else {
				newSet.add(batchYear);
			}
			return newSet;
		});
	};

	const handleDelete = async () => {
		if (!deletingStudentId) return;

		try {
			const response = await fetch(`/api/superadmin/students/${deletingStudentId}`, {
				method: "DELETE",
			});

			if (response.ok) {
				const data = await response.json();
				toast.success(data.message || "Student deleted successfully");
				setIsDeleteDialogOpen(false);
				setDeletingStudentId(null);
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

	// Group students by batch year (based on data we have on the current page)
	const studentsByBatch = students.reduce((acc, student) => {
		const batchYear = student.batch_year || 0; // Use 0 for students without batch
		if (!acc[batchYear]) {
			acc[batchYear] = [];
		}
		acc[batchYear].push(student);
		return acc;
	}, {} as Record<number, Student[]>);

	// Get sorted batch years (descending) based on master batches list,
	// so we always show all active batches (e.g. 2028, 2029) even if no students yet.
	const sortedBatchYears = batches
		.map((b) => b.batch_year)
		.sort((a, b) => b - a);

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
									placeholder="Search by name or email..."
									value={search}
									onChange={(e) => {
										setSearch(e.target.value);
										// Reset to page 1 when search changes
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
						<Select value={batchYearFilter} onValueChange={setBatchYearFilter}>
							<SelectTrigger>
								<SelectValue placeholder="Filter by batch" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Batches</SelectItem>
								{batches.map((batch) => (
									<SelectItem key={batch.batch_year} value={batch.batch_year.toString()}>
										Batch {batch.batch_year}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* Students Table - Grouped by Batch */}
			<Card>
				<CardHeader>
					<CardTitle>Students ({pagination.total})</CardTitle>
					<CardDescription>
						All student profiles managed by the system, grouped by batch
					</CardDescription>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-4">
							{Array.from({ length: 3 }).map((_, i) => (
								<div key={i} className="space-y-2">
									<Skeleton className="h-8 w-32" />
									<div className="rounded-md border">
										<Table>
											<TableHeader>
												<TableRow>
													{Array.from({ length: 10 }).map((_, j) => (
														<TableHead key={j}>
															<Skeleton className="h-4 w-full" />
														</TableHead>
													))}
												</TableRow>
											</TableHeader>
											<TableBody>
												{Array.from({ length: 5 }).map((_, k) => (
													<TableRow key={k}>
														{Array.from({ length: 10 }).map((_, l) => (
															<TableCell key={l}>
																<Skeleton className="h-4 w-full" />
															</TableCell>
														))}
													</TableRow>
												))}
											</TableBody>
										</Table>
									</div>
								</div>
							))}
						</div>
					) : students.length === 0 ? (
						<div className="text-center py-8">
							<p className="text-muted-foreground">No students found</p>
						</div>
					) : batchYearFilter === "all" ? (
						// Show grouped by batch when "All Batches" is selected
						<div className="space-y-4">
							{sortedBatchYears.map((batchYear) => {
								const batchStudents = studentsByBatch[batchYear] || [];
								const isExpanded = expandedBatches.has(batchYear);
								const batchDisplayName = `Batch ${batchYear}`;

								return (
									<div key={batchYear} className="rounded-md border">
										<div className="w-full flex items-center justify-between p-4 gap-3">
										<button
											type="button"
											onClick={() => toggleBatch(batchYear)}
												className="flex items-center gap-3 hover:text-primary transition-colors"
										>
												{isExpanded ? (
													<ChevronUp className="w-5 h-5 text-muted-foreground" />
												) : (
													<ChevronDown className="w-5 h-5 text-muted-foreground" />
												)}
												<h3 className="text-lg font-semibold">{batchDisplayName}</h3>
												<Badge variant="secondary">{batchStudents.length} students</Badge>
											</button>
											<Link href={`/superadmin/students/batch/${batchYear}`}>
												<Button variant="outline" size="sm">
													View batch
												</Button>
											</Link>
											</div>
										{isExpanded && (
											<div className="border-t">
												<Table>
													<TableHeader>
														<TableRow>
															<TableHead className="w-12">
																<Checkbox
																	checked={
																		batchStudents.every((s) =>
																			selectedStudents.includes(s.student_id)
																		) && batchStudents.length > 0
																	}
																	onCheckedChange={() => {
																		const allSelected = batchStudents.every((s) =>
																			selectedStudents.includes(s.student_id)
																		);
																		if (allSelected) {
																			setSelectedStudents((prev) =>
																				prev.filter(
																					(id) => !batchStudents.some((s) => s.student_id === id)
																				)
																			);
																		} else {
																			setSelectedStudents((prev) => [
																				...prev,
																				...batchStudents
																					.map((s) => s.student_id)
																					.filter((id) => !prev.includes(id)),
																			]);
																		}
																	}}
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
														{batchStudents.map((student) => (
															<TableRow key={student.student_id}>
																<TableCell>
																	<Checkbox
																		checked={selectedStudents.includes(student.student_id)}
																		onCheckedChange={() => toggleStudent(student.student_id)}
																	/>
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
																<TableCell>
																	{student.blood_group ? (
																		<Badge variant="secondary">
																			{student.blood_group}
																		</Badge>
																	) : (
																		<span className="text-muted-foreground">—</span>
																	)}
																</TableCell>
																<TableCell className="text-sm">
																	{student.phone || (
																		<span className="text-muted-foreground">—</span>
																	)}
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
																			onClick={() => {
																				setDeletingStudentId(student.student_id);
																				setIsDeleteDialogOpen(true);
																			}}
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
									</div>
								);
							})}
						</div>
					) : (
						// Show flat table when a specific batch is selected
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
											<TableCell>
												{student.blood_group ? (
													<Badge variant="secondary">
														{student.blood_group}
													</Badge>
												) : (
													<span className="text-muted-foreground">—</span>
												)}
											</TableCell>
											<TableCell className="text-sm">
												{student.phone || (
													<span className="text-muted-foreground">—</span>
												)}
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
														onClick={() => {
															setDeletingStudentId(student.student_id);
															setIsDeleteDialogOpen(true);
														}}
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

			{/* Delete Confirmation Dialog */}
			<AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the student record.
							{deletingStudentId && (
								<span className="block mt-2 text-sm text-muted-foreground">
									Note: If the student has ticket history, deletion will be blocked. Use deactivate instead.
								</span>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => setDeletingStudentId(null)}>
							Cancel
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleDelete}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
