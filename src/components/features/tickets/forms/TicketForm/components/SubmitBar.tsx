"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import type { TicketFormState, Subcategory } from "../types";

interface SubmitBarProps {
  form: TicketFormState;
  currentSubcategory: Subcategory | null;
  loading: boolean;
  onSubmit: () => void;
}

export function SubmitBar({
  form,
  currentSubcategory,
  loading,
  onSubmit,
}: SubmitBarProps) {
  const hasCategory = !!form.categoryId;
  
  const subFields = currentSubcategory?.fields || [];
  const hasDynamicDescription = subFields.some(f => 
    f.slug === 'description' || f.field_type === 'textarea' || f.name.toLowerCase().includes('description')
  );
  
  const descLength = String(form.description || "").trim().length;
  const hasMinDescription = hasDynamicDescription || descLength >= 10;

  const isFormValid = hasCategory && hasMinDescription;

  return (
    <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6">
      <Link href="/student/dashboard">
        <Button variant="outline" size="lg">Cancel</Button>
      </Link>

      <Button
        type="button"
        size="lg"
        onClick={onSubmit}
        disabled={loading || !isFormValid}
        className="min-w-[140px] flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating...
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Create Ticket
          </>
        )}
      </Button>
    </div>
  );
}
