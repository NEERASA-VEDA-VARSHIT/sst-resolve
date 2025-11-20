import { NextResponse } from "next/server";
import { db, hostels } from "@/db";
import { asc } from "drizzle-orm";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: hostels.id,
        name: hostels.name,
      })
      .from(hostels)
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
