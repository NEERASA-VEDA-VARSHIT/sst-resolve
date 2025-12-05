"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Clock, AlertTriangle, Building2, X, Search, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterAction {
  key: string;
  label: string;
  value: string;
}

interface FilterActionsProps {
  activeFilters: FilterAction[];
  onRemoveFilter: (key: string) => void;
  onReset: () => void;
  onApply: () => void;
  tat: string;
  category: string;
  onTatToday: () => void;
  onTatDue: () => void;
  onDomainToggle: (domainValue: string) => void;
  domainOptions: Array<{ value: string; label: string }>;
  isApplying: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export function FilterActions({
  activeFilters,
  onRemoveFilter,
  onReset,
  onApply,
  tat,
  category,
  onTatToday,
  onTatDue,
  onDomainToggle,
  domainOptions,
  isApplying,
  isExpanded,
  onToggleExpand,
  showAdvanced,
  onToggleAdvanced,
}: FilterActionsProps) {
  return (
    <>
      {/* Active Filters and Quick Actions */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {activeFilters.length > 0 && (
          <>
            {activeFilters.map((filter) => (
              <Badge key={filter.key} variant="secondary" className="gap-1 pr-1 text-xs h-5 max-w-[200px]">
                <span className="text-xs truncate">{filter.label}: {filter.value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-3 w-3 p-0 hover:bg-transparent flex-shrink-0"
                  onClick={() => onRemoveFilter(filter.key)}
                >
                  <X className="w-2.5 h-2.5" />
                </Button>
              </Badge>
            ))}
            {activeFilters.length > 0 && <Separator orientation="vertical" className="h-4" />}
          </>
        )}
        
        {/* Quick Actions */}
        <button
          onClick={onTatToday}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
            tat === "today"
              ? "bg-amber-500 text-white shadow-sm"
              : "bg-background hover:bg-amber-50 dark:hover:bg-amber-950/20 border border-border"
          )}
        >
          <Clock className="w-3 h-3" />
          TAT Today
        </button>
        <button
          onClick={onTatDue}
          className={cn(
            "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
            tat === "due"
              ? "bg-red-500 text-white shadow-sm"
              : "bg-background hover:bg-red-50 dark:hover:bg-red-950/20 border border-border"
          )}
        >
          <AlertTriangle className="w-3 h-3" />
          Overdue
        </button>
        {/* Dynamic Domain Quick Action Buttons */}
        {domainOptions.map((domain) => {
          const isActive = category === domain.value;
          // Use generic Building2 icon for all domains (remove hardcoded icon logic)
          return (
            <button
              key={domain.value}
              onClick={() => onDomainToggle(domain.value)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1.5",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background hover:bg-primary/10 border border-border"
              )}
            >
              <Building2 className="w-3 h-3" />
              {domain.label}
            </button>
          );
        })}
      </div>

      {/* Expanded View Actions */}
      {isExpanded && (
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleAdvanced}
            className="text-xs h-7 text-primary hover:text-primary hover:bg-primary/10"
            disabled={isApplying}
          >
            {showAdvanced ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" />
                Hide Advanced
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show Advanced Filters
              </>
            )}
          </Button>
          <Button 
            onClick={onApply} 
            size="sm" 
            className="h-7 text-xs min-w-[100px]"
            disabled={isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Search className="w-3 h-3 mr-1" />
                Apply
              </>
            )}
          </Button>
        </div>
      )}
    </>
  );
}
