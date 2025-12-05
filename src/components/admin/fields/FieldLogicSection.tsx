"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Field {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  options?: Array<{ label: string; value: string }>;
}

interface FieldLogicSectionProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  dependsOnSlug: string;
  onDependsOnChange: (slug: string) => void;
  logicBehavior: "show" | "hide";
  onLogicBehaviorChange: (behavior: "show" | "hide") => void;
  logicValues: string[];
  onLogicValuesChange: (values: string[]) => void;
  logicRequiredEnabled: boolean;
  availableValueOptions: Array<{ label: string; value: string }>;
  manualLogicInput: string;
  onManualLogicInputChange: (text: string) => void;
  controllingFields: Field[];
  hasControllingFields: boolean;
}

const CHOICE_FIELD_TYPES = new Set(["select", "multi_select"]);

export function FieldLogicSection({
  enabled,
  onToggle,
  dependsOnSlug,
  onDependsOnChange,
  logicBehavior,
  onLogicBehaviorChange,
  logicValues,
  onLogicValuesChange,
  logicRequiredEnabled,
  availableValueOptions,
  manualLogicInput,
  onManualLogicInputChange,
  controllingFields,
  hasControllingFields,
}: FieldLogicSectionProps) {
  return (
    <div className="space-y-3 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="font-medium">Conditional Logic (optional)</Label>
          <p className="text-xs text-muted-foreground">
            Show or require this field based on another answer.
          </p>
        </div>
        <Checkbox checked={enabled} disabled={!hasControllingFields} onCheckedChange={(checked) => onToggle(checked === true)} />
      </div>
      {!hasControllingFields && (
        <p className="text-xs text-muted-foreground">
          Add another field first to enable conditional logic.
        </p>
      )}
      {enabled && hasControllingFields && (
        <div className="space-y-4 pt-4 border-t">
          <div className="space-y-2">
            <Label>Depends on field</Label>
            <Select value={dependsOnSlug} onValueChange={onDependsOnChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a field to depend on" />
              </SelectTrigger>
              <SelectContent>
                {controllingFields.map((ctrl) => (
                  <SelectItem key={ctrl.id} value={ctrl.slug}>
                    {ctrl.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dependsOnSlug && (
            <>
              <div className="space-y-2">
                <Label>Behavior</Label>
                <Select value={logicBehavior} onValueChange={(value) => onLogicBehaviorChange(value as "show" | "hide")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="show">Show this field when values match</SelectItem>
                    <SelectItem value="hide">Hide this field when values match</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Values that {logicBehavior === "show" ? "trigger" : "hide"} this field</Label>
                {availableValueOptions.length > 0 ? (
                  <div className="space-y-2">
                    {availableValueOptions.map((option) => {
                      const checked = logicValues.includes(option.value);
                      return (
                        <label key={option.value} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(isChecked) => {
                              const next =
                                isChecked === true
                                  ? [...new Set([...logicValues, option.value])]
                                  : logicValues.filter((val) => val !== option.value);
                              onLogicValuesChange(next);
                            }}
                          />
                          <span>{option.label}</span>
                        </label>
                      );
                    })}
                    {logicValues.length === 0 && (
                      <p className="text-xs text-muted-foreground">Select at least one value.</p>
                    )}
                  </div>
                ) : (
                  <Input
                    value={manualLogicInput}
                    onChange={(e) => onManualLogicInputChange(e.target.value)}
                    placeholder="Enter values, separated by commas"
                  />
                )}
              </div>

              {logicBehavior === "show" && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="logic-required"
                    checked={logicRequiredEnabled}
                    onCheckedChange={(checked) => onLogicRequiredToggle(checked === true)}
                    disabled={logicValues.length === 0}
                  />
                  <Label
                    htmlFor="logic-required"
                    className={cn(
                      "cursor-pointer",
                      logicValues.length === 0 && "text-muted-foreground"
                    )}
                  >
                    Mark this field as required when the condition is met
                  </Label>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
