"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useDebouncedCallback } from "use-debounce";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentBulkUpload } from "./StudentBulkUpload";
import { AddSingleStudentDialog } from "./AddSingleStudentDialog";
import { BulkEditDialog } from "./BulkEditDialog";
import { Upload, UserPlus } from "lucide-react";
import { EditStudentDialog } from "./EditStudentDialog";
import { StudentsFilters } from "./StudentsFilters";
import { StudentsTable } from "./StudentsTable";
import { BulkActionsBar } from "./BulkActionsBar";
// import { StudentsPagination } from "./StudentsPagination"; // TODO: Create this component
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

interface StudentsManagementProps {
	initialStudents: Student[];
	initialBatches: Batch[];
	initialHostels: Hostel[];
	initialPagination: PaginationInfo;
	initialSearch?: string;
	initialHostelFilter?: string;
	initialBatchYearFilter?: string;
}

export function StudentsManagement({
	initialStudents,
	initialBatches,
	initialHostels,
	initialPagination,
	initialSearch = "",
	initialHostelFilter = "all",
	initialBatchYearFilter = "all",
}: StudentsManagementProps) {
	const router = useRouter();
	const searchParams = useSearchParams();
	
	const [students, setStudents] = useState<Student[]>(initialStudents);
	const [batches, setBatches] = useState<Batch[]>(initialBatches);
	const [hostels, setHostels] = useState<Hostel[]>(initialHostels);
	const [pagination, setPagination] = useState<PaginationInfo>(initialPagination);
	const [search, setSearch] = useState(initialSearch);
	const [hostelFilter, setHostelFilter] = useState(initialHostelFilter);
	const [batchYearFilter, setBatchYearFilter] = useState(initialBatchYearFilter);
	const [showUploadView, setShowUploadView] = useState(false);
	const [showAddStudentDialog, setShowAddStudentDialog] = useState(false);
	const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
	const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
	const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
	const [showEditDialog, setShowEditDialog] = useState(false);
	const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());
	const [deletingStudentId, setDeletingStudentId] = useState<number | null>(null);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

	// Auto-expand batches that have students on initial load
	useEffect(() => {
		if (batchYearFilter === "all" && students.length > 0 && expandedBatches.size === 0) {
			const batchesWithStudents = new Set<number>(
				students
					.map((s) => s.batch_year)
					.filter((year): year is number => year !== null)
			);
			if (batchesWithStudents.size > 0) {
				setExpandedBatches(batchesWithStudents);
			}
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [batchYearFilter, students.length]);

	const updateURL = (newSearch: string, newHostelFilter: string, newBatchYearFilter: string, newPage: number) => {
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
		if (newBatchYearFilter !== "all") {
			params.set("batch_year", newBatchYearFilter);
		} else {
			params.delete("batch_year");
		}
		if (newPage > 1) {
			params.set("page", newPage.toString());
		} else {
			params.delete("page");
		}
		router.push(`?${params.toString()}`);
	};

	const refreshData = () => {
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

	const clearSelection = () => {
		setSelectedStudents([]);
	};

	// Debounced search to reduce API calls
	const debouncedSearch = useDebouncedCallback(
		(value: string) => {
			updateURL(value, hostelFilter, batchYearFilter, 1);
			router.refresh();
		},
		300 // Wait 300ms after user stops typing
	);

	const handleSearch = () => {
		updateURL(search, hostelFilter, batchYearFilter, 1);
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
		updateURL(search, value, batchYearFilter, 1);
		router.refresh();
	};

	const handleBatchYearFilterChange = (value: string) => {
		setBatchYearFilter(value);
		updateURL(search, hostelFilter, value, 1);
		router.refresh();
	};

	const handlePageChange = (newPage: number) => {
		updateURL(search, hostelFilter, batchYearFilter, newPage);
		router.refresh();
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
				refreshData();
			} else {
				const error = await response.json();
				toast.error(error.error || "Failed to delete student");
			}
		} catch (error) {
			console.error("Delete error:", error);
			toast.error("Failed to delete student");
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

			<StudentsFilters
				search={search}
				hostelFilter={hostelFilter}
				batchYearFilter={batchYearFilter}
				onSearchChange={handleSearchChange}
				onHostelFilterChange={handleHostelFilterChange}
				onBatchYearFilterChange={handleBatchYearFilterChange}
				onSearch={handleSearch}
				onKeyPress={handleKeyPress}
				batches={batches}
				hostels={hostels}
			/>

			<Card>
				<CardHeader>
					<CardTitle>Students ({pagination.total})</CardTitle>
					<CardDescription>
						All student profiles managed by the system, grouped by batch
					</CardDescription>
				</CardHeader>
				<CardContent>
					<StudentsTable
						students={students}
						batches={batches}
						batchYearFilter={batchYearFilter}
						selectedStudents={selectedStudents}
						onToggleStudent={toggleStudent}
						onToggleAll={toggleAll}
						onEdit={(id) => {
							setEditingStudentId(id);
							setShowEditDialog(true);
						}}
						onDelete={(id) => {
							setDeletingStudentId(id);
							setIsDeleteDialogOpen(true);
						}}
						expandedBatches={expandedBatches}
						onToggleBatch={toggleBatch}
					/>
					{/* <StudentsPagination pagination={pagination} onPageChange={handlePageChange} /> */}
				</CardContent>
			</Card>

			<BulkActionsBar
				selectedCount={selectedStudents.length}
				onBulkEdit={() => setShowBulkEditDialog(true)}
				onClearSelection={clearSelection}
			/>

			{/* Add Student Dialog */}
			<AddSingleStudentDialog
				open={showAddStudentDialog}
				onOpenChange={setShowAddStudentDialog}
				onSuccess={() => {
					refreshData();
				}}
			/>

			{/* Bulk Edit Dialog */}
			<BulkEditDialog
				open={showBulkEditDialog}
				onOpenChange={setShowBulkEditDialog}
				selectedStudentIds={selectedStudents}
				onSuccess={() => {
					refreshData();
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
						refreshData();
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
