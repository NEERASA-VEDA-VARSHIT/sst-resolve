import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db, tickets, ticket_groups, categories, ticket_statuses, committees } from "@/db";
import { eq, inArray, desc } from "drizzle-orm";
import { getOrCreateUser } from "@/lib/auth/user-sync";
import { getUserRoleFromDB } from "@/lib/auth/db-roles";

const toValidDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const serializeDate = (value: unknown): string | null => {
  const date = toValidDate(value);
  return date ? date.toISOString() : null;
};

type SerializedTicket = {
  id: number;
  status: string | null;
  category_name: string | null;
  description: string | null;
  location: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: unknown;
  resolution_due_at: string | null;
};

/**
 * ============================================
 * /api/tickets/groups
 * ============================================
 * 
 * POST → Create Ticket Group
 *   - Auth: Required (Admin only)
 *   - Group multiple tickets together for bulk management
 *   - Body: { name: string, ticketIds: number[], description: string (optional) }
 *   - Use Case: Handle related tickets together (e.g., hostel-wide issue)
 *   - Returns: 201 Created with group object
 * 
 * GET → List Ticket Groups
 *   - Auth: Required (Admin only)
 *   - List all ticket groups with ticket counts
 *   - Returns: 200 OK with array of groups
 * ============================================
 */

// POST - Create a new ticket group and add tickets to it
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can create ticket groups" }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, ticketIds } = body;

    if (!name || !ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return NextResponse.json({ error: "Group name and at least one ticket ID are required" }, { status: 400 });
    }

    // Ensure user exists in database
    const dbUser = await getOrCreateUser(userId);
    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create the group
    const [newGroup] = await db
      .insert(ticket_groups)
      .values({
        name,
        description: description || null,
        created_by: dbUser.id,
      })
      .returning();

    if (!newGroup) {
      return NextResponse.json({ error: "Failed to create group" }, { status: 500 });
    }

    // Add tickets to the group
    await db
      .update(tickets)
      .set({ group_id: newGroup.id })
      .where(inArray(tickets.id, ticketIds));

    // Fetch updated tickets
    const updatedTickets = await db
      .select()
      .from(tickets)
      .where(inArray(tickets.id, ticketIds));

    return NextResponse.json({
      group: newGroup,
      tickets: updatedTickets,
    }, { status: 201 });
  } catch (error) {
    console.error("Error creating ticket group:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// GET - Get all ticket groups with their tickets
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure user exists in database
    await getOrCreateUser(userId);

    // Get role from database (single source of truth)
    const role = await getUserRoleFromDB(userId);
    
    if (role !== "admin" && role !== "super_admin") {
      return NextResponse.json({ error: "Only admins and super admins can view ticket groups" }, { status: 403 });
    }

    // Fetch groups first, then fetch committees separately to avoid nested object issues
    const groups = await db
      .select({
        id: ticket_groups.id,
        name: ticket_groups.name,
        description: ticket_groups.description,
        created_by: ticket_groups.created_by,
        committee_id: ticket_groups.committee_id,
        is_archived: ticket_groups.is_archived,
        created_at: ticket_groups.created_at,
        updated_at: ticket_groups.updated_at,
      })
      .from(ticket_groups)
      .orderBy(desc(ticket_groups.is_archived), desc(ticket_groups.created_at));

    // Safety check
    if (!Array.isArray(groups)) {
      console.error("Groups is not an array:", groups);
      return NextResponse.json({ groups: [], stats: { totalGroups: 0, activeGroups: 0, archivedGroups: 0, totalTicketsInGroups: 0 } });
    }

    // Fetch committees for groups that have committee_id
    const committeeIds = groups
      .map(g => g.committee_id)
      .filter((id): id is number => id !== null && id !== undefined);
    
    const committeesMap = new Map<number, { id: number; name: string; description: string | null }>();
    if (committeeIds.length > 0) {
      const committeeRecords = await db
        .select({
          id: committees.id,
          name: committees.name,
          description: committees.description,
        })
        .from(committees)
        .where(inArray(committees.id, committeeIds));
      
      committeeRecords.forEach(c => {
        committeesMap.set(c.id, c);
      });
    }

    // Fetch tickets for each group with category and status information
    const groupsWithTickets = await Promise.all(
      groups.map(async (group) => {
        try {
          const groupTickets = await db
            .select({
              id: tickets.id,
              status_id: tickets.status_id,
              status_value: ticket_statuses.value,
              category_id: tickets.category_id,
              category_name: categories.name,
              description: tickets.description,
              location: tickets.location,
              created_at: tickets.created_at,
              updated_at: tickets.updated_at,
              metadata: tickets.metadata,
              resolution_due_at: tickets.resolution_due_at,
            })
            .from(tickets)
            .leftJoin(categories, eq(tickets.category_id, categories.id))
            .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
            .where(eq(tickets.group_id, group.id));
          
          const committee = group.committee_id ? committeesMap.get(group.committee_id) || null : null;
          
          return {
            id: group.id,
            name: group.name || null,
            description: group.description || null,
            created_by: group.created_by || null,
            committee_id: group.committee_id || null,
            is_archived: group.is_archived || false,
            created_at: serializeDate(group.created_at),
            updated_at: serializeDate(group.updated_at),
            committee: committee ? {
              id: committee.id,
              name: committee.name || null,
              description: committee.description || null,
            } : null,
            tickets: Array.isArray(groupTickets) ? groupTickets.map(t => {
              try {
                return {
                  id: t.id,
                  status: t.status_value || null,
                  category_name: t.category_name || null,
                  description: t.description || null,
                  location: t.location || null,
                  created_at: (() => {
                    try {
                      if (!t.created_at) return null;
                      if (t.created_at instanceof Date) {
                        return isNaN(t.created_at.getTime()) ? null : t.created_at.toISOString();
                      }
                      if (typeof t.created_at === 'string') {
                        const date = new Date(t.created_at);
                        return isNaN(date.getTime()) ? null : date.toISOString();
                      }
                      const date = new Date(t.created_at);
                      return isNaN(date.getTime()) ? null : date.toISOString();
                    } catch {
                      return null;
                    }
                  })(),
                  updated_at: (() => {
                    try {
                      if (!t.updated_at) return null;
                      if (t.updated_at instanceof Date) {
                        return isNaN(t.updated_at.getTime()) ? null : t.updated_at.toISOString();
                      }
                      if (typeof t.updated_at === 'string') {
                        const date = new Date(t.updated_at);
                        return isNaN(date.getTime()) ? null : date.toISOString();
                      }
                      const date = new Date(t.updated_at);
                      return isNaN(date.getTime()) ? null : date.toISOString();
                    } catch {
                      return null;
                    }
                  })(),
                  metadata: (() => {
                    try {
                      if (!t.metadata) return null;
                      if (typeof t.metadata === 'string') {
                        try {
                          return JSON.parse(t.metadata);
                        } catch {
                          return null;
                        }
                      }
                      if (typeof t.metadata === 'object' && t.metadata !== null) {
                        // Deep clone to avoid issues with Date objects or circular references
                        // First check if it's a plain object
                        if (t.metadata.constructor === Object || Object.getPrototypeOf(t.metadata) === null) {
                          try {
                            const stringified = JSON.stringify(t.metadata);
                            return JSON.parse(stringified);
                          } catch {
                            return null;
                          }
                        }
                        // If it's not a plain object, try to convert it
                        try {
                          return JSON.parse(JSON.stringify(t.metadata, (_key, value) => {
                                                                            if (value instanceof Date) {
                                                                              return value.toISOString();
                                                                            }
                                                                            if (value === undefined) {
                                                                              return null;
                                                                            }
                                                                            return value;
                                                                          }));
                        } catch {
                          return null;
                        }
                      }
                      return null;
                    } catch (e) {
                      console.error("Error parsing metadata for ticket:", t.id, e);
                      return null;
                    }
                  })(),
                  resolution_due_at: (() => {
                    try {
                      if (!t.resolution_due_at) return null;
                      if (t.resolution_due_at instanceof Date) {
                        return isNaN(t.resolution_due_at.getTime()) ? null : t.resolution_due_at.toISOString();
                      }
                      if (typeof t.resolution_due_at === 'string') {
                        const date = new Date(t.resolution_due_at);
                        return isNaN(date.getTime()) ? null : date.toISOString();
                      }
                      const date = new Date(t.resolution_due_at);
                      return isNaN(date.getTime()) ? null : date.toISOString();
                    } catch {
                      return null;
                    }
                  })(),
                };
              } catch (err) {
                console.error("Error serializing ticket:", t.id, err);
                return {
                  id: t.id,
                  status: null,
                  category_name: null,
                  description: null,
                  location: null,
                  created_at: null,
                  updated_at: null,
                  metadata: null,
                  resolution_due_at: null,
                };
              }
            }) : [],
            ticketCount: Array.isArray(groupTickets) ? groupTickets.length : 0,
          };
        } catch (err) {
          console.error("Error processing group:", group.id, err);
          return {
            id: group.id,
            name: group.name || null,
            description: group.description || null,
            created_by: group.created_by || null,
            committee_id: group.committee_id || null,
            is_archived: group.is_archived || false,
            created_at: null,
            updated_at: null,
            committee: null,
            tickets: [],
            ticketCount: 0,
          };
        }
      })
    );

    // Calculate stats
    const totalGroups = groups.length;
    const activeGroups = groups.filter(g => !g.is_archived).length;
    const archivedGroups = groups.filter(g => g.is_archived).length;
    const totalTicketsInGroups = groupsWithTickets.reduce((sum, g) => sum + g.ticketCount, 0);

    // Ensure all data is serializable - avoid spreading to prevent issues with Date objects
    const serializableGroups = groupsWithTickets.map(g => {
      try {
        const created_at = serializeDate(g.created_at);
        const updated_at = serializeDate(g.updated_at);
        
        // Safely serialize committee
        let committee: { id: number; name: string | null; description: string | null } | null = null;
        if (g.committee) {
          try {
            committee = {
              id: typeof g.committee.id === 'number' ? g.committee.id : 0,
              name: typeof g.committee.name === 'string' ? g.committee.name : null,
              description: typeof g.committee.description === 'string' ? g.committee.description : null,
            };
          } catch (e) {
            console.error("Error serializing committee for group:", g.id, e);
          }
        }
        
        // Safely serialize tickets array
        let tickets: SerializedTicket[] = [];
        if (Array.isArray(g.tickets)) {
          try {
            tickets = g.tickets.map(t => {
              // Ensure ticket is a plain object
              if (t && typeof t === 'object') {
                return {
                  id: typeof t.id === 'number' ? t.id : 0,
                  status: typeof t.status === 'string' ? t.status : null,
                  category_name: typeof t.category_name === 'string' ? t.category_name : null,
                  description: typeof t.description === 'string' ? t.description : null,
                  location: typeof t.location === 'string' ? t.location : null,
                  created_at: typeof t.created_at === 'string' ? t.created_at : null,
                  updated_at: typeof t.updated_at === 'string' ? t.updated_at : null,
                  metadata: (() => {
                    try {
                      if (!t.metadata) return null;
                      if (typeof t.metadata === 'string') {
                        try {
                          return JSON.parse(t.metadata);
                        } catch {
                          return null;
                        }
                      }
                      if (typeof t.metadata === 'object' && t.metadata !== null) {
                        if (t.metadata.constructor === Object || Object.getPrototypeOf(t.metadata) === null) {
                          try {
                            return JSON.parse(JSON.stringify(t.metadata, (_key, value) => {
                              if (value instanceof Date) return value.toISOString();
                              if (value === undefined) return null;
                              return value;
                            }));
                          } catch {
                            return null;
                          }
                        }
                        try {
                          return JSON.parse(JSON.stringify(t.metadata, (_key, value) => {
                            if (value instanceof Date) return value.toISOString();
                            if (value === undefined) return null;
                            return value;
                          }));
                        } catch {
                          return null;
                        }
                      }
                      return null;
                    } catch {
                      return null;
                    }
                  })(),
                  resolution_due_at: typeof t.resolution_due_at === 'string' ? t.resolution_due_at : null,
                };
              }
              return null;
            }).filter(t => t !== null);
          } catch (e) {
            console.error("Error serializing tickets for group:", g.id, e);
          }
        }
        
        return {
          id: typeof g.id === 'number' ? g.id : 0,
          name: typeof g.name === 'string' ? g.name : null,
          description: typeof g.description === 'string' ? g.description : null,
          created_by: typeof g.created_by === 'string' ? g.created_by : null,
          committee_id: typeof g.committee_id === 'number' ? g.committee_id : null,
          is_archived: typeof g.is_archived === 'boolean' ? g.is_archived : false,
          created_at,
          updated_at,
          committee,
          tickets,
          ticketCount: typeof g.ticketCount === 'number' ? g.ticketCount : 0,
        };
      } catch (err) {
        console.error("Error serializing group:", g.id, err);
        if (err instanceof Error) {
          console.error("Error details:", err.message, err.stack);
        }
        return {
          id: typeof g.id === 'number' ? g.id : 0,
          name: typeof g.name === 'string' ? g.name : null,
          description: typeof g.description === 'string' ? g.description : null,
          created_by: null,
          committee_id: null,
          is_archived: false,
          created_at: null,
          updated_at: null,
          committee: null,
          tickets: [],
          ticketCount: 0,
        };
      }
    });

    // Final validation - ensure everything is JSON serializable
    const finalGroups = serializableGroups.map(g => {
      // Use JSON.parse(JSON.stringify()) to ensure everything is serializable
      try {
        return JSON.parse(JSON.stringify(g, (_key, value) => {
          // Convert any remaining Date objects
          if (value instanceof Date) {
            return value.toISOString();
          }
          // Remove undefined values
          if (value === undefined) {
            return null;
          }
          return value;
        }));
      } catch (err) {
        console.error("Error in final serialization for group:", g.id, err);
        // Return a minimal safe object
        return {
          id: typeof g.id === 'number' ? g.id : 0,
          name: typeof g.name === 'string' ? g.name : null,
          description: typeof g.description === 'string' ? g.description : null,
          created_by: null,
          committee_id: null,
          is_archived: false,
          created_at: null,
          updated_at: null,
          committee: null,
          tickets: [],
          ticketCount: 0,
        };
      }
    });

    return NextResponse.json({ 
      groups: finalGroups,
      stats: {
        totalGroups: typeof totalGroups === 'number' ? totalGroups : 0,
        activeGroups: typeof activeGroups === 'number' ? activeGroups : 0,
        archivedGroups: typeof archivedGroups === 'number' ? archivedGroups : 0,
        totalTicketsInGroups: typeof totalTicketsInGroups === 'number' ? totalTicketsInGroups : 0,
      }
    });
  } catch (error) {
    console.error("Error fetching ticket groups:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

