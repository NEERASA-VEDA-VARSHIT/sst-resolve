"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DomainsList } from "./DomainsList";
import { DomainsForm } from "./DomainsForm";

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

interface MasterData {
    hostels: Array<{ id: number; name: string }>;
    classSections: Array<{ id: number; name: string }>;
    batches: Array<{ id: number; batch_year: number }>;
}

interface DomainsManagementProps {
    initialDomains: Domain[];
    initialScopes: Scope[];
    masterData: MasterData;
}

export function DomainsManagement({ initialDomains, initialScopes, masterData }: DomainsManagementProps) {
    const router = useRouter();
    const [domains] = useState<Domain[]>(initialDomains);
    const [scopes] = useState<Scope[]>(initialScopes);
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

    const refreshData = () => {
        router.refresh();
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
                    refreshData();
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
                    refreshData();
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
                    refreshData();
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
                    refreshData();
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
        setScopeDialog(true);
    };

    const closeScopeDialog = () => {
        setScopeDialog(false);
        setEditingScope(null);
        setScopeForm({ name: "", description: "", domain_id: "", student_field_key: null });
    };

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
                refreshData();
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
        <>
            <DomainsList
                domains={domains}
                scopes={scopes}
                selectedDomain={selectedDomain}
                onDomainSelect={setSelectedDomain}
                onEditDomain={openDomainDialog}
                onDeleteDomain={(domain) => openDeleteDialog("domain", domain)}
                onEditScope={openScopeDialog}
                onDeleteScope={(scope) => openDeleteDialog("scope", scope)}
                onAddDomain={() => openDomainDialog()}
                onAddScope={() => openScopeDialog()}
            />

            <DomainsForm
                domainDialogOpen={domainDialog}
                onDomainDialogChange={setDomainDialog}
                editingDomain={editingDomain}
                domainForm={domainForm}
                onDomainFormChange={(data) => setDomainForm(prev => ({ ...prev, ...data }))}
                domainLoading={domainLoading}
                onDomainSubmit={handleDomainSubmit}
                scopeDialogOpen={scopeDialog}
                onScopeDialogChange={setScopeDialog}
                editingScope={editingScope}
                scopeForm={scopeForm}
                onScopeFormChange={(data) => setScopeForm(prev => ({ ...prev, ...data }))}
                scopeLoading={scopeLoading}
                onScopeSubmit={handleScopeSubmit}
                selectedDomain={selectedDomain}
                domains={domains}
                masterData={masterData}
                deleteDialogOpen={deleteDialogOpen}
                onDeleteDialogChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setDeletingItem(null);
                }}
                deletingItem={deletingItem}
                onDelete={handleDelete}
            />
        </>
    );
}
