import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db, students, hostels, class_sections, batches } from "@/db";
import { eq, asc } from "drizzle-orm";
import { getCachedUser } from "@/lib/cache/cached-queries";
import { getCategoriesHierarchy } from "@/lib/category/getCategoriesHierarchy";
import TicketForm from "@/components/student/ticket-form/TicketForm";

/**
 * Committee New Ticket Page
 * Note: Auth is handled by committee/layout.tsx
 */
export default async function CommitteeNewTicketPage() {
  // Layout ensures userId exists and user is created via getOrCreateUser
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized"); // TypeScript type guard - layout ensures this never happens

  // Use cached function for better performance (request-scoped deduplication)
  const dbUser = await getCachedUser(userId);

  // Parallelize all database queries for better performance
  const [
    studentDataResult,
    hostelsList,
    categoryHierarchy,
  ] = await Promise.all([
    // Fetch student row from DB (committee members might also be students)
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

    // Fetch full category hierarchy (categories → subcategories → sub-subcategories → fields → options)
    getCategoriesHierarchy(),
  ]);

  const [studentData] = studentDataResult;
  const student = studentData?.student;

  // Find the student's hostel name from ID (if student exists)
  const studentHostel = student?.hostel_id ? hostelsList.find(h => h.id === student.hostel_id) : null;

  // Normalize student - use full_name from schema
  const fullName = dbUser.full_name || "";
  const normalizedStudent = student
    ? {
        userNumber: "",
        fullName: fullName,
        email: dbUser.email || "",
        mobile: dbUser.phone || "",
        hostel: studentHostel?.name || null,
        roomNumber: student.room_no,
        batchYear: studentData.batch_year,
        classSection: studentData.class_section_name || null,
      }
    : {
        userNumber: "",
        fullName: fullName,
        email: dbUser.email || "",
        mobile: dbUser.phone || "",
        hostel: null,
        roomNumber: null,
        batchYear: null,
        classSection: null,
      };

  // Filter to only Committee category
  const committeeCategory = categoryHierarchy.find(
    cat => cat.label.toLowerCase() === "committee" || cat.value.toLowerCase() === "committee"
  );

  if (!committeeCategory) {
    redirect("/committee/dashboard");
  }

  // Flatten hierarchy into shapes expected by TicketForm (only Committee category)
  const categoriesFromHierarchy = [{
    id: committeeCategory.id,
    name: committeeCategory.label,
    slug: committeeCategory.value,
  }];

  const subcategoriesWithSubs = (committeeCategory.subcategories || []).map((sub) => ({
    id: sub.id,
    category_id: committeeCategory.id,
    name: sub.label,
    slug: sub.value,
    display_order: undefined as number | undefined,
    sub_subcategories: (sub.sub_subcategories || []).map((ss) => ({
      id: ss.id,
      subcategory_id: sub.id,
      name: ss.label,
      slug: ss.value,
      display_order: undefined as number | undefined,
    })),
    // Attach fields; TicketForm will further sort/normalize
    fields: (sub.fields || []).map((f) => ({
      id: f.id,
      name: f.name,
      slug: f.slug,
      field_type: f.type,
      required: f.required ?? false,
      placeholder: f.placeholder ?? null,
      help_text: f.help_text ?? null,
      validation_rules: (f.validation_rules || null) as Record<string, unknown> | null,
      display_order: f.display_order ?? 0,
      subcategory_id: sub.id,
      options: (f.options || []).map((opt, index) => ({
        id: index,
        label: opt.label,
        value: opt.value,
      })),
    })),
  }));

  // Flatten dynamic fields for TicketForm (still accepts flat list)
  const mappedCategoryFields = subcategoriesWithSubs.flatMap((sub) => sub.fields || []);

  // Define standard profile fields to show for all tickets
  // These are always shown to help admins contact committee members
  const standardProfileFields = [
    {
      field_name: "name",
      storage_key: "name",
      required: false,
      editable: false,
      display_order: 1,
    },
    {
      field_name: "email",
      storage_key: "email",
      required: false,
      editable: false,
      display_order: 2,
    },
    {
      field_name: "phone",
      storage_key: "phone",
      required: false,
      editable: true,
      display_order: 3,
    },
  ];

  // Add student-specific fields if committee member is also a student
  if (student) {
    standardProfileFields.push(
      {
        field_name: "rollNo",
        storage_key: "rollNo",
        required: false,
        editable: false,
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
      }
    );
  }

  return (
    <TicketForm
      dbUserId={dbUser.id}
      student={normalizedStudent}
      categories={categoriesFromHierarchy as Array<{ id: number; name: string; [key: string]: unknown }>}
      subcategories={subcategoriesWithSubs}
      profileFields={standardProfileFields}
      dynamicFields={mappedCategoryFields}
      fieldOptions={[]} // No longer needed as options are nested in fields
      hostels={hostelsList}
    />
  );
}

