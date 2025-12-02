"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

import {
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  ImageIcon,
} from "lucide-react";

import { DynamicFieldRenderer } from "@/components/tickets/DynamicFieldRenderer";
import { ProfileFieldsRenderer } from "@/components/tickets/ProfileFieldsRenderer";

/* ===========================
   Types
   =========================== */

// Server -> client normalized shapes
type StudentProfile = {
  fullName: string;
  email: string;
  mobile: string;
  hostel: string | null;
  roomNumber: string | null;
  batchYear: number | null;
  classSection: string | null;
};

type Category = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sla_hours?: number | null;
  display_order?: number | null;
};

type SubSubcategory = {
  id: number;
  subcategory_id: number;
  name: string;
  slug?: string;
  description?: string | null;
  display_order?: number;
};

type DynamicField = {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  validation_rules?: Record<string, unknown> | null;
  display_order: number;
  subcategory_id?: number; // join key
  options?: Array<{ label: string; value: string }>;
};

type Subcategory = {
  id: number;
  category_id?: number;
  name: string;
  slug?: string;
  description?: string | null;
  fields?: DynamicField[];
  sub_subcategories?: SubSubcategory[];
  display_order?: number;
};

type ProfileFieldConfig = {
  id?: number;
  category_id?: number;
  field_name: string;
  storage_key: string;
  required: boolean;
  editable: boolean;
  display_order: number;
};

type TicketFormProps = {
  dbUserId: string;
  student: Partial<StudentProfile> | null; // server-provided may be partial
  categories: Category[]; // from server (can be any shape)
  subcategories: Subcategory[]; // flat list
  profileFields: ProfileFieldConfig[]; // flat list
  dynamicFields: DynamicField[]; // flat list
  fieldOptions: { id: number; option_label: string; option_value: string; field_id: number }[];
  hostels?: Array<{ id: number; name: string }>;
};

/* ===========================
   Helpers & Validation utils
   =========================== */

const rollNoRegex = /^\d{2}bcs\d{5}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+91)?[6-9]\d{9}$/;

const validateRollNo = (v?: string) => !!v && rollNoRegex.test(v.trim());
const validateEmail = (v?: string) => !!v && emailRegex.test(v.trim());
const validatePhone = (v?: string) => {
  if (!v) return false;
  const cleaned = v.replace(/[\s\-]/g, "");
  return phoneRegex.test(cleaned);
};

// generateEmailFromRollNo helper was removed as ticket emails are now driven by backend logic.

/* ===========================
   TicketForm
   =========================== */

export default function TicketForm(props: TicketFormProps) {
  const {
    student: studentProp,
    categories: categoriesProp,
    subcategories: subcategoriesProp,
    profileFields: profileFieldsProp,
    dynamicFields: dynamicFieldsProp,
    fieldOptions: fieldOptionsProp,
    hostels: hostelsProp,
  } = props;

  const router = useRouter();

  // --- Normalize student to remove undefined and avoid type mismatch ---
  const student: StudentProfile | null = useMemo(() => {
    if (!studentProp) return null;
    return {
      fullName: studentProp.fullName ?? "",
      email: studentProp.email ?? "",
      mobile: studentProp.mobile ?? "",
      hostel: studentProp.hostel ?? null,
      roomNumber: studentProp.roomNumber ?? null,
      batchYear: studentProp.batchYear ?? null,
      classSection: studentProp.classSection ?? null,
    };
  }, [studentProp]);

  /* -------------------------
     Build schemas in-memory:
     categories -> subcategories -> fields
     ------------------------- */
  const schemas = useMemo(() => {
    // group subcategories by category_id
    const subsByCat = new Map<number, Subcategory[]>();
    for (const s of subcategoriesProp || []) {
      type SubcategoryWithId = {
        category_id?: number;
        categoryId?: number;
        [key: string]: unknown;
      };
      const catId = (s as SubcategoryWithId).category_id ?? (s as SubcategoryWithId).categoryId ?? null;
      if (catId == null) continue;
      const arr = subsByCat.get(catId) || [];
      arr.push(s);
      subsByCat.set(catId, arr);
    }

    // map fields by subcategory_id
    const fieldsBySub = new Map<number, DynamicField[]>();
    for (const f of dynamicFieldsProp || []) {
      type FieldWithId = {
        subcategory_id?: number;
        subCategoryId?: number;
        category_field_subcategory_id?: number;
        [key: string]: unknown;
      };
      const subId = (f as FieldWithId).subcategory_id ?? (f as FieldWithId).subCategoryId ?? (f as FieldWithId).category_field_subcategory_id ?? null;
      if (subId == null) continue;
      const arr = fieldsBySub.get(subId) || [];
      arr.push(f);
      fieldsBySub.set(subId, arr);
    }

    // map options by field_id
    // Note: Options may already be attached to fields from the server (mappedCategoryFields)
    // This mapping is a fallback for when options come separately via fieldOptionsProp
    type FieldOption = {
      id: number;
      field_id?: number;
      label?: string;
      option_label?: string;
      value?: string;
      option_value?: string;
    };
    const optionsByField = new Map<number, Array<{ id: number; label: string; value: string }>>();
    for (const opt of (fieldOptionsProp || []) as FieldOption[]) {
      const fieldId = opt.field_id;
      if (fieldId == null) continue;
      
      // Skip empty values
      const optValue = opt.value || opt.option_value || '';
      if (!optValue || optValue.trim() === '') continue;
      
      const arr = optionsByField.get(fieldId) || [];
      
      // Check for duplicates by ID first (if available), then by value+label combination
      // This allows options with the same value but different labels
      const isDuplicate = arr.some(existing => {
        // If both have IDs, compare by ID
        if (opt.id && existing.id && opt.id === existing.id) return true;
        // Otherwise, compare by value+label combination
        const existingKey = existing.id ? `id:${existing.id}` : `val:${existing.value}|label:${existing.label}`;
        const newKey = opt.id ? `id:${opt.id}` : `val:${optValue}|label:${opt.label || opt.option_label || optValue}`;
        return existingKey === newKey;
      });
      
      if (!isDuplicate) {
        arr.push({
          id: opt.id,
          label: opt.label || opt.option_label || optValue, // Support both property names
          value: optValue,
        });
        optionsByField.set(fieldId, arr);
      }
    }

    // for each category attach subcategories and subcategory fields
    const arr: {
      category: Category;
      subcategories: Subcategory[];
      profileFields: ProfileFieldConfig[];
    }[] = (categoriesProp || []).map((c) => {
      const categoryId = typeof c === 'object' && c !== null && 'id' in c ? (c as { id: number }).id : null;
      const rawSubs = categoryId ? subsByCat.get(categoryId) || [] : [];
      const subs = rawSubs.map((s) => {
        const subcategoryId = typeof s === 'object' && s !== null && 'id' in s ? (s as { id: number }).id : null;
        const rawFields = subcategoryId ? fieldsBySub.get(subcategoryId) || [] : [];
        const fields = rawFields.map((f) => {
          // Use options already attached to field (from server) if available,
          // otherwise fall back to optionsByField mapping
          const fieldOptions = (f as DynamicField).options && Array.isArray((f as DynamicField).options) && (f as DynamicField).options!.length > 0
            ? (f as DynamicField).options!
            : (optionsByField.get(f.id) || []);
          
          return {
            ...f,
            placeholder: f.placeholder ?? null,
            help_text: f.help_text ?? null,
            options: fieldOptions,
          };
        });
        return {
          ...s,
          fields: fields.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        } as Subcategory;
      }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      type ProfileField = {
        category_id?: number;
        [key: string]: unknown;
      };
      type Category = {
        id?: number;
        [key: string]: unknown;
      };
      const catProfileFields = (profileFieldsProp || []).filter((pf: ProfileField) => {
        if (pf.category_id) return pf.category_id === (c as Category).id;
        return true; // global fallback
      }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      return { category: c, subcategories: subs, profileFields: catProfileFields };
    });

    return arr;
  }, [categoriesProp, subcategoriesProp, profileFieldsProp, dynamicFieldsProp, fieldOptionsProp]);

  /* -------------------------
     Local form state
     ------------------------- */
  const [form, setForm] = useState(() => {
    // initial profile prefill from student
    const initialProfile: Record<string, string> = {};
    if (student) {
      if (student.fullName) initialProfile["name"] = student.fullName;
      if (student.email) initialProfile["email"] = student.email;
      if (student.mobile) initialProfile["phone"] = student.mobile;
      if (student.hostel) initialProfile["hostel"] = student.hostel;
      if (student.roomNumber) initialProfile["roomNumber"] = student.roomNumber;
      if (student.batchYear) initialProfile["batchYear"] = String(student.batchYear);
      if (student.classSection) initialProfile["classSection"] = student.classSection;
    }

    return {
      categoryId: null as number | null,
      subcategoryId: null as number | null,
      subSubcategoryId: null as number | null,
      description: "",
      details: {} as Record<string, unknown>,
      profile: initialProfile as Record<string, string>,
    };
  });

  const [loading, setLoading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const touchedProfileFields = useRef(new Set<string>());
  const fileInputRef = useRef<HTMLInputElement | null>(null);



  const setFormPartial = useCallback((patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const setDetail = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, details: { ...(prev.details || {}), [key]: value } }));
  }, []);

  const setProfileField = useCallback((key: string, value: unknown) => {
    touchedProfileFields.current.add(key);
    setForm((prev) => ({ ...prev, profile: { ...(prev.profile || {}), [key]: String(value) } }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  /* -------------------------
     Derived helpers
     ------------------------- */
  const currentSchema = useMemo(() => {
    if (!form.categoryId) return null;
    return schemas.find((s) => s.category.id === form.categoryId) || null;
  }, [form.categoryId, schemas]);

  const currentSubcategory = useMemo(() => {
    if (!currentSchema || !form.subcategoryId) return null;
    return currentSchema.subcategories.find((s) => s.id === form.subcategoryId) || null;
  }, [currentSchema, form.subcategoryId]);

  type FieldRules = {
    dependsOn?: string;
    showWhenValue?: string | string[];
    hideWhenValue?: string | string[];
    requiredWhenValue?: string | string[];
    multiSelect?: boolean;
  };

  const getDependencyValue = useCallback(
    (key?: string) => {
      if (!key) return undefined;
      if (key.startsWith("profile.")) {
        const profileKey = key.slice("profile.".length);
        return form.profile?.[profileKey];
      }
      return form.details?.[key];
    },
    [form.details, form.profile]
  );

  const matchesRuleValue = (value: unknown, ruleValue?: string | string[]) => {
    if (ruleValue == null) return false;
    const values = Array.isArray(value) ? value : [value];
    const targets = Array.isArray(ruleValue) ? ruleValue : [ruleValue];
    return values.some((val) =>
      targets.some(
        (target) => String(val ?? "").toLowerCase() === String(target ?? "").toLowerCase()
      )
    );
  };

  const isMultiSelectField = useCallback((field: DynamicField) => {
    const rules = (field.validation_rules || {}) as FieldRules;
    if (rules?.multiSelect) return true;
    const type = (field.field_type || "").toLowerCase();
    return type === "multi_select" || type === "multiselect" || type === "select_multiple";
  }, []);

  const shouldDisplayField = useCallback(
    (field: DynamicField) => {
      const rules = (field.validation_rules || {}) as FieldRules;
      if (!rules.dependsOn) return true;
      const controllingValue = getDependencyValue(rules.dependsOn);

      if (rules.showWhenValue !== undefined) {
        return matchesRuleValue(controllingValue, rules.showWhenValue);
      }
      if (rules.hideWhenValue !== undefined) {
        return !matchesRuleValue(controllingValue, rules.hideWhenValue);
      }
      return true;
    },
    [getDependencyValue]
  );

  const isFieldRequired = useCallback(
    (field: DynamicField) => {
      const rules = (field.validation_rules || {}) as FieldRules;
      if (rules.dependsOn && rules.requiredWhenValue !== undefined) {
        const controllingValue = getDependencyValue(rules.dependsOn);
        return matchesRuleValue(controllingValue, rules.requiredWhenValue);
      }
      return field.required;
    },
    [getDependencyValue]
  );

  useEffect(() => {
    if (!currentSubcategory?.fields?.length) return;
    setForm((prev) => {
      const nextDetails = { ...(prev.details || {}) };
      let changed = false;
      for (const field of currentSubcategory.fields || []) {
        if (!shouldDisplayField(field) && nextDetails[field.slug] !== undefined) {
          delete nextDetails[field.slug];
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, details: nextDetails };
    });
  }, [currentSubcategory, shouldDisplayField]);

  const isFieldValueFilled = useCallback(
    (field: DynamicField, value: unknown) => {
      if (isMultiSelectField(field)) {
        const arr = Array.isArray(value) ? value : value != null ? [value] : [];
        return arr.filter((v) => typeof v === "string" && v.trim() !== "").length > 0;
      }

      switch ((field.field_type || "").toLowerCase()) {
        case "boolean": {
          return (
            value === true ||
            value === false ||
            value === "true" ||
            value === "false"
          );
        }
        case "upload": {
          const images = Array.isArray(value)
            ? value
            : value
            ? [value]
            : [];
          return images.length > 0;
        }
        default: {
          if (value === undefined || value === null) return false;
          if (typeof value === "string") return value.trim() !== "";
          return true;
        }
      }
    },
    [isMultiSelectField]
  );

  /* -------------------------
     Autofill dynamic profile fields (do not overwrite touched)
     ------------------------- */
  useEffect(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0 || !student) return;

    setForm((prev) => {
      const next = { ...prev, profile: { ...(prev.profile || {}) } as Record<string, string> };
      let changed = false;

      for (const field of pf) {
        const key = field.storage_key;
        if (touchedProfileFields.current.has(key)) continue;
        const cur = next.profile[key];
        if (cur !== undefined && cur !== null && String(cur).trim() !== "") continue;

        let value = "";
        switch (field.field_name) {
          case "name": value = student.fullName || ""; break;
          case "email": value = student.email || ""; break;
          case "phone": value = student.mobile || ""; break;
          case "hostel": value = student.hostel || ""; break;
          case "roomNumber": value = student.roomNumber || ""; break;
          case "batchYear": value = student.batchYear ? String(student.batchYear) : ""; break;
          case "classSection": value = student.classSection || ""; break;
          default: value = "";
        }

        if (value !== "") {
          next.profile[key] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentSchema?.profileFields, student]);

  /* -------------------------
     Validation
     ------------------------- */
  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};

    if (!form.categoryId) newErrors["category"] = "Category is required";

    if (currentSchema && currentSchema.subcategories && currentSchema.subcategories.length > 0) {
      if (!form.subcategoryId) newErrors["subcategory"] = "Subcategory is required";
    }

    if (currentSubcategory && currentSubcategory.sub_subcategories && currentSubcategory.sub_subcategories.length > 0) {
      if (!form.subSubcategoryId) newErrors["subSubcategory"] = "Please select a sub-type";
    }

    // Check if dynamic fields handle description
    const fieldsToCheck = currentSubcategory?.fields || [];
    const hasDynamicDescription = fieldsToCheck.some(f => 
      f.slug === 'description' || f.field_type === 'textarea' || f.name.toLowerCase().includes('description')
    );
    
    // Description - only validate if not handled by dynamic fields
    if (!hasDynamicDescription) {
      if (!form.description || String(form.description).trim().length < 10) {
        newErrors["description"] = "Please provide a clear description (at least 10 characters)";
      }
    }

    // Profile fields
    const pf = currentSchema?.profileFields || [];
    for (const f of pf) {
      if (f.required) {
        const fieldKey = f.storage_key || f.field_name;
        const val = form.profile[fieldKey];
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          newErrors[fieldKey] = `${f.field_name} is required`;
        } else {
          if (f.field_name === "rollNo" && !validateRollNo(String(val))) {
            newErrors[fieldKey] = "Roll number must be in format xxbcsxxxxx (e.g., 24bcs10005)";
          }
          if (f.field_name === "email" && !validateEmail(String(val))) {
            newErrors[fieldKey] = "Invalid email format";
          }
          if (f.field_name === "phone" && !validatePhone(String(val))) {
            newErrors[fieldKey] = "Invalid phone number";
          }
        }
      }
    }

    // Dynamic subcategory fields
    const subFields = currentSubcategory?.fields || [];
    for (const field of subFields) {
      if (!shouldDisplayField(field)) continue;
      const fv = form.details[field.slug];
      const fieldIsRequired = isFieldRequired(field);

      if (fieldIsRequired && !isFieldValueFilled(field, fv)) {
        newErrors[field.slug] = `${field.name} is required`;
        continue;
      }

      if (!isFieldValueFilled(field, fv)) {
        continue;
      }

      const multiSelect = isMultiSelectField(field);
      if (multiSelect) {
        continue;
      }

      if (field.field_type === "boolean" || field.field_type === "upload") {
        continue;
      }

      type ValidationRules = {
        minLength?: number | null;
        maxLength?: number | null;
        pattern?: string | null;
        errorMessage?: string | null;
        min?: number | null;
        max?: number | null;
        [key: string]: unknown;
      };
      type FieldWithValidation = DynamicField & { validation_rules?: ValidationRules | null };
      const rules = (field as FieldWithValidation).validation_rules;

      if (rules && typeof fv === "string") {
        const minLength = typeof rules.minLength === "number" ? rules.minLength : null;
        const maxLength = typeof rules.maxLength === "number" ? rules.maxLength : null;
        const pattern = typeof rules.pattern === "string" ? rules.pattern : null;
        const errorMessage = typeof rules.errorMessage === "string" ? rules.errorMessage : null;

        if (minLength !== null && fv.length < minLength) {
          newErrors[field.slug] = `${field.name} must be at least ${minLength} characters`;
        }
        if (maxLength !== null && fv.length > maxLength) {
          newErrors[field.slug] = `${field.name} must be at most ${maxLength} characters`;
        }
        if (pattern !== null) {
          const re = new RegExp(pattern);
          if (!re.test(fv))
            newErrors[field.slug] = errorMessage || `${field.name} format is invalid`;
        }
      }

      if (rules && (rules.min !== undefined || rules.max !== undefined)) {
        const num = Number(fv);
        const min = typeof rules.min === "number" ? rules.min : null;
        const max = typeof rules.max === "number" ? rules.max : null;
        if (min !== null && num < min) newErrors[field.slug] = `${field.name} must be at least ${min}`;
        if (max !== null && num > max) newErrors[field.slug] = `${field.name} must be at most ${max}`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [
    form,
    currentSchema,
    currentSubcategory,
    shouldDisplayField,
    isFieldRequired,
    isFieldValueFilled,
    isMultiSelectField,
  ]);

  /* -------------------------
     Progress calculation
     ------------------------- */
  const progress = useMemo(() => {
    let total = 0, complete = 0;

    total++; if (form.categoryId) complete++;
    
    // Only count generic description if not handled by dynamic fields
    const subFields = currentSubcategory?.fields || [];
    const hasDynamicDescription = subFields.some(f => 
      f.slug === 'description' || f.field_type === 'textarea' || f.name.toLowerCase().includes('description')
    );
    
    if (!hasDynamicDescription) {
      total++; if (form.description && String(form.description).trim().length >= 10) complete++;
    }

    if (currentSchema && currentSchema.subcategories && currentSchema.subcategories.length > 0) {
      total++; if (form.subcategoryId) complete++;
    }

    const ss = currentSubcategory?.sub_subcategories || [];
    if (ss.length > 0) {
      total++; if (form.subSubcategoryId) complete++;
    }

    const pf = currentSchema?.profileFields || [];
    for (const f of pf) {
      total++;
      const v = form.profile[f.storage_key];
      if (v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== "")) complete++;
    }

    const sf = currentSubcategory?.fields || [];
    for (const f of sf) {
      if (!shouldDisplayField(f)) continue;
      if (!isFieldRequired(f)) continue;
      total++;
      const v = form.details[f.slug];
      if (isFieldValueFilled(f, v)) complete++;
    }

    return total === 0 ? 0 : Math.round((complete / total) * 100);
  }, [
    form,
    currentSchema,
    currentSubcategory,
    shouldDisplayField,
    isFieldRequired,
    isFieldValueFilled,
  ]);

  /* -------------------------
     Image upload
     ------------------------- */
  const uploadImage = useCallback(async (file: File) => {
    setImagesUploading(true);
    try {
      const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowed.includes(file.type)) throw new Error("Only JPEG/PNG/WebP images allowed");
      const max = 10 * 1024 * 1024;
      if (file.size > max) throw new Error("Image exceeds 10MB");

      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/tickets/attachments/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "upload failed" }));
        throw new Error(err.error || "Upload failed");
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned non-JSON response");
      }
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        details: {
          ...(prev.details || {}),
          images: [...((prev.details?.images as string[]) || []), data.url],
        },
      }));
      toast.success("Image uploaded");
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      const errorMessage = err instanceof Error ? err.message : "Image upload failed";
      toast.error(errorMessage);
    } finally {
      setImagesUploading(false);
    }
  }, []);

  const handleImageFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    (async () => {
      for (let i = 0; i < files.length; i++) {
        await uploadImage(files[i]);
      }
    })();
  }, [uploadImage]);

  const removeImage = useCallback((url: string) => {
    setForm((prev) => {
      const images = Array.isArray(prev.details?.images) ? prev.details.images : [];
      const newImages = images.filter((u: unknown) => typeof u === 'string' && u !== url);
      return {
        ...prev,
        details: {
          ...(prev.details || {}),
          images: newImages,
        },
      };
    });
  }, []);

  /* -------------------------
     Submit
     ------------------------- */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    
    // Prevent double submission
    if (loading) {
      console.warn("[TicketForm] Submit already in progress, ignoring duplicate submission");
      return;
    }
    
    if (!validateForm()) {
      toast.error("Please fix the highlighted errors");
      return;
    }
    setLoading(true);
    try {
      // Clean up profile data - remove undefined keys
      // Safety check: ensure form.profile is a valid object before calling Object.entries
      const profileData = form.profile && typeof form.profile === 'object' && !Array.isArray(form.profile) 
        ? form.profile 
        : {};
      const cleanProfile = Object.fromEntries(
        Object.entries(profileData).filter(([key, value]) => key !== 'undefined' && value != null)
      );

      // Extract images from details and clean up details
      const images = (form.details?.images as string[]) || [];
      const detailsWithoutImages = { ...(form.details || {}) };
      delete detailsWithoutImages.images;

      // Derive location for domain/scope-based SPOC assignment
      // For Hostel tickets, we want location to be the student's hostel name where possible.
      // This reads from the profile field keyed as "hostel" (configured in profileFields).
      const derivedLocation =
        typeof form.profile?.hostel === "string" && form.profile.hostel.trim()
          ? form.profile.hostel.trim()
          : undefined;

      const payload = {
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        subSubcategoryId: form.subSubcategoryId || null,
        description: form.description,
        details: detailsWithoutImages,
        images: images.length > 0 ? images : undefined,
        // Location is optional in schema; when set it will be used for domain/scope matching
        location: derivedLocation,
        profile: cleanProfile,
      };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Check Content-Type before parsing
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        // Try to get error text if available
        const text = await res.text().catch(() => "Unknown error");
        console.error("[TicketForm] Non-JSON response:", {
          status: res.status,
          statusText: res.statusText,
          contentType,
          body: text.substring(0, 500), // First 500 chars
        });
        throw new Error(`Server error (${res.status}): ${res.statusText || "Unknown error"}`);
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "ticket creation failed" }));
        throw new Error(err.error || `Ticket creation failed (${res.status})`);
      }

      const ticket = await res.json();
      toast.success("Ticket created successfully");
      router.push(`/student/dashboard/ticket/${ticket.id}`);
    } catch (err: unknown) {
      console.error("Ticket create error:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create ticket";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [form, validateForm, router, loading]);

  /* ===========================
     Small internal subcomponents
     =========================== */

  function CategorySelector() {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label className="text-sm sm:text-base font-semibold">Category <span className="text-destructive">*</span></Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Choose the category for your issue.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <Select
          value={form.categoryId?.toString() || ""}
          onValueChange={(v) => {
            const id = v ? Number(v) : null;
            setFormPartial({ categoryId: id, subcategoryId: null, subSubcategoryId: null, details: { images: form.details?.images || [] } });
            setErrors((p) => { const c = { ...p }; delete c.category; delete c.subcategory; return c; });
          }}
        >
          <SelectTrigger id="category" className={`w-full h-11 ${errors.category ? "border-destructive" : ""}`}>
            <SelectValue placeholder={(schemas?.length ?? 0) === 0 ? "No categories" : "Select category"} />
          </SelectTrigger>
          <SelectContent>
            {schemas.map((s) => (
              <SelectItem key={s.category.id} value={String(s.category.id)}>{s.category.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.category && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
      </div>
    );
  }

  function SubcategorySelector() {
    if (!form.categoryId) return null;
    const subs = currentSchema?.subcategories || [];
    if (!subs || subs.length === 0) return null;
    return (
      <div className="space-y-2">
        <Label className="text-sm sm:text-base font-semibold">Subcategory <span className="text-destructive">*</span></Label>
        <Select
          value={form.subcategoryId?.toString() || ""}
          onValueChange={(v) => {
            const id = v ? Number(v) : null;
            setFormPartial({ subcategoryId: id, subSubcategoryId: null, details: { images: form.details?.images || [] } });
            setErrors((p) => { const c = { ...p }; delete c.subcategory; delete c.subSubcategory; return c; });
          }}
        >
          <SelectTrigger id="subcategory" className={`w-full h-11 ${errors.subcategory ? "border-destructive" : ""}`}>
            <SelectValue placeholder="Select subcategory" />
          </SelectTrigger>
          <SelectContent>
            {subs.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.subcategory && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.subcategory}</p>}
      </div>
    );
  }

  function SubSubcategorySelector() {
    const ss = currentSubcategory?.sub_subcategories || [];
    if (!ss || ss.length === 0) return null;
    return (
      <div className="space-y-2">
        <Label className="text-sm sm:text-base font-semibold">Sub-Type <span className="text-destructive">*</span></Label>
        <Select
          value={form.subSubcategoryId?.toString() || ""}
          onValueChange={(v) => {
            const id = v ? Number(v) : null;
            setFormPartial({ subSubcategoryId: id });
            setErrors((p) => { const c = { ...p }; delete c.subSubcategory; return c; });
          }}
        >
          <SelectTrigger id="subSubcategory" className={`w-full h-11 ${errors.subSubcategory ? "border-destructive" : ""}`}>
            <SelectValue placeholder="Select sub-type" />
          </SelectTrigger>
          <SelectContent>
            {ss.map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {errors.subSubcategory && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.subSubcategory}</p>}
      </div>
    );
  }

  // Create field-specific image upload handler
  const createImageUploadHandler = useCallback((fieldSlug: string) => {
    return async (file: File) => {
      setImagesUploading(true);
      try {
        const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
        if (!allowed.includes(file.type)) throw new Error("Only JPEG/PNG/WebP images allowed");
        const max = 10 * 1024 * 1024;
        if (file.size > max) throw new Error("Image exceeds 10MB");

        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/tickets/attachments/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "upload failed" }));
          throw new Error(err.error || "Upload failed");
        }
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }
        const data = await res.json();
        
        // Store image in the specific field slug
        setForm((prev) => {
          const currentImages = Array.isArray(prev.details?.[fieldSlug]) 
            ? (prev.details[fieldSlug] as string[])
            : prev.details?.[fieldSlug] 
              ? [String(prev.details[fieldSlug])]
              : [];
          
          return {
            ...prev,
            details: {
              ...(prev.details || {}),
              [fieldSlug]: [...currentImages, data.url],
            },
          };
        });
        toast.success("Image uploaded");
      } catch (err: unknown) {
        console.error("Upload failed:", err);
        const errorMessage = err instanceof Error ? err.message : "Image upload failed";
        toast.error(errorMessage);
      } finally {
        setImagesUploading(false);
      }
    };
  }, []);

  const DynamicFieldsSectionMemo = useMemo(() => {
    const fields = currentSubcategory?.fields || [];
    if (!fields || fields.length === 0) return null;

    const sorted = fields.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const visibleFields = sorted.filter(shouldDisplayField);
    if (visibleFields.length === 0) return null;

    return (
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-base sm:text-lg font-semibold">Additional Details</h3>
        {visibleFields.map((f) => (
          <DynamicFieldRenderer
            key={f.id}
            field={{
              ...f,
              validation_rules: f.validation_rules ?? {},
              required: isFieldRequired(f),
            } as DynamicField & { validation_rules: Record<string, unknown> }}
            value={form.details[f.slug]}
            onChange={(val) => setDetail(f.slug, val)}
            error={errors[f.slug]}
            onImageUpload={f.field_type === "upload" ? createImageUploadHandler(f.slug) : undefined}
            imagesUploading={f.field_type === "upload" ? imagesUploading : false}
          />
        ))}
      </div>
    );
  }, [
    currentSubcategory?.fields,
    form.details,
    errors,
    setDetail,
    createImageUploadHandler,
    imagesUploading,
    shouldDisplayField,
    isFieldRequired,
  ]);

  const ProfileFieldsSectionMemo = useMemo(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0) return null;
    
    return (
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-base sm:text-lg font-semibold">Contact & Profile</h3>
        <ProfileFieldsRenderer
          profileFields={pf}
          studentProfile={student ?? {} as StudentProfile}
          formData={form.profile}
          onChange={(key, value) => setProfileField(key, value)}
          errors={errors}
          hostels={hostelsProp || []}
        />
      </div>
    );
  }, [currentSchema?.profileFields, student, form.profile, setProfileField, errors, hostelsProp]);

  const DescriptionEditorMemo = useMemo(() => {
    // Only show generic description if there's no dynamic description field
    const fields = currentSubcategory?.fields || [];
    const hasDynamicDescription = fields.some(f => 
      f.slug === 'description' || f.field_type === 'textarea' || f.name.toLowerCase().includes('description')
    );
    
    if (hasDynamicDescription) return null;
    
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label htmlFor="description" className="text-sm sm:text-base font-semibold">Description <span className="text-destructive">*</span></Label>
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
          value={form.description || ""}
          onChange={(e) => {
            const value = e.target.value;
            setFormPartial({ description: value });
            if (errors.description) {
              setErrors((p) => { const c = { ...p }; delete c.description; return c; });
            }
          }}
          placeholder="Type a clear, concise description (minimum 10 characters)"
          className={errors.description ? "border-destructive" : ""}
        />
        <div className="flex items-center justify-between">
          {errors.description && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.description}</p>}
          <p className="text-xs text-muted-foreground ml-auto">{String(form.description || "").length} characters</p>
        </div>
      </div>
    );
  }, [currentSubcategory?.fields, form.description, errors.description, setFormPartial, setErrors]);

  // General image upload section (always available, optional)
  const GeneralImageUploadMemo = useMemo(() => {
    // If any dynamic field is an upload, let that field handle attachments instead
    const hasUploadField = currentSubcategory?.fields?.some(
      (field) => field.field_type === 'upload'
    );
    if (hasUploadField) return null;

    const images: string[] = (form.details?.images as string[]) || [];
    
    return (
      <div className="space-y-2 border-t pt-4">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Label htmlFor="general-images" className="text-sm sm:text-base font-semibold">
            Attachments
          </Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload images to help explain your issue (jpg/png/webp). Max 10MB each. Optional.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground">Upload images to help explain your issue (jpg/png/webp). Max 10MB each.</p>

        <div className="flex gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            multiple
            id="general-images"
            onChange={(e) => handleImageFiles(e.target.files)}
          />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={imagesUploading}>
            <ImageIcon className="mr-2 w-4 h-4" /> Upload Image
          </Button>
          {imagesUploading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Uploading...</div>}
        </div>

        {images.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3">
            {images.map((u) => (
              <div key={u} className="relative w-28 h-28 rounded overflow-hidden border group">
                <Image 
                  src={u} 
                  alt="attachment" 
                  fill
                  sizes="112px"
                  className="object-cover" 
                  style={{ objectFit: 'cover' }}
                />
                <button 
                  type="button" 
                  aria-label="Remove" 
                  onClick={() => removeImage(u)} 
                  className="absolute top-1 right-1 bg-white/80 p-1 rounded hover:bg-white transition-colors z-10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }, [currentSubcategory?.fields, form.details?.images, imagesUploading, fileInputRef, handleImageFiles, removeImage]);

  function SubmitBar() {
    // Simple client-side guard so the button only enables when the core fields are filled
    const hasCategory = !!form.categoryId;
    
    // Check if description is handled by dynamic fields or the main description field
    const subFields = currentSubcategory?.fields || [];
    const hasDynamicDescription = subFields.some(f => 
      f.slug === 'description' || f.field_type === 'textarea' || f.name.toLowerCase().includes('description')
    );
    
    const descLength = String(form.description || "").trim().length;
    const hasMinDescription = hasDynamicDescription || descLength >= 10;

    const isFormValid = hasCategory && hasMinDescription;

    return (
      <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4 sm:pt-6">
        <Link href="/student/dashboard"><Button variant="outline" size="lg">Cancel</Button></Link>

        <Button
          type="button"
          size="lg"
          onClick={() => handleSubmit()}
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

  /* ===========================
     Render
     =========================== */

  return (
    <div className="max-w-3xl mx-auto p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-1.5 sm:gap-2 text-sm sm:text-base h-8 sm:h-10">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Back to Tickets</span>
            <span className="sm:hidden">Back</span>
          </Button>
        </Link>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-3 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-2xl sm:text-3xl font-bold">Create New Ticket</CardTitle>
              <CardDescription className="mt-1 sm:mt-2 text-sm sm:text-base">Fill in the details below to create a support ticket</CardDescription>
            </div>
            <div className="w-full sm:w-56">
              <div className="text-xs sm:text-sm text-muted-foreground">Form Completion</div>
              <div className="flex items-center justify-between gap-2">
                <Progress value={progress} className="h-2 w-full rounded flex-1" />
                <div className="text-xs sm:text-sm font-medium whitespace-nowrap">{progress}%</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 pt-0">
          {!student ? (
            <div className="py-6 sm:py-8">
              <Alert>
                <AlertDescription className="text-xs sm:text-sm">Please complete your profile to create tickets. <Link href="/student/profile"><Button size="sm" className="mt-2 sm:mt-0 sm:ml-2">Go to Profile</Button></Link></AlertDescription>
              </Alert>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <CategorySelector />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <SubcategorySelector />
                  <SubSubcategorySelector />
                </div>

                {DynamicFieldsSectionMemo}

                {DescriptionEditorMemo}

                {GeneralImageUploadMemo}

                <Separator />

                {ProfileFieldsSectionMemo}

                <SubmitBar />
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Rebuilt TicketForm — Clean, Fast, Fully Typed
// Using React Hook Form + Zod + Controlled Dynamic Schema
// Drop into: src/components/student/ticket-form/NewTicketForm.tsx

// "use client";

// import React, { useEffect, useMemo } from "react";
// import { useForm, FormProvider, useFormContext, Controller } from "react-hook-form";
// import { z } from "zod";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useRouter } from "next/navigation";
// import { Button } from "@/components/ui/button";
// import { Textarea } from "@/components/ui/textarea";
// import { Label } from "@/components/ui/label";
// import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { toast } from "sonner";

// /* ==========================================================
//    1. ZOD SCHEMA (Dynamic + Safe)
//    ========================================================== */

// const BaseTicketSchema = z.object({
//   categoryId: z.number().nullable(),
//   subcategoryId: z.number().nullable(),
//   subSubcategoryId: z.number().nullable().optional(),
//   description: z.string().min(10, "Description must be at least 10 characters"),
//   details: z.record(z.string(), z.any()).optional(),
//   profile: z.record(z.string(), z.any()),
// });

// // The final schema will be computed dynamically based on subcategory fields
// export type TicketFormSchema = z.infer<typeof BaseTicketSchema>;

// /* ==========================================================
//    2. COMPONENT: Field Wrapper
//    ========================================================== */

// function RHFInput({ label, name, placeholder }: any) {
//   const { register, formState } = useFormContext();
//   const error = formState.errors[name]?.message as string | undefined;
//   return (
//     <div className="space-y-1">
//       <Label>{label}</Label>
//       <input
//         {...register(name)}
//         placeholder={placeholder}
//         className={`input ${error ? "border-red-500" : ""}`}
//       />
//       {error && <p className="text-xs text-red-500">{error}</p>}
//     </div>
//   );
// }

// /* ==========================================================
//    3. MAIN FORM COMPONENT
//    ========================================================== */

// export default function NewTicketForm({
//   student,
//   categories,
//   subcategories,
//   subSubcategories,
//   profileFields,
//   dynamicFields,
//   fieldOptions,
//   dbUserId,
// }: any) {
//   const router = useRouter();

//   /* --------------------------------------
//      Build dynamic validation schema
//      -------------------------------------- */

//   const dynamicSchema = useMemo(() => {
//     let schema = BaseTicketSchema;
//     return schema;
//   }, [categories, subcategories, dynamicFields]);

//   /* --------------------------------------
//      React Hook Form
//      -------------------------------------- */

//   const methods = useForm<TicketFormSchema>({
//     resolver: zodResolver(dynamicSchema),
//     defaultValues: {
//       categoryId: null,
//       subcategoryId: null,
//       subSubcategoryId: null,
//       description: "",
//       details: {},
//       profile: {
//         rollNo: student?.userNumber,
//         name: student?.fullName,
//         email: student?.email,
//         phone: student?.mobile,
//         hostel: student?.hostel,
//         roomNumber: student?.roomNumber,
//         batchYear: student?.batchYear,
//         classSection: student?.classSection,
//       },
//     },
//   });

//   const { watch, handleSubmit, setValue } = methods;

//   const selectedCategory = watch("categoryId");
//   const selectedSubcategory = watch("subcategoryId");

//   const filteredSubcategories = useMemo(
//     () => (subcategories || []).filter((s: any) => s.category_id === selectedCategory),
//     [selectedCategory, subcategories]
//   );

//   const filteredSubSubcategories = useMemo(
//     () => (subSubcategories || []).filter((s: any) => s.subcategory_id === selectedSubcategory),
//     [selectedSubcategory, subSubcategories]
//   );

//   const filteredDynamicFields = useMemo(
//     () => (dynamicFields || []).filter((df: any) => df.subcategory_id === selectedSubcategory),
//     [selectedSubcategory, dynamicFields]
//   );

//   /* --------------------------------------
//      Submit handler
//      -------------------------------------- */

//   async function onSubmit(values: TicketFormSchema) {
//     try {
//       const payload = {
//         categoryId: values.categoryId,
//         subcategoryId: values.subcategoryId,
//         subSubcategoryId: values.subSubcategoryId,
//         description: values.description,
//         details: {
//           ...(values.details || {}),
//           profile: values.profile,
//         },
//       };

//       const res = await fetch("/api/tickets", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(payload),
//       });

//       if (!res.ok) throw new Error("Failed to create ticket");

//       const ticket = await res.json();
//       toast.success("Ticket created successfully");
//       router.push(`/student/dashboard/tickets/${ticket.id}`);
//     } catch (err: unknown) {
//       toast.error(err.message || "Error creating ticket");
//     }
//   }

//   /* ==========================================================
//        RENDER
//      ========================================================== */

//   return (
//     <FormProvider {...methods}>
//       <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto p-6 space-y-6">
//         <Card>
//           <CardHeader>
//             <CardTitle>Create New Ticket</CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-6">
//             {/* Category */}
//             <div className="space-y-2">
//               <Label>Category *</Label>
//               <Controller
//                 name="categoryId"
//                 render={({ field }) => (
//                   <Select
//                     value={field.value?.toString() || ""}
//                     onValueChange={(v) => field.onChange(Number(v))}
//                   >
//                     <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
//                     <SelectContent>
//                       {categories.map((c: any) => (
//                         <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
//                       ))}
//                     </SelectContent>
//                   </Select>
//                 )}
//               />
//             </div>

//             {/* Subcategory */}
//             {filteredSubcategories.length > 0 && (
//               <div className="space-y-2">
//                 <Label>Issue Type *</Label>
//                 <Controller
//                   name="subcategoryId"
//                   render={({ field }) => (
//                     <Select
//                       value={field.value?.toString() || ""}
//                       onValueChange={(v) => field.onChange(Number(v))}
//                     >
//                       <SelectTrigger><SelectValue placeholder="Select issue" /></SelectTrigger>
//                       <SelectContent>
//                         {filteredSubcategories.map((s: any) => (
//                           <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 />
//               </div>
//             )}

//             {/* Sub-Subcategory */}
//             {filteredSubSubcategories.length > 0 && (
//               <div className="space-y-2">
//                 <Label>Sub-Type</Label>
//                 <Controller
//                   name="subSubcategoryId"
//                   render={({ field }) => (
//                     <Select
//                       value={field.value?.toString() || ""}
//                       onValueChange={(v) => field.onChange(Number(v))}
//                     >
//                       <SelectTrigger><SelectValue placeholder="Select sub-type" /></SelectTrigger>
//                       <SelectContent>
//                         {filteredSubSubcategories.map((s: any) => (
//                           <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
//                         ))}
//                       </SelectContent>
//                     </Select>
//                   )}
//                 />
//               </div>
//             )}

//             {/* Dynamic Fields */}
//             {filteredDynamicFields.length > 0 && (
//               <div className="space-y-4 border-t pt-4">
//                 <h3 className="font-semibold">Additional Details</h3>
//                 {filteredDynamicFields.map((df: any) => (
//                   <RHFInput key={df.slug} name={`details.${df.slug}`} label={df.name} placeholder={df.placeholder} />
//                 ))}
//               </div>
//             )}

//             {/* Description */}
//             <div className="space-y-2">
//               <Label>Description *</Label>
//               <Controller
//                 name="description"
//                 render={({ field, fieldState }) => (
//                   <>
//                     <Textarea {...field} rows={5} className={fieldState.error ? "border-red-500" : ""} />
//                     {fieldState.error && (
//                       <p className="text-xs text-red-500">{fieldState.error.message}</p>
//                     )}
//                   </>
//                 )}
//               />
//             </div>

//             {/* Profile Fields */}
//             <div className="space-y-4 border-t pt-4">
//               <h3 className="font-semibold">Contact & Profile</h3>
//               {profileFields.map((pf: any) => (
//                 <RHFInput key={pf.storage_key} name={`profile.${pf.storage_key}`} label={pf.field_name} />
//               ))}
//             </div>

//             {/* Submit */}
//             <Button type="submit" className="w-full">Create Ticket</Button>
//           </CardContent>
//         </Card>
//       </form>
//     </FormProvider>
//   );
// }