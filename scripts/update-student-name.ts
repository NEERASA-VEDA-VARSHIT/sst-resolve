/**
 * Update Student Name Script
 * Updates student name for Roll No: 24bcs10005
 * Name: Neerasa Vedavarshit
 */

import { db } from "../src/db/index.js";
import { students, users } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

async function updateStudentName() {
  try {
    console.log("Looking for student with roll no: 24bcs10005...");

    // Find student by roll number
    const [student] = await db
      .select({
        student_id: students.id,
        user_id: students.user_id,
        roll_no: students.roll_no,
        email: users.email,
        first_name: users.first_name,
        last_name: users.last_name,
      })
      .from(students)
      .innerJoin(users, eq(students.user_id, users.id))
      .where(eq(students.roll_no, "24bcs10005"))
      .limit(1);

    if (!student) {
      console.error("❌ Student not found with roll no: 24bcs10005");
      process.exit(1);
    }

    console.log("\n📋 Current student details:");
    console.log(`  Student ID: ${student.student_id}`);
    console.log(`  User ID: ${student.user_id}`);
    console.log(`  Roll No: ${student.roll_no}`);
    console.log(`  Email: ${student.email}`);
    console.log(`  First Name: ${student.first_name || "(empty)"}`);
    console.log(`  Last Name: ${student.last_name || "(empty)"}`);

    // Update user record
    console.log("\n🔄 Updating student name...");
    const [updatedUser] = await db
      .update(users)
      .set({
        first_name: "Neerasa",
        last_name: "Vedavarshit",
        updated_at: new Date(),
      })
      .where(eq(users.id, student.user_id))
      .returning();

    console.log("\n✅ Student name updated successfully!");
    console.log("\n📋 Updated student details:");
    console.log(`  First Name: ${updatedUser.first_name}`);
    console.log(`  Last Name: ${updatedUser.last_name}`);
    console.log(`  Full Name: ${[updatedUser.first_name, updatedUser.last_name].filter(Boolean).join(' ')}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error updating student:", error);
    process.exit(1);
  }
}

updateStudentName();

