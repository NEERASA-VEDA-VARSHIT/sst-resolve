"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { normalizeStatusForComparison } from "@/lib/utils";

export function StudentActions({ ticketId, currentStatus }: { ticketId: number; currentStatus: string }) {
	const router = useRouter();
	const [loading, setLoading] = useState(false);

	// Normalize status for comparison (handles both uppercase enum and lowercase constants)
	const normalizedStatus = normalizeStatusForComparison(currentStatus);

	const handleReopen = async () => {
		// Students can reopen closed or resolved tickets
		if (normalizedStatus !== "closed" && normalizedStatus !== "resolved") return;

		setLoading(true);
		try {
			const response = await fetch(`/api/tickets/${ticketId}/status`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: "REOPENED" }),
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

	// Students can only reopen closed/resolved tickets (escalation removed)
	const canReopen = normalizedStatus === "closed" || normalizedStatus === "resolved";

	if (!canReopen) {
		return null;
	}

	return (
		<Card className="border-2 border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
			<CardContent className="p-5">
				<div className="flex items-center justify-between flex-wrap gap-4">
					<div className="flex-1 min-w-0">
						<h3 className="text-base font-semibold text-blue-900 dark:text-blue-100 mb-1">
							Reopen Ticket
						</h3>
						<p className="text-sm text-blue-700 dark:text-blue-300">
							If your issue wasn't resolved, you can reopen this ticket for further assistance
						</p>
					</div>
					<Button
						variant="outline"
						onClick={handleReopen}
						disabled={loading}
						className="border-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 whitespace-nowrap"
						size="lg"
					>
						<RotateCcw className="w-4 h-4 mr-2" />
						{loading ? "Reopening..." : "Reopen Ticket"}
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
