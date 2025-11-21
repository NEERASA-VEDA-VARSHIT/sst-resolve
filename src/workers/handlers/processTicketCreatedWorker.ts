import { db } from "@/db";
import { categories, tickets, users, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTicketCreatedEmail, sendEmail } from "@/lib/email";
import { postToSlackChannel } from "@/lib/slack";
import { slackConfig } from "@/conf/config";

type TicketCreatedPayload = {
  ticket_id: number;
  created_by_clerk?: string;
  category?: string;
};

type TicketRecord = {
  id: number;
  description: string | null;
  location: string | null;
  metadata: Record<string, any> | null;
  categoryId: number | null;
  createdBy: string | null;
  statusId: number | null;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

const SLACK_SUPPORTED_CATEGORIES = ["Hostel", "College", "Committee"] as const;
type SlackCategory = (typeof SLACK_SUPPORTED_CATEGORIES)[number];

const firstString = (...values: Array<string | number | null | undefined>) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const asString = String(value).trim();
    if (asString.length > 0) {
      return asString;
    }
  }
  return undefined;
};

const normalizeMetadata = (metadata: Record<string, any> | null): Record<string, any> => {
  // Safety check: ensure metadata is a valid object (not null, not array, not primitive)
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }
  // Additional safety: ensure we can safely spread
  try {
    return { ...metadata };
  } catch (error) {
    console.warn("[normalizeMetadata] Error spreading metadata, returning empty object:", error);
    return {};
  }
};

const getDefaultSlackChannelFor = (category: SlackCategory): string => {
  switch (category) {
    case "Hostel":
      return (slackConfig.channels.hostel as string) || "#tickets-hostel";
    case "College":
      return slackConfig.channels.college;
    case "Committee":
    default:
      return slackConfig.channels.committee;
  }
};

const formatStatus = (status: string | null) => {
  if (!status) return "Open";
  return status
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

const shouldSendSlack = (categoryName: string): categoryName is SlackCategory => {
  return SLACK_SUPPORTED_CATEGORIES.includes(categoryName as SlackCategory);
};

export async function processTicketCreated(outboxId: number, payload: TicketCreatedPayload) {
  try {
    // Safety check: ensure payload is a valid object
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      console.warn(`[processTicketCreated] Outbox ${outboxId} skipped: invalid payload`, payload);
      return;
    }

    if (!payload?.ticket_id) {
      console.warn(`[processTicketCreated] Outbox ${outboxId} skipped: missing ticket_id`);
      return;
    }

    const ticketId = Number(payload.ticket_id);
    const [ticketRow] = await db
      .select({
        id: tickets.id,
        description: tickets.description,
        location: tickets.location,
        metadata: tickets.metadata,
        categoryId: tickets.category_id,
        createdBy: tickets.created_by,
        statusId: tickets.status_id,
        statusValue: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(tickets.status_id, ticket_statuses.id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow) {
      throw new Error(`[processTicketCreated] Ticket ${ticketId} not found`);
    }

    const ticket: TicketRecord = {
      id: ticketRow.id,
      description: ticketRow.description,
      location: ticketRow.location,
      metadata: ticketRow.metadata as Record<string, any> | null,
      categoryId: ticketRow.categoryId,
      createdBy: ticketRow.createdBy,
      statusId: ticketRow.statusId,
    };
    
    const ticketStatusValue = ticketRow.statusValue || "open";

    let categoryName = payload.category || "General";
    if (ticket.categoryId) {
      const [categoryRecord] = await db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.id, ticket.categoryId))
        .limit(1);
      if (categoryRecord?.name) {
        categoryName = categoryRecord.name;
      }
    }

    let creator: UserRecord | null = null;
    if (ticket.createdBy) {
      const [userRecord] = await db
        .select({
          id: users.id,
          first_name: users.first_name,
          last_name: users.last_name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, ticket.createdBy))
        .limit(1);
      if (userRecord) {
        creator = {
          id: userRecord.id,
          name: [userRecord.first_name, userRecord.last_name].filter(Boolean).join(' ').trim() || null,
          email: userRecord.email,
          phone: userRecord.phone,
        };
      }
    }

    // Safely normalize and access metadata
    let metadata: Record<string, any> = {};
    let metadataProfile: Record<string, any> = {};
    
    try {
      metadata = normalizeMetadata(ticket.metadata);
      
      // Safety check: ensure metadata.profile is a valid object before accessing
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.profile) {
        const profile = metadata.profile;
        if (profile && typeof profile === "object" && !Array.isArray(profile)) {
          metadataProfile = profile;
        }
      }
    } catch (error) {
      console.error(`[processTicketCreated] Error processing metadata for ticket ${ticketId}:`, error);
      // Continue with empty objects to prevent further errors
      metadata = {};
      metadataProfile = {};
    }

    // Safely access metadata properties with fallbacks
    const safeGet = (obj: any, ...keys: string[]): any => {
      for (const key of keys) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj[key] != null) {
          return obj[key];
        }
      }
      return undefined;
    };

    let subcategoryName = firstString(safeGet(metadata, 'subcategory')) || "";
    if (!subcategoryName && safeGet(metadata, 'subcategoryId') && ticket.categoryId) {
      try {
        const { getSubcategoryById } = await import("@/lib/categories");
        const subcategory = await getSubcategoryById(safeGet(metadata, 'subcategoryId'), ticket.categoryId);
        if (subcategory?.name) {
          subcategoryName = subcategory.name;
        }
      } catch (error) {
        console.warn(
          `[processTicketCreated] Unable to resolve subcategory for ticket ${ticketId}`,
          error
        );
      }
    }

    const contactName = firstString(
      safeGet(metadata, 'contactName'),
      safeGet(metadata, 'fullName'),
      safeGet(metadataProfile, 'name'),
      safeGet(metadataProfile, 'fullName'),
      creator?.name
    );
    const contactPhone = firstString(
      safeGet(metadata, 'contactPhone'),
      safeGet(metadata, 'phone'),
      safeGet(metadataProfile, 'phone'),
      safeGet(metadataProfile, 'mobile'),
      creator?.phone
    );
    const contactEmail = firstString(
      safeGet(metadata, 'contactEmail'),
      safeGet(metadata, 'email'),
      safeGet(metadataProfile, 'email'),
      creator?.email
    );
    const roomNumber = firstString(
      safeGet(metadata, 'roomNumber'),
      safeGet(metadataProfile, 'roomNumber'),
      safeGet(metadataProfile, 'room_no')
    );
    const batchYearRaw =
      safeGet(metadata, 'batchYear') ?? safeGet(metadataProfile, 'batchYear') ?? safeGet(metadataProfile, 'batch_year');
    const batchYear = typeof batchYearRaw === "number" ? batchYearRaw : parseInt(String(batchYearRaw || ""), 10);
    const classSection = firstString(
      safeGet(metadata, 'classSection'),
      safeGet(metadataProfile, 'classSection'),
      safeGet(metadataProfile, 'class_section')
    );
    const hostelName = firstString(
      safeGet(metadata, 'hostel'),
      safeGet(metadataProfile, 'hostel'),
      safeGet(metadata, 'location'),
      ticket.location
    );

    // Safety check: ensure metadata is a valid object before spreading
    let metadataToPersist: Record<string, any> = {};
    let metadataDirty = false;

    try {
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
        // Safely spread metadata - catch any errors during spread
        try {
          metadataToPersist = { ...metadata };
        } catch (spreadError) {
          console.error(`[processTicketCreated] Error spreading metadata for ticket ${ticketId}:`, spreadError);
          // If spread fails, try to manually copy safe properties
          metadataToPersist = {};
          if (metadata) {
            for (const key in metadata) {
              if (Object.prototype.hasOwnProperty.call(metadata, key)) {
                try {
                  const value = metadata[key];
                  if (value !== null && value !== undefined) {
                    metadataToPersist[key] = value;
                  }
                } catch (copyError) {
                  console.warn(`[processTicketCreated] Skipping metadata key ${key} due to error:`, copyError);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`[processTicketCreated] Error preparing metadataToPersist for ticket ${ticketId}:`, error);
      metadataToPersist = {};
    }

    const setMetadataValue = (key: string, value: unknown) => {
      try {
        if (metadataToPersist[key] !== value) {
          metadataToPersist[key] = value;
          metadataDirty = true;
        }
      } catch (error) {
        console.warn(`[processTicketCreated] Error setting metadata value for key ${key}:`, error);
      }
    };

    const studentEmail = contactEmail || creator?.email;
    if (studentEmail) {
      try {
        const emailTemplate = getTicketCreatedEmail(
          ticket.id,
          categoryName,
          subcategoryName || "General",
          ticket.description || undefined,
          contactName,
          contactPhone,
          roomNumber,
          Number.isNaN(batchYear) ? undefined : batchYear,
          classSection
        );

        const emailResult = await sendEmail({
          to: studentEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          ticketId: ticket.id,
        });

        if (emailResult?.messageId) {
          setMetadataValue("originalEmailMessageId", emailResult.messageId);
          setMetadataValue("originalEmailSubject", emailTemplate.subject);
        }
      } catch (error) {
        console.error(
          `[processTicketCreated] Failed to send email for ticket ${ticket.id}`,
          error
        );
      }
    } else {
      console.warn(
        `[processTicketCreated] No email found for ticket ${ticket.id}; skipping email send`
      );
    }

    if (shouldSendSlack(categoryName)) {
      const header = "🆕 New Ticket Raised";
      const contactLines: string[] = [];
      if (contactName) contactLines.push(`Name: ${contactName}`);
      if (contactPhone) contactLines.push(`Phone: ${contactPhone}`);
      if (studentEmail) contactLines.push(`Email: ${studentEmail}`);
      if (categoryName === "Hostel" && roomNumber) {
        contactLines.push(`Room: ${roomNumber}`);
      }
      if (categoryName === "College") {
        if (!Number.isNaN(batchYear) && batchYear) contactLines.push(`Batch: ${batchYear}`);
        if (classSection) contactLines.push(`Class: ${classSection}`);
      }

      const body = [
        `*Ticket ID:* #${ticket.id}`,
        `Category: ${categoryName}${subcategoryName ? ` → ${subcategoryName}` : ""}`,
        ticket.location ? `Location: ${ticket.location}` : undefined,
        creator?.name ? `User: ${creator.name}` : undefined,
        contactLines.length ? `Contact: ${contactLines.join(" | ")}` : undefined,
        ticket.description ? `Description: ${ticket.description}` : undefined,
        `Status: ${formatStatus(ticketStatusValue)}`,
      ]
        .filter(Boolean)
        .join("\n");

      const key = `${categoryName}${subcategoryName ? ":" + subcategoryName : ""}`;
      
      // Safety check: ensure ccMap and defaultCc are valid before accessing
      let ccUserIds: string[] = [];
      try {
        const ccMap = slackConfig?.ccMap;
        const defaultCc = slackConfig?.defaultCc;
        
        if (ccMap && typeof ccMap === 'object' && !Array.isArray(ccMap)) {
          ccUserIds = ccMap[key] || ccMap[categoryName] || [];
        }
        
        // Fallback to defaultCc if no ccUserIds found
        if (!ccUserIds || ccUserIds.length === 0) {
          if (Array.isArray(defaultCc) && defaultCc.length > 0) {
            ccUserIds = defaultCc;
          } else {
            // Final fallback: empty array
            ccUserIds = [];
          }
        }
      } catch (error) {
        console.warn(`[processTicketCreated] Error accessing Slack ccMap for ticket ${ticket.id}:`, error);
        // Fallback to empty array if all else fails
        ccUserIds = [];
      }

      // Safety check: ensure hostels is a valid object before accessing
      let hostelChannels: Record<string, string> = {};
      let channelOverride: string | undefined = undefined;
      
      try {
        const hostelsConfig = (slackConfig?.channels as any)?.hostels;
        if (hostelsConfig && typeof hostelsConfig === 'object' && !Array.isArray(hostelsConfig)) {
          hostelChannels = hostelsConfig;
        }
        
        if (categoryName === "Hostel" && hostelName && hostelChannels[hostelName]) {
          channelOverride = hostelChannels[hostelName];
        }
      } catch (error) {
        console.warn(`[processTicketCreated] Error accessing Slack hostels config for ticket ${ticket.id}:`, error);
        // Continue with empty channels - will use default channel
      }

      try {
        const messageTs = await postToSlackChannel(
          categoryName as SlackCategory,
          `${header}\n${body}`,
          ticket.id,
          ccUserIds,
          channelOverride
        );

        if (messageTs) {
          setMetadataValue("slackMessageTs", messageTs);
          setMetadataValue(
            "slackChannel",
            channelOverride || getDefaultSlackChannelFor(categoryName as SlackCategory)
          );
        }
      } catch (error) {
        console.error(
          `[processTicketCreated] Failed to post Slack message for ticket ${ticket.id}`,
          error
        );
      }
    }

    if (metadataDirty) {
      try {
        // Final safety check before updating metadata
        let safeMetadata: Record<string, any> = {};
        
        if (metadataToPersist && typeof metadataToPersist === 'object' && !Array.isArray(metadataToPersist)) {
          // Try to serialize to ensure it's valid JSON
          try {
            JSON.stringify(metadataToPersist);
            safeMetadata = metadataToPersist;
          } catch (serializeError) {
            console.error(`[processTicketCreated] Metadata not serializable for ticket ${ticket.id}, creating clean copy:`, serializeError);
            // Create a clean copy by manually copying safe properties
            safeMetadata = {};
            for (const key in metadataToPersist) {
              if (Object.prototype.hasOwnProperty.call(metadataToPersist, key)) {
                try {
                  const value = metadataToPersist[key];
                  // Only include serializable values
                  if (value !== null && value !== undefined) {
                    JSON.stringify(value); // Test if value is serializable
                    safeMetadata[key] = value;
                  }
                } catch (valueError) {
                  console.warn(`[processTicketCreated] Skipping non-serializable metadata key ${key} for ticket ${ticket.id}`);
                }
              }
            }
          }
        }
        
        await db
          .update(tickets)
          .set({ metadata: safeMetadata })
          .where(eq(tickets.id, ticket.id));
      } catch (error) {
        console.error(`[processTicketCreated] Error updating metadata for ticket ${ticket.id}:`, error);
        console.error(`[processTicketCreated] Error details:`, error instanceof Error ? error.stack : error);
      }
    }

    console.log(
      `[processTicketCreated] Notifications processed for ticket ${ticket.id} (category=${categoryName})`
    );
  } catch (error) {
    console.error(`[processTicketCreated] Fatal error processing ticket ${payload?.ticket_id || 'unknown'}:`, error);
    // Re-throw to mark outbox as failed
    throw error;
  }
}