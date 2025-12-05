/**
 * API-based Cache Functions
 * Frontend-only alternatives to database cache functions
 * These functions call backend API endpoints with caching
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

/**
 * Get cached user from API
 * Replaces: getCachedUser
 */
export async function getCachedUser(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('[API Cache] Error getting cached user:', error);
    return null;
  }
}

/**
 * Get cached admin user from API
 * Replaces: getCachedAdminUser
 */
export async function getCachedAdminUser(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/admin/list?userId=${userId}`, {
      next: { revalidate: 60 }, // Cache for 60 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return { dbUser: null, role: null };
    }

    const data = await response.json();
    return {
      dbUser: data.user || null,
      role: data.role || null,
    };
  } catch (error) {
    console.error('[API Cache] Error getting cached admin user:', error);
    return { dbUser: null, role: null };
  }
}

/**
 * Get cached ticket statuses from API
 * Replaces: getCachedTicketStatuses
 */
export async function getCachedTicketStatuses() {
  try {
    const response = await fetch(`${API_BASE_URL}/filters/statuses`, {
      next: { revalidate: 300 }, // Cache for 5 minutes
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.statuses || [];
  } catch (error) {
    console.error('[API Cache] Error getting cached ticket statuses:', error);
    return [];
  }
}

/**
 * Get cached committee tickets from API
 * Replaces: getCachedCommitteeTickets
 */
export async function getCachedCommitteeTickets(userId: string) {
  try {
    const response = await fetch(`${API_BASE_URL}/tickets/admin?userId=${userId}`, {
      next: { revalidate: 30 }, // Cache for 30 seconds
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.tickets || [];
  } catch (error) {
    console.error('[API Cache] Error getting cached committee tickets:', error);
    return [];
  }
}
