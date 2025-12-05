"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api, endpoints } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import type { TicketFormState } from "../types";

export function useTicketSubmission(
  form: TicketFormState,
  loading: boolean,
  setLoading: (loading: boolean) => void,
  validateForm: () => boolean
) {
  const router = useRouter();

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (loading) {
      console.warn("[TicketForm] Submit already in progress, ignoring duplicate submission");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the highlighted errors");
      return;
    }

    setLoading(true);
    const loadingToastId = toast.loading("Creating your ticket...", {
      description: "Please wait while we process your request",
    });

    try {
      const profileData =
        form.profile && typeof form.profile === "object" && !Array.isArray(form.profile)
          ? form.profile
          : {};
      const cleanProfile = Object.fromEntries(
        Object.entries(profileData).filter(([key, value]) => key !== "undefined" && value != null)
      );

      const images = (form.details?.images as string[]) || [];
      const detailsWithoutImages = { ...(form.details || {}) };
      delete detailsWithoutImages.images;

      const derivedLocation =
        typeof form.profile?.hostel === "string" && form.profile.hostel.trim()
          ? form.profile.hostel.trim()
          : undefined;

      const payload = {
        categoryId: form.categoryId,
        subcategoryId: form.subcategoryId,
        description: form.description,
        details: detailsWithoutImages,
        images: images.length > 0 ? images : undefined,
        location: derivedLocation,
        profile: cleanProfile,
      };

      const response = await api.post<{ id?: number; ticket?: { id: number } }>(endpoints.tickets, payload);
      const ticket = response.data;
      const ticketId = ticket?.id || ticket?.ticket?.id;

      if (!ticketId) {
        throw new Error("Ticket created but no ID returned");
      }

      toast.dismiss(loadingToastId);
      toast.success("Ticket created successfully!", {
        description: `Ticket #${ticketId} has been created and assigned`,
        duration: 3000,
      });

      await new Promise((resolve) => setTimeout(resolve, 500));
      router.push(`/student/dashboard/ticket/${ticketId}`);
      return;
    } catch (err: unknown) {
      logger.error("Ticket create error", err, { component: "TicketForm", action: "submit" });
      const errorMessage = err instanceof Error ? err.message : "Failed to create ticket";

      toast.dismiss(loadingToastId);
      toast.error("Failed to create ticket", {
        description: errorMessage,
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  }, [form, validateForm, router, loading, setLoading]);

  return { handleSubmit };
}
