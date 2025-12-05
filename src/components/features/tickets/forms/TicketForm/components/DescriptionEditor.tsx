"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, AlertCircle } from "lucide-react";

interface DescriptionEditorProps {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onErrorClear: () => void;
}

export function DescriptionEditor({
  value,
  error,
  onChange,
  onErrorClear,
}: DescriptionEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Label htmlFor="description" className="text-sm sm:text-base font-semibold">
          Description <span className="text-destructive">*</span>
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p>Explain your issue clearly. Add relevant dates, room numbers, attachments.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <Textarea
        id="description"
        rows={6}
        value={value || ""}
        onChange={(e) => {
          onChange(e.target.value);
          if (error) {
            onErrorClear();
          }
        }}
        placeholder="Type a clear, concise description (minimum 10 characters)"
        className={error ? "border-destructive" : ""}
      />
      <div className="flex items-center justify-between">
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
        <p className="text-xs text-muted-foreground ml-auto">
          {String(value || "").length} characters
        </p>
      </div>
    </div>
  );
}
