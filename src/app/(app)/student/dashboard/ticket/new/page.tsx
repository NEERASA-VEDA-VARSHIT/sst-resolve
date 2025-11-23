
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, categories, subcategories, sub_subcategories, students, category_fields, category_profile_fields, field_options, hostels, class_sections } from "@/db";
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
    categoryProfileFieldsRaw,
    categoryFields,
    optionsList,
  ] = await Promise.all([
    // Fetch student row from DB with class section name
    db
      .select({
        student: students,
        class_section_name: class_sections.name,
      })
      .from(students)
      .leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
      .where(eq(students.user_id, dbUser.id))
      .limit(1),
    
    // Fetch hostels to map ID to name
    db
      .select()
      .from(hostels)
      .orderBy(asc(hostels.name)),
    
    // Fetch categories
    db
      .select()
      .from(categories)
      .where(eq(categories.active, true))
      .orderBy(asc(categories.display_order)),
    
    // Fetch subcategories
    db
      .select()
      .from(subcategories)
      .where(eq(subcategories.active, true))
      .orderBy(asc(subcategories.display_order)),
    
    // Fetch sub-subcategories
    db
      .select()
      .from(sub_subcategories)
      .where(eq(sub_subcategories.active, true))
      .orderBy(asc(sub_subcategories.display_order)),
    
    // Fetch profile fields
    db
      .select()
      .from(category_profile_fields)
      .orderBy(asc(category_profile_fields.display_order)),
    
    // Dynamic fields - no active filtering (hard delete approach)
    db
      .select()
      .from(category_fields)
      .orderBy(asc(category_fields.display_order)),
    
    // Field options - no active filtering (hard delete approach)
    db
      .select({
        id: field_options.id,
        field_id: field_options.field_id,
        option_label: field_options.label,
        option_value: field_options.value,
        display_order: field_options.display_order,
      })
      .from(field_options)
      .orderBy(asc(field_options.display_order)),
  ]);

  const [studentData] = studentDataResult;
  if (!studentData?.student) redirect("/student/profile");

  const student = studentData.student;

  // Find the student's hostel name from ID
  const studentHostel = hostelsList.find(h => h.id === student.hostel_id);

  // Normalize student - FIXED
  // Construct full name from first_name and last_name
  const fullName = [dbUser.first_name, dbUser.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || "";

  const normalizedStudent = {
    userNumber: student.roll_no,
    fullName: fullName,
    email: dbUser.email || "",
    mobile: dbUser.phone || "",
    hostel: studentHostel?.name || null,  // Use hostel name instead of ID
    roomNumber: student.room_no,
    batchYear: student.batch_year,
    classSection: studentData.class_section_name || null,  // Use class section name instead of ID
  };

  // Nest sub-subcategories within their parent subcategories
  const subcategoriesWithSubs = subcategoryList.map(sub => ({
    ...sub,
    sub_subcategories: subSubcategoryList.filter(
      subSub => subSub.subcategory_id === sub.id
    ),
  }));

  // Map to ProfileFieldConfig format (add storage_key from field_name)
  const categoryProfileFields = categoryProfileFieldsRaw.map(field => ({
    ...field,
    storage_key: field.field_name.toLowerCase().replace(/\s+/g, '_'),
  }));

  // Map categoryFields to match DynamicField type
  const mappedCategoryFields = categoryFields.map(field => ({
    id: field.id,
    name: field.name,
    slug: field.slug,
    field_type: field.field_type,
    required: field.required,
    placeholder: field.placeholder,
    help_text: field.help_text,
    validation_rules: field.validation_rules as Record<string, unknown> | null,
    display_order: field.display_order,
    subcategory_id: field.subcategory_id,
    options: optionsList
      .filter(opt => opt.field_id === field.id)
      .map(opt => ({ label: opt.option_label, value: opt.option_value })),
  }));

  return (
    <TicketForm
      dbUserId={dbUser.id}
      student={normalizedStudent}
      categories={categoryList as Array<{ id: number; name: string; [key: string]: unknown }>}
      subcategories={subcategoriesWithSubs}
      profileFields={categoryProfileFields}
      dynamicFields={mappedCategoryFields}
      fieldOptions={optionsList}
      hostels={hostelsList}
    />
  );
}
