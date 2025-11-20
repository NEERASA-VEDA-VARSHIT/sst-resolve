"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Committee Dashboard Error Page
 * Automatically catches errors in committee dashboard routes
 */
export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Committee dashboard error:", error);
	}, [error]);

	return (
		<div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center p-8">
			<div className="max-w-md space-y-6 text-center">
				<div className="flex justify-center">
					<div className="rounded-full bg-red-100 p-4 dark:bg-red-950">
						<AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
					</div>
				</div>
				
				<div className="space-y-2">
					<h2 className="text-2xl font-bold tracking-tight">
						Committee Dashboard Error
					</h2>
					<p className="text-sm text-muted-foreground">
						An error occurred while loading the committee dashboard. Please try again.
					</p>
				</div>

				{process.env.NODE_ENV === "development" && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-left dark:border-red-800 dark:bg-red-950/20">
						<p className="mb-2 text-xs font-semibold text-red-800 dark:text-red-300">
							Error Details (Development Only):
						</p>
						<pre className="overflow-x-auto text-xs text-red-700 dark:text-red-400">
							{error.message}
						</pre>
						{error.digest && (
							<p className="mt-2 text-xs text-red-600 dark:text-red-500">
								Digest: {error.digest}
							</p>
						)}
					</div>
				)}

				<div className="flex justify-center gap-3">
					<Button
						onClick={reset}
						variant="default"
						className="gap-2"
					>
						<RefreshCw className="h-4 w-4" />
						Try Again
					</Button>
					<Button
						onClick={() => window.location.href = "/committee/dashboard"}
						variant="outline"
					>
						Reload Dashboard
					</Button>
				</div>
			</div>
		</div>
	);
}
