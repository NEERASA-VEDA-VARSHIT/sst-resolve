import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, students, users, hostels, batches, class_sections } from "@/db";
import { eq } from "drizzle-orm";
import { UpdateStudentMobileSchema } from "@/schema/student.schema";
import { getOrCreateUser } from "@/lib/user-sync";

/* ------------------------------------------------------------
   Reusable function: returns full student profile with joins
-------------------------------------------------------------*/
async function getStudentProfile(dbUserId: string) {
  const [student] = await db
    .select({
      id: students.id,
      user_id: students.user_id,
      roll_no: students.roll_no,
      room_no: students.room_no,

      hostel_id: students.hostel_id,
      hostel_name: hostels.name,

      class_section_id: students.class_section_id,
      class_section_name: class_sections.name,

      batch_id: students.batch_id,
      batch_year: batches.batch_year,
      batch_year_direct: students.batch_year,

      department: students.department,
      active: students.active,
      source: students.source,
      last_synced_at: students.last_synced_at,
      created_at: students.created_at,
      updated_at: students.updated_at,
    })
    .from(students)
    .leftJoin(hostels, eq(students.hostel_id, hostels.id))
    .leftJoin(class_sections, eq(students.class_section_id, class_sections.id))
    .leftJoin(batches, eq(students.batch_id, batches.id))
    .where(eq(students.user_id, dbUserId))
    .limit(1);

  return student;
}

/* ------------------------------------------------------------
    GET — Fetch student profile
-------------------------------------------------------------*/
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const userNumber = (clerkUser.publicMetadata as any)?.userNumber;

    const profile = await getStudentProfile(dbUser.id);

    if (!profile) {
      return NextResponse.json(
        { error: "Student profile not found", needsLink: true, userNumber },
        { status: 404 }
      );
    }

    // Construct full name from first_name and last_name
    const full_name = [dbUser.first_name, dbUser.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    return NextResponse.json({
      id: profile.id,
      user_number: profile.roll_no,
      full_name: full_name,
      email: dbUser.email,
      mobile: dbUser.phone,
      room_number: profile.room_no,

      hostel: profile.hostel_name,
      hostel_id: profile.hostel_id,

      class_section: profile.class_section_name,
      batch_year: profile.batch_year || profile.batch_year_direct,
      department: profile.department,
      active: profile.active,
      source: profile.source,
      last_synced_at: profile.last_synced_at,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });

  } catch (err) {
    console.error("GET /api/profile error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/* ------------------------------------------------------------
    PATCH — Update mobile, hostel_id, room_number
-------------------------------------------------------------*/
export async function PATCH(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { mobile, hostel_id, room_number } = body;

    /* ---------------------------
       Validate mobile (if sent)
    ----------------------------*/
    if (mobile !== undefined) {
      const validation = UpdateStudentMobileSchema.safeParse({ mobile });
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid mobile number", details: validation.error.issues },
          { status: 400 }
        );
      }
    }

    /* ---------------------------
       Validate room number
    ----------------------------*/
    if (room_number !== undefined && !room_number.trim()) {
      return NextResponse.json(
        { error: "Room number cannot be empty" },
        { status: 400 }
      );
    }

    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    /* ---------------------------
       Update MOBILE
    ----------------------------*/
    if (mobile !== undefined) {
      await db
        .update(users)
        .set({
          phone: mobile.trim(),
          updated_at: new Date(),
        })
        .where(eq(users.id, dbUser.id));
    }

    /* ---------------------------
       Update STUDENT FIELDS
    ----------------------------*/
    const studentUpdates: any = {};

    if (hostel_id !== undefined) {
      studentUpdates.hostel_id =
        hostel_id === "" || hostel_id === null ? null : hostel_id;
    }

    if (room_number !== undefined) {
      studentUpdates.room_no = room_number.trim();
    }

    if (Object.keys(studentUpdates).length > 0) {
      studentUpdates.updated_at = new Date();

      await db
        .update(students)
        .set(studentUpdates)
        .where(eq(students.user_id, dbUser.id));
    }

    /* ---------------------------
       Return updated profile
    ----------------------------*/
    const profile = await getStudentProfile(dbUser.id);

    if (!profile)
      return NextResponse.json({ error: "Student profile not found" }, { status: 404 });

    // Construct full name from first_name and last_name
    const full_name = [dbUser.first_name, dbUser.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || null;

    return NextResponse.json({
      id: profile.id,
      user_number: profile.roll_no,
      full_name: full_name,
      email: dbUser.email,
      mobile: mobile !== undefined ? mobile.trim() : dbUser.phone,
      room_number: profile.room_no,
      hostel: profile.hostel_name,
      hostel_id: profile.hostel_id,
      class_section: profile.class_section_name,
      batch_year: profile.batch_year || profile.batch_year_direct,
      department: profile.department,
      active: profile.active,
      source: profile.source,
      last_synced_at: profile.last_synced_at,
      created_at: profile.created_at,
      updated_at: profile.updated_at,
    });

  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
