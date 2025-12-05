"use client";

import { useState, useCallback, useRef } from "react";
import type { TicketFormState, StudentProfile } from "../types";

export function useTicketFormState(student: StudentProfile | null) {
  // Initial profile prefill from student
  const getInitialProfile = useCallback((): Record<string, string> => {
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
    return initialProfile;
  }, [student]);

  const [form, setForm] = useState<TicketFormState>(() => ({
    categoryId: null,
    subcategoryId: null,
    description: "",
    details: {},
    profile: getInitialProfile(),
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const touchedProfileFields = useRef(new Set<string>());

  const setFormPartial = useCallback((patch: Partial<TicketFormState> | ((prev: TicketFormState) => Partial<TicketFormState>)) => {
    if (typeof patch === "function") {
      setForm((prev) => ({ ...prev, ...patch(prev) }));
    } else {
      setForm((prev) => ({ ...prev, ...patch }));
    }
  }, []);

  const setDetail = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({
      ...prev,
      details: { ...(prev.details || {}), [key]: value },
    }));
  }, []);

  const setProfileField = useCallback((key: string, value: unknown) => {
    touchedProfileFields.current.add(key);
    setForm((prev) => ({
      ...prev,
      profile: { ...(prev.profile || {}), [key]: String(value) },
    }));
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  }, []);

  // Autofill profile fields from student data
  // Note: This is handled in the main component via currentSchema?.profileFields
  // Keeping this hook focused on form state management only

  return {
    form,
    errors,
    setForm,
    setFormPartial,
    setDetail,
    setProfileField,
    setErrors,
    touchedProfileFields,
  };
}
