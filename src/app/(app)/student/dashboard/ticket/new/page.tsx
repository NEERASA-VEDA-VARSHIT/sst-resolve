
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, categories, subcategories, sub_subcategories, students, category_fields, category_profile_fields, field_options, hostels } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/user-sync";
import TicketForm from "@/components/student/ticket-form/TicketForm";

export default async function NewTicketPage() {
  const { userId } = await auth();
  if (!userId) redirect("/");

  const dbUser = await getOrCreateUser(userId);
  if (!dbUser) redirect("/");

  // Fetch student row from DB
  const [student] = await db
    .select()
    .from(students)
    .where(eq(students.user_id, dbUser.id))
    .limit(1);

  if (!student) redirect("/student/profile");

  // Fetch hostels to map ID to name
  const hostelsList = await db
    .select()
    .from(hostels)
    .orderBy(asc(hostels.name));

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
    classSection: student.class_section_id ? String(student.class_section_id) : null,
  };

  // Fetch categories
  const categoryList = await db
    .select()
    .from(categories)
    .where(eq(categories.active, true))
    .orderBy(asc(categories.display_order));

  // Fetch subcategories
  const subcategoryList = await db
    .select()
    .from(subcategories)
    .where(eq(subcategories.active, true))
    .orderBy(asc(subcategories.display_order));

  // Fetch sub-subcategories
  const subSubcategoryList = await db
    .select()
    .from(sub_subcategories)
    .where(eq(sub_subcategories.active, true))
    .orderBy(asc(sub_subcategories.display_order));

  // Nest sub-subcategories within their parent subcategories
  const subcategoriesWithSubs = subcategoryList.map(sub => ({
    ...sub,
    sub_subcategories: subSubcategoryList.filter(
      subSub => subSub.subcategory_id === sub.id
    ),
  }));

  // Fetch profile fields
  const categoryProfileFieldsRaw = await db
    .select()
    .from(category_profile_fields)
    .orderBy(asc(category_profile_fields.display_order));
  
  // Map to ProfileFieldConfig format (add storage_key from field_name)
  const categoryProfileFields = categoryProfileFieldsRaw.map(field => ({
    ...field,
    storage_key: field.field_name.toLowerCase().replace(/\s+/g, '_'),
  }));

  // Dynamic fields - no active filtering (hard delete approach)
  const categoryFields = await db
    .select()
    .from(category_fields)
    .orderBy(asc(category_fields.display_order));

  // Field options - no active filtering (hard delete approach)  
  const optionsList = await db
    .select({
      id: field_options.id,
      field_id: field_options.field_id,
      option_label: field_options.label,
      option_value: field_options.value,
      display_order: field_options.display_order,
    })
    .from(field_options)
    .orderBy(asc(field_options.display_order));

  return (
    <TicketForm
      dbUserId={dbUser.id}
      student={normalizedStudent}
      categories={categoryList}
      subcategories={subcategoriesWithSubs}
      profileFields={categoryProfileFields}
      dynamicFields={categoryFields}
      fieldOptions={optionsList}
      hostels={hostelsList}
    />
  );
}
