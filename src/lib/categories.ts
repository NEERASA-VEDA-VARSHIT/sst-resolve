/**
 * Category Schema Helper Functions
 * Reusable Drizzle-based functions to fetch category-related data
 * with proper type safety and consistent mapping
 */

import { db } from "@/db";
import { 
  categories, 
  subcategories, 
  sub_subcategories,
  category_fields, 
  field_options,
  category_profile_fields 
} from "@/db/schema";
import { eq, and, asc, inArray } from "drizzle-orm";

/**
 * Get all active subcategories for a category
 */
export async function getSubcategories(categoryId: number) {
  return await db
    .select()
    .from(subcategories)
    .where(
      and(
        eq(subcategories.category_id, categoryId),
        eq(subcategories.active, true)
      )
    )
    .orderBy(asc(subcategories.display_order), asc(subcategories.created_at));
}

/**
 * Get a single subcategory by ID
 */
export async function getSubcategoryById(subcategoryId: number, categoryId: number) {
  const [subcategory] = await db
    .select()
    .from(subcategories)
    .where(
      and(
        eq(subcategories.id, subcategoryId),
        eq(subcategories.category_id, categoryId),
        eq(subcategories.active, true)
      )
    )
    .limit(1);
  
  return subcategory;
}

/**
 * Get all sub-subcategories for a subcategory
 */
export async function getSubSubcategories(subcategoryId: number) {
  return await db
    .select()
    .from(sub_subcategories)
    .where(
      and(
        eq(sub_subcategories.subcategory_id, subcategoryId),
        eq(sub_subcategories.active, true)
      )
    )
    .orderBy(asc(sub_subcategories.display_order));
}

/**
 * Get a single sub-subcategory by ID
 */
export async function getSubSubcategoryById(subSubcategoryId: number, subcategoryId: number) {
  const [subSubcategory] = await db
    .select()
    .from(sub_subcategories)
    .where(
      and(
        eq(sub_subcategories.id, subSubcategoryId),
        eq(sub_subcategories.subcategory_id, subcategoryId),
        eq(sub_subcategories.active, true)
      )
    )
    .limit(1);
  
  return subSubcategory;
}

/**
 * Get all sub-subcategories for multiple subcategories
 */
export async function getSubSubcategoriesForSubcategories(subcategoryIds: number[]) {
  if (subcategoryIds.length === 0) return [];
  
  return await db
    .select()
    .from(sub_subcategories)
    .where(
      and(
        inArray(sub_subcategories.subcategory_id, subcategoryIds),
        eq(sub_subcategories.active, true)
      )
    )
    .orderBy(asc(sub_subcategories.display_order));
}

/**
 * Get all fields for a subcategory
 */
export async function getFields(subcategoryId: number) {
  return await db
    .select()
    .from(category_fields)
    .where(eq(category_fields.subcategory_id, subcategoryId))
    .orderBy(asc(category_fields.display_order));
}

/**
 * Get all fields for multiple subcategories
 */
export async function getFieldsForSubcategories(subcategoryIds: number[]) {
  if (subcategoryIds.length === 0) return [];
  
  return await db
    .select()
    .from(category_fields)
    .where(inArray(category_fields.subcategory_id, subcategoryIds))
    .orderBy(asc(category_fields.display_order));
}

/**
 * Get all options for a field
 */
export async function getFieldOptions(fieldId: number) {
  return await db
    .select()
    .from(field_options)
    .where(eq(field_options.field_id, fieldId))
    .orderBy(asc(field_options.display_order));
}

/**
 * Get all options for multiple fields
 */
export async function getFieldOptionsForFields(fieldIds: number[]) {
  if (fieldIds.length === 0) return [];
  
  return await db
    .select()
    .from(field_options)
    .where(inArray(field_options.field_id, fieldIds))
    .orderBy(asc(field_options.display_order));
}

/**
 * Get category profile field configuration
 */
export async function getCategoryProfileFields(categoryId: number) {
  return await db
    .select()
    .from(category_profile_fields)
    .where(eq(category_profile_fields.category_id, categoryId))
    .orderBy(asc(category_profile_fields.display_order));
}

/**
 * Get category by ID
 */
export async function getCategoryById(categoryId: number) {
  const [category] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, categoryId))
    .limit(1);
  
  return category;
}

/**
 * Get complete category schema with all related data
 * (used by API route for caching)
 */
export async function getCategorySchema(categoryId: number) {
  // Fetch category
  const category = await getCategoryById(categoryId);
  if (!category || !category.active) {
    return null;
  }

  // Fetch all subcategories
  const subcategoriesData = await getSubcategories(categoryId);
  
  if (subcategoriesData.length === 0) {
    return {
      category,
      subcategories: [],
    };
  }

  const subcategoryIds = subcategoriesData.map(sc => sc.id);

  // Fetch all sub-subcategories for these subcategories
  const subSubcategoriesData = await getSubSubcategoriesForSubcategories(subcategoryIds);

  // Fetch all fields for these subcategories
  const fieldsData = await getFieldsForSubcategories(subcategoryIds);

  // Fetch all options for select fields
  const selectFieldIds = fieldsData
    .filter(f => f.field_type === "select")
    .map(f => f.id);
  
  const optionsData = selectFieldIds.length > 0 
    ? await getFieldOptionsForFields(selectFieldIds)
    : [];

  // Build the complete schema structure
  const schema = {
    category: {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon,
      color: category.color,
      sla_hours: category.sla_hours,
    },
    subcategories: subcategoriesData.map((subcat) => ({
      id: subcat.id,
      category_id: subcat.category_id,
      name: subcat.name,
      slug: subcat.slug,
      description: subcat.description,
      active: subcat.active,
      display_order: subcat.display_order,
      created_at: subcat.created_at,
      updated_at: subcat.updated_at,
      sub_subcategories: subSubcategoriesData.filter(
        (ssc) => ssc.subcategory_id === subcat.id
      ),
      fields: fieldsData
        .filter((field) => field.subcategory_id === subcat.id)
        .map((field) => ({
          id: field.id,
          subcategory_id: field.subcategory_id,
          name: field.name,
          slug: field.slug,
          field_type: field.field_type,
          required: field.required,
          placeholder: field.placeholder,
          help_text: field.help_text,
          validation_rules: field.validation_rules,
          display_order: field.display_order,
          active: field.active,
          created_at: field.created_at,
          updated_at: field.updated_at,
          options: optionsData.filter((opt) => opt.field_id === field.id),
        })),
    })),
  };

  return schema;
}

// Legacy category tree (deprecated - kept for backward compatibility)
export type CategoryNode = {
  id: string;
  title: string;
  children?: CategoryNode[];
  fields?: { id: string; label: string; type: "text" | "date" | "select"; options?: string[] }[];
};

export const CATEGORY_TREE: CategoryNode[] = [
  {
    id: "hostel",
    title: "Hostel",
    children: [
      {
        id: "hostel_location",
        title: "Choose Hostel",
        children: [
          { id: "hostel_neeladri", title: "Neeladri" },
          { id: "hostel_velankani", title: "Velankani" },
        ],
      },
      {
        id: "hostel_issue",
        title: "Issue Type",
        children: [
          {
            id: "hostel_mess",
            title: "Mess Quality Issues",
            fields: [
              { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
              { id: "date", label: "Date", type: "date" },
              { id: "description", label: "Issue Description", type: "text" },
            ],
          },
          { id: "hostel_leave", title: "Leave Application" },
          {
            id: "hostel_maintenance",
            title: "Maintenance / Housekeeping",
            children: [
              { id: "plumbing", title: "Plumbing" },
              { id: "electrical", title: "Electrical" },
              { id: "painting", title: "Painting" },
              { id: "carpenter", title: "Carpenter" },
              { id: "pantry", title: "Pantry Area" },
            ],
          },
          { id: "hostel_wifi", title: "Wi-Fi Issues" },
          { id: "hostel_room_change", title: "Room Change Request" },
          { id: "hostel_other", title: "Other" },
        ],
      },
    ],
  },
  {
    id: "college",
    title: "College",
    children: [
      {
        id: "college_issue",
        title: "Issue Type",
        children: [
          {
            id: "college_mess",
            title: "Mess Quality Issues",
            children: [
              { 
                id: "college_mess_gsr", 
                title: "GSR",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
              { 
                id: "college_mess_uniworld", 
                title: "Uniworld",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
              { 
                id: "college_mess_tcb", 
                title: "TCB",
                fields: [
                  { id: "meal", label: "Meal", type: "select", options: ["Breakfast", "Lunch", "Dinner"] },
                  { id: "date", label: "Date", type: "date" },
                  { id: "description", label: "Issue Description", type: "text" },
                ],
              },
            ],
          },
          {
            id: "college_maintenance",
            title: "Maintenance / Housekeeping",
            fields: [
              { id: "description", label: "Description", type: "text" },
            ],
          },
          { id: "college_wifi", title: "Wi-Fi Issues" },
          { id: "college_other", title: "Other" },
        ],
      },
    ],
  },
];

export const LOCATIONS = {
  hostel: ["Neeladri", "Velankani"],
};

// Committee subcategories
export const COMMITTEE_SUBCATEGORIES = [
  "Student Welfare (Council)",
  "Mess Committee",
  "Transport",
  "Event",
  "Cultural Club",
  "Sports Club",
] as const;


