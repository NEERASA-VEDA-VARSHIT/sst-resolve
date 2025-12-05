"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Loader2 } from "lucide-react";

interface Domain {
  id: number;
  name: string;
  description: string | null;
}

interface Scope {
  id: number;
  domain_id: number;
  name: string;
  description: string | null;
  student_field_key: string | null;
}

interface MasterData {
  hostels: Array<{ id: number; name: string }>;
  classSections: Array<{ id: number; name: string }>;
  batches: Array<{ id: number; batch_year: number }>;
}

interface DomainsFormProps {
  // Domain dialog
  domainDialogOpen: boolean;
  onDomainDialogChange: (open: boolean) => void;
  editingDomain: Domain | null;
  domainForm: { name: string; description: string };
  onDomainFormChange: (data: Partial<{ name: string; description: string }>) => void;
  domainLoading: boolean;
  onDomainSubmit: () => void;

  // Scope dialog
  scopeDialogOpen: boolean;
  onScopeDialogChange: (open: boolean) => void;
  editingScope: Scope | null;
  scopeForm: {
    name: string;
    description: string;
    domain_id: string;
    student_field_key: string | null;
  };
  onScopeFormChange: (data: Partial<{
    name: string;
    description: string;
    domain_id: string;
    student_field_key: string | null;
  }>) => void;
  scopeLoading: boolean;
  onScopeSubmit: () => void;
  selectedDomain: number | null;
  domains: Domain[];
  masterData: MasterData;

  // Delete dialog
  deleteDialogOpen: boolean;
  onDeleteDialogChange: (open: boolean) => void;
  deletingItem: { type: "domain" | "scope"; id: number; name: string } | null;
  onDelete: () => void;
}

export function DomainsForm({
  domainDialogOpen,
  onDomainDialogChange,
  editingDomain,
  domainForm,
  onDomainFormChange,
  domainLoading,
  onDomainSubmit,
  scopeDialogOpen,
  onScopeDialogChange,
  editingScope,
  scopeForm,
  onScopeFormChange,
  scopeLoading,
  onScopeSubmit,
  selectedDomain,
  domains,
  masterData,
  deleteDialogOpen,
  onDeleteDialogChange,
  deletingItem,
  onDelete,
}: DomainsFormProps) {
  const closeDomainDialog = () => {
    onDomainDialogChange(false);
  };

  const closeScopeDialog = () => {
    onScopeDialogChange(false);
  };

  // Scope name field logic
  const getScopeNameField = () => {
    if (scopeForm.student_field_key) {
      let options: Array<{ value: string; label: string }> = [];
      let placeholder = "Select a value";

      if (scopeForm.student_field_key === "hostel_id") {
        options = masterData.hostels.map(h => ({ value: h.name, label: h.name }));
        placeholder = "Select a hostel";
      } else if (scopeForm.student_field_key === "class_section_id") {
        options = masterData.classSections.map(s => ({ value: s.name, label: s.name }));
        placeholder = "Select a class section";
      } else if (scopeForm.student_field_key === "batch_id") {
        options = masterData.batches.map(b => ({ value: `Batch ${b.batch_year}`, label: `Batch ${b.batch_year}` }));
        placeholder = "Select a batch";
      }

      return (
        <Select
          value={scopeForm.name}
          onValueChange={(value) => onScopeFormChange({ name: value })}
        >
          <SelectTrigger id="scope-name">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value="" disabled>
                No options available
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
    }

    return (
      <Input
        id="scope-name"
        value={scopeForm.name}
        onChange={(e) => onScopeFormChange({ name: e.target.value })}
        placeholder="e.g., Neeladri, Velankani"
      />
    );
  };

  return (
    <>
      {/* Domain Dialog */}
      <Dialog open={domainDialogOpen} onOpenChange={onDomainDialogChange}>
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
                onChange={(e) => onDomainFormChange({ name: e.target.value })}
                placeholder="e.g., Hostel, College, Mess"
              />
            </div>
            <div>
              <Label htmlFor="domain-description">Description</Label>
              <Textarea
                id="domain-description"
                value={domainForm.description}
                onChange={(e) => onDomainFormChange({ description: e.target.value })}
                placeholder="Brief description of this domain"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDomainDialog}>
              Cancel
            </Button>
            <Button onClick={onDomainSubmit} disabled={domainLoading}>
              {domainLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingDomain ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Scope Dialog */}
      <Dialog open={scopeDialogOpen} onOpenChange={onScopeDialogChange}>
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
                onValueChange={(value) => onScopeFormChange({ domain_id: value })}
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
                  onScopeFormChange({
                    student_field_key: newFieldKey,
                    name: "",
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
              {getScopeNameField()}
            </div>
            <div>
              <Label htmlFor="scope-description">Description</Label>
              <Textarea
                id="scope-description"
                value={scopeForm.description}
                onChange={(e) => onScopeFormChange({ description: e.target.value })}
                placeholder="Brief description of this scope"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeScopeDialog}>
              Cancel
            </Button>
            <Button onClick={onScopeSubmit} disabled={scopeLoading}>
              {scopeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingScope ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogChange}>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
