import { WebClient } from "@slack/web-api";
import { slackConfig } from "@/conf/config";

const slack = slackConfig.botToken ? new WebClient(slackConfig.botToken) : null;

// Channel mapping driven by config
const getHostelChannel = (): string => {
	const defaultHostel = slackConfig.channels.hostel as string;
	if (defaultHostel) return defaultHostel;
	// Fallback to first available hostel channel from config
	const hostelsConfig = slackConfig.channels.hostels as Record<string, string> | undefined;
	if (hostelsConfig && typeof hostelsConfig === 'object') {
		const firstHostelChannel = Object.values(hostelsConfig)[0];
		if (firstHostelChannel) return firstHostelChannel;
	}
	// Last resort: use a channel that likely exists
	return "#tickets-velankani";
};

const SLACK_CHANNELS: Record<"Hostel" | "College" | "Committee", string> = {
	Hostel: getHostelChannel(),
	College: (slackConfig.channels.college as string) || "#tickets-college",
	Committee: (slackConfig.channels.committee as string) || "#tickets-committee",
};

export async function postToSlackChannel(
    category: "Hostel" | "College" | "Committee" | string, // Allow any string for flexibility
    text: string,
    ticketId?: number,
    ccUserIds?: string[],
    channelOverride?: string,
    threadTs?: string // Support posting to existing thread
): Promise<string | null> {
	console.log("[Slack] Preparing message", {
		category,
		ticketId,
		channelOverride,
		hasBotToken: !!slackConfig.botToken,
		slackEnabled: slackConfig.enabled,
	});

	if (!slackConfig.enabled) {
		console.warn("[Slack] Slack is disabled in config (no SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL)");
		return null;
	}

	if (!slack) {
		console.error("[Slack] SLACK_BOT_TOKEN not set; skipping Slack send. Check your environment variables.");
		return null;
	}

	// Use channelOverride if provided, otherwise try to get from category mapping
	// If channelOverride is explicitly provided (even if empty string), use it
	// Otherwise, fall back to category-based mapping
	let channel: string | null = null;
	
	if (channelOverride) {
		channel = channelOverride;
	} else if (category && typeof category === 'string') {
		// Try exact match first
		if (category in SLACK_CHANNELS) {
			channel = SLACK_CHANNELS[category as keyof typeof SLACK_CHANNELS];
		} else {
			// Try case-insensitive match
			const categoryLower = category.toLowerCase();
			const matchingKey = Object.keys(SLACK_CHANNELS).find(
				key => key.toLowerCase() === categoryLower
			) as keyof typeof SLACK_CHANNELS | undefined;
			if (matchingKey) {
				channel = SLACK_CHANNELS[matchingKey];
			}
		}
	}
	
	if (!channel) {
		console.warn("[Slack] No channel configured", { category, channelOverride, availableChannels: Object.keys(SLACK_CHANNELS) });
		return null;
	}

	try {
		// Normalize channel name (remove # if present, Slack API handles both)
		const normalizedChannel = channel.startsWith('#') ? channel.slice(1) : channel;
		
		// Append CC mentions to the text if provided
        const ccSuffix = Array.isArray(ccUserIds) && ccUserIds.length > 0
            ? `\nCC: ${ccUserIds.map((id) => `<@${id}>`).join(" ")}`
            : "";

        type SlackBlock = {
			type: string;
			text?: { type: string; text: string };
			elements?: Array<Record<string, unknown>>;
			[key: string]: unknown;
		};
		const blocks: SlackBlock[] = [
			{
				type: "section",
				text: {
					type: "mrkdwn",
                    text: `${text}${ccSuffix}`,
				},
			},
		];

		// Add interactive buttons if ticket ID is provided
		if (ticketId) {
			// Get base URL for website links
			// Priority: NEXT_PUBLIC_APP_URL > VERCEL_URL > localhost
			let baseUrl = process.env.NEXT_PUBLIC_APP_URL;
			if (!baseUrl) {
				const vercelUrl = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL;
				if (vercelUrl) {
					baseUrl = vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`;
				} else {
					baseUrl = 'http://localhost:3000';
				}
			}
			const ticketUrl = `${baseUrl}/admin/dashboard/ticket/${ticketId}`;
			
			blocks.push({
				type: "actions",
				elements: [
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🌐 View on Website",
							emoji: true,
						},
						url: ticketUrl,
						action_id: "ticket_view_website",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "🔄 Mark In Progress",
							emoji: true,
						},
						style: "primary",
						value: `in_progress_${ticketId}`,
						action_id: "ticket_in_progress",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "⏱️ Update TAT",
							emoji: true,
						},
						value: `set_tat_${ticketId}`,
						action_id: "ticket_set_tat",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "💬 Add Comment",
							emoji: true,
						},
						value: `add_comment_${ticketId}`,
						action_id: "ticket_add_comment",
					},
					{
						type: "button",
						text: {
							type: "plain_text",
							text: "✅ Close Ticket",
							emoji: true,
						},
						style: "danger",
						value: `close_${ticketId}`,
						action_id: "ticket_close",
					},
				],
			});
		}

		console.log("[Slack] Sending chat.postMessage", {
			channel: normalizedChannel,
			category,
			ticketId,
			threadTs,
			ccCount: ccUserIds?.length || 0,
			textLength: text.length,
		});
        const result = await slack.chat.postMessage({
			channel: normalizedChannel,
            text: `${text}${ccSuffix}`,
			blocks,
			...(threadTs ? { thread_ts: threadTs } : {}), // Post to thread if threadTs provided
		});
		
		const messageTs = result.ts || null;
		if (messageTs) {
			console.log("[Slack] ✅ Message posted successfully", {
				channel: normalizedChannel,
				ticketId,
				messageTs,
				ok: result.ok,
			});
		} else {
			console.warn("[Slack] ⚠️ Message posted but no timestamp returned", {
				channel: normalizedChannel,
				ticketId,
				result: result,
			});
		}
		return messageTs;
	} catch (error: unknown) {
		type SlackError = {
			message?: string;
			code?: string;
			data?: { error?: string };
			response?: unknown;
		};
		const slackError = error as SlackError;
		console.error(`[Slack] Error posting to ${channel}`, {
			message: slackError.message,
			code: slackError.code,
			data: slackError.data,
			response: slackError.response,
		});
		
		// If channel_not_found, try to get channel list for debugging
		if (slackError.code === 'channel_not_found' || slackError.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				type Channel = { id?: string; name?: string };
				console.error(`Available channels:`, channels?.channels?.map((c: Channel) => ({ id: c.id, name: c.name })));
			} catch (listError) {
				console.error(`Could not list channels:`, listError);
			}
		}
		
		return null;
	}
}

export async function postThreadReply(
	category: "Hostel" | "College" | "Committee",
	threadTs: string,
	text: string,
	ccUserIds?: string[]
) {
	if (!slack) {
		console.warn("SLACK_BOT_TOKEN not set; skipping Slack send.");
		return;
	}

	const channel = SLACK_CHANNELS[category];
	if (!channel) {
		console.warn(`No Slack channel configured for category: ${category}`);
		return;
	}

	try {
		// Normalize channel name (remove # if present)
		const normalizedChannel = channel.startsWith('#') ? channel.slice(1) : channel;
		
		const ccSuffix = Array.isArray(ccUserIds) && ccUserIds.length > 0
			? `\nCC: ${ccUserIds.map((id) => `<@${id}>`).join(" ")}`
			: "";
		const result = await slack.chat.postMessage({
			channel: normalizedChannel,
			text: `${text}${ccSuffix}`,
			thread_ts: threadTs,
		});
		console.log(`✅ Posted thread reply to ${normalizedChannel} (ts: ${result.ts})`);
		return result;
	} catch (error: unknown) {
		type SlackError = {
			message?: string;
			code?: string;
			data?: { error?: string };
			response?: unknown;
		};
		const slackError = error as SlackError;
		console.error(`❌ Error posting thread reply to ${channel}:`, {
			message: slackError.message,
			code: slackError.code,
			data: slackError.data,
			response: slackError.response,
		});
		
		// If channel_not_found, try to get channel list for debugging
		if (slackError.code === 'channel_not_found' || slackError.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				type Channel = { id?: string; name?: string };
				console.error(`Available channels:`, channels?.channels?.map((c: Channel) => ({ id: c.id, name: c.name })));
			} catch (listError) {
				console.error(`Could not list channels:`, listError);
			}
		}
		
		throw error; // Re-throw so caller can handle
	}
}

export async function postThreadReplyToChannel(
    channel: string,
    threadTs: string,
    text: string,
    ccUserIds?: string[]
) {
    if (!slack) {
        console.warn("SLACK_BOT_TOKEN not set; skipping Slack send.");
        return;
    }

    try {
		// Normalize channel name (remove # if present)
		const normalizedChannel = channel.startsWith('#') ? channel.slice(1) : channel;
		
        const ccSuffix = Array.isArray(ccUserIds) && ccUserIds.length > 0
            ? `\nCC: ${ccUserIds.map((id) => `<@${id}>`).join(" ")}`
            : "";
        const result = await slack.chat.postMessage({
            channel: normalizedChannel,
            text: `${text}${ccSuffix}`,
            thread_ts: threadTs,
        });
        console.log(`✅ Posted thread reply to ${normalizedChannel} (ts: ${result.ts})`);
        return result;
    } catch (error: unknown) {
        type SlackError = {
			message?: string;
			code?: string;
			data?: { error?: string };
			response?: unknown;
		};
		const slackError = error as SlackError;
        console.error(`❌ Error posting thread reply to ${channel}:`, {
            message: slackError.message,
            code: slackError.code,
            data: slackError.data,
            response: slackError.response,
        });
		
		// If channel_not_found, try to get channel list for debugging
		if (slackError.code === 'channel_not_found' || slackError.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				type Channel = { id?: string; name?: string };
				console.error(`Available channels:`, channels?.channels?.map((c: Channel) => ({ id: c.id, name: c.name })));
			} catch (listError) {
				console.error(`Could not list channels:`, listError);
			}
		}
		
        throw error;
    }
}

