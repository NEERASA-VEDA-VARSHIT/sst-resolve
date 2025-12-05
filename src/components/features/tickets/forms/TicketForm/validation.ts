/**
 * Validation utilities for TicketForm
 */

const rollNoRegex = /^\d{2}bcs\d{5}$/i;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^(\+91)?[6-9]\d{9}$/;

export const validateRollNo = (v?: string) => !!v && rollNoRegex.test(v.trim());
export const validateEmail = (v?: string) => !!v && emailRegex.test(v.trim());
export const validatePhone = (v?: string) => {
  if (!v) return false;
  const cleaned = v.replace(/[\s\-]/g, "");
  return phoneRegex.test(cleaned);
};
