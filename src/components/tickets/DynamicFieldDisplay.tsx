/**
 * DynamicFieldDisplay Component
 * Renders a single dynamic field with proper formatting based on field type
 */

import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type DynamicField = {
  key: string;
  value: unknown;
  label: string;
  fieldType: string;
};

interface DynamicFieldDisplayProps {
  field: DynamicField;
}

/**
 * Sanitize string values to prevent XSS
 * Removes < and > characters that could be used for HTML injection
 */
function sanitize(str: string): string {
  return String(str).replace(/[<>]/g, "");
}

/**
 * Format dynamic field value based on field type
 */
function formatDynamicFieldValue(fieldType: string, value: unknown): React.ReactNode {
  // Skip objects and nested structures that can't be rendered directly
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return null;
  }

  // Boolean fields
  if (fieldType === 'boolean') {
    const isTruthy = value === true || 
                     value === 'true' || 
                     value === 'yes' || 
                     String(value).toLowerCase() === 'yes';
    
    return isTruthy ? (
      <Badge variant="default" className="bg-green-500">Yes</Badge>
    ) : (
      <Badge variant="secondary">No</Badge>
    );
  }

  // Date fields
  if (fieldType === 'date' && value) {
    try {
      const dateValue = value instanceof Date ? value :
                       typeof value === 'string' ? new Date(value) :
                       typeof value === 'number' ? new Date(value) :
                       null;
      if (dateValue && !isNaN(dateValue.getTime())) {
        return format(dateValue, 'MMMM d, yyyy');
      }
      return String(value);
    } catch {
      return String(value);
    }
  }

  // Number fields
  if (fieldType === 'number' && value) {
    return Number(value).toLocaleString();
  }

  // Long text (over 100 chars)
  if (typeof value === 'string' && value.length > 100) {
    return (
      <p className="text-sm whitespace-pre-wrap leading-relaxed">{sanitize(value)}</p>
    );
  }

  // Array fields
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-2">
        {value.map((item: any, idx: number) => (
          <Badge key={idx} variant="outline">{sanitize(String(item))}</Badge>
        ))}
      </div>
    );
  }

  // Select fields
  if (fieldType === 'select') {
    return (
      <Badge variant="outline" className="text-base font-normal">
        {sanitize(String(value))}
      </Badge>
    );
  }

  // Default: render as-is with sanitization
  return sanitize(String(value));
}

export function DynamicFieldDisplay({ field }: DynamicFieldDisplayProps) {
  const displayValue = formatDynamicFieldValue(field.fieldType, field.value);

  // Don't render if value is null (e.g., nested objects)
  if (displayValue === null) {
    return null;
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-background/50 border border-border/50">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {sanitize(field.label)}
      </p>
      <div className="text-base font-medium">{displayValue}</div>
    </div>
  );
}
