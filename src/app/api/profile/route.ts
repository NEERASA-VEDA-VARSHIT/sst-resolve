import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, students, users, hostels, batches, class_sections } from "@/db";
import type { StudentInsert, UserInsert } from "@/db/inferred-types";
import { eq } from "drizzle-orm";
import {
  UpdateStudentMobileSchema,
  UpdateStudentProfileSchema,
} from "@/schemas/business/student";
import { getOrCreateUser } from "@/lib/auth/user-sync";

/* ------------------------------------------------------------
   Reusable function: returns full student profile with joins
-------------------------------------------------------------*/
async function getStudentProfile(dbUserId: string) {
  const [student] = await db
    .select({
      id: students.id,
      user_id: students.user_id,
      room_no: students.room_no,

      hostel_id: students.hostel_id,
      hostel_name: hostels.name,

      class_section_id: students.class_section_id,
      class_section_name: class_sections.name,

      batch_id: students.batch_id,
      batch_year: batches.batch_year,

      blood_group: students.blood_group,
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

    const profile = await getStudentProfile(dbUser.id);

    if (!profile) {
      console.warn(`[GET /api/profile] Student profile not found for user ${dbUser.id} (email: ${dbUser.email}, external_id: ${dbUser.external_id})`);
      return NextResponse.json(
        { error: "Student profile not found", needsLink: true },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      full_name: dbUser.full_name || "",
      email: dbUser.email || "",
      mobile: dbUser.phone || "",
      room_number: profile.room_no || null,

      hostel: profile.hostel_name || null,
      hostel_id: profile.hostel_id || null,

      class_section: profile.class_section_name || null,
      batch_year: profile.batch_year || null,
      blood_group: profile.blood_group || null,
      created_at: profile.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
      updated_at: profile.updated_at ? new Date(profile.updated_at).toISOString() : new Date().toISOString(),
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
       Validate profile updates (hostel_id, room_number)
    ----------------------------*/
    if (hostel_id !== undefined || room_number !== undefined) {
      const profileValidation = UpdateStudentProfileSchema.safeParse({
        hostel_id,
        room_number,
      });
      
      if (!profileValidation.success) {
        return NextResponse.json(
          { 
            error: "Invalid profile data", 
            details: profileValidation.error.issues 
          },
          { status: 400 }
        );
      }
    }

    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

    /* ---------------------------
       Update MOBILE
    ----------------------------*/
    if (mobile !== undefined) {
      const userUpdate: Partial<UserInsert> = {
        phone: mobile.trim(),
        updated_at: new Date(),
      };
      await db
        .update(users)
        .set(userUpdate)
        .where(eq(users.id, dbUser.id));
    }

    /* ---------------------------
       Check if student record exists
    ----------------------------*/
    const existingProfile = await getStudentProfile(dbUser.id);

    /* ---------------------------
       Update STUDENT FIELDS
       ✅ Using drizzle-zod schema for validation and transformation
    ----------------------------*/
    let studentUpdates: Partial<StudentInsert> | null = null;

    if (hostel_id !== undefined || room_number !== undefined) {
      // Validate and transform using drizzle-zod schema (handles field name mapping)
      const profileData = UpdateStudentProfileSchema.parse({
        hostel_id: hostel_id === "" || hostel_id === null ? null : hostel_id,
        room_number,
      });

      studentUpdates = {
        updated_at: new Date(),
      };

      if (profileData.hostel_id !== undefined && profileData.hostel_id !== null) {
        studentUpdates.hostel_id = profileData.hostel_id;
      }

      if (profileData.room_no !== undefined && profileData.room_no !== null && typeof profileData.room_no === 'string') {
        studentUpdates.room_no = profileData.room_no.trim().toUpperCase();
      }
    }

    if (studentUpdates && Object.keys(studentUpdates).length > 1) { // > 1 because updated_at is always present
      if (!existingProfile) {
        // Student record doesn't exist - this shouldn't happen if user was created via admin form
        // But we'll return a helpful error message
        console.error(`[PATCH /api/profile] Student record not found for user ${dbUser.id} (email: ${dbUser.email}, external_id: ${dbUser.external_id})`);
        return NextResponse.json(
          { error: "Student profile not found. Please contact administration to create your student profile." },
          { status: 404 }
        );
      }

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

    if (!profile) {
      console.error(`[PATCH /api/profile] Student profile not found after update for user ${dbUser.id} (email: ${dbUser.email}, external_id: ${dbUser.external_id})`);
      return NextResponse.json(
        { error: "Student profile not found. Please contact administration to create your student profile." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: profile.id,
      full_name: dbUser.full_name || "",
      email: dbUser.email || "",
      mobile: mobile !== undefined ? mobile.trim() : (dbUser.phone || ""),
      room_number: profile.room_no || null,
      hostel: profile.hostel_name || null,
      hostel_id: profile.hostel_id || null,
      class_section: profile.class_section_name || null,
      batch_year: profile.batch_year || null,
      blood_group: profile.blood_group || null,
      created_at: profile.created_at ? new Date(profile.created_at).toISOString() : new Date().toISOString(),
      updated_at: profile.updated_at ? new Date(profile.updated_at).toISOString() : new Date().toISOString(),
    });

  } catch (err) {
    console.error("PATCH /api/profile error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
