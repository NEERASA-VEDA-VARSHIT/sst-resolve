/**
 * POST /api/superadmin/students/bulk-upload
 * 
 * Bulk upload students via CSV
 * Creates or updates student records based on email (unique identifier)
 * SuperAdmin-only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users, students, hostels, batches, class_sections, roles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";
import { getOrCreateUser } from "@/lib/auth/user-sync";

/**
 * Data cleaning utilities
 */
function capitalize(str: string): string {
	if (!str) return str;
	return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function cleanFullName(name: string): string {
	if (!name) return name;
	// Trim and capitalize each word
	return name
		.trim()
		.split(/\s+/)
		.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

function cleanEmail(email: string): string {
	return email.trim().toLowerCase();
}

function cleanMobile(mobile: string): string {
	// Remove all spaces and non-digit characters
	return mobile.replace(/\D/g, "");
}

/**
 * Master data lookup cache
 * Loaded once at start of CSV processing to avoid N+1 queries
 */
interface MasterDataCache {
	hostels: Map<string, number>; // name (lowercase) -> id
	class_sections: Map<string, number>; // name (uppercase) -> id
	batches: Map<number, number>; // batch_year -> id
}

async function loadMasterDataCache(): Promise<MasterDataCache> {
	const [hostelList, sectionList, batchList] = await Promise.all([
		db.select({
			id: hostels.id,
			name: hostels.name,
			is_active: hostels.is_active,
		}).from(hostels).where(eq(hostels.is_active, true)),
		db.select({
			id: class_sections.id,
			name: class_sections.name,
			is_active: class_sections.is_active,
		}).from(class_sections).where(eq(class_sections.is_active, true)),
		db.select({
			id: batches.id,
			batch_year: batches.batch_year,
			is_active: batches.is_active,
		}).from(batches).where(eq(batches.is_active, true)),
	]);

	return {
		hostels: new Map(hostelList.map(h => [h.name.toLowerCase(), h.id])),
		class_sections: new Map(sectionList.map(cs => [cs.name.toUpperCase(), cs.id])),
		batches: new Map(batchList.map(b => [b.batch_year, b.id])),
	};
}

interface CSVRow {
	email: string;
	full_name: string;
	hostel?: string;
	room_number?: string;
	class_section?: string;
	batch_year?: string;
	mobile?: string;
	blood_group?: string;
	[userDefinedKey: string]: unknown;
}

interface ValidationError {
	row: number;
	field: string;
	message: string;
	value?: unknown;
}

interface UploadResult {
	success: boolean;
	created: number;
	updated: number;
	skipped: number;
	errors: ValidationError[];
	summary: string;
}

/**
 * Validate CSV row data against master tables
 */
function validateRow(row: CSVRow, rowIndex: number, cache: MasterDataCache): ValidationError[] {
	const errors: ValidationError[] = [];

	// Clean data first
	const cleanedEmail = row.email ? cleanEmail(row.email) : "";
	const cleanedName = row.full_name ? cleanFullName(row.full_name) : "";
	const cleanedMobileNum = row.mobile ? cleanMobile(row.mobile) : "";

	// Required fields
	if (!cleanedEmail) {
		errors.push({
			row: rowIndex,
			field: "email",
			message: "Email is required",
			value: row.email,
		});
	} else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
		errors.push({
			row: rowIndex,
			field: "email",
			message: "Invalid email format",
			value: row.email,
		});
	}

	if (!cleanedName) {
		errors.push({
			row: rowIndex,
			field: "full_name",
			message: "Full name is required",
			value: row.full_name,
		});
	}

	// Mobile is required and must be 10 digits
	if (!cleanedMobileNum) {
		errors.push({
			row: rowIndex,
			field: "mobile",
			message: "Mobile number is required",
			value: row.mobile,
		});
	} else if (cleanedMobileNum.length !== 10) {
		errors.push({
			row: rowIndex,
			field: "mobile",
			message: "Mobile must be 10 digits",
			value: row.mobile,
		});
	}

	// Room number is optional in bulk upload; skip required check here.

	// Hostel is required
	if (!row.hostel || !row.hostel.trim()) {
		errors.push({
			row: rowIndex,
			field: "hostel",
			message: "Hostel is required",
			value: row.hostel,
		});
	} else {
		const hostelId = cache.hostels.get(row.hostel.trim().toLowerCase());
		if (!hostelId) {
			const validHostels = Array.from(cache.hostels.keys()).map(h => capitalize(h)).join(", ");
			errors.push({
				row: rowIndex,
				field: "hostel",
				message: `Invalid hostel '${row.hostel}'. Must be one of: ${validHostels}`,
				value: row.hostel,
			});
		}
	}

	// Class section is required
	if (!row.class_section || !row.class_section.trim()) {
		errors.push({
			row: rowIndex,
			field: "class_section",
			message: "Class section is required",
			value: row.class_section,
		});
	} else {
		const sectionId = cache.class_sections.get(row.class_section.trim().toUpperCase());
		if (!sectionId) {
			const validSections = Array.from(cache.class_sections.keys()).join(", ");
			errors.push({
				row: rowIndex,
				field: "class_section",
				message: `Invalid class section '${row.class_section}'. Must be one of: ${validSections}`,
				value: row.class_section,
			});
		}
	}

	// Batch year is required
	if (!row.batch_year || !row.batch_year.trim()) {
		errors.push({
			row: rowIndex,
			field: "batch_year",
			message: "Batch year is required",
			value: row.batch_year,
		});
	} else {
		const year = parseInt(row.batch_year);
		const batchId = cache.batches.get(year);
		if (isNaN(year)) {
			errors.push({
				row: rowIndex,
				field: "batch_year",
				message: "Batch year must be a valid number",
				value: row.batch_year,
			});
		} else if (!batchId) {
			const validBatches = Array.from(cache.batches.keys()).sort().join(", ");
			errors.push({
				row: rowIndex,
				field: "batch_year",
				message: `Invalid batch year '${year}'. Must be one of: ${validBatches}`,
				value: row.batch_year,
			});
		}
	}

	// Blood group is required and must be a valid value
	if (!row.blood_group || !row.blood_group.trim()) {
		errors.push({
			row: rowIndex,
			field: "blood_group",
			message: "Blood group is required",
			value: row.blood_group,
		});
	} else {
		const normalized = row.blood_group.trim().toUpperCase();
		const allowed = new Set([
			"A+",
			"A-",
			"B+",
			"B-",
			"O+",
			"O-",
			"AB+",
			"AB-",
		]);
		if (!allowed.has(normalized)) {
			errors.push({
				row: rowIndex,
				field: "blood_group",
				message: "Blood group must be one of A+, A-, B+, B-, O+, O-, AB+, AB-",
				value: row.blood_group,
			});
		}
	}

	return errors;
}

/**
 * Parse CSV text to array of objects
 */
function parseCSV(csvText: string): CSVRow[] {
	const lines = csvText.trim().split("\n");
	if (lines.length < 2) {
		throw new Error("CSV must have at least a header row and one data row");
	}

	const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
	const rows: CSVRow[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split(",").map((v) => v.trim());
		const row: Record<string, string> = {};

		headers.forEach((header, index) => {
			row[header] = values[index] || "";
		});

		rows.push(row as unknown as CSVRow);
	}

	return rows;
}

export async function POST(request: NextRequest) {
	try {
		const { userId } = await auth();
		if (!userId) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Ensure user is super_admin
		await getOrCreateUser(userId);
		const role = await getUserRoleFromDB(userId);
		if (role !== "super_admin") {
			return NextResponse.json({ error: "Forbidden: Super admin only" }, { status: 403 });
		}

		const formData = await request.formData();
		const file = formData.get("file") as File;

		if (!file) {
			return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
		}

		if (!file.name.endsWith(".csv")) {
			return NextResponse.json({ error: "File must be a CSV" }, { status: 400 });
		}

		// Read file content
		const csvText = await file.text();
		const rows = parseCSV(csvText);

		// Load master data cache for validation and processing
		const masterDataCache = await loadMasterDataCache();

		// Validate all rows
		const allErrors: ValidationError[] = [];
		rows.forEach((row, index) => {
			const rowErrors = validateRow(row, index + 2, masterDataCache); // +2 for header and 1-based indexing
			allErrors.push(...rowErrors);
		});

		// If validation errors, return them
		if (allErrors.length > 0) {
			return NextResponse.json(
				{
					success: false,
					errors: allErrors,
					message: `Validation failed: ${allErrors.length} errors found`,
				},
				{ status: 400 },
			);
		}

		// Process each row
		let created = 0;
		let updated = 0;
		let skipped = 0;
		const processingErrors: ValidationError[] = [];

		for (let i = 0; i < rows.length; i++) {
			const row = rows[i];
			const rowNum = i + 2;

			try {
				// Clean and resolve data to IDs
				const cleanedEmail = cleanEmail(row.email);
				const cleanedData = {
					email: cleanedEmail,
					full_name: cleanFullName(row.full_name),
					hostel_id: masterDataCache.hostels.get(row.hostel!.trim().toLowerCase())!,
					room_number: row.room_number ? row.room_number.trim() : "",
					class_section_id: masterDataCache.class_sections.get(row.class_section!.trim().toUpperCase())!,
					batch_id: masterDataCache.batches.get(parseInt(row.batch_year!))!,
					mobile: row.mobile ? cleanMobile(row.mobile) : "",
					blood_group: row.blood_group!.trim().toUpperCase(),
					roll_no: cleanedEmail.slice(0, 32),
				};

				// Find user by email
				const [existingUser] = await db
					.select()
					.from(users)
					.where(eq(users.email, cleanedData.email))
					.limit(1);

				if (existingUser) {
					// Update user info (only override phone if a mobile number was provided)
					const userUpdate: Partial<typeof users.$inferInsert> = {
						full_name: cleanedData.full_name,
						updated_at: new Date(),
					};
					if (cleanedData.mobile) {
						userUpdate.phone = cleanedData.mobile;
					}
					await db
						.update(users)
						.set(userUpdate)
						.where(eq(users.id, existingUser.id));

					// Check if student record exists
					const [existingStudent] = await db
						.select()
						.from(students)
						.where(eq(students.user_id, existingUser.id))
						.limit(1);

					if (existingStudent) {
						// Update student record
						await db
							.update(students)
							.set({
								roll_no: (existingStudent as { roll_no?: string | null })?.roll_no ?? cleanedData.roll_no,
								room_no: cleanedData.room_number,
								hostel_id: cleanedData.hostel_id,
								class_section_id: cleanedData.class_section_id,
								batch_id: cleanedData.batch_id,
								blood_group: cleanedData.blood_group,
								updated_at: new Date(),
							})
							.where(eq(students.id, existingStudent.id));

						updated++;
					} else {
						// Create student record
						await db.insert(students).values({
							user_id: existingUser.id,
							roll_no: cleanedData.roll_no,
							room_no: cleanedData.room_number,
							hostel_id: cleanedData.hostel_id,
							class_section_id: cleanedData.class_section_id,
							batch_id: cleanedData.batch_id,
							blood_group: cleanedData.blood_group,
						});

						created++;
					}
				} else {
					// User doesn't exist - create both user and student
					// Get student role_id
					const [studentRole] = await db
						.select({ id: roles.id })
						.from(roles)
						.where(eq(roles.name, "student"))
						.limit(1);
					
					if (!studentRole) {
						processingErrors.push({
							row: rowNum,
							field: "role",
							message: "Student role not found in database",
							value: "student",
						});
						continue;
					}

					const [newUser] = await db
						.insert(users)
						.values({
							auth_provider: "manual",
							external_id: `pending_${cleanedData.email}`, // Temporary, will be updated on first login
							email: cleanedData.email,
							full_name: cleanedData.full_name,
							// Phone is NOT NULL in schema; fall back to empty string if missing
							phone: cleanedData.mobile || "",
							role_id: studentRole.id,
						})
						.returning();

					await db.insert(students).values({
						user_id: newUser.id,
						roll_no: cleanedData.roll_no,
						room_no: cleanedData.room_number,
						hostel_id: cleanedData.hostel_id,
						class_section_id: cleanedData.class_section_id,
						batch_id: cleanedData.batch_id,
						blood_group: cleanedData.blood_group,
					});

					created++;
				}
			} catch (error: unknown) {
				console.error(`Error processing row ${rowNum}:`, error);
				const errorMessage = error instanceof Error ? error.message : "Failed to process row";
				processingErrors.push({
					row: rowNum,
					field: "processing",
					message: errorMessage,
				});
				skipped++;
			}
		}

		const result: UploadResult = {
			success: processingErrors.length === 0,
			created,
			updated,
			skipped,
			errors: processingErrors,
			summary: `Created: ${created}, Updated: ${updated}, Skipped: ${skipped}`,
		};

		return NextResponse.json(result, { status: 200 });
	} catch (error: unknown) {
		console.error("Bulk upload error:", error);
		const errorMessage = error instanceof Error ? error.message : "Failed to process upload";
		return NextResponse.json(
			{ error: errorMessage },
			{ status: 500 },
		);
	}
}
