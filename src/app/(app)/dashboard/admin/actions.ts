"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function setRole(formData: FormData) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const role = (sessionClaims as any)?.metadata?.role;
  if (role !== "super_admin") throw new Error("Forbidden");

  const targetId = String(formData.get("id") || "");
  const targetRole = String(formData.get("role") || "");
  if (!targetId || !["student", "admin", "super_admin", "committee"].includes(targetRole)) {
    throw new Error("Invalid payload");
  }

  const client = await clerkClient();
  await client.users.updateUser(targetId, {
    publicMetadata: { role: targetRole },
  });

  revalidatePath("/superadmin/dashboard");
}

export async function removeRole(formData: FormData) {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const role = (sessionClaims as any)?.metadata?.role;
  if (role !== "super_admin") throw new Error("Forbidden");

  const targetId = String(formData.get("id") || "");
  if (!targetId) throw new Error("Invalid payload");

  const client = await clerkClient();
  await client.users.updateUser(targetId, {
    publicMetadata: { role: undefined },
  });

  revalidatePath("/superadmin/dashboard");
}


