import { db } from "@/db";
import { categories, tickets, users, ticket_committee_tags, ticket_statuses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getTicketCreatedEmail, sendEmail } from "@/lib/integration/email";
import { postToSlackChannel } from "@/lib/integration/slack";
import { slackConfig } from "@/conf/config";
import { logNotification } from "@/workers/utils";
import { shouldSendEmailNotification, shouldSendSlackNotification } from "@/lib/notification/notification-config";
import { findNotificationChannel, saveTicketSlackThread } from "@/lib/notification/channel-routing";

type TicketCreatedPayload = {
  ticket_id: number;
  created_by_clerk?: string;
  category?: string;
};

type TicketRecord = {
  id: number;
  description: string | null;
  location: string | null;
  metadata: Record<string, unknown> | null;
  categoryId: number | null;
  createdBy: string | null;
  status: string | null;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

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

const normalizeMetadata = (metadata: Record<string, unknown> | null): Record<string, unknown> => {
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

const formatStatus = (status: string | null) => {
  if (!status) return "Open";
  return status
    .toLowerCase()
    .split("_")
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
};

// Helper to get fallback channel (used when no database config exists)
function getFallbackSuperAdminChannel(): string | null {
  if (slackConfig.channels.committee) {
    return slackConfig.channels.committee as string;
  }
  if (slackConfig.channels.college) {
    return slackConfig.channels.college as string;
  }
  if (slackConfig.channels.hostel) {
    return slackConfig.channels.hostel as string;
  }
  return null;
}

export async function processTicketCreated(outboxId: number, payload: TicketCreatedPayload) {
  console.log(`[processTicketCreated] 📬 Starting notification processing for outbox ${outboxId}, ticket #${payload.ticket_id}`);
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
    console.log(`[processTicketCreated] Processing ticket #${ticketId} from outbox ${outboxId}`);
    const [ticketRow] = await db
      .select({
        id: tickets.id,
        description: tickets.description,
        location: tickets.location,
        metadata: tickets.metadata,
        categoryId: tickets.category_id,
        scopeId: tickets.scope_id,
        assignedTo: tickets.assigned_to,
        createdBy: tickets.created_by,
        status: ticket_statuses.value,
      })
      .from(tickets)
      .leftJoin(ticket_statuses, eq(ticket_statuses.id, tickets.status_id))
      .where(eq(tickets.id, ticketId))
      .limit(1);

    if (!ticketRow) {
      throw new Error(`[processTicketCreated] Ticket ${ticketId} not found`);
    }

    const ticket: TicketRecord = {
      id: ticketRow.id,
      description: ticketRow.description,
      location: ticketRow.location,
      metadata: ticketRow.metadata as Record<string, unknown> | null,
      categoryId: ticketRow.categoryId,
      createdBy: ticketRow.createdBy,
      status: ticketRow.status,
    };
    
    const ticketStatusValue = (ticketRow.status || "open").toLowerCase();

    // Fetch category with domain_id for routing
    let categoryName = payload.category || "General";
    let domainId: number | null = null;
    if (ticket.categoryId) {
      const [categoryRecord] = await db
        .select({ 
          name: categories.name,
          domain_id: categories.domain_id,
        })
        .from(categories)
        .where(eq(categories.id, ticket.categoryId))
        .limit(1);
      if (categoryRecord?.name) {
        categoryName = categoryRecord.name;
      }
      if (categoryRecord?.domain_id) {
        domainId = categoryRecord.domain_id;
      }
    }

    // Fetch committee IDs if ticket is tagged to committees
    let committeeIds: number[] | null = null;
    if (ticket.categoryId) {
      try {
        const committeeTags = await db
          .select({ committee_id: ticket_committee_tags.committee_id })
          .from(ticket_committee_tags)
          .where(eq(ticket_committee_tags.ticket_id, ticketId));
        if (committeeTags.length > 0) {
          committeeIds = committeeTags.map(tag => tag.committee_id).filter((id): id is number => id !== null);
        }
      } catch (error) {
        console.warn(`[processTicketCreated] Error fetching committee tags for ticket ${ticketId}:`, error);
      }
    }

    let creator: UserRecord | null = null;
    if (ticket.createdBy) {
      const [userRecord] = await db
        .select({
          id: users.id,
          full_name: users.full_name,
          email: users.email,
          phone: users.phone,
        })
        .from(users)
        .where(eq(users.id, ticket.createdBy))
        .limit(1);
      if (userRecord) {
        creator = {
          id: userRecord.id,
          name: userRecord.full_name || null,
          email: userRecord.email,
          phone: userRecord.phone,
        };
      }
    }

    // Safely normalize and access metadata
    let metadata: Record<string, unknown> = {};
    let metadataProfile: Record<string, unknown> = {};
    
    try {
      metadata = normalizeMetadata(ticket.metadata);
      
      // Safety check: ensure metadata.profile is a valid object before accessing
      if (metadata && typeof metadata === 'object' && !Array.isArray(metadata) && metadata.profile) {
        const profile = metadata.profile;
        if (profile && typeof profile === "object" && !Array.isArray(profile)) {
          metadataProfile = profile as Record<string, unknown>;
        }
      }
    } catch (error) {
      console.error(`[processTicketCreated] Error processing metadata for ticket ${ticketId}:`, error);
      // Continue with empty objects to prevent further errors
      metadata = {};
      metadataProfile = {};
    }

    // Ensure metadata is a Record<string, unknown>
    const safeMetadata: Record<string, unknown> = (metadata && typeof metadata === 'object' && !Array.isArray(metadata))
      ? metadata as Record<string, unknown>
      : {};
    const safeMetadataProfile: Record<string, unknown> = (metadataProfile && typeof metadataProfile === 'object' && !Array.isArray(metadataProfile))
      ? metadataProfile as Record<string, unknown>
      : {};

    // Safely access metadata properties with fallbacks
    const safeGet = (obj: Record<string, unknown>, ...keys: string[]): unknown => {
      for (const key of keys) {
        if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj[key] != null) {
          return obj[key];
        }
      }
      return undefined;
    };

    const subcategoryValue = safeGet(safeMetadata, 'subcategory');
    let subcategoryName = firstString(
      typeof subcategoryValue === 'string' ? subcategoryValue :
      typeof subcategoryValue === 'number' ? subcategoryValue :
      null
    ) || "";
    const subcategoryIdValue = safeGet(safeMetadata, 'subcategoryId');
    if (!subcategoryName && subcategoryIdValue && ticket.categoryId) {
      try {
        const { getSubcategoryById } = await import("@/lib/category/categories");
        const subcategoryIdNum = typeof subcategoryIdValue === 'number' ? subcategoryIdValue : Number(subcategoryIdValue);
        if (!isNaN(subcategoryIdNum)) {
          const subcategory = await getSubcategoryById(subcategoryIdNum, ticket.categoryId);
          if (subcategory?.name) {
            subcategoryName = subcategory.name;
          }
        }
      } catch (error) {
        console.warn(
          `[processTicketCreated] Unable to resolve subcategory for ticket ${ticketId}`,
          error
        );
      }
    }

    const toFirstStringValue = (val: unknown): string | number | null | undefined => {
      if (val === null || val === undefined) return val;
      if (typeof val === 'string' || typeof val === 'number') return val;
      return null;
    };
    
    const contactName = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'contactName')),
      toFirstStringValue(safeGet(safeMetadata, 'fullName')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'name')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'fullName')),
      creator?.name
    );
    const contactPhone = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'contactPhone')),
      toFirstStringValue(safeGet(safeMetadata, 'phone')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'phone')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'mobile')),
      creator?.phone
    );
    const contactEmail = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'contactEmail')),
      toFirstStringValue(safeGet(safeMetadata, 'email')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'email')),
      creator?.email
    );
    const roomNumber = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'roomNumber')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'roomNumber')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'room_no'))
    );
    const batchYearRaw =
      safeGet(safeMetadata, 'batchYear') ?? safeGet(safeMetadataProfile, 'batchYear') ?? safeGet(safeMetadataProfile, 'batch_year');
    const batchYear = typeof batchYearRaw === "number" ? batchYearRaw : parseInt(String(batchYearRaw || ""), 10);
    const classSection = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'classSection')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'classSection')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'class_section'))
    );
    const hostelName = firstString(
      toFirstStringValue(safeGet(safeMetadata, 'hostel')),
      toFirstStringValue(safeGet(safeMetadataProfile, 'hostel')),
      toFirstStringValue(safeGet(safeMetadata, 'location')),
      ticket.location
    );

    // Safety check: ensure metadata is a valid object before spreading
    let metadataToPersist: Record<string, unknown> = {};
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

    // Check if email should be sent (database-driven config)
    // Pass scope_id and location for scope-based notification config lookup
    const shouldSendEmail = await shouldSendEmailNotification(
      ticket.categoryId, 
      null, // subcategoryId
      ticketRow.scopeId || null, // scopeId from ticket
      ticket.location || null // ticketLocation for scope resolution fallback
    );
    const studentEmail = contactEmail || creator?.email;
    
    if (shouldSendEmail && studentEmail) {
      try {
        console.log(`[processTicketCreated] Sending email for ticket #${ticket.id} to ${studentEmail}`);
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

        console.log(`[processTicketCreated] Attempting to send email to ${studentEmail} for ticket #${ticket.id}`);
        const emailResult = await sendEmail({
          to: studentEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
          ticketId: ticket.id,
        });

        if (emailResult?.messageId) {
          setMetadataValue("originalEmailMessageId", emailResult.messageId);
          setMetadataValue("originalEmailSubject", emailTemplate.subject);
          console.log(`[processTicketCreated] ✅ Email sent successfully for ticket #${ticket.id} (Message-ID: ${emailResult.messageId})`);
        } else if (emailResult === null) {
          console.error(`[processTicketCreated] ❌ Email sending failed for ticket #${ticket.id} - sendEmail returned null`);
          console.error(`[processTicketCreated] This usually means: SMTP not configured, invalid email address, or SMTP error occurred`);
        } else {
          console.warn(`[processTicketCreated] ⚠️ Email sent for ticket #${ticket.id} but no Message-ID returned (result: ${JSON.stringify(emailResult)})`);
        }

        if (emailResult) {
          await logNotification({
            userId: creator?.id ?? null,
            ticketId: ticket.id,
            channel: "email",
            notificationType: "ticket.created",
            emailMessageId: typeof emailResult.messageId === "string" ? emailResult.messageId : null,
            sentAt: new Date(),
          });
        }
      } catch (error) {
        console.error(
          `[processTicketCreated] ❌ Failed to send email for ticket ${ticket.id}:`,
          error instanceof Error ? error.message : error
        );
        if (error instanceof Error && error.stack) {
          console.error(`[processTicketCreated] Error stack:`, error.stack);
        }
      }
    } else {
      if (!shouldSendEmail) {
        console.log(`[processTicketCreated] Email disabled for ticket #${ticket.id} (category: ${categoryName})`);
      } else {
        console.warn(
          `[processTicketCreated] ⚠️ No email found for ticket #${ticket.id}; skipping email send`
        );
        console.warn(
          `[processTicketCreated] Debug info - contactEmail: ${contactEmail || 'null'}, creator?.email: ${creator?.email || 'null'}`
        );
      }
    }

    // Check if Slack should be sent (database-driven config, no hardcoding)
    // Pass scope_id and location for scope-based notification config lookup
    const shouldSendSlack = await shouldSendSlackNotification(
      categoryName,
      ticket.categoryId,
      null, // subcategoryId not needed for initial check
      ticketRow.scopeId || null, // scopeId from ticket
      ticket.location || null // ticketLocation for scope resolution fallback
    );

    // Track Slack message status for final log
    let messageTs: string | null = null;

    if (shouldSendSlack) {
      console.log(`[processTicketCreated] Sending Slack notification for ticket #${ticket.id} (category: ${categoryName})`);
      
      // Find notification channel using database-driven routing (priority-based)
      const channelRouting = await findNotificationChannel(
        ticket.id,
        ticket.categoryId,
        ticketRow.scopeId,
        domainId,
        committeeIds,
        ticketRow.assignedTo
      );

      const header = "🆕 New Ticket Raised";
      const contactLines: string[] = [];
      if (contactName) contactLines.push(`Name: ${contactName}`);
      if (contactPhone) contactLines.push(`Phone: ${contactPhone}`);
      if (studentEmail) contactLines.push(`Email: ${studentEmail}`);
      if (roomNumber) contactLines.push(`Room: ${roomNumber}`);
      if (!Number.isNaN(batchYear) && batchYear) contactLines.push(`Batch: ${batchYear}`);
      if (classSection) contactLines.push(`Class: ${classSection}`);
      if (hostelName) contactLines.push(`Hostel: ${hostelName}`);

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

      // Get channel + CC user IDs from notification_config (database-driven)
      let ccUserIds: string[] = [];
      let overrideChannel: string | null = null;
      try {
        const { getNotificationConfig } = await import("@/lib/notification/notification-config");
        // Pass scope_id and location for scope-based notification config lookup
        console.log(`[processTicketCreated] Calling getNotificationConfig for ticket #${ticketId}: categoryId=${ticket.categoryId}, scopeId=${ticketRow.scopeId}, location=${ticket.location}, categoryName=${categoryName}`);
        const notifConfig = await getNotificationConfig(
          ticket.categoryId, 
          null, // subcategoryId - would need to be extracted from metadata if needed
          ticketRow.scopeId || null, // scopeId from ticket
          ticket.location || null // ticketLocation for scope resolution fallback
        );
        ccUserIds = notifConfig.slackCcUserIds || [];
        overrideChannel = notifConfig.slackChannel || null;
        
        // Fallback to env config for CC only if database didn't specify any
        if (ccUserIds.length === 0 && Array.isArray(slackConfig.defaultCc) && slackConfig.defaultCc.length > 0) {
          ccUserIds = slackConfig.defaultCc;
        }
      } catch (error) {
        console.warn(`[processTicketCreated] Error accessing Slack CC config for ticket ${ticket.id}:`, error);
        // Fallback to env config
        if (Array.isArray(slackConfig.defaultCc) && slackConfig.defaultCc.length > 0) {
          ccUserIds = slackConfig.defaultCc;
        }
      }

      try {
        // Determine channel to use
        // Priority: database config channel > channelRouting.channel > fallback channel > category-based mapping (in postToSlackChannel)
        // If slackUserId exists, we'd send DM (not yet implemented), so fall back to channel
        const targetChannel = overrideChannel || channelRouting.channel || getFallbackSuperAdminChannel();
        
        console.log(`[processTicketCreated] Calling postToSlackChannel for ticket #${ticket.id}`, {
          category: categoryName,
          channel: targetChannel || 'will use category-based mapping',
          slackUserId: channelRouting.slackUserId,
          threadTs: channelRouting.threadTs,
          ccUserIds: ccUserIds?.length || 0,
        });

        // If we have a Slack user ID, send DM; otherwise send to channel
        // Note: postToSlackChannel will use category-based mapping if channelOverride is null/undefined
        if (channelRouting.slackUserId) {
          // Send DM to user (requires different API call - implement if needed)
          console.log(`[processTicketCreated] DM notifications not yet implemented, falling back to channel`);
          // For now, fall back to channel - pass null to let postToSlackChannel use category mapping
          messageTs = await postToSlackChannel(
            categoryName,
            `${header}\n${body}`,
            ticket.id,
            ccUserIds,
            targetChannel || undefined // Pass undefined to use category-based mapping
          );
        } else {
          // Send to channel (or thread if threadTs exists)
          // postToSlackChannel will use category-based mapping if channelOverride is null/undefined
          messageTs = await postToSlackChannel(
            categoryName,
            `${header}\n${body}`,
            ticket.id,
            ccUserIds,
            targetChannel || undefined, // Pass undefined to use category-based mapping
            channelRouting.threadTs || undefined
          );
        }

        if (messageTs) {
          console.log(`[processTicketCreated] ✅ Slack message sent successfully for ticket #${ticket.id}, ts: ${messageTs}`);
          
          // Save thread to notification_channels for future updates (only if we have a channel)
          const actualChannel = targetChannel || channelRouting.channel;
          if (actualChannel && !channelRouting.threadTs) {
            try {
              await saveTicketSlackThread(ticket.id, actualChannel, messageTs);
            } catch (error) {
              // Ignore errors if notification_channels table doesn't exist yet
              console.warn(`[processTicketCreated] Could not save Slack thread (table may not exist):`, error);
            }
          }
          
          setMetadataValue("slackMessageTs", messageTs);
          setMetadataValue("slackChannel", actualChannel || categoryName || "unknown");
          
          await logNotification({
            userId: null,
            ticketId: ticket.id,
            channel: "slack",
            notificationType: "ticket.created",
            slackMessageId: messageTs,
            sentAt: new Date(),
          });
        } else {
          console.warn(`[processTicketCreated] ⚠️ Slack message returned null for ticket #${ticket.id}. Check Slack configuration and logs.`);
        }
      } catch (error) {
        console.error(
          `[processTicketCreated] ❌ Failed to post Slack message for ticket ${ticket.id}`,
          error
        );
        if (error instanceof Error) {
          console.error(`[processTicketCreated] Error details:`, {
            message: error.message,
            stack: error.stack,
          });
        }
      }
    } else {
      console.log(`[processTicketCreated] Slack notifications disabled for ticket #${ticket.id} (category: ${categoryName})`);
    }

    if (metadataDirty) {
      try {
        // Final safety check before updating metadata
        let safeMetadata: Record<string, unknown> = {};
        
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
                } catch {
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

    // Determine actual Slack status (sent vs skipped)
    const slackStatus = shouldSendSlack 
      ? (messageTs ? 'sent' : 'failed') 
      : 'skipped';
    
    console.log(
      `[processTicketCreated] ✅ All notifications processed for ticket #${ticket.id} (category=${categoryName}, email=${shouldSendEmail ? (studentEmail ? 'sent' : 'skipped') : 'skipped'}, slack=${slackStatus})`
    );
  } catch (error) {
    console.error(`[processTicketCreated] Fatal error processing ticket ${payload?.ticket_id || 'unknown'}:`, error);
    // Re-throw to mark outbox as failed
    throw error;
  }
}