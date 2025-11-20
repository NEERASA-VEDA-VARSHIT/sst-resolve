import { db } from "@/db";
import { categories, tickets, users } from "@/db/schema";
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
  legacyCategory: string | null;
  legacySubcategory: string | null;
  createdBy: string | null;
  status: string;
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
  if (!metadata || typeof metadata !== "object") {
    return {};
  }
  return { ...metadata };
};

const getDefaultSlackChannelFor = (category: SlackCategory): string => {
  switch (category) {
    case "Hostel":
      return slackConfig.channels.hostel;
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
      legacyCategory: tickets.category,
      legacySubcategory: tickets.subcategory,
      createdBy: tickets.created_by,
      status: tickets.status,
    })
    .from(tickets)
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
    legacyCategory: ticketRow.legacyCategory,
    legacySubcategory: ticketRow.legacySubcategory,
    createdBy: ticketRow.createdBy,
    status: ticketRow.status,
  };

  let categoryName = payload.category || ticket.legacyCategory || "General";
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
        name: users.name,
        email: users.email,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, ticket.createdBy))
      .limit(1);
    if (userRecord) {
      creator = userRecord;
    }
  }

  const metadata = normalizeMetadata(ticket.metadata);
  const metadataProfile =
    metadata.profile && typeof metadata.profile === "object" ? metadata.profile : {};

  let subcategoryName =
    firstString(metadata.subcategory, ticket.legacySubcategory) || "";
  if (!subcategoryName && metadata.subcategoryId && ticket.categoryId) {
    try {
      const { getSubcategoryById } = await import("@/lib/categories");
      const subcategory = await getSubcategoryById(metadata.subcategoryId, ticket.categoryId);
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
    metadata.contactName,
    metadata.fullName,
    metadataProfile.name,
    metadataProfile.fullName,
    creator?.name
  );
  const contactPhone = firstString(
    metadata.contactPhone,
    metadata.phone,
    metadataProfile.phone,
    metadataProfile.mobile,
    creator?.phone
  );
  const contactEmail = firstString(
    metadata.contactEmail,
    metadata.email,
    metadataProfile.email,
    creator?.email
  );
  const roomNumber = firstString(
    metadata.roomNumber,
    metadataProfile.roomNumber,
    metadataProfile.room_no
  );
  const batchYearRaw =
    metadata.batchYear ?? metadataProfile.batchYear ?? metadataProfile.batch_year;
  const batchYear = typeof batchYearRaw === "number" ? batchYearRaw : parseInt(batchYearRaw || "", 10);
  const classSection = firstString(
    metadata.classSection,
    metadataProfile.classSection,
    metadataProfile.class_section
  );
  const hostelName = firstString(
    metadata.hostel,
    metadataProfile.hostel,
    metadata.location,
    ticket.location
  );

  const metadataToPersist: Record<string, any> = { ...metadata };
  let metadataDirty = false;

  const setMetadataValue = (key: string, value: any) => {
    if (metadataToPersist[key] !== value) {
      metadataToPersist[key] = value;
      metadataDirty = true;
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
      `Status: ${formatStatus(ticket.status)}`,
    ]
      .filter(Boolean)
      .join("\n");

    const key = `${categoryName}${subcategoryName ? ":" + subcategoryName : ""}`;
    const ccUserIds =
      slackConfig.ccMap[key] || slackConfig.ccMap[categoryName] || slackConfig.defaultCc;

    const hostelChannels: Record<string, string> =
      (slackConfig.channels as any).hostels || {};
    const channelOverride =
      categoryName === "Hostel" && hostelName && hostelChannels[hostelName]
        ? hostelChannels[hostelName]
        : undefined;

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
    await db
      .update(tickets)
      .set({ metadata: metadataToPersist })
      .where(eq(tickets.id, ticket.id));
  }

  console.log(
    `[processTicketCreated] Notifications processed for ticket ${ticket.id} (category=${categoryName})`
  );
}

