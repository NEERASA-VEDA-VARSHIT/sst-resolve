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
  subSubcategoryId: number | null;
  description: string;
  location: string;
  details: Record<string, any>;
  profile: Record<string, any>;
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
  subSubcategoryId: number | null;
  description: string;
  location: string | null;
  details: {
    profile: Record<string, any>;
    images?: string[];
    [key: string]: any;
  };
}

/**
 * Safely get or generate email from roll number and name
 */
function generateEmail(rollNo: string, name: string): string {
  if (!rollNo || !name) return "";
  const namePart = name
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "");
  return `${namePart}.${rollNo.toLowerCase()}@sst.scaler.com`;
}

/**
 * Get final value with fallback chain
 */
function getFinalValue(
  profileValue: any,
  legacyValue: string,
  profileFallback: any
): string {
  const profileStr =
    profileValue !== undefined && profileValue !== null
      ? String(profileValue).trim()
      : "";
  const legacyStr = legacyValue?.trim() || "";
  const fallbackStr =
    profileFallback !== undefined && profileFallback !== null
      ? String(profileFallback)
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
  const finalRollNo = getFinalValue(
    profileValues.rollNo,
    formData.contactRollNo,
    studentProfile?.userNumber
  );

  const finalName = getFinalValue(
    profileValues.name,
    formData.contactName,
    studentProfile?.fullName
  );

  const finalPhone = getFinalValue(
    profileValues.phone,
    formData.contactPhone,
    studentProfile?.mobile
  );

  // Email: try profile email first, then generate from roll+name, then use student profile email
  const emailFromProfile =
    profileValues.email && String(profileValues.email).trim()
      ? String(profileValues.email).trim()
      : formData.contactEmail?.trim() || "";

  const finalEmail =
    emailFromProfile ||
    generateEmail(finalRollNo, finalName) ||
    studentProfile?.email ||
    "";

  // Extract category-specific fields
  const finalLocation = getFinalValue(
    profileValues.hostel,
    formData.location,
    studentProfile?.hostel
  );

  const finalRoomNumber = getFinalValue(
    profileValues.roomNumber,
    formData.roomNumber,
    studentProfile?.roomNumber
  );

  const finalBatchYear = getFinalValue(
    profileValues.batchYear,
    formData.batchYear,
    studentProfile?.batchYear
  );

  const finalClassSection = getFinalValue(
    profileValues.classSection,
    formData.classSection,
    studentProfile?.classSection
  );

  // Build clean payload
  return {
    categoryId: formData.categoryId,
    subcategoryId: formData.subcategoryId,
    subSubcategoryId: formData.subSubcategoryId || null,
    description: formData.description,
    location: finalLocation || null,
    details: {
      ...formData.details,
      profile: formData.profile || {},
      images: images.length > 0 ? images : undefined,
    },
  };
}
