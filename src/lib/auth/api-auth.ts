/**
 * API-based Authentication Functions
 * Frontend-only alternatives to database auth functions
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function getUserRole(userId: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/role?userId=${userId}`, {
      cache: 'no-store',
    });
    if (!response.ok) return 'student';
    const data = await response.json();
    return data.role || 'student';
  } catch (error) {
    console.error('[API Auth] Error getting user role:', error);
    return 'student';
  }
}

export async function ensureUser(userId: string): Promise<void> {
  try {
    // Use webhook endpoint or create user endpoint if available
    await fetch(`${API_BASE_URL}/webhooks/clerk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
      cache: 'no-store',
    });
  } catch (error) {
    console.error('[API Auth] Error ensuring user:', error);
  }
}

export async function getRoleFast(userId: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    const response = await fetch(`${API_BASE_URL}/auth/role?userId=${userId}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    return data.role || null;
  } catch {
    return null;
  }
}
