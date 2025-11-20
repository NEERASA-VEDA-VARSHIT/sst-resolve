/**
 * user-sync.ts
 *
 * Production-ready user sync helpers (Clerk -> Postgres via Drizzle)
 *
 * Exports:
 *  - syncUserFromClerk(clerkUserId)
 *  - getOrCreateUser(clerkUserId)
 *  - getUserRole (deprecated wrapper)
 *  - getUserNumber(clerkUserId)
 *
 * Notes:
 *  - Uses clerkClient correctly: clerkClient.users.getUser(...)
 *  - Uses db.transaction(...) for atomicity
 *  - Uses pg_advisory_xact_lock to serialize auto-link on email
 *  - NEVER upserts by email alone (prevents hijacking)
 *  - Idempotent role assignment
 */

import { clerkClient } from "@clerk/nextjs/server";
import { db, users, user_roles, roles as rolesTable } from "@/db";
import { eq, and, sql } from "drizzle-orm";
import { getOrCreateRole, invalidateUserRoleCache } from "@/lib/db-roles";

/* --------------------
   Simple in-process Clerk cache (per-worker)
   -------------------- */
const clerkUserCache = new Map<string, any>();
const CLERK_CACHE_TTL_MS = 60 * 1000; // 60s TTL
const clerkCacheTimestamps = new Map<string, number>();

async function fetchClerkUserCached(clerkUserId: string) {
  const now = Date.now();
  const ts = clerkCacheTimestamps.get(clerkUserId) ?? 0;
  if (clerkUserCache.has(clerkUserId) && now - ts < CLERK_CACHE_TTL_MS) {
    return clerkUserCache.get(clerkUserId);
  }
  const client = await clerkClient();
  const u = await client.users.getUser(clerkUserId);
  clerkUserCache.set(clerkUserId, u);
  clerkCacheTimestamps.set(clerkUserId, now);
  return u;
}

/* --------------------
   Small helpers
   -------------------- */

function normalizeStringOrNull(v: unknown): string | null {
  if (!v && v !== "") return null;
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

function getClerkDisplayName(user: any): string | null {
  const fn = normalizeStringOrNull(user.firstName);
  const ln = normalizeStringOrNull(user.lastName);
  if (fn || ln) return `${fn ?? ""} ${ln ?? ""}`.trim() || null;
  // fallback to username or first email
  return (
    normalizeStringOrNull(user.username) ??
    normalizeStringOrNull(user.emailAddresses?.[0]?.emailAddress)
  );
}

function getPrimaryEmail(user: any): string | null {
  const email = normalizeStringOrNull(user.emailAddresses?.[0]?.emailAddress);
  return email ? email.toLowerCase() : null;
}

function getPrimaryPhone(user: any): string | null {
  return normalizeStringOrNull(user.phoneNumbers?.[0]?.phoneNumber);
}

/* --------------------
   Utilities interacting with DB inside a transaction
   -------------------- */

/**
 * syncUserFromClerk
 * - Ensures a DB user exists for a given clerkUserId.
 * - If user exists (by clerk_id) -> update fields from Clerk.
 * - If user does not exist -> insert new row (clerk_id authoritative).
 * - Assigns "student" role idempotently for newly created users.
 *
 * Returns the DB user record (first column returned by Drizzle queries).
 */
export async function syncUserFromClerk(clerkUserId: string) {
  if (!clerkUserId) {
    throw new Error("syncUserFromClerk requires clerkUserId");
  }

  // Fetch Clerk user once (cached)
  let clerkUser;
  try {
    clerkUser = await fetchClerkUserCached(clerkUserId);
  } catch (err: any) {
    if (err?.status === 404) {
      // Clerk user not found - caller should handle null case
      return null;
    }
    throw err;
  }

  const email = getPrimaryEmail(clerkUser);
  const name = getClerkDisplayName(clerkUser);
  const phone = getPrimaryPhone(clerkUser);

  return await db.transaction(async (tx) => {
    // 1. Try find by clerk_id
    const [existing] = await tx
      .select()
      .from(users)
      .where(eq(users.clerk_id, clerkUserId))
      .limit(1);

    if (existing) {
      // email may be null but fallback is ALWAYS a string
      const safeEmail: string = email ?? existing.email;

      const userData = {
        email: safeEmail,
        name: name ?? existing.name,
        phone: phone ?? existing.phone,
        updated_at: new Date(),
      };

      const [updated] = await tx
        .update(users)
        .set(userData)
        .where(eq(users.id, existing.id))
        .returning();

      const result = updated || existing;

      try {
        invalidateUserRoleCache(result.clerk_id);
      } catch {}

      return result;
    }

    // 2. Insert path
    if (!email) {
      throw new Error(
        `syncUserFromClerk: Cannot create user without email for clerk_id=${clerkUserId}`
      );
    }

    const realEmail: string = email; // <-- TYPE SAFE

    const userDataToInsert = {
      clerk_id: clerkUserId,
      email: realEmail,
      name,
      phone,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const insertResult = await tx
      .insert(users)
      .values(userDataToInsert)
      .onConflictDoNothing()
      .returning();

    let newUser: any;

    if (insertResult.length > 0) {
      newUser = insertResult[0];
    } else {
      const [existingAgain] = await tx
        .select()
        .from(users)
        .where(eq(users.clerk_id, clerkUserId))
        .limit(1);
      if (!existingAgain) {
        throw new Error(
          `User insert conflict but no row found for clerk_id=${clerkUserId}`
        );
      }
      newUser = existingAgain;
    }

    const studentRoleId = await getOrCreateRole("student");

    await tx
      .insert(user_roles)
      .values({
        user_id: newUser.id,
        role_id: studentRoleId,
        created_at: new Date(),
        domain: null,
        scope: null,
        granted_by: null,
      })
      .onConflictDoNothing();

    try {
      invalidateUserRoleCache(clerkUserId);
    } catch {}

    return newUser;
  });
}

/**
 * getOrCreateUser
 *
 * Flow:
 *  1) If DB user exists by clerk_id -> return it
 *  2) Fetch clerk user (cached)
 *  3) Try safe auto-link by email for CSV-imported users (only when existing DB user has no real clerk_id OR clerk_id starts with "pending_")
 *     - Protected: will not auto-link if user has non-student roles
 *     - Uses advisory lock to serialize concurrent auto-link attempts for the same email
 *     - Atomic update guarded by original clerk_id value
 *  4) If auto-link not possible -> call syncUserFromClerk (creates new DB user)
 *
 * Returns DB user or null (if Clerk user not found)
 */
export async function getOrCreateUser(clerkUserId: string) {
  if (!clerkUserId) {
    throw new Error("getOrCreateUser requires clerkUserId");
  }

  // Fast path: existing by clerk_id
  const [existingByClerk] = await db
    .select()
    .from(users)
    .where(eq(users.clerk_id, clerkUserId))
    .limit(1);

  if (existingByClerk) return existingByClerk;

  // Fetch Clerk user (cached)
  let clerkUser;
  try {
    clerkUser = await fetchClerkUserCached(clerkUserId);
  } catch (err: any) {
    if (err?.status === 404) return null;
    throw err;
  }

  const email = getPrimaryEmail(clerkUser);

  // If no email, fall back to sync (which will create by clerk_id)
  if (!email) {
    return await syncUserFromClerk(clerkUserId);
  }

  // Attempt safe auto-link by email
  // Serialize auto-link attempts by email using advisory lock
  return await db
    .transaction(async (tx) => {
      // Acquire advisory lock for this email (hashtext is stable across nodes)
      // We use pg_advisory_xact_lock so lock is held for transaction duration
      // Note: hashtext returns int, safe for advisory lock
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${email}));`);

      const [existingByEmail] = await tx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!existingByEmail) {
        // No candidate to auto-link -> create fresh user via sync (outside this tx to avoid nested tx issues)
        // Commit current tx and create via sync function (which uses its own transaction)
        // But because we are in a tx here, we simply return null to caller to call sync outside:
        // We'll call syncUserFromClerk after this transaction completes (outside)
        return null;
      }

      // If the DB user already has a clerk_id:
      // - If it's equal to desired clerkUserId → return it
      // - If it's a "real" clerk_id (not placeholder) and different → do NOT link
      const currentClerkId = existingByEmail.clerk_id ?? "";

      if (currentClerkId === clerkUserId) {
        return existingByEmail;
      }

      const isPlaceholder =
        !currentClerkId || currentClerkId.startsWith("pending_");

      if (!isPlaceholder) {
        // privileged/real-clerk_id present: do not auto-link
        return existingByEmail;
      }

      // Ensure user is not privileged: fetch roles
      const existingRoles = await tx
        .select({ name: rolesTable.name })
        .from(user_roles)
        .innerJoin(rolesTable, eq(user_roles.role_id, rolesTable.id))
        .where(eq(user_roles.user_id, existingByEmail.id));

      const hasNonStudentRole = existingRoles.some(
        (r: any) => r.name && r.name !== "student"
      );

      if (hasNonStudentRole) {
        // Do not auto-link privileged accounts
        return existingByEmail;
      }

      // Attempt an atomic update: only update clerk_id when it still equals the placeholder value
      const [linked] = await tx
        .update(users)
        .set({
          clerk_id: clerkUserId,
          name: getClerkDisplayName(clerkUser) ?? existingByEmail.name,
          phone: getPrimaryPhone(clerkUser) ?? existingByEmail.phone,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(users.id, existingByEmail.id),
            eq(users.clerk_id, existingByEmail.clerk_id) // guard to ensure atomicity
          )
        )
        .returning();

      if (linked) {
        // Ensure at least "student" role exists for the account
        const roleRows = await tx
          .select()
          .from(user_roles)
          .where(eq(user_roles.user_id, linked.id));

        if (roleRows.length === 0) {
          const roleId = await getOrCreateRole("student");
          await tx
            .insert(user_roles)
            .values({
              user_id: linked.id,
              role_id: roleId,
              domain: null,
              scope: null,
              granted_by: null,
              created_at: new Date(),
            })
            .onConflictDoNothing();
        }

        // Invalidate caches
        try {
          invalidateUserRoleCache(existingByEmail.clerk_id);
          invalidateUserRoleCache(clerkUserId);
        } catch (e) {
          console.warn("[User Sync] invalidateUserRoleCache failed", e);
        }

        return linked;
      }

      // If we failed to link (race), try to read by clerk_id (another process may have linked)
      const [maybeLinked] = await tx
        .select()
        .from(users)
        .where(eq(users.clerk_id, clerkUserId))
        .limit(1);

      if (maybeLinked) return maybeLinked;

      // Could not link inside tx; caller will call syncUserFromClerk
      return null;
    })
    .then(async (maybeUser) => {
      // If the transactional attempt returned a DB user -> return it
      if (maybeUser) return maybeUser;

      // Otherwise, fallback to syncUserFromClerk which will create a fresh DB row with clerk_id authoritative
      return await syncUserFromClerk(clerkUserId);
    });
}

/* ---------------------------
   Deprecated convenience wrappers
   ---------------------------*/

/**
 * getUserRole (deprecated wrapper)
 */
export async function getUserRole(clerkUserId: string): Promise<string | null> {
  try {
    const { getUserRoleFromDB } = await import("@/lib/db-roles");
    return await getUserRoleFromDB(clerkUserId);
  } catch (err) {
    console.error("getUserRole (deprecated) failed:", err);
    return null;
  }
}

/**
 * getUserNumber
 * - Prefers Clerk privateMetadata -> publicMetadata
 */
export async function getUserNumber(
  clerkUserId: string
): Promise<string | null> {
  if (!clerkUserId) return null;
  try {
    const clerkUser = await fetchClerkUserCached(clerkUserId);
    const metadata =
      clerkUser.privateMetadata ?? clerkUser.publicMetadata ?? {};
    return normalizeStringOrNull((metadata as any)?.userNumber) || null;
  } catch (err: any) {
    if (err?.status === 404) return null;
    console.error("getUserNumber failed:", err);
    return null;
  }
}
