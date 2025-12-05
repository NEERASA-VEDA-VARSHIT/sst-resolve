"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft } from "lucide-react";

import { DynamicFieldRenderer } from "@/components/features/tickets/display/DynamicFieldRenderer";
import { ProfileFieldsRenderer } from "@/components/features/tickets/display/ProfileFieldsRenderer";

// Types
import type { TicketFormProps, StudentProfile, TicketFormState } from "./types";

// Utilities
import { buildCategorySchemas } from "./schemaBuilder";
import { validateTicketForm, calculateFormProgress } from "./formValidation";
import { shouldDisplayField, isFieldRequired, isMultiSelectField } from "./fieldHelpers";

// Hooks
import { useTicketFormState } from "./hooks/useTicketFormState";
import { useTicketSubmission } from "./hooks/useTicketSubmission";
import { useImageUpload } from "./hooks/useImageUpload";

// Components
import { CategorySelector } from "./components/CategorySelector";
import { SubcategorySelector } from "./components/SubcategorySelector";
import { DescriptionEditor } from "./components/DescriptionEditor";
import { GeneralImageUpload } from "./components/GeneralImageUpload";
import { SubmitBar } from "./components/SubmitBar";

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

  // Normalize student profile
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

  // Build category schemas
  const schemas = useMemo(
    () =>
      buildCategorySchemas(
        categoriesProp,
        subcategoriesProp,
        dynamicFieldsProp,
        profileFieldsProp,
        fieldOptionsProp
      ),
    [categoriesProp, subcategoriesProp, dynamicFieldsProp, profileFieldsProp, fieldOptionsProp]
  );

  // Form state management
  const {
    form,
    errors,
    setFormPartial,
    setDetail,
    setProfileField,
    setErrors,
  } = useTicketFormState(student);

  const [loading, setLoading] = useState(false);
  const { uploadImage, imagesUploading } = useImageUpload();

  // Derived state
  const currentSchema = useMemo(() => {
    if (!form.categoryId) return null;
    return schemas.find((s) => s.category.id === form.categoryId) || null;
  }, [form.categoryId, schemas]);

  const currentSubcategory = useMemo(() => {
    if (!currentSchema || !form.subcategoryId) return null;
    return currentSchema.subcategories.find((s) => s.id === form.subcategoryId) || null;
  }, [currentSchema, form.subcategoryId]);

  // Clean up hidden fields when dependencies change
  useEffect(() => {
    if (!currentSubcategory?.fields?.length) return;
    setFormPartial((prev) => {
      const nextDetails = { ...(prev.details || {}) };
      let changed = false;
      for (const field of currentSubcategory.fields || []) {
        if (!shouldDisplayField(field, form) && nextDetails[field.slug] !== undefined) {
          delete nextDetails[field.slug];
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, details: nextDetails };
    });
  }, [currentSubcategory, form, setFormPartial]);

  // Validation
  const validateForm = useCallback(() => {
    const newErrors = validateTicketForm(form, currentSchema, currentSubcategory);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [form, currentSchema, currentSubcategory, setErrors]);

  // Progress calculation
  const progress = useMemo(
    () => calculateFormProgress(form, currentSchema, currentSubcategory),
    [form, currentSchema, currentSubcategory]
  );

  // Image upload handlers
  const handleImageFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        try {
          const url = await uploadImage(file);
          setFormPartial((prev) => ({
            ...prev,
            details: {
              ...(prev.details || {}),
              images: [...((prev.details?.images as string[]) || []), url],
            },
          }));
        } catch (error) {
          // Error already handled in uploadImage hook
        }
      }
    },
    [uploadImage, setFormPartial]
  );

  const removeImage = useCallback(
    (url: string) => {
      setFormPartial((prev) => {
        const images = Array.isArray(prev.details?.images) ? prev.details.images : [];
        const newImages = images.filter((u: unknown) => typeof u === "string" && u !== url);
        return {
          ...prev,
          details: {
            ...(prev.details || {}),
            images: newImages,
          },
        };
      });
    },
    [setFormPartial]
  );

  // Field-specific image upload handler
  const createImageUploadHandler = useCallback(
    (fieldSlug: string) => {
      return async (file: File) => {
        try {
          const url = await uploadImage(file);
          setFormPartial((prev) => {
            const currentImages = Array.isArray(prev.details?.[fieldSlug])
              ? (prev.details[fieldSlug] as string[])
              : prev.details?.[fieldSlug]
                ? [String(prev.details[fieldSlug])]
                : [];

            return {
              ...prev,
              details: {
                ...(prev.details || {}),
                [fieldSlug]: [...currentImages, url],
              },
            };
          });
        } catch (error) {
          // Error already handled in uploadImage hook
        }
      };
    },
    [uploadImage, setFormPartial]
  );

  // Submission
  const { handleSubmit } = useTicketSubmission(form, loading, setLoading, validateForm);

  // Autofill profile fields from student data
  useEffect(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0 || !student) return;

    setFormPartial((prev) => {
      const next = { ...prev, profile: { ...(prev.profile || {}) } };
      let changed = false;

      for (const field of pf) {
        const key = field.storage_key;
        const cur = next.profile[key];
        if (cur !== undefined && cur !== null && String(cur).trim() !== "") continue;

        let value = "";
        switch (field.field_name) {
          case "name":
            value = student.fullName || "";
            break;
          case "email":
            value = student.email || "";
            break;
          case "phone":
            value = student.mobile || "";
            break;
          case "hostel":
            value = student.hostel || "";
            break;
          case "roomNumber":
            value = student.roomNumber || "";
            break;
          case "batchYear":
            value = student.batchYear ? String(student.batchYear) : "";
            break;
          case "classSection":
            value = student.classSection || "";
            break;
          default:
            value = "";
        }

        if (value !== "") {
          next.profile[key] = value;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [currentSchema?.profileFields, student, setFormPartial]);

  // Memoized sections
  const DynamicFieldsSectionMemo = useMemo(() => {
    const fields = currentSubcategory?.fields || [];
    if (!fields || fields.length === 0) return null;

    const sorted = fields.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const visibleFields = sorted.filter((f) => shouldDisplayField(f, form));
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
              required: isFieldRequired(f, form),
            } as any}
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
    form,
    errors,
    setDetail,
    createImageUploadHandler,
    imagesUploading,
  ]);

  const ProfileFieldsSectionMemo = useMemo(() => {
    const pf = currentSchema?.profileFields || [];
    if (!pf || pf.length === 0) return null;

    return (
      <div className="space-y-4 border-t pt-4">
        <h3 className="text-base sm:text-lg font-semibold">Contact & Profile</h3>
        <ProfileFieldsRenderer
          profileFields={pf}
          studentProfile={student ?? ({} as StudentProfile)}
          formData={form.profile}
          onChange={(key, value) => setProfileField(key, value)}
          errors={errors}
          hostels={hostelsProp || []}
        />
      </div>
    );
  }, [currentSchema?.profileFields, student, form.profile, setProfileField, errors, hostelsProp]);

  const DescriptionEditorMemo = useMemo(() => {
    const fields = currentSubcategory?.fields || [];
    const hasDynamicDescription = fields.some(
      (f) =>
        f.slug === "description" ||
        f.field_type === "textarea" ||
        f.name.toLowerCase().includes("description")
    );

    if (hasDynamicDescription) return null;

    return (
      <DescriptionEditor
        value={form.description || ""}
        error={errors.description}
        onChange={(value) => {
          setFormPartial({ description: value });
          if (errors.description) {
            setErrors((p) => {
              const c = { ...p };
              delete c.description;
              return c;
            });
          }
        }}
        onErrorClear={() => {
          setErrors((p) => {
            const c = { ...p };
            delete c.description;
            return c;
          });
        }}
      />
    );
  }, [currentSubcategory?.fields, form.description, errors.description, setFormPartial, setErrors]);

  const GeneralImageUploadMemo = useMemo(() => {
    const hasUploadField = currentSubcategory?.fields?.some((field) => field.field_type === "upload");
    if (hasUploadField) return null;

    const images: string[] = (form.details?.images as string[]) || [];

    return (
      <GeneralImageUpload
        images={images}
        uploading={imagesUploading}
        onUpload={handleImageFiles}
        onRemove={removeImage}
      />
    );
  }, [currentSubcategory?.fields, form.details?.images, imagesUploading, handleImageFiles, removeImage]);

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
              <CardDescription className="mt-1 sm:mt-2 text-sm sm:text-base">
                Fill in the details below to create a support ticket
              </CardDescription>
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
                <AlertDescription className="text-xs sm:text-sm">
                  Please complete your profile to create tickets.{" "}
                  <Link href="/student/profile">
                    <Button size="sm" className="mt-2 sm:mt-0 sm:ml-2">
                      Go to Profile
                    </Button>
                  </Link>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              className="space-y-4 sm:space-y-6 relative"
            >
              {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm px-6">
                  <div className="w-full max-w-xs sm:max-w-sm rounded-xl border bg-card/95 shadow-lg p-4 sm:p-5 flex flex-col items-center gap-3 text-center">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin text-primary" />
                    <div className="space-y-1">
                      <p className="text-sm sm:text-base font-semibold">Creating your ticket…</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        This usually takes a few seconds. Please don&apos;t close this screen.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:gap-6">
                <CategorySelector
                  schemas={schemas}
                  value={form.categoryId}
                  error={errors.category}
                  onChange={(categoryId) => {
                    setFormPartial({
                      categoryId,
                      subcategoryId: null,
                      details: { images: form.details?.images || [] },
                    });
                    setErrors((p) => {
                      const c = { ...p };
                      delete c.category;
                      delete c.subcategory;
                      return c;
                    });
                  }}
                  onSubcategoryReset={() => {
                    setFormPartial({ subcategoryId: null });
                  }}
                />
                <SubcategorySelector
                  subcategories={currentSchema?.subcategories || []}
                  value={form.subcategoryId}
                  error={errors.subcategory}
                  onChange={(subcategoryId) => {
                    setFormPartial({ subcategoryId, details: { images: form.details?.images || [] } });
                    setErrors((p) => {
                      const c = { ...p };
                      delete c.subcategory;
                      return c;
                    });
                  }}
                />

                {DynamicFieldsSectionMemo}

                {DescriptionEditorMemo}

                {GeneralImageUploadMemo}

                <Separator />

                {ProfileFieldsSectionMemo}

                <SubmitBar
                  form={form}
                  currentSubcategory={currentSubcategory}
                  loading={loading}
                  onSubmit={handleSubmit}
                />
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
