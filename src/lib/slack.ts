import { WebClient } from "@slack/web-api";
import { slackConfig } from "@/conf/config";

const slack = slackConfig.botToken ? new WebClient(slackConfig.botToken) : null;

// Channel mapping driven by config
const SLACK_CHANNELS: Record<"Hostel" | "College" | "Committee", string> = {
	Hostel: slackConfig.channels.hostel,
	College: slackConfig.channels.college,
	Committee: slackConfig.channels.committee,
};

export async function postToSlackChannel(
    category: "Hostel" | "College" | "Committee",
    text: string,
    ticketId?: number,
    ccUserIds?: string[],
    channelOverride?: string
): Promise<string | null> {
	console.log("[Slack] Preparing message", {
		category,
		ticketId,
		channelOverride,
		hasBotToken: !!slackConfig.botToken,
	});

	if (!slack) {
		console.warn("[Slack] SLACK_BOT_TOKEN not set; skipping Slack send.");
		return null;
	}

	const channel = channelOverride || SLACK_CHANNELS[category];
	if (!channel) {
		console.warn("[Slack] No channel configured for category", { category, channelOverride });
		return null;
	}

	try {
		// Normalize channel name (remove # if present, Slack API handles both)
		const normalizedChannel = channel.startsWith('#') ? channel.slice(1) : channel;
		
		// Append CC mentions to the text if provided
        const ccSuffix = Array.isArray(ccUserIds) && ccUserIds.length > 0
            ? `\nCC: ${ccUserIds.map((id) => `<@${id}>`).join(" ")}`
            : "";

        const blocks = [
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
			} as any);
		}

		console.log("[Slack] Sending chat.postMessage", {
			channel: normalizedChannel,
			category,
			ticketId,
			ccCount: ccUserIds?.length || 0,
		});
        const result = await slack.chat.postMessage({
			channel: normalizedChannel,
            text: `${text}${ccSuffix}`,
			blocks,
		});
		
		const messageTs = result.ts || null;
		console.log("[Slack] Message posted", {
			channel: normalizedChannel,
			ticketId,
			messageTs,
		});
		return messageTs;
	} catch (error: any) {
		console.error(`[Slack] Error posting to ${channel}`, {
			message: error.message,
			code: error.code,
			data: error.data,
			response: error.response,
		});
		
		// If channel_not_found, try to get channel list for debugging
		if (error.code === 'channel_not_found' || error.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				console.error(`Available channels:`, channels?.channels?.map((c: any) => ({ id: c.id, name: c.name })));
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
	} catch (error: any) {
		console.error(`❌ Error posting thread reply to ${channel}:`, {
			message: error.message,
			code: error.code,
			data: error.data,
			response: error.response,
		});
		
		// If channel_not_found, try to get channel list for debugging
		if (error.code === 'channel_not_found' || error.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				console.error(`Available channels:`, channels?.channels?.map((c: any) => ({ id: c.id, name: c.name })));
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
    } catch (error: any) {
        console.error(`❌ Error posting thread reply to ${channel}:`, {
            message: error.message,
            code: error.code,
            data: error.data,
            response: error.response,
        });
		
		// If channel_not_found, try to get channel list for debugging
		if (error.code === 'channel_not_found' || error.data?.error === 'channel_not_found') {
			try {
				const channels = await slack?.conversations.list({ types: 'public_channel,private_channel' });
				console.error(`Available channels:`, channels?.channels?.map((c: any) => ({ id: c.id, name: c.name })));
			} catch (listError) {
				console.error(`Could not list channels:`, listError);
			}
		}
		
        throw error;
    }
}

