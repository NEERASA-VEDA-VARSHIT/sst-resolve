import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  userNumber: text("user_number").notNull(),
  category: text("category").notNull(),
  subcategory: text("subcategory").notNull(),
  description: text("description"),
  location: text("location"),
  details: text("details"), // JSON: comments, TAT, email threading, etc.
  status: text("status").default("open"), // open, in_progress, awaiting_student_response, closed, resolved
  assignedTo: text("assigned_to"), // Clerk userId of the admin assigned to this ticket
  escalationCount: text("escalation_count").default("0"), // Number of times escalated
  escalatedAt: timestamp("escalated_at"), // Last escalation timestamp
  escalatedTo: text("escalated_to"), // Who it was escalated to (super_admin, admin userId, etc.)
  rating: text("rating"), // 1-10 rating from student
  ratingSubmitted: timestamp("rating_submitted"), // When rating was submitted
  ratingRequired: text("rating_required").default("false"), // Whether rating is required before new ticket
  isPublic: text("is_public").default("false"), // Whether ticket is visible on public dashboard
  acknowledgedAt: timestamp("acknowledged_at"), // When SPOC acknowledged the ticket
  acknowledgedBy: text("acknowledged_by"), // Clerk userId of SPOC who acknowledged
  acknowledgementTat: text("acknowledgement_tat"), // TAT on acknowledgement (e.g., "2 hours", "1 day")
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const students = pgTable("students", {
  id: serial("id").primaryKey(),
  userNumber: varchar("user_number").notNull().unique(),
  fullName: varchar("full_name"),
  email: varchar("email"),
  roomNumber: varchar("room_number"),
  mobile: varchar("mobile"),
  hostel: varchar("hostel"),
  whatsappNumber: varchar("whatsapp_number"), // WhatsApp number for notifications
  ticketsThisWeek: text("tickets_this_week").default("0"), // Ticket count for rate limiting
  lastTicketDate: timestamp("last_ticket_date"), // For weekly reset calculation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Staff/Admin users table for assignment/escalation targeting
export const staff = pgTable("staff", {
  id: serial("id").primaryKey(),
  clerkUserId: varchar("clerk_user_id"), // optional if managed via Clerk; can be null for placeholders
  fullName: varchar("full_name").notNull(),
  email: varchar("email"),
  slackUserId: varchar("slack_user_id"),
  whatsappNumber: varchar("whatsapp_number"),
  role: varchar("role").notNull(), // admin | super_admin
  domain: varchar("domain").notNull(), // Hostel | College
  scope: varchar("scope"), // e.g. Velankani, Neeladri (for Hostel); can be null for College-wide
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Escalation rules: ordered list per domain/scope -> staff
export const escalationRules = pgTable("escalation_rules", {
  id: serial("id").primaryKey(),
  domain: varchar("domain").notNull(), // Hostel | College
  scope: varchar("scope"), // e.g. Velankani, Neeladri; null for domain-wide
  level: varchar("level").notNull(), // 1, 2, 3 ... (store as text for simplicity)
  staffId: varchar("staff_id").notNull(), // references staff.id (string for simplicity across drivers)
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Committees table
export const committees = pgTable("committees", {
  id: serial("id").primaryKey(),
  name: varchar("name").notNull(), // e.g., "Student Welfare Council", "Mess Committee"
  description: text("description"), // Optional description
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Committee members table - links Clerk users to committees
export const committeeMembers = pgTable("committee_members", {
  id: serial("id").primaryKey(),
  committeeId: text("committee_id").notNull(), // references committees.id
  clerkUserId: varchar("clerk_user_id").notNull(), // Clerk user ID
  role: varchar("role"), // Optional: "chair", "member", "secretary", etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Default assignment rules per domain/scope
// assignment_rules table removed (reverted)
