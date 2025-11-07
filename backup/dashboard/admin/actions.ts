"use server";

import { auth } from "@clerk/nextjs/server";
import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import type { Roles } from "@/types/globals";

export async function setRole(formData: FormData) {
	const { sessionClaims } = await auth();

	if (sessionClaims?.metadata?.role !== "admin" && sessionClaims?.metadata?.role !== "super_admin") {
		throw new Error("Not authorized");
	}

	const client = await clerkClient();
	const id = formData.get("id") as string;
	const role = formData.get("role") as Roles;

	try {
		await client.users.updateUser(id, {
			publicMetadata: {
				role: role,
			},
		});

		revalidatePath("/dashboard/admin");
		revalidatePath("/dashboard/superadmin");
	} catch (error) {
		throw new Error("Failed to set role");
	}
}

export async function removeRole(formData: FormData) {
	const { sessionClaims } = await auth();

	if (sessionClaims?.metadata?.role !== "admin" && sessionClaims?.metadata?.role !== "super_admin") {
		throw new Error("Not authorized");
	}

	const client = await clerkClient();
	const id = formData.get("id") as string;

	try {
		await client.users.updateUser(id, {
			publicMetadata: {
				role: null,
			},
		});

		revalidatePath("/dashboard/admin");
		revalidatePath("/dashboard/superadmin");
	} catch (error) {
		throw new Error("Failed to remove role");
	}
}
