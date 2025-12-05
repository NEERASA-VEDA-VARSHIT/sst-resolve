"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Pencil, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import Link from "next/link";

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

interface StudentsTableProps {
	students: Student[];
	batches: Batch[];
	batchYearFilter: string;
	selectedStudents: number[];
	onToggleStudent: (id: number) => void;
	onToggleAll: () => void;
	onEdit: (id: number) => void;
	onDelete: (id: number) => void;
	expandedBatches: Set<number>;
	onToggleBatch: (batchYear: number) => void;
}

export function StudentsTable({
	students,
	batches,
	batchYearFilter,
	selectedStudents,
	onToggleStudent,
	onToggleAll,
	onEdit,
	onDelete,
	expandedBatches,
	onToggleBatch,
}: StudentsTableProps) {
	// Group students by batch year
	const studentsByBatch = students.reduce((acc, student) => {
		const batchYear = student.batch_year || 0;
		if (!acc[batchYear]) {
			acc[batchYear] = [];
		}
		acc[batchYear].push(student);
		return acc;
	}, {} as Record<number, Student[]>);

	// Get sorted batch years (descending)
	const sortedBatchYears = batches
		.map((b) => b.batch_year)
		.sort((a, b) => b - a);

	if (students.length === 0) {
		return (
			<div className="text-center py-8">
				<p className="text-muted-foreground">No students found</p>
			</div>
		);
	}

	if (batchYearFilter === "all") {
		// Show grouped by batch when "All Batches" is selected
		return (
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
									onClick={() => onToggleBatch(batchYear)}
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
														onCheckedChange={(checked) => {
															if (checked) {
																batchStudents.forEach((s) => {
																	if (!selectedStudents.includes(s.student_id)) {
																		onToggleStudent(s.student_id);
																	}
																});
															} else {
																batchStudents.forEach((s) => {
																	if (selectedStudents.includes(s.student_id)) {
																		onToggleStudent(s.student_id);
																	}
																});
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
															onCheckedChange={() => onToggleStudent(student.student_id)}
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
																onClick={() => onEdit(student.student_id)}
															>
																<Pencil className="w-4 h-4" />
															</Button>
															<Button
																variant="ghost"
																size="sm"
																onClick={() => onDelete(student.student_id)}
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
		);
	}

	// Show flat table when a specific batch is selected
	return (
		<div className="rounded-md border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-12">
							<Checkbox
								checked={selectedStudents.length === students.length && students.length > 0}
								onCheckedChange={onToggleAll}
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
									onCheckedChange={() => onToggleStudent(student.student_id)}
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
										onClick={() => onEdit(student.student_id)}
									>
										<Pencil className="w-4 h-4" />
									</Button>
									<Button
										variant="ghost"
										size="sm"
										onClick={() => onDelete(student.student_id)}
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
	);
}
