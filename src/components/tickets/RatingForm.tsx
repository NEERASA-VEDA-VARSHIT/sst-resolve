"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Star } from "lucide-react";

interface RatingFormProps {
	ticketId: number;
	currentRating?: string;
}

export function RatingForm({ ticketId, currentRating }: RatingFormProps) {
	const router = useRouter();
	const [rating, setRating] = useState<number | null>(currentRating ? parseInt(currentRating, 10) : null);
	const [hoveredRating, setHoveredRating] = useState<number | null>(null);
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!rating) {
			toast.error("Please select a rating");
			return;
		}

		setLoading(true);
		try {
			const response = await fetch(`/api/tickets/${ticketId}/rate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ rating }),
			});

            if (response.ok) {
                toast.success(`Thank you! Your rating of ${rating}/5 has been recorded.`);
				router.refresh();
			} else {
				const error = await response.json().catch(() => ({ error: "Failed to submit rating" }));
				toast.error(error.error || "Failed to submit rating");
			}
		} catch (error) {
			console.error("Error submitting rating:", error);
			toast.error("Failed to submit rating. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	if (currentRating) {
		return (
			<div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950">
				<Label className="text-sm font-medium mb-2 block">Rating Submitted</Label>
				<div className="flex items-center gap-2">
					<div className="flex">
                        {[1, 2, 3, 4, 5].map((num) => (
							<Star
								key={num}
								className={`w-5 h-5 ${
									num <= parseInt(currentRating, 10)
										? "fill-yellow-400 text-yellow-400"
										: "text-gray-300"
								}`}
							/>
						))}
					</div>
                    <span className="text-lg font-semibold">{currentRating}/5</span>
				</div>
				<p className="text-sm text-muted-foreground mt-2">Thank you for your feedback!</p>
			</div>
		);
	}

	return (
		<form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-muted/50">
            <Label className="text-sm font-medium mb-3 block">
                Rate Your Experience (1-5)
            </Label>
			<div className="flex items-center gap-2 mb-4">
                {[1, 2, 3, 4, 5].map((num) => (
					<button
						key={num}
						type="button"
						onClick={() => setRating(num)}
						onMouseEnter={() => setHoveredRating(num)}
						onMouseLeave={() => setHoveredRating(null)}
						className="transition-colors"
					>
						<Star
							className={`w-6 h-6 ${
								num <= (hoveredRating || rating || 0)
									? "fill-yellow-400 text-yellow-400"
									: "text-gray-300"
							} hover:scale-110 transition-transform`}
						/>
					</button>
				))}
                {rating && (
                    <span className="ml-2 text-lg font-semibold">{rating}/5</span>
                )}
			</div>
			<Button type="submit" disabled={!rating || loading}>
				{loading ? "Submitting..." : "Submit Rating"}
			</Button>
		</form>
	);
}

