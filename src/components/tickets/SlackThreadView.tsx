"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

interface SlackMessage {
    ts: string;
    text: string;
    user_info?: {
        name: string;
        avatar?: string;
    };
}

interface SlackThreadViewProps {
    threadId?: string | null;
    channel?: string | null;
}

export function SlackThreadView({ threadId, channel }: SlackThreadViewProps) {
    const [messages, setMessages] = useState<SlackMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchThread() {
            if (!threadId || !channel) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                const response = await fetch(
                    `/api/slack/thread/${threadId}?channel=${encodeURIComponent(channel)}`
                );

                if (!response.ok) {
                    throw new Error("Failed to fetch Slack thread");
                }

                // Check Content-Type before parsing JSON
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new Error("Server returned non-JSON response");
                }

                const data = await response.json();
                setMessages(data.messages || []);
            } catch (err) {
                console.error("Error fetching Slack thread:", err);
                setError("Failed to load Slack thread");
            } finally {
                setLoading(false);
            }
        }

        fetchThread();
    }, [threadId, channel]);

    if (!threadId || !channel) {
        return (
            <Card>
                <CardContent className="p-6 text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No Slack thread available for this ticket</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        Slack Thread
                    </CardTitle>
                    {threadId && channel && (
                        <Button
                            variant="outline"
                            size="sm"
                            asChild
                        >
                            <a
                                href={`slack://channel?team=&id=${channel.replace("#", "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open in Slack
                            </a>
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex gap-3">
                                <Skeleton className="w-8 h-8 rounded-full" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-3 w-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center text-muted-foreground py-4">
                        <p className="text-destructive">{error}</p>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-4">
                        <p>No messages in this thread yet</p>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.ts} className="flex gap-3">
                            <Avatar className="w-8 h-8">
                                {msg.user_info?.avatar && (
                                    <AvatarImage src={msg.user_info.avatar} alt={msg.user_info.name} />
                                )}
                                <AvatarFallback>
                                    {msg.user_info?.name?.charAt(0)?.toUpperCase() || "?"}
                                </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm">
                                        {msg.user_info?.name || "Unknown"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatDistanceToNow(new Date(parseFloat(msg.ts) * 1000), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                </div>
                                <p className="text-sm mt-1 whitespace-pre-wrap break-words">
                                    {msg.text}
                                </p>
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    );
}
