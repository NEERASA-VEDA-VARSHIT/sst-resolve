
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, categories, subcategories, sub_subcategories, students, category_fields, field_options, hostels, class_sections, batches } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import TicketForm from "@/components/student/ticket-form/TicketForm";

export default async function NewTicketPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  // Parallelize all database queries for better performance
  const [
    studentDataResult,
    hostelsList,
    categoryList,
    subcategoryList,
    subSubcategoryList,
    categoryFields,
    optionsList,
  ] = await Promise.all([
    // Fetch student row from DB with class section name
    db
      .select({
        student: students,
        class_section_name: class_sections.name,
        batch_year: batches.batch_year,
      })
      .from(students)
      .leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
      .leftJoin(batches, eq(students.batch_id, batches.id))
      .where(eq(students.user_id, dbUser.id))
      .limit(1),
    
    // Fetch hostels to map ID to name (only active hostels)
    db
      .select()
      .from(hostels)
      .where(eq(hostels.is_active, true))
      .orderBy(asc(hostels.name)),
    
    // Fetch categories
    db
      .select()
      .from(categories)
      .where(eq(categories.is_active, true))
      .orderBy(asc(categories.display_order)),
    
    // Fetch subcategories
    db
      .select()
      .from(subcategories)
      .where(eq(subcategories.is_active, true))
      .orderBy(asc(subcategories.display_order)),
    
    // Fetch sub-subcategories
    db
      .select()
      .from(sub_subcategories)
      .where(eq(sub_subcategories.is_active, true))
      .orderBy(asc(sub_subcategories.display_order)),
    
    // Dynamic fields - filter by is_active
    db
      .select()
      .from(category_fields)
      .where(eq(category_fields.is_active, true))
      .orderBy(asc(category_fields.display_order)),
    
    // Field options - filter by is_active, ordered by display_order
    db
      .select({
        id: field_options.id,
        field_id: field_options.field_id,
        option_label: field_options.label,
        option_value: field_options.value,
        display_order: field_options.display_order,
      })
      .from(field_options)
      .where(eq(field_options.is_active, true))
      .orderBy(asc(field_options.display_order), asc(field_options.id)),
  ]);

  const [studentData] = studentDataResult;
  if (!studentData?.student) redirect("/student/profile");

  const student = studentData.student;

  // Find the student's hostel name from ID
  const studentHostel = hostelsList.find(h => h.id === student.hostel_id);

  // Normalize student - use full_name from schema
  const fullName = dbUser.full_name || "";

  const normalizedStudent = {
    userNumber: student.roll_no,
    fullName: fullName,
    email: dbUser.email || "",
    mobile: dbUser.phone || "",
    hostel: studentHostel?.name || null,  // Use hostel name instead of ID
    roomNumber: student.room_no,
    batchYear: studentData.batch_year,
    classSection: studentData.class_section_name || null,  // Use class section name instead of ID
  };

  // Nest sub-subcategories within their parent subcategories
  const subcategoriesWithSubs = subcategoryList.map(sub => ({
    ...sub,
    display_order: sub.display_order ?? undefined,
    sub_subcategories: subSubcategoryList.filter(
      subSub => subSub.subcategory_id === sub.id
    ).map(subSub => ({
      ...subSub,
      display_order: subSub.display_order ?? undefined,
    })),
  }));

  // Map categoryFields to match DynamicField type
  const mappedCategoryFields = categoryFields.map(field => {
    // Get options for this field, preserving display_order from database
    const fieldOptions = optionsList
      .filter(opt => opt.field_id === field.id && opt.option_value && opt.option_value.trim() !== "")
      .map((opt) => ({ 
        id: opt.id, // Include id for unique key generation
        label: opt.option_label || opt.option_value, 
        value: opt.option_value,
        display_order: opt.display_order || 0, // Preserve display_order for sorting
      }));
    
    // Deduplicate options by ID first (prefer options with IDs), then by value+label combination
    // This ensures we don't lose options that have the same value but different labels
    const seen = new Set<string>();
    const uniqueOptions = fieldOptions.filter(opt => {
      // Create a unique key from ID (if available) or value+label combination
      const key = opt.id ? `id:${opt.id}` : `val:${opt.value}|label:${opt.label}`;
      if (seen.has(key)) {
        return false; // Skip duplicate
      }
      seen.add(key);
      return true;
    });
    
    // Sort by display_order (from database), then by id, then by label
    const sortedOptions = [...uniqueOptions].sort((a, b) => {
      // First, sort by display_order
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      // Then by ID if both have IDs
      if (a.id && b.id) return a.id - b.id;
      // Finally, sort by label alphabetically
      return (a.label || '').localeCompare(b.label || '');
    });
    
    return {
      id: field.id,
      name: field.name,
      slug: field.slug,
      field_type: field.field_type,
      required: field.required ?? false,
      placeholder: field.placeholder,
      help_text: field.help_text,
      validation_rules: field.validation_rules as Record<string, unknown> | null,
      display_order: field.display_order ?? 0,
      subcategory_id: field.subcategory_id,
      options: sortedOptions,
    };
  });

  // Define standard profile fields to show for all tickets
  // These are always shown to help admins contact students
  const standardProfileFields = [
    {
      field_name: "rollNo",
      storage_key: "rollNo",
      required: false,
      editable: false,
      display_order: 1,
    },
    {
      field_name: "name",
      storage_key: "name",
      required: false,
      editable: false,
      display_order: 2,
    },
    {
      field_name: "email",
      storage_key: "email",
      required: false,
      editable: false,
      display_order: 3,
    },
    {
      field_name: "phone",
      storage_key: "phone",
      required: false,
      editable: true,
      display_order: 4,
    },
    {
      field_name: "hostel",
      storage_key: "hostel",
      required: false,
      editable: true,
      display_order: 5,
    },
    {
      field_name: "roomNumber",
      storage_key: "roomNumber",
      required: false,
      editable: true,
      display_order: 6,
    },
    {
      field_name: "batchYear",
      storage_key: "batchYear",
      required: false,
      editable: false,
      display_order: 7,
    },
    {
      field_name: "classSection",
      storage_key: "classSection",
      required: false,
      editable: false,
      display_order: 8,
    },
  ];

  return (
    <TicketForm
      dbUserId={dbUser.id}
      student={normalizedStudent}
      categories={categoryList as Array<{ id: number; name: string; [key: string]: unknown }>}
      subcategories={subcategoriesWithSubs}
      profileFields={standardProfileFields}
      dynamicFields={mappedCategoryFields}
      fieldOptions={optionsList}
      hostels={hostelsList}
    />
  );
}
