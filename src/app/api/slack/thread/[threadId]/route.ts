import { WebClient } from "@slack/web-api";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const slack = process.env.SLACK_BOT_TOKEN ? new WebClient(process.env.SLACK_BOT_TOKEN) : null;

/**
 * Slack Thread API
 * Fetches messages from a Slack thread for display in the dashboard
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ threadId: string }> }
) {
    try {
        // Authenticate user
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { threadId } = await params;
        const { searchParams } = new URL(request.url);
        const channel = searchParams.get("channel");

        if (!channel) {
            return NextResponse.json(
                { error: "Channel parameter required" },
                { status: 400 }
            );
        }

        if (!slack) {
            return NextResponse.json(
                { error: "Slack not configured" },
                { status: 503 }
            );
        }

        console.log("[Slack API] Fetching thread", { threadId, channel });

        // Fetch thread messages
        const result = await slack.conversations.replies({
            channel,
            ts: threadId,
            limit: 100,
        });

        if (!result.messages) {
            return NextResponse.json({ messages: [] });
        }

        // Fetch user info for each message
        type SlackMessage = {
            ts?: string;
            text?: string;
            user?: string;
            bot_profile?: {
                name?: string;
                icons?: {
                    image_48?: string;
                };
            };
        };
        const messages = await Promise.all(
            result.messages.map(async (msg: SlackMessage) => {
                if (msg.user) {
                    try {
                        const userInfo = await slack!.users.info({ user: msg.user });
                        return {
                            ts: msg.ts,
                            text: msg.text,
                            user_info: {
                                name: userInfo.user?.real_name || userInfo.user?.name || "Unknown",
                                avatar: userInfo.user?.profile?.image_48 || userInfo.user?.profile?.image_72,
                            },
                        };
                    } catch (error) {
                        console.error("[Slack API] Error fetching user info:", error);
                        return {
                            ts: msg.ts,
                            text: msg.text,
                            user_info: {
                                name: "Unknown",
                                avatar: undefined,
                            },
                        };
                    }
                }
                return {
                    ts: msg.ts,
                    text: msg.text || msg.bot_profile?.name || "Bot",
                    user_info: {
                        name: msg.bot_profile?.name || "Bot",
                        avatar: msg.bot_profile?.icons?.image_48,
                    },
                };
            })
        );

        console.log(`[Slack API] Fetched ${messages.length} messages`);

        return NextResponse.json({ messages });
    } catch (error) {
        console.error("[Slack API] Error fetching thread:", error);
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json(
            {
                error: "Failed to fetch Slack thread",
                message: errorMessage,
            },
            { status: 500 }
        );
    }
}
