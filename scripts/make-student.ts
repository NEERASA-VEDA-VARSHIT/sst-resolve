import 'dotenv/config';
import { db, users, roles, student_profiles } from "@/db";
import { eq } from "drizzle-orm";

const CLERK_ID = "user_35jfwc3NCPRHASrnR7SZIcEgcuI";

async function main() {
    console.log(`Converting user ${CLERK_ID} to student...`);

    // 1. Find the student role ID
    const studentRole = await db.query.roles.findFirst({
        where: eq(roles.name, "student"),
    });

    if (!studentRole) {
        console.error("Error: 'student' role not found in database.");
        process.exit(1);
    }

    console.log(`Found student role ID: ${studentRole.id}`);

    // 2. Find the user
    const user = await db.query.users.findFirst({
        where: eq(users.clerk_id, CLERK_ID),
    });

    if (!user) {
        console.error(`Error: User with Clerk ID ${CLERK_ID} not found.`);
        process.exit(1);
    }

    console.log(`Found user: ${user.first_name} ${user.last_name} (ID: ${user.id})`);
    console.log(`Current role ID: ${user.role_id}`);

    // 3. Update the user's role to student
    await db
        .update(users)
        .set({
            role_id: studentRole.id,
            email: "neerasa.24bcs10005@sst.scaler.com"
        })
        .where(eq(users.id, user.id));

    console.log("Successfully updated user role to student.");

    // 4. Check if student profile exists
    const existingProfile = await db.query.student_profiles.findFirst({
        where: eq(student_profiles.user_id, user.id),
    });

    if (existingProfile) {
        // Update existing profile
        await db
            .update(student_profiles)
            .set({
                roll_number: "24bcs10005",
                hostel: "Neeladri",
                room_number: "A2-013",
                section: "A",
                batch: "2028",
                phone: "9391541081",
            })
            .where(eq(student_profiles.user_id, user.id));

        console.log("Updated existing student profile.");
    } else {
        // Create new profile
        await db.insert(student_profiles).values({
            user_id: user.id,
            roll_number: "24bcs10005",
            hostel: "Neeladri",
            room_number: "A2-013",
            section: "A",
            batch: "2028",
            phone: "9391541081",
        });

        console.log("Created new student profile.");
    }

    console.log("\nStudent profile details:");
    console.log("Roll No: 24bcs10005");
    console.log("Name: Neerasa Veda Varshit");
    console.log("Email: neerasa.24bcs10005@sst.scaler.com");
    console.log("Hostel: Neeladri");
    console.log("Room: A2-013");
    console.log("Section: A");
    console.log("Batch: 2028");
    console.log("Phone: 9391541081");

    process.exit(0);
}

main().catch((err) => {
    console.error("Error executing script:", err);
    process.exit(1);
});
