"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    Pencil,
    Loader2,
    ArrowLeft,
    Trash2
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

interface Domain {
    id: number;
    name: string;
    description: string | null;
    is_active: boolean;
    created_at: string;
}

interface Scope {
    id: number;
    domain_id: number;
    name: string;
    description: string | null;
    student_field_key: string | null;
    is_active: boolean;
    created_at: string;
}

export default function DomainsPage() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [scopes, setScopes] = useState<Scope[]>([]);
    const [selectedDomain, setSelectedDomain] = useState<number | null>(null);

    // Domain dialog state
    const [domainDialog, setDomainDialog] = useState(false);
    const [domainForm, setDomainForm] = useState({ name: "", description: "" });
    const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
    const [domainLoading, setDomainLoading] = useState(false);

    // Scope dialog state
    const [scopeDialog, setScopeDialog] = useState(false);
    const [scopeForm, setScopeForm] = useState({ 
        name: "", 
        description: "", 
        domain_id: "",
        student_field_key: "" as string | null
    });
    const [editingScope, setEditingScope] = useState<Scope | null>(null);
    const [scopeLoading, setScopeLoading] = useState(false);
    
    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deletingItem, setDeletingItem] = useState<{ type: "domain" | "scope"; id: number; name: string } | null>(null);
    
    // Master data for scope form dropdowns
    const [hostels, setHostels] = useState<Array<{ id: number; name: string }>>([]);
    const [classSections, setClassSections] = useState<Array<{ id: number; name: string }>>([]);
    const [batches, setBatches] = useState<Array<{ id: number; batch_year: number }>>([]);
    const [loadingMasterData, setLoadingMasterData] = useState(false);

    useEffect(() => {
        fetchData();
        fetchMasterData();
    }, []);

    const fetchMasterData = async () => {
        setLoadingMasterData(true);
        try {
            // Fetch hostels (active only)
            const hostelsRes = await fetch("/api/superadmin/hostels?active=true");
            if (hostelsRes.ok) {
                const hostelsData = await hostelsRes.json();
                setHostels(hostelsData.hostels || []);
            }

            // Fetch class sections (active only)
            const sectionsRes = await fetch("/api/superadmin/class-sections?active=true");
            if (sectionsRes.ok) {
                const sectionsData = await sectionsRes.json();
                setClassSections(sectionsData.class_sections || []);
            }

            // Fetch batches (active only)
            const batchesRes = await fetch("/api/superadmin/batches?active=true");
            if (batchesRes.ok) {
                const batchesData = await batchesRes.json();
                setBatches(batchesData.batches || []);
            }
        } catch (error) {
            console.error("Error fetching master data:", error);
        } finally {
            setLoadingMasterData(false);
        }
    };

    const fetchData = async () => {
        try {
            const res = await fetch("/api/domains");
            if (res.ok) {
                const data = await res.json();
                setDomains(data.domains || []);
                setScopes(data.scopes || []);
            }
        } catch (error) {
            console.error("Error fetching domains:", error);
        }
    };

    // ==================== DOMAIN HANDLERS ====================
    const handleDomainSubmit = async () => {
        if (!domainForm.name.trim()) {
            toast.error("Please enter domain name");
            return;
        }

        setDomainLoading(true);
        try {
            if (editingDomain) {
                // Update domain
                const res = await fetch(`/api/superadmin/domains/${editingDomain.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(domainForm),
                });

                if (res.ok) {
                    toast.success("Domain updated successfully");
                    fetchData();
                    closeDomainDialog();
                } else {
                    const error = await res.json();
                    toast.error(error.error || "Failed to update domain");
                }
            } else {
                // Create domain
                const res = await fetch("/api/superadmin/domains", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(domainForm),
                });

                if (res.ok) {
                    toast.success("Domain created successfully");
                    fetchData();
                    closeDomainDialog();
                } else {
                    const error = await res.json();
                    toast.error(error.error || "Failed to create domain");
                }
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setDomainLoading(false);
        }
    };

    const openDomainDialog = (domain?: Domain) => {
        if (domain) {
            setEditingDomain(domain);
            setDomainForm({ name: domain.name, description: domain.description || "" });
        }
        setDomainDialog(true);
    };

    const closeDomainDialog = () => {
        setDomainDialog(false);
        setEditingDomain(null);
        setDomainForm({ name: "", description: "" });
    };

    // ==================== SCOPE HANDLERS ====================
    const handleScopeSubmit = async () => {
        if (!scopeForm.name.trim() || !scopeForm.domain_id) {
            toast.error("Please fill all required fields");
            return;
        }

        setScopeLoading(true);
        try {
            if (editingScope) {
                // Update scope
                const res = await fetch(`/api/superadmin/scopes/${editingScope.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: scopeForm.name,
                        description: scopeForm.description,
                        domain_id: parseInt(scopeForm.domain_id),
                        student_field_key: scopeForm.student_field_key || null,
                    }),
                });

                if (res.ok) {
                    toast.success("Scope updated successfully");
                    fetchData();
                    closeScopeDialog();
                } else {
                    const error = await res.json();
                    toast.error(error.error || "Failed to update scope");
                }
            } else {
                // Create scope
                const res = await fetch("/api/superadmin/scopes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: scopeForm.name,
                        description: scopeForm.description,
                        domain_id: parseInt(scopeForm.domain_id),
                        student_field_key: scopeForm.student_field_key || null,
                    }),
                });

                if (res.ok) {
                    toast.success("Scope created successfully");
                    fetchData();
                    closeScopeDialog();
                } else {
                    const error = await res.json();
                    toast.error(error.error || "Failed to create scope");
                }
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setScopeLoading(false);
        }
    };

    const openScopeDialog = (scope?: Scope) => {
        if (scope) {
            setEditingScope(scope);
            setScopeForm({
                name: scope.name,
                description: scope.description || "",
                domain_id: scope.domain_id.toString(),
                student_field_key: scope.student_field_key || null,
            });
        } else {
            setScopeForm({ 
                name: "", 
                description: "", 
                domain_id: selectedDomain?.toString() || "",
                student_field_key: null,
            });
        }
        // Refresh master data when opening dialog
        fetchMasterData();
        setScopeDialog(true);
    };

    const closeScopeDialog = () => {
        setScopeDialog(false);
        setEditingScope(null);
        setScopeForm({ name: "", description: "", domain_id: "", student_field_key: null });
    };

    const filteredScopes = selectedDomain
        ? scopes.filter(s => s.domain_id === selectedDomain)
        : [];

    // ==================== DELETE HANDLERS ====================
    const handleDelete = async () => {
        if (!deletingItem) return;

        try {
            const endpoint = deletingItem.type === "domain" 
                ? `/api/superadmin/domains/${deletingItem.id}`
                : `/api/superadmin/scopes/${deletingItem.id}`;

            const res = await fetch(endpoint, {
                method: "DELETE",
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(data.message || `${deletingItem.type === "domain" ? "Domain" : "Scope"} deleted successfully`);
                setDeleteDialogOpen(false);
                setDeletingItem(null);
                fetchData();
                // Clear selection if deleted domain was selected
                if (deletingItem.type === "domain" && selectedDomain === deletingItem.id) {
                    setSelectedDomain(null);
                }
            } else {
                const error = await res.json();
                toast.error(error.error || `Failed to delete ${deletingItem.type}`);
            }
        } catch (error) {
            console.error("Delete error:", error);
            toast.error(`Failed to delete ${deletingItem.type}`);
        }
    };

    const openDeleteDialog = (type: "domain" | "scope", item: Domain | Scope) => {
        setDeletingItem({
            type,
            id: item.id,
            name: item.name,
        });
        setDeleteDialogOpen(true);
    };

    return (
        <div className="container mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Domains & Scopes Management</h1>
                    <p className="text-muted-foreground">
                        Manage operational domains and their scopes
                    </p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/superadmin/dashboard/master-data">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to Master Data
                    </Link>
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* DOMAINS CARD */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Domains</CardTitle>
                            <CardDescription>Click a domain to view its scopes</CardDescription>
                        </div>
                        <Button onClick={() => openDomainDialog()} size="sm">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Domain
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {domains.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                                            No domains found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    domains.map((domain) => (
                                        <TableRow
                                            key={domain.id}
                                            className={`cursor-pointer transition-colors ${selectedDomain === domain.id
                                                    ? "bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary"
                                                    : "hover:bg-muted/50"
                                                }`}
                                            onClick={() => setSelectedDomain(domain.id)}
                                        >
                                            <TableCell className={`font-medium ${selectedDomain === domain.id ? "font-semibold" : ""}`}>
                                                {domain.name}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {domain.description || "-"}
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <div className="flex items-center gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDomainDialog(domain);
                                                        }}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            openDeleteDialog("domain", domain);
                                                        }}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>

                {/* SCOPES CARD */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div>
                            <CardTitle>Scopes</CardTitle>
                            <CardDescription>
                                {selectedDomain
                                    ? `${domains.find(d => d.id === selectedDomain)?.name || ''} Scopes`
                                    : "← Select a domain to view its scopes"}
                            </CardDescription>
                        </div>
                        <Button
                            onClick={() => openScopeDialog()}
                            size="sm"
                            disabled={!selectedDomain}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Scope
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {!selectedDomain ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
                                <p className="text-muted-foreground text-sm">
                                    Click on a domain from the left to view and manage its scopes
                                </p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredScopes.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                                                No scopes found for this domain
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredScopes.map((scope) => (
                                            <TableRow key={scope.id}>
                                                <TableCell className="font-medium">{scope.name}</TableCell>
                                                <TableCell>
                                                    {scope.student_field_key ? (
                                                        <Badge variant="secondary" className="text-xs">
                                                            Dynamic ({scope.student_field_key.replace("_id", "")})
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs">
                                                            Fixed
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {scope.description || "-"}
                                                </TableCell>
                                                <TableCell className="text-right space-x-2">
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openScopeDialog(scope)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => openDeleteDialog("scope", scope)}
                                                            className="text-destructive hover:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ==================== DOMAIN DIALOG ==================== */}
            <Dialog open={domainDialog} onOpenChange={setDomainDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingDomain ? "Edit Domain" : "Add Domain"}</DialogTitle>
                        <DialogDescription>
                            {editingDomain ? "Update domain information" : "Create a new operational domain"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="domain-name">Domain Name *</Label>
                            <Input
                                id="domain-name"
                                value={domainForm.name}
                                onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
                                placeholder="e.g., Hostel, College, Mess"
                            />
                        </div>
                        <div>
                            <Label htmlFor="domain-description">Description</Label>
                            <Textarea
                                id="domain-description"
                                value={domainForm.description}
                                onChange={(e) => setDomainForm({ ...domainForm, description: e.target.value })}
                                placeholder="Brief description of this domain"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeDomainDialog}>
                            Cancel
                        </Button>
                        <Button onClick={handleDomainSubmit} disabled={domainLoading}>
                            {domainLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingDomain ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== SCOPE DIALOG ==================== */}
            <Dialog open={scopeDialog} onOpenChange={setScopeDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingScope ? "Edit Scope" : "Add Scope"}</DialogTitle>
                        <DialogDescription>
                            {editingScope ? "Update scope information" : "Create a new scope within a domain"}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="scope-domain">Domain *</Label>
                            <Select
                                value={scopeForm.domain_id}
                                onValueChange={(value) => setScopeForm({ ...scopeForm, domain_id: value })}
                                disabled={!!editingScope}
                            >
                                <SelectTrigger id="scope-domain">
                                    <SelectValue placeholder="Select domain" />
                                </SelectTrigger>
                                <SelectContent>
                                    {domains.map((domain) => (
                                        <SelectItem key={domain.id} value={domain.id.toString()}>
                                            {domain.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="scope-student-field">Student Field Key (Optional)</Label>
                            <Select
                                value={scopeForm.student_field_key || "none"}
                                onValueChange={(value) => {
                                    const newFieldKey = value === "none" ? null : value;
                                    // Clear scope name when changing field key type
                                    setScopeForm({ 
                                        ...scopeForm, 
                                        student_field_key: newFieldKey,
                                        name: "" // Reset name when changing field type
                                    });
                                }}
                            >
                                <SelectTrigger id="scope-student-field">
                                    <SelectValue placeholder="Select student field (for dynamic scopes)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None (Fixed Scope)</SelectItem>
                                    <SelectItem value="hostel_id">Hostel ID (Dynamic from Student)</SelectItem>
                                    <SelectItem value="class_section_id">Class Section ID (Dynamic from Student)</SelectItem>
                                    <SelectItem value="batch_id">Batch ID (Dynamic from Student)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {scopeForm.student_field_key 
                                    ? "This scope will be dynamically resolved from the student's " + scopeForm.student_field_key.replace("_id", "") + ". Select the value from the dropdown below."
                                    : "This is a fixed scope (not based on student data). Enter a custom name below."}
                            </p>
                        </div>
                        <div>
                            <Label htmlFor="scope-name">Scope Name *</Label>
                            {scopeForm.student_field_key ? (
                                // Show dropdown based on selected student field
                                (() => {
                                    let options: Array<{ value: string; label: string }> = [];
                                    let placeholder = "Select a value";

                                    if (scopeForm.student_field_key === "hostel_id") {
                                        options = hostels.map(h => ({ value: h.name, label: h.name }));
                                        placeholder = "Select a hostel";
                                    } else if (scopeForm.student_field_key === "class_section_id") {
                                        options = classSections.map(s => ({ value: s.name, label: s.name }));
                                        placeholder = "Select a class section";
                                    } else if (scopeForm.student_field_key === "batch_id") {
                                        options = batches.map(b => ({ value: `Batch ${b.batch_year}`, label: `Batch ${b.batch_year}` }));
                                        placeholder = "Select a batch";
                                    }

                                    return (
                                        <Select
                                            value={scopeForm.name}
                                            onValueChange={(value) => setScopeForm({ ...scopeForm, name: value })}
                                            disabled={loadingMasterData}
                                        >
                                            <SelectTrigger id="scope-name">
                                                <SelectValue placeholder={placeholder} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {options.length === 0 ? (
                                                    <SelectItem value="" disabled>
                                                        {loadingMasterData ? "Loading..." : "No options available"}
                                                    </SelectItem>
                                                ) : (
                                                    options.map((option) => (
                                                        <SelectItem key={option.value} value={option.value}>
                                                            {option.label}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    );
                                })()
                            ) : (
                                // Show text input for fixed scopes
                                <Input
                                    id="scope-name"
                                    value={scopeForm.name}
                                    onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })}
                                    placeholder="e.g., Neeladri, Velankani"
                                />
                            )}
                        </div>
                        <div>
                            <Label htmlFor="scope-description">Description</Label>
                            <Textarea
                                id="scope-description"
                                value={scopeForm.description}
                                onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                                placeholder="Brief description of this scope"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeScopeDialog}>
                            Cancel
                        </Button>
                        <Button onClick={handleScopeSubmit} disabled={scopeLoading}>
                            {scopeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {editingScope ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ==================== DELETE CONFIRMATION DIALOG ==================== */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the {deletingItem?.type === "domain" ? "domain" : "scope"} <strong>{deletingItem?.name}</strong>.
                            {deletingItem?.type === "domain" && (
                                <span className="block mt-2 text-sm text-muted-foreground">
                                    Note: If the domain has associated categories or scopes, deletion will be blocked.
                                </span>
                            )}
                            {deletingItem?.type === "scope" && (
                                <span className="block mt-2 text-sm text-muted-foreground">
                                    Note: If the scope has assigned categories, deletion will be blocked.
                                </span>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setDeletingItem(null)}>
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
