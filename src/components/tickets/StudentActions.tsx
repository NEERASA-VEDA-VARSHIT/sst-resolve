"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

export function StudentActions({ ticketId, currentStatus }: { ticketId: number; currentStatus: string }) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	const handleReopen = async () => {
		if (currentStatus !== "closed") return;

		setLoading(true);
		try {
			const response = await fetch(`/api/tickets/${ticketId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "open" }),
			});

			if (response.ok) {
				toast.success("Ticket reopened successfully");
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to reopen ticket" }));
				toast.error(error.error || "Failed to reopen ticket");
			}
		} catch (error) {
			console.error("Error reopening ticket:", error);
			toast.error("Failed to reopen ticket. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (currentStatus !== "closed") {
		return null;
	}

	return (
		<div className="border-t pt-4 space-y-4">
			<label className="text-sm font-medium text-muted-foreground block">
				👤 Student Actions
			</label>

			<div className="flex flex-wrap gap-2">
				<Button
					variant="outline"
					onClick={handleReopen}
					disabled={loading}
				>
					<RotateCcw className="w-4 h-4 mr-2" />
					{loading ? "Reopening..." : "Reopen Ticket"}
				</Button>
			</div>
		</div>
	);
}

