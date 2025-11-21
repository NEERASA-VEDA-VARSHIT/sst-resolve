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
  userNumber: string; // normalized to empty string when missing
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
  validation_rules?: any;
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

function generateEmailFromRollNo(roll: string, name: string) {
  if (!roll || !name) return "";
  const namePart = name.toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
  return `${namePart}.${String(roll).toLowerCase()}@sst.scaler.com`;
}

/* ===========================
   TicketForm
   =========================== */

export default function TicketForm(props: TicketFormProps) {
  const {
    dbUserId,
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
      userNumber: studentProp.userNumber ?? "",
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
      const catId = (s as any).category_id ?? (s as any).categoryId ?? null;
      if (catId == null) continue;
      const arr = subsByCat.get(catId) || [];
      arr.push(s);
      subsByCat.set(catId, arr);
    }

    // map fields by subcategory_id
    const fieldsBySub = new Map<number, DynamicField[]>();
    for (const f of dynamicFieldsProp || []) {
      const subId = (f as any).subcategory_id ?? (f as any).subCategoryId ?? (f as any).category_field_subcategory_id ?? null;
      if (subId == null) continue;
      const arr = fieldsBySub.get(subId) || [];
      arr.push(f);
      fieldsBySub.set(subId, arr);
    }

    // map options by field_id
    const optionsByField = new Map<number, any[]>();
    for (const opt of fieldOptionsProp || []) {
      const fieldId = (opt as any).field_id;
      if (fieldId == null) continue;
      
      const arr = optionsByField.get(fieldId) || [];
      arr.push({
        id: opt.id,
        label: (opt as any).label || (opt as any).option_label, // Support both property names
        value: (opt as any).value || (opt as any).option_value,
      });
      optionsByField.set(fieldId, arr);
    }

    // for each category attach subcategories and subcategory fields
    const arr: {
      category: Category;
      subcategories: Subcategory[];
      profileFields: ProfileFieldConfig[];
    }[] = (categoriesProp || []).map((c) => {
      const rawSubs = subsByCat.get((c as any).id) || [];
      const subs = rawSubs.map((s) => {
        const rawFields = fieldsBySub.get((s as any).id) || [];
        const fields = rawFields.map((f) => ({
          ...f,
          placeholder: f.placeholder ?? null,
          help_text: f.help_text ?? null,
          options: optionsByField.get(f.id) || [],
        }));
        return {
          ...s,
          fields: fields.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)),
        } as Subcategory;
      }).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));

      const catProfileFields = (profileFieldsProp || []).filter((pf: any) => {
        if ((pf as any).category_id) return (pf as any).category_id === (c as any).id;
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
    const initialProfile: Record<string, any> = {};
    if (student) {
      if (student.userNumber) initialProfile["rollNo"] = student.userNumber;
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
      details: {} as Record<string, any>,
      profile: initialProfile as Record<string, any>,
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

  const setDetail = useCallback((key: string, value: any) => {
    setForm((prev) => ({ ...prev, details: { ...(prev.details || {}), [key]: value } }));
  }, []);

  const setProfileField = useCallback((key: string, value: any) => {
    touchedProfileFields.current.add(key);
    setForm((prev) => ({ ...prev, profile: { ...(prev.profile || {}), [key]: value } }));
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

  /* -------------------------
     Autofill dynamic profile fields (do not overwrite touched)
     ------------------------- */
  useEffect(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0 || !student) return;

    setForm((prev) => {
      const next = { ...prev, profile: { ...(prev.profile || {}) } as Record<string, any> };
      let changed = false;

      for (const field of pf) {
        const key = field.storage_key;
        if (touchedProfileFields.current.has(key)) continue;
        const cur = next.profile[key];
        if (cur !== undefined && cur !== null && String(cur).trim() !== "") continue;

        let value = "";
        switch (field.field_name) {
          case "rollNo": value = student.userNumber || ""; break;
          case "name": value = student.fullName || ""; break;
          case "email": value = student.email || (student.userNumber && student.fullName ? generateEmailFromRollNo(String(student.userNumber), String(student.fullName)) : ""); break;
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
      if (!field.required) continue;
      const fv = form.details[field.slug];
      if (field.field_type === "boolean") {
        const isBool = fv === true || fv === false || fv === "true" || fv === "false";
        if (!isBool) newErrors[field.slug] = `${field.name} is required`;
      } else {
        if (fv === undefined || fv === null || (typeof fv === "string" && fv.trim() === "")) {
          newErrors[field.slug] = `${field.name} is required`;
        } else {
          const rules = (field as any).validation_rules;
          if (rules && typeof fv === "string") {
            if (rules.minLength && fv.length < rules.minLength) {
              newErrors[field.slug] = `${field.name} must be at least ${rules.minLength} characters`;
            }
            if (rules.maxLength && fv.length > rules.maxLength) {
              newErrors[field.slug] = `${field.name} must be at most ${rules.maxLength} characters`;
            }
            if (rules.pattern) {
              const re = new RegExp(rules.pattern);
              if (!re.test(fv)) newErrors[field.slug] = rules.errorMessage || `${field.name} format is invalid`;
            }
          }
          if (rules && (rules.min !== undefined || rules.max !== undefined)) {
            const num = Number(fv);
            if (rules.min !== undefined && num < rules.min) newErrors[field.slug] = `${field.name} must be at least ${rules.min}`;
            if (rules.max !== undefined && num > rules.max) newErrors[field.slug] = `${field.name} must be at most ${rules.max}`;
          }
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, currentSchema, currentSubcategory]);

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
      if (!f.required) continue;
      total++;
      const v = form.details[f.slug];
      if (v !== undefined && v !== null && (typeof v !== "string" || v.trim() !== "")) complete++;
    }

    return total === 0 ? 0 : Math.round((complete / total) * 100);
  }, [form, currentSchema, currentSubcategory]);

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
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        details: {
          ...(prev.details || {}),
          images: [...((prev.details?.images as string[]) || []), data.url],
        },
      }));
      toast.success("Image uploaded");
    } catch (err: any) {
      console.error("Upload failed:", err);
      toast.error(err.message || "Image upload failed");
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

  const removeImage = (url: string) => {
    setForm((prev) => {
      const newImages = (prev.details?.images || []).filter((u: string) => u !== url);
      return {
        ...prev,
        details: {
          ...(prev.details || {}),
          images: newImages,
        },
      };
    });
  };

  /* -------------------------
     Submit
     ------------------------- */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
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

      const payload = {
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        subSubcategoryId: form.subSubcategoryId || null,
        description: form.description,
        details: detailsWithoutImages,
        images: images.length > 0 ? images : undefined,
        profile: cleanProfile,
      };

      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "ticket creation failed" }));
        throw new Error(err.error || "Ticket creation failed");
      }

      const ticket = await res.json();
      toast.success("Ticket created successfully");
      router.push(`/student/dashboard/ticket/${ticket.id}`);
    } catch (err: any) {
      console.error("Ticket create error:", err);
      toast.error(err.message || "Failed to create ticket");
    } finally {
      setLoading(false);
    }
  }, [form, validateForm, router]);

  /* ===========================
     Small internal subcomponents
     =========================== */

  function CategorySelector() {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-base font-semibold">Category <span className="text-destructive">*</span></Label>
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
        <Label className="text-base font-semibold">Subcategory <span className="text-destructive">*</span></Label>
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
        <Label className="text-base font-semibold">Sub-Type <span className="text-destructive">*</span></Label>
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

  const DynamicFieldsSectionMemo = useMemo(() => {
    const fields = currentSubcategory?.fields || [];
    if (!fields || fields.length === 0) return null;
    
    // Filter out upload fields since they're handled by the dedicated Attachments section
    const nonUploadFields = fields.filter(f => f.field_type !== "upload");
    if (nonUploadFields.length === 0) return null;
    
    const sorted = nonUploadFields.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    

    
    return (
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Additional Details</h3>
        {sorted.map((f) => (
          <DynamicFieldRenderer
            key={f.id}
            field={{ ...f, validation_rules: f.validation_rules ?? {} } as any}
            value={form.details[f.slug]}
            onChange={(val) => setDetail(f.slug, val)}
            error={errors[f.slug]}
          />
        ))}
      </div>
    );
  }, [currentSubcategory?.fields, form.details, errors, setDetail]);

  const ProfileFieldsSectionMemo = useMemo(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0) return null;
    
    return (
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-lg font-semibold">Contact & Profile</h3>
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
        <div className="flex items-center gap-2">
          <Label htmlFor="description" className="text-base font-semibold">Description <span className="text-destructive">*</span></Label>
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

  const ImageUploaderMemo = useMemo(() => {
    // Only show if subcategory has an "upload" type field
    const hasUploadField = currentSubcategory?.fields?.some(
      (field) => field.field_type === 'upload'
    );
    
    if (!hasUploadField) return null;
    
    const images: string[] = (form.details?.images as string[]) || [];
    return (
      <div className="space-y-2 border-t pt-4">
        <h3 className="text-lg font-semibold">Attachments</h3>
        <p className="text-sm text-muted-foreground">Upload images to help explain your issue (jpg/png/webp). Max 10MB each.</p>

        <div className="flex gap-3 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            multiple
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
      <div className="flex justify-end gap-3 pt-6">
        <Link href="/student/dashboard"><Button variant="outline" size="lg">Cancel</Button></Link>

        <Button
          type="button"
          size="lg"
          onClick={() => handleSubmit()}
          disabled={loading || !isFormValid}
          className="min-w-[140px] flex items-center justify-center gap-2"
        >
          {loading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>) : (<><CheckCircle2 className="w-4 h-4" /> Create Ticket</>)}
        </Button>
      </div>
    );
  }

  /* ===========================
     Render
     =========================== */

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/student/dashboard">
          <Button variant="ghost" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Tickets
          </Button>
        </Link>
      </div>

      <Card className="border-2 shadow-lg">
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold">Create New Ticket</CardTitle>
              <CardDescription className="mt-2 text-base">Fill in the details below to create a support ticket</CardDescription>
            </div>
            <div className="w-56">
              <div className="text-sm text-muted-foreground">Form Completion</div>
              <div className="flex items-center justify-between">
                <Progress value={progress} className="h-2 w-full rounded" />
                <div className="ml-3 text-sm font-medium">{progress}%</div>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {!student ? (
            <div className="py-8">
              <Alert>
                <AlertDescription>Please complete your profile to create tickets. <Link href="/student/profile"><Button size="sm">Go to Profile</Button></Link></AlertDescription>
              </Alert>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                <CategorySelector />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SubcategorySelector />
                  <SubSubcategorySelector />
                </div>

                {DynamicFieldsSectionMemo}

                {DescriptionEditorMemo}

                {ImageUploaderMemo}

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
//     } catch (err: any) {
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