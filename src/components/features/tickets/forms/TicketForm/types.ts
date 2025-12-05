/**
 * Type definitions for TicketForm component
 */

export type StudentProfile = {
  fullName: string;
  email: string;
  mobile: string;
  hostel: string | null;
  roomNumber: string | null;
  batchYear: number | null;
  classSection: string | null;
};

export type Category = {
  id: number;
  name: string;
  slug?: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  sla_hours?: number | null;
  display_order?: number | null;
};

export type DynamicField = {
  id: number;
  name: string;
  slug: string;
  field_type: string;
  required: boolean;
  placeholder: string | null;
  help_text: string | null;
  validation_rules?: Record<string, unknown> | null;
  display_order: number;
  subcategory_id?: number;
  options?: Array<{ label: string; value: string }>;
};

export type Subcategory = {
  id: number;
  category_id?: number;
  name: string;
  slug?: string;
  description?: string | null;
  fields?: DynamicField[];
  display_order?: number;
};

export type ProfileFieldConfig = {
  id?: number;
  category_id?: number;
  field_name: string;
  storage_key: string;
  required: boolean;
  editable: boolean;
  display_order: number;
};

export type TicketFormProps = {
  dbUserId: string;
  student: Partial<StudentProfile> | null;
  categories: Category[];
  subcategories: Subcategory[];
  profileFields: ProfileFieldConfig[];
  dynamicFields: DynamicField[];
  fieldOptions: { id: number; option_label: string; option_value: string; field_id: number }[];
  hostels?: Array<{ id: number; name: string }>;
};

export type TicketFormState = {
  categoryId: number | null;
  subcategoryId: number | null;
  description: string;
  details: Record<string, unknown>;
  profile: Record<string, string>;
};

export type CategorySchema = {
  category: Category;
  subcategories: Subcategory[];
  profileFields: ProfileFieldConfig[];
};

export type FieldRules = {
  dependsOn?: string;
  showWhenValue?: string | string[];
  hideWhenValue?: string | string[];
  requiredWhenValue?: string | string[];
  multiSelect?: boolean;
};
