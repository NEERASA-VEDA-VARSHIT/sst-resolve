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
	Building2, 
	Users, 
	Calendar, 
	Pencil, 
	Trash2,
	Loader2,
	AlertCircle
} from "lucide-react";
import { toast } from "sonner";

interface Hostel {
	id: number;
	name: string;
	code: string;
	created_at: string;
}

interface ClassSection {
	id: number;
	name: string;
	created_at: string;
}

interface Batch {
	id: number;
	batch_year: number;
	created_at: string;
}

export default function MasterDataPage() {
	// State for hostels
	const [hostels, setHostels] = useState<Hostel[]>([]);
	const [hostelDialog, setHostelDialog] = useState(false);
	const [hostelForm, setHostelForm] = useState({ name: "", code: "" });
	const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
	const [hostelLoading, setHostelLoading] = useState(false);

	// State for sections
	const [sections, setSections] = useState<ClassSection[]>([]);
	const [sectionDialog, setSectionDialog] = useState(false);
	const [sectionForm, setSectionForm] = useState({ name: "" });
	const [editingSection, setEditingSection] = useState<ClassSection | null>(null);
	const [sectionLoading, setSectionLoading] = useState(false);

	// State for batches
	const [batches, setBatches] = useState<Batch[]>([]);
	const [batchDialog, setBatchDialog] = useState(false);
	const [batchForm, setBatchForm] = useState({ batch_year: "" });
	const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
	const [batchLoading, setBatchLoading] = useState(false);

	const [deleteDialog, setDeleteDialog] = useState(false);
	const [deleteItem, setDeleteItem] = useState<{ type: string; id: number; name: string } | null>(null);

	// Fetch data on mount
	useEffect(() => {
		fetchHostels();
		fetchSections();
		fetchBatches();
	}, []);

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
		if (!hostelForm.name.trim() || !hostelForm.code.trim()) {
			toast.error("Please fill all fields");
			return;
		}

		setHostelLoading(true);
		try {
			if (editingHostel) {
				// Update
				const res = await fetch(`/api/superadmin/hostels/${editingHostel.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(hostelForm),
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
				// Create
				const res = await fetch("/api/superadmin/hostels", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(hostelForm),
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
		} catch (error) {
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
		} catch (error) {
			toast.error("An error occurred");
		}
	};

	const openHostelDialog = (hostel?: Hostel) => {
		if (hostel) {
			setEditingHostel(hostel);
			setHostelForm({ name: hostel.name, code: hostel.code });
		}
		setHostelDialog(true);
	};

	const closeHostelDialog = () => {
		setHostelDialog(false);
		setEditingHostel(null);
		setHostelForm({ name: "", code: "" });
	};

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

	const handleSectionSubmit = async () => {
		if (!sectionForm.name.trim()) {
			toast.error("Please enter section name");
			return;
		}

		setSectionLoading(true);
		try {
			if (editingSection) {
				// Update
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
				// Create
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
		} catch (error) {
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
		} catch (error) {
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
				// Update
				const res = await fetch(`/api/superadmin/batches/${editingBatch.id}`, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ batch_year: year }),
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
				// Create
				const res = await fetch("/api/superadmin/batches", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ batch_year: year }),
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
		} catch (error) {
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
		} catch (error) {
			toast.error("An error occurred");
		}
	};

	const openBatchDialog = (batch?: Batch) => {
		if (batch) {
			setEditingBatch(batch);
			setBatchForm({ batch_year: batch.batch_year.toString() });
		}
		setBatchDialog(true);
	};

	const closeBatchDialog = () => {
		setBatchDialog(false);
		setEditingBatch(null);
		setBatchForm({ batch_year: "" });
	};

	// ==================== DELETE CONFIRMATION ====================
	const confirmDelete = (type: string, id: number, name: string) => {
		setDeleteItem({ type, id, name });
		setDeleteDialog(true);
	};

	const handleDelete = () => {
		if (!deleteItem) return;

		switch (deleteItem.type) {
			case "hostel":
				handleDeleteHostel(deleteItem.id);
				break;
			case "section":
				handleDeleteSection(deleteItem.id);
				break;
			case "batch":
				handleDeleteBatch(deleteItem.id);
				break;
		}
	};

	return (
		<div className="container mx-auto py-8 space-y-6">
			<div>
				<h1 className="text-3xl font-bold">Master Data Management</h1>
				<p className="text-muted-foreground">
					Manage hostels, class sections, and batches for the institution
				</p>
			</div>

			<Tabs defaultValue="hostels" className="w-full">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="hostels" className="flex items-center gap-2">
						<Building2 className="h-4 w-4" />
						Hostels
					</TabsTrigger>
					<TabsTrigger value="sections" className="flex items-center gap-2">
						<Users className="h-4 w-4" />
						Class Sections
					</TabsTrigger>
					<TabsTrigger value="batches" className="flex items-center gap-2">
						<Calendar className="h-4 w-4" />
						Batches
					</TabsTrigger>
				</TabsList>

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
										<TableHead>Code</TableHead>
										<TableHead>Created At</TableHead>
										<TableHead className="text-right">Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{hostels.length === 0 ? (
										<TableRow>
											<TableCell colSpan={5} className="text-center text-muted-foreground">
												No hostels found
											</TableCell>
										</TableRow>
									) : (
										hostels.map((hostel) => (
											<TableRow key={hostel.id}>
												<TableCell>{hostel.id}</TableCell>
												<TableCell className="font-medium">{hostel.name}</TableCell>
												<TableCell>{hostel.code}</TableCell>
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

				{/* ==================== BATCHES TAB ==================== */}
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
												<TableCell className="font-medium">{batch.batch_year}</TableCell>
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
			</Tabs>

			{/* ==================== HOSTEL DIALOG ==================== */}
			<Dialog open={hostelDialog} onOpenChange={setHostelDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{editingHostel ? "Edit Hostel" : "Add Hostel"}</DialogTitle>
						<DialogDescription>
							{editingHostel ? "Update hostel information" : "Create a new hostel"}
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<Label htmlFor="hostel-name">Hostel Name</Label>
							<Input
								id="hostel-name"
								value={hostelForm.name}
								onChange={(e) => setHostelForm({ ...hostelForm, name: e.target.value })}
								placeholder="e.g., Neeladri"
							/>
						</div>
						<div>
							<Label htmlFor="hostel-code">Hostel Code</Label>
							<Input
								id="hostel-code"
								value={hostelForm.code}
								onChange={(e) => setHostelForm({ ...hostelForm, code: e.target.value })}
								placeholder="e.g., NLD"
							/>
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
								onChange={(e) => setBatchForm({ batch_year: e.target.value })}
								placeholder="e.g., 2028"
								min="2000"
								max="2100"
							/>
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
