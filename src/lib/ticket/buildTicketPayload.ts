/**
 * Ticket Payload Builder
 * Extracts messy payload creation logic into clean utility function
 */

interface StudentProfile {
  userNumber: string;
  hostel: string | null;
  fullName: string | null;
  email: string | null;
  mobile: string | null;
  roomNumber: string | null;
  batchYear: number | null;
  classSection: string | null;
}

interface FormData {
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  location: string;
  details: Record<string, unknown>;
  profile: Record<string, unknown>;
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  contactRollNo: string;
  roomNumber: string;
  batchYear: string;
  classSection: string;
}

interface TicketPayload {
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  location: string | null;
  details: {
    profile: Record<string, unknown>;
    images?: string[];
    [key: string]: unknown;
  };
}

/**
 * Safely get or generate email from roll number and name
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function generateEmail(_rollNo: string, _name: string): string {
  if (!_rollNo || !_name) return "";
  const namePart = _name
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
  return `${namePart}.${_rollNo.toLowerCase()}@sst.scaler.com`;
}

/**
 * Get final value with fallback chain
 */
function getFinalValue(
  profileValue: unknown,
  legacyValue: string,
  profileFallback: string | null | undefined | Record<string, unknown>
): string {
  const profileStr =
    profileValue !== undefined && profileValue !== null
      ? String(profileValue).trim()
      : "";
  const legacyStr = legacyValue?.trim() || "";
  const fallbackStr =
    profileFallback !== undefined && profileFallback !== null
      ? typeof profileFallback === 'string' ? profileFallback : String(profileFallback)
      : "";

  return profileStr || legacyStr || fallbackStr;
}

/**
 * Build clean ticket payload from form data
 * 
 * @param formData - Current form state
 * @param studentProfile - User profile from database
 * @param images - Array of uploaded image URLs
 * @returns Clean ticket payload ready for API submission
 */
export function buildTicketPayload(
  formData: FormData,
  studentProfile: StudentProfile | null,
  images: string[] = []
): TicketPayload {
  const profileValues = formData.profile || {};

  // Extract contact information with fallback chain
  // const finalRollNo = getFinalValue(
  //   profileValues.rollNo,
  //   formData.contactRollNo,
  //   studentProfile?.userNumber
  // );

  // const finalName = getFinalValue(
  //   profileValues.name,
  //   formData.contactName,
  //   studentProfile?.fullName
  // );

  // Extract category-specific fields
  const finalLocation = getFinalValue(
    profileValues.hostel,
    formData.location,
    studentProfile?.hostel
  );

  // Build clean payload
  return {
    categoryId: formData.categoryId,
    subcategoryId: formData.subcategoryId,
    description: formData.description,
    location: finalLocation || null,
    details: {
      ...formData.details,
      profile: formData.profile || {},
      images: images.length > 0 ? images : undefined,
    },
  };
}
