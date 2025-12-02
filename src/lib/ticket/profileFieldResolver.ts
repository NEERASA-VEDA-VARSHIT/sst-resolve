/**
 * Resolve profile field values using priority system
 * 1. metadata.profile[field_name] (new structure)
 * 2. Student record
 * 3. User record
 */

type StudentRecord = {
  hostel_id: number | null;
  hostel_name: string | null;
  room_no: string | null;
};

type UserRecord = {
  name: string | null;
  email: string | null;
};

type ProfileFieldConfig = {
  field_name: string;
  display_order: number;
  required: boolean;
  editable: boolean;
};

/**
 * Profile field display labels
 */
export const PROFILE_FIELD_LABELS: Record<string, string> = {
  name: "Full Name",
  email: "Email",
  phone: "Phone Number",
  hostel: "Hostel",
  roomNumber: "Room Number",
  batchYear: "Batch Year",
  classSection: "Class Section",
};

/**
 * Resolve a single profile field value
 */
export function resolveProfileFieldValue(
  fieldName: string,
  metadata: Record<string, unknown>,
  studentRecord?: StudentRecord,
  userRecord?: UserRecord
): string | null {
  type ProfileData = Record<string, unknown>;
  const profileData: ProfileData = (metadata?.profile && typeof metadata.profile === 'object' && !Array.isArray(metadata.profile)) 
    ? metadata.profile as ProfileData 
    : {};
  
  // 1. Try metadata.profile first (highest priority - submitted by user)
  if (fieldName in profileData && profileData[fieldName]) {
    return String(profileData[fieldName]);
  }
  
  // 2. Try student table
  if (studentRecord) {
    switch (fieldName) {
      case "hostel":
        // Use hostel_name if available, fallback to hostel_id
        if (studentRecord.hostel_name) return studentRecord.hostel_name;
        if (studentRecord.hostel_id) return String(studentRecord.hostel_id);
        break;
      case "roomNumber":
        if (studentRecord.room_no) return studentRecord.room_no;
        break;
    }
  }
  
  // 3. Try user table
  if (userRecord) {
    switch (fieldName) {
      case "name":
        if (userRecord.name) return userRecord.name;
        break;
      case "email":
        if (userRecord.email) return userRecord.email;
        break;
    }
  }
  
  return null;
}

/**
 * Resolve all profile fields based on configuration
 */
export function resolveProfileFields(
  profileFieldsConfig: ProfileFieldConfig[],
  metadata: Record<string, unknown>,
  studentRecord?: StudentRecord,
  userRecord?: UserRecord
): Array<{ field_name: string; label: string; value: string }> {
  return profileFieldsConfig
    .map(field => {
      const value = resolveProfileFieldValue(
        field.field_name,
        metadata,
        studentRecord,
        userRecord
      );
      
      if (!value) return null;
      
      return {
        field_name: field.field_name,
        label: PROFILE_FIELD_LABELS[field.field_name] || field.field_name,
        value,
      };
    })
    .filter((field): field is { field_name: string; label: string; value: string } => field !== null);
}
