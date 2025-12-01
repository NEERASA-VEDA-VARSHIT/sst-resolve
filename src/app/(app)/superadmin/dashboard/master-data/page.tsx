"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/components/ui/table";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Plus,
	Users,
	Calendar,
	Pencil,
	Trash2,
	Loader2,
	AlertCircle,
	Settings2,
	Shield
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import type { ClassSection, Batch, Hostel } from "@/db/types-only";

export default function MasterDataPage() {
	// State for sections
	const [sections, setSections] = useState<ClassSection[]>([]);
	const [sectionDialog, setSectionDialog] = useState(false);
	const [sectionForm, setSectionForm] = useState({ name: "" });
	const [editingSection, setEditingSection] = useState<ClassSection | null>(null);
	const [sectionLoading, setSectionLoading] = useState(false);

	// State for batches
	const [batches, setBatches] = useState<Batch[]>([]);
	const [batchDialog, setBatchDialog] = useState(false);
	const [batchForm, setBatchForm] = useState({ batch_year: "", is_active: true });
	const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
	const [batchLoading, setBatchLoading] = useState(false);

	// State for hostels
	const [hostels, setHostels] = useState<Hostel[]>([]);
	const [hostelDialog, setHostelDialog] = useState(false);
	const [hostelForm, setHostelForm] = useState({ name: "", is_active: true });
	const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
	const [hostelLoading, setHostelLoading] = useState(false);

	const [deleteDialog, setDeleteDialog] = useState(false);
	const [deleteItem, setDeleteItem] = useState<{ type: string; id: number; name: string } | null>(null);

	// Fetch data on mount
	useEffect(() => {
		fetchSections();
		fetchBatches();
		fetchHostels();
	}, []);

	// ==================== SECTIONS ====================
	const fetchSections = async () => {
		try {
			const res = await fetch("/api/superadmin/class-sections");
			if (res.ok) {
				const data = await res.json();
				setSections(data.class_sections || []);
			}
		} catch (error) {
			console.error("Error fetching sections:", error);
		}
	};

	// ==================== HOSTELS ====================
	const fetchHostels = async () => {
		try {
			const res = await fetch("/api/superadmin/hostels");
			if (res.ok) {
				const data = await res.json();
				setHostels(data.hostels || []);
			}
		} catch (error) {
			console.error("Error fetching hostels:", error);
		}
	};

	const handleHostelSubmit = async () => {
		if (!hostelForm.name.trim()) {
			toast.error("Please enter hostel name");
			return;
		}

		setHostelLoading(true);
		try {
			if (editingHostel) {
				const res = await fetch(`/api/superadmin/hostels/${editingHostel.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: hostelForm.name.trim(),
						is_active: hostelForm.is_active,
					}),
				});

				if (res.ok) {
					toast.success("Hostel updated successfully");
					fetchHostels();
					closeHostelDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to update hostel");
				}
			} else {
				const res = await fetch("/api/superadmin/hostels", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: hostelForm.name.trim(),
						// backend defaults to true; we explicitly set it from form for clarity
						is_active: hostelForm.is_active,
					}),
				});

				if (res.ok) {
					toast.success("Hostel created successfully");
					fetchHostels();
					closeHostelDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to create hostel");
				}
			}
		} catch {
			toast.error("An error occurred");
		} finally {
			setHostelLoading(false);
		}
	};

	const handleDeleteHostel = async (id: number) => {
		try {
			const res = await fetch(`/api/superadmin/hostels/${id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				toast.success("Hostel deleted successfully");
				fetchHostels();
				setDeleteDialog(false);
				setDeleteItem(null);
			} else {
				const error = await res.json();
				toast.error(error.error || "Failed to delete hostel");
			}
		} catch {
			toast.error("An error occurred");
		}
	};

	const openHostelDialog = (hostel?: Hostel) => {
		if (hostel) {
			setEditingHostel(hostel);
			setHostelForm({ name: hostel.name, is_active: true });
		} else {
			setEditingHostel(null);
			setHostelForm({ name: "", is_active: true });
		}
		setHostelDialog(true);
	};

	const closeHostelDialog = () => {
		setHostelDialog(false);
		setEditingHostel(null);
		setHostelForm({ name: "", is_active: true });
	};

	const handleSectionSubmit = async () => {
		if (!sectionForm.name.trim()) {
			toast.error("Please enter section name");
			return;
		}

		setSectionLoading(true);
		try {
			if (editingSection) {
				const res = await fetch(`/api/superadmin/class-sections/${editingSection.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(sectionForm),
				});

				if (res.ok) {
					toast.success("Section updated successfully");
					fetchSections();
					closeSectionDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to update section");
				}
			} else {
				const res = await fetch("/api/superadmin/class-sections", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(sectionForm),
				});

				if (res.ok) {
					toast.success("Section created successfully");
					fetchSections();
					closeSectionDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to create section");
				}
			}
		} catch {
			toast.error("An error occurred");
		} finally {
			setSectionLoading(false);
		}
	};

	const handleDeleteSection = async (id: number) => {
		try {
			const res = await fetch(`/api/superadmin/class-sections/${id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				toast.success("Section deleted successfully");
				fetchSections();
				setDeleteDialog(false);
				setDeleteItem(null);
			} else {
				const error = await res.json();
				toast.error(error.error || "Failed to delete section");
			}
		} catch {
			toast.error("An error occurred");
		}
	};

	const openSectionDialog = (section?: ClassSection) => {
		if (section) {
			setEditingSection(section);
			setSectionForm({ name: section.name });
		}
		setSectionDialog(true);
	};

	const closeSectionDialog = () => {
		setSectionDialog(false);
		setEditingSection(null);
		setSectionForm({ name: "" });
	};

	// ==================== BATCHES ====================
	const fetchBatches = async () => {
		try {
			const res = await fetch("/api/superadmin/batches");
			if (res.ok) {
				const data = await res.json();
				setBatches(data.batches || []);
			}
		} catch (error) {
			console.error("Error fetching batches:", error);
		}
	};

	const handleBatchSubmit = async () => {
		if (!batchForm.batch_year.trim()) {
			toast.error("Please enter batch year");
			return;
		}

		const year = parseInt(batchForm.batch_year);
		if (isNaN(year) || year < 2000 || year > 2100) {
			toast.error("Please enter a valid year");
			return;
		}

		setBatchLoading(true);
		try {
			if (editingBatch) {
				const res = await fetch(`/api/superadmin/batches/${editingBatch.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						batch_year: year,
						is_active: batchForm.is_active,
					}),
				});

				if (res.ok) {
					toast.success("Batch updated successfully");
					fetchBatches();
					closeBatchDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to update batch");
				}
			} else {
				const res = await fetch("/api/superadmin/batches", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						batch_year: year,
						is_active: batchForm.is_active,
					}),
				});

				if (res.ok) {
					toast.success("Batch created successfully");
					fetchBatches();
					closeBatchDialog();
				} else {
					const error = await res.json();
					toast.error(error.error || "Failed to create batch");
				}
			}
		} catch {
			toast.error("An error occurred");
		} finally {
			setBatchLoading(false);
		}
	};

	const handleDeleteBatch = async (id: number) => {
		try {
			const res = await fetch(`/api/superadmin/batches/${id}`, {
				method: "DELETE",
			});

			if (res.ok) {
				toast.success("Batch deleted successfully");
				fetchBatches();
				setDeleteDialog(false);
				setDeleteItem(null);
			} else {
				const error = await res.json();
				toast.error(error.error || "Failed to delete batch");
			}
		} catch {
			toast.error("An error occurred");
		}
	};

	const openBatchDialog = (batch?: Batch) => {
		if (batch) {
			setEditingBatch(batch);
			setBatchForm({ batch_year: batch.batch_year.toString(), is_active: true });
		} else {
			setEditingBatch(null);
			setBatchForm({ batch_year: "", is_active: true });
		}
		setBatchDialog(true);
	};

	const closeBatchDialog = () => {
		setBatchDialog(false);
		setEditingBatch(null);
		setBatchForm({ batch_year: "", is_active: true });
	};

	// ==================== DELETE CONFIRMATION ====================
	const confirmDelete = (type: string, id: number, name: string) => {
		setDeleteItem({ type, id, name });
		setDeleteDialog(true);
	};

	const handleDelete = () => {
		if (!deleteItem) return;

		switch (deleteItem.type) {
			case "section":
				handleDeleteSection(deleteItem.id);
				break;
			case "batch":
				handleDeleteBatch(deleteItem.id);
				break;
			case "hostel":
				handleDeleteHostel(deleteItem.id);
				break;
		}
	};

	return (
		<div className="container mx-auto py-8 space-y-8">
			{/* PAGE HEADER */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-3xl font-bold">Master Data Management</h1>
					<p className="text-muted-foreground">
						Central hub for students, admins, domains &amp; scopes, and committees.
					</p>
				</div>
			</div>

			{/* HIGH-LEVEL MASTER DATA HUB */}
			<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-4 w-4" />
							Students
						</CardTitle>
						<CardDescription>
							Add, edit, deactivate and bulk-manage student records.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex justify-end">
						<Button asChild size="sm">
							<Link href="/superadmin/students">Open Students</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Shield className="h-4 w-4" />
							Admins
						</CardTitle>
						<CardDescription>
							Manage admin and super admin staff profiles and roles.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex justify-end">
						<Button asChild size="sm">
							<Link href="/superadmin/dashboard/staff">Open Staff</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Settings2 className="h-4 w-4" />
							Domains &amp; Scopes
						</CardTitle>
						<CardDescription>
							Configure operational domains and their scopes (e.g., Hostel, College).
						</CardDescription>
					</CardHeader>
					<CardContent className="flex justify-end">
						<Button asChild size="sm">
							<Link href="/superadmin/dashboard/domains">Open Domains &amp; Scopes</Link>
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-4 w-4" />
							Committees
						</CardTitle>
						<CardDescription>
							Manage committees and their committee heads.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex justify-end">
						<Button asChild size="sm">
							<Link href="/superadmin/dashboard/committees">Open Committees</Link>
						</Button>
					</CardContent>
				</Card>
			</div>

			<Tabs defaultValue="sections" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="sections" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Class Sections
					</TabsTrigger>
					<TabsTrigger value="batches" className="flex items-center gap-2">
						<Calendar className="h-4 w-4" />
						Batches
					</TabsTrigger>
					<TabsTrigger value="hostels" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Hostels
					</TabsTrigger>
				</TabsList>

				{/* ==================== SECTIONS TAB ==================== */}
				<TabsContent value="sections">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Class Sections</CardTitle>
								<CardDescription>Manage class section information</CardDescription>
							</div>
							<Button onClick={() => openSectionDialog()}>
								<Plus className="h-4 w-4 mr-2" />
								Add Section
							</Button>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Created At</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{sections.length === 0 ? (
										<TableRow>
											<TableCell colSpan={4} className="text-center text-muted-foreground">
												No sections found
											</TableCell>
										</TableRow>
									) : (
										sections.map((section) => (
											<TableRow key={section.id}>
												<TableCell>{section.id}</TableCell>
												<TableCell className="font-medium">{section.name}</TableCell>
												<TableCell>{new Date(section.created_at).toLocaleDateString()}</TableCell>
												<TableCell className="text-right space-x-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => openSectionDialog(section)}
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => confirmDelete("section", section.id, section.name)}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* ====================BATCHES TAB ==================== */}
				<TabsContent value="batches">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Batches</CardTitle>
								<CardDescription>Manage batch year information</CardDescription>
							</div>
							<Button onClick={() => openBatchDialog()}>
								<Plus className="h-4 w-4 mr-2" />
								Add Batch
							</Button>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Batch Year</TableHead>
										<TableHead>Created At</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{batches.length === 0 ? (
										<TableRow>
											<TableCell colSpan={4} className="text-center text-muted-foreground">
												No batches found
											</TableCell>
										</TableRow>
									) : (
										batches.sort((a, b) => b.batch_year - a.batch_year).map((batch) => (
											<TableRow key={batch.id}>
												<TableCell>{batch.id}</TableCell>
											<TableCell className="font-medium">
												{batch.batch_year}
												{batch.is_active === false && (
													<span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
												)}
											</TableCell>
												<TableCell>{new Date(batch.created_at).toLocaleDateString()}</TableCell>
												<TableCell className="text-right space-x-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => openBatchDialog(batch)}
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => confirmDelete("batch", batch.id, batch.batch_year.toString())}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>

				{/* ==================== HOSTELS TAB ==================== */}
				<TabsContent value="hostels">
					<Card>
						<CardHeader className="flex flex-row items-center justify-between">
							<div>
								<CardTitle>Hostels</CardTitle>
								<CardDescription>Manage hostel information</CardDescription>
							</div>
							<Button onClick={() => openHostelDialog()}>
								<Plus className="h-4 w-4 mr-2" />
								Add Hostel
							</Button>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>ID</TableHead>
										<TableHead>Name</TableHead>
										<TableHead>Created At</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{hostels.length === 0 ? (
										<TableRow>
											<TableCell colSpan={4} className="text-center text-muted-foreground">
												No hostels found
											</TableCell>
										</TableRow>
									) : (
										hostels.map((hostel) => (
											<TableRow key={hostel.id}>
												<TableCell>{hostel.id}</TableCell>
												<TableCell className="font-medium">{hostel.name}</TableCell>
												<TableCell>{new Date(hostel.created_at).toLocaleDateString()}</TableCell>
												<TableCell className="text-right space-x-2">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => openHostelDialog(hostel)}
													>
														<Pencil className="h-4 w-4" />
													</Button>
													<Button
														variant="ghost"
														size="sm"
														onClick={() => confirmDelete("hostel", hostel.id, hostel.name)}
													>
														<Trash2 className="h-4 w-4 text-destructive" />
													</Button>
												</TableCell>
											</TableRow>
										))
									)}
								</TableBody>
							</Table>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			{/* ==================== SECTION DIALOG ==================== */}
			<Dialog open={sectionDialog} onOpenChange={setSectionDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingSection ? "Edit Section" : "Add Section"}</DialogTitle>
						<DialogDescription>
							{editingSection ? "Update section information" : "Create a new section"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="section-name">Section Name</Label>
							<Input
								id="section-name"
								value={sectionForm.name}
								onChange={(e) => setSectionForm({ name: e.target.value })}
								placeholder="e.g., A"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeSectionDialog}>
							Cancel
						</Button>
						<Button onClick={handleSectionSubmit} disabled={sectionLoading}>
							{sectionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{editingSection ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ==================== BATCH DIALOG ==================== */}
			<Dialog open={batchDialog} onOpenChange={setBatchDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingBatch ? "Edit Batch" : "Add Batch"}</DialogTitle>
						<DialogDescription>
							{editingBatch ? "Update batch year" : "Create a new batch year"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="batch-year">Batch Year</Label>
							<Input
								id="batch-year"
								type="number"
								value={batchForm.batch_year}
								onChange={(e) => setBatchForm({ ...batchForm, batch_year: e.target.value })}
								placeholder="e.g., 2028"
								min="2000"
								max="2100"
							/>
						</div>
						<div className="flex items-center space-x-2">
							<input
								id="batch-active"
								type="checkbox"
								checked={batchForm.is_active}
								onChange={(e) =>
									setBatchForm((prev) => ({ ...prev, is_active: e.target.checked }))
								}
								className="h-4 w-4"
							/>
							<Label htmlFor="batch-active">Active</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeBatchDialog}>
							Cancel
						</Button>
						<Button onClick={handleBatchSubmit} disabled={batchLoading}>
							{batchLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{editingBatch ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ==================== HOSTEL DIALOG ==================== */}
			<Dialog open={hostelDialog} onOpenChange={setHostelDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingHostel ? "Edit Hostel" : "Add Hostel"}</DialogTitle>
						<DialogDescription>
							{editingHostel ? "Update hostel details" : "Create a new hostel"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="hostel-name">Hostel Name</Label>
							<Input
								id="hostel-name"
								value={hostelForm.name}
								onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
								placeholder="e.g., Hostel A"
							/>
						</div>
						<div className="flex items-center space-x-2">
							<input
								id="hostel-active"
								type="checkbox"
								checked={hostelForm.is_active}
								onChange={(e) =>
									setHostelForm((prev) => ({ ...prev, is_active: e.target.checked }))
								}
								className="h-4 w-4"
							/>
							<Label htmlFor="hostel-active">Active</Label>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={closeHostelDialog}>
							Cancel
						</Button>
						<Button onClick={handleHostelSubmit} disabled={hostelLoading}>
							{hostelLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							{editingHostel ? "Update" : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
			<Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertCircle className="h-5 w-5 text-destructive" />
							Confirm Delete
						</DialogTitle>
						<DialogDescription>
							Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
							This action cannot be undone and may affect student records.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteDialog(false)}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={handleDelete}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
