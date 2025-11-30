import { NextResponse } from "next/server";
import { db, hostels } from "@/db";
import { eq, asc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: hostels.id,
        name: hostels.name,
        is_active: hostels.is_active,
        created_at: hostels.created_at,
      })
      .from(hostels)
      .where(eq(hostels.is_active, true))
      .orderBy(asc(hostels.name));       // Sort alphabetically

    return NextResponse.json(rows);
  } catch (error) {
    console.error("Error fetching hostels:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
