"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

/* ---------------------------------------------
   FIX: make all fields optional to avoid mismatch
---------------------------------------------- */
interface StudentProfile {
  userNumber?: string | null;
  fullName?: string | null;
  email?: string | null;
  mobile?: string | null;
  hostel?: string | null;
  roomNumber?: string | null;
  batchYear?: number | null;
  classSection?: string | null;
}
interface ProfileFieldConfig {
  field_name: string;
  storage_key?: string; // Optional - will use field_name as fallback
  required: boolean;
  editable: boolean;
  display_order: number;
}

interface ProfileFieldsRendererProps {
  profileFields: ProfileFieldConfig[];
  studentProfile: StudentProfile | null;
  formData: Record<string, unknown>;
  onChange: (fieldName: string, value: unknown) => void;
  errors: Record<string, string>;
  hostels?: Array<{ id: number; name: string }>;
}

const FIELD_LABELS: Record<string, string> = {
  rollNo: "Roll Number",
  name: "Full Name",
  email: "Email",
  phone: "Phone Number",
  hostel: "Hostel",
  roomNumber: "Room Number",
  batchYear: "Batch Year",
  classSection: "Class Section",
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  rollNo: "e.g., 24bcs10005",
  name: "Enter your full name",
  email: "Email auto-filled from profile",
  phone: "Enter your phone number",
  hostel: "Select hostel",
  roomNumber: "Enter room number",
  batchYear: "e.g., 2024",
  classSection: "e.g., A, B, C",
};

export function ProfileFieldsRenderer({
  profileFields,
  studentProfile,
  formData,
  onChange,
  errors,
  hostels = [],
}: ProfileFieldsRendererProps) {
  if (!profileFields || profileFields.length === 0) return null;

  const sortedFields = [...profileFields].sort(
    (a, b) => a.display_order - b.display_order
  );

  const getFieldValue = (field: ProfileFieldConfig): string => {
    const key = field.storage_key || field.field_name;

    if (formData[key] !== undefined && formData[key] !== null && formData[key] !== "") {
      return String(formData[key]);
    }

    if (!studentProfile) return "";

    switch (key) {
      case "rollNo":
        return studentProfile.userNumber ?? "";
      case "name":
        return studentProfile.fullName ?? "";
      case "email":
        return studentProfile.email ?? "";
      case "phone":
        return studentProfile.mobile ?? "";
      case "hostel":
        return studentProfile.hostel ?? "";
      case "roomNumber":
        return studentProfile.roomNumber ?? "";
      case "batchYear":
        return studentProfile.batchYear ? String(studentProfile.batchYear) : "";
      case "classSection":
        return studentProfile.classSection ?? "";
      default:
        return "";
    }
  };

  const renderField = (field: ProfileFieldConfig) => {
    const key = field.storage_key || field.field_name;
    const value = getFieldValue(field);
    const required = field.required;

    const editable =
      field.editable &&
      key !== "rollNo" &&
      key !== "email"; // email + rollNo always readonly

    if (key === "hostel") {
      return (
        <div key={key} className="space-y-2">
          <Label className="font-medium">
            {FIELD_LABELS[key] ?? field.field_name}
            {required && <span className="text-destructive ml-1">*</span>}
          </Label>

          <Select
            value={value}
            disabled={!editable}
            onValueChange={(v) => onChange(key, v)}
          >
            <SelectTrigger className={errors[key] ? "border-destructive" : ""}>
              <SelectValue placeholder={FIELD_PLACEHOLDERS[key] ?? "Select hostel"} />
            </SelectTrigger>
            <SelectContent>
              {hostels
                .filter(h => h.name && h.name.trim() !== "")
                .map((h) => (
                  <SelectItem key={h.id} value={h.name}>
                    {h.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {errors[key] && (
            <p className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {errors[key]}
            </p>
          )}

          {!editable && (
            <p className="text-xs text-muted-foreground">Auto-filled from profile</p>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label className="font-medium">
          {FIELD_LABELS[key] ?? field.field_name}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>

        <Input
          id={key}
          value={value}
          required={required}
          readOnly={!editable}
          disabled={!editable}
          placeholder={FIELD_PLACEHOLDERS[key] ?? ""}
          className={`${errors[key] ? "border-destructive" : ""} ${
            !editable ? "bg-muted cursor-not-allowed" : ""
          }`}
          onChange={(e) => onChange(key, e.target.value)}
        />

        {errors[key] && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors[key]}
          </p>
        )}

        {!editable && (
          <p className="text-xs text-muted-foreground">Auto-filled from profile</p>
        )}
      </div>
    );
  };

  return (
    <Card className="border-2 bg-muted/30">
      <CardHeader>
        <CardTitle className="text-lg">Profile Information</CardTitle>
        <CardDescription>
          These fields help the admin reach you & correctly assign your ticket.
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedFields.map((f, index) => {
          const key = f.storage_key || f.field_name || `profile-field-${index}`;
          return (
            <div key={key}>{renderField(f)}</div>
          );
        })}
      </CardContent>
    </Card>
  );
}
