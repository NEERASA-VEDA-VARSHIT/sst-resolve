"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Users, Settings2, Shield, Calendar } from "lucide-react";
import Link from "next/link";
import type { ClassSection, Batch, Hostel } from "@/db/types-only";
import { SectionsTab } from "./SectionsTab";
import { BatchesTab } from "./BatchesTab";
import { HostelsTab } from "./HostelsTab";
import { SectionDialog } from "./SectionDialog";
import { BatchDialog } from "./BatchDialog";
import { HostelDialog } from "./HostelDialog";
import { DeleteDialog } from "./DeleteDialog";
import { toast } from "sonner";

interface MasterDataManagementProps {
	initialSections: ClassSection[];
	initialBatches: Batch[];
	initialHostels: Hostel[];
}

export function MasterDataManagement({
	initialSections,
	initialBatches,
	initialHostels,
}: MasterDataManagementProps) {
	const router = useRouter();
	
	const [sections] = useState<ClassSection[]>(initialSections);
	const [sectionDialog, setSectionDialog] = useState(false);
	const [sectionForm, setSectionForm] = useState({ name: "" });
	const [editingSection, setEditingSection] = useState<ClassSection | null>(null);
	const [sectionLoading, setSectionLoading] = useState(false);

	const [batches] = useState<Batch[]>(initialBatches);
	const [batchDialog, setBatchDialog] = useState(false);
	const [batchForm, setBatchForm] = useState({ batch_year: "", is_active: true });
	const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
	const [batchLoading, setBatchLoading] = useState(false);

	const [hostels] = useState<Hostel[]>(initialHostels);
	const [hostelDialog, setHostelDialog] = useState(false);
	const [hostelForm, setHostelForm] = useState({ name: "", is_active: true });
	const [editingHostel, setEditingHostel] = useState<Hostel | null>(null);
	const [hostelLoading, setHostelLoading] = useState(false);

	const [deleteDialog, setDeleteDialog] = useState(false);
	const [deleteItem, setDeleteItem] = useState<{ type: string; id: number; name: string } | null>(null);

	const refreshData = () => {
		router.refresh();
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
					refreshData();
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
					refreshData();
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
				refreshData();
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
					refreshData();
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
					refreshData();
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
				refreshData();
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
					refreshData();
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
						is_active: hostelForm.is_active,
					}),
				});

				if (res.ok) {
					toast.success("Hostel created successfully");
					refreshData();
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
				refreshData();
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

				<TabsContent value="sections">
					<SectionsTab
						sections={sections}
						onAdd={() => openSectionDialog()}
						onEdit={openSectionDialog}
						onDelete={(id) => confirmDelete("section", id, sections.find(s => s.id === id)?.name || "")}
					/>
				</TabsContent>

				<TabsContent value="batches">
					<BatchesTab
						batches={batches}
						onAdd={() => openBatchDialog()}
						onEdit={openBatchDialog}
						onDelete={(id) => confirmDelete("batch", id, batches.find(b => b.id === id)?.batch_year.toString() || "")}
					/>
				</TabsContent>

				<TabsContent value="hostels">
					<HostelsTab
						hostels={hostels}
						onAdd={() => openHostelDialog()}
						onEdit={openHostelDialog}
						onDelete={(id) => confirmDelete("hostel", id, hostels.find(h => h.id === id)?.name || "")}
					/>
				</TabsContent>
			</Tabs>

			<SectionDialog
				open={sectionDialog}
				onOpenChange={setSectionDialog}
				editingSection={editingSection}
				formData={sectionForm}
				onFormChange={setSectionForm}
				onSubmit={handleSectionSubmit}
				loading={sectionLoading}
			/>

			<BatchDialog
				open={batchDialog}
				onOpenChange={setBatchDialog}
				editingBatch={editingBatch}
				formData={batchForm}
				onFormChange={setBatchForm}
				onSubmit={handleBatchSubmit}
				loading={batchLoading}
			/>

			<HostelDialog
				open={hostelDialog}
				onOpenChange={setHostelDialog}
				editingHostel={editingHostel}
				formData={hostelForm}
				onFormChange={setHostelForm}
				onSubmit={handleHostelSubmit}
				loading={hostelLoading}
			/>

			<DeleteDialog
				open={deleteDialog}
				onOpenChange={setDeleteDialog}
				itemName={deleteItem?.name || null}
				onConfirm={handleDelete}
			/>
		</div>
	);
}
