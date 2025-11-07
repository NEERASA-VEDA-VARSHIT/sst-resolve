import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, tickets } from "@/db";
import { desc, eq } from "drizzle-orm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calendar, ExternalLink, ArrowLeft } from "lucide-react";

export default async function PublicDashboardPage() {
	const { userId, sessionClaims } = await auth();
	const role = sessionClaims?.metadata?.role || "student";
	const isAdmin = role === "admin" || role === "super_admin";
	
	// Get userNumber for students to check ticket ownership
	let userNumber: string | undefined;
	if (userId && role === "student") {
		try {
			const client = await clerkClient();
			const user = await client.users.getUser(userId);
			userNumber = (user.publicMetadata as any)?.userNumber as string | undefined;
		} catch (e) {
			// Ignore errors
		}
	}

	// Fetch only public tickets
	const publicTickets = await db
		.select()
		.from(tickets)
		.where(eq(tickets.isPublic, "true"))
		.orderBy(desc(tickets.createdAt));

	const getStatusBadgeClass = (status: string | null) => {
		if (!status) return "bg-muted text-foreground";
		switch (status) {
			case 'open':
				return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border-transparent';
			case 'reopened':
				return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 border-transparent';
			case 'in_progress':
				return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border-transparent';
			case 'awaiting_student_response':
				return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border-transparent';
			case 'resolved':
				return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 border-transparent';
			case 'closed':
				return 'bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200 border-transparent';
			default:
				return 'bg-muted text-foreground';
		}
	};

	return (
		<div className="min-h-screen bg-background">
			{/* Header */}
			<header className="border-b bg-card">
				<div className="container mx-auto px-6 py-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-4">
							{isAdmin && (
								<Button variant="outline" size="sm" asChild>
									<Link href={role === "super_admin" ? "/superadmin/dashboard" : "/admin/dashboard"}>
										<ArrowLeft className="w-4 h-4 mr-2" />
										Back to Dashboard
									</Link>
								</Button>
							)}
							<h1 className="text-2xl font-bold">SST Resolve - Public Dashboard</h1>
						</div>
					</div>
				</div>
			</header>

			{/* Main Content */}
			<main className="container mx-auto px-6 py-8">
				<div className="mb-6">
					<p className="text-muted-foreground">
						View publicly shared tickets and their current status. These tickets have been made public by administrators.
					</p>
					{isAdmin && (
						<p className="text-sm text-muted-foreground mt-2">
							As an {role === "super_admin" ? "super admin" : "admin"}, you can click on tickets to view full details and manage them.
						</p>
					)}
				</div>

				{publicTickets.length === 0 ? (
					<Card>
						<CardContent className="py-12 text-center">
							<p className="text-muted-foreground">No public tickets available at this time.</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{publicTickets.map((ticket) => {
							// Check if user can see comments (ticket owner, admin, or super admin)
							const canSeeComments = isAdmin || (userId && userNumber && ticket.userNumber === userNumber);
							
							// Parse details to get comments count (only if user can see comments)
							let commentsCount = 0;
							if (canSeeComments) {
								try {
									if (ticket.details) {
										const details = JSON.parse(ticket.details);
										commentsCount = details.comments?.filter((c: any) => !c?.isInternal && c?.type !== "super_admin_note").length || 0;
									}
								} catch (e) {
									// Ignore parse errors
								}
							}

							const TicketCardContent = (
								<Card key={ticket.id} className={`hover:shadow-md transition-shadow ${isAdmin ? 'cursor-pointer hover:border-primary' : ''}`}>
									<CardHeader className="pb-3">
										<div className="flex items-start justify-between">
											<div className="space-y-2 flex-1">
												<div className="flex items-center gap-2 flex-wrap">
													<CardTitle className="text-lg">Ticket #{ticket.id}</CardTitle>
													<Badge variant="outline">{ticket.category}</Badge>
													{ticket.status && (
														<Badge variant="outline" className={getStatusBadgeClass(ticket.status)}>
															{ticket.status.replaceAll('_', ' ')}
														</Badge>
													)}
												</div>
												{ticket.subcategory && (
													<p className="text-sm text-muted-foreground">{ticket.subcategory}</p>
												)}
											</div>
										</div>
									</CardHeader>
									<CardContent className="pt-0">
										<p className="text-sm text-muted-foreground mb-4 line-clamp-2">
											{ticket.description || "No description provided"}
										</p>
										<div className="flex items-center justify-between text-sm">
											<div className="flex items-center gap-2 text-muted-foreground">
												<Calendar className="w-3 h-3" />
												{ticket.createdAt?.toLocaleDateString()}
											</div>
											{canSeeComments && commentsCount > 0 && (
												<Badge variant="secondary" className="text-xs">
													{commentsCount} comment{commentsCount !== 1 ? 's' : ''}
												</Badge>
											)}
										</div>
										{isAdmin && (
											<div className="mt-4 pt-4 border-t">
												<Button variant="outline" size="sm" className="w-full" asChild>
													<Link href={role === "super_admin" ? `/superadmin/dashboard/ticket/${ticket.id}` : `/admin/dashboard/ticket/${ticket.id}`}>
														View Details
														<ExternalLink className="w-3 h-3 ml-2" />
													</Link>
												</Button>
											</div>
										)}
									</CardContent>
								</Card>
							);

							// If admin, wrap in link; otherwise just return the card
							if (isAdmin) {
								return (
									<Link 
										key={ticket.id}
										href={role === "super_admin" ? `/superadmin/dashboard/ticket/${ticket.id}` : `/admin/dashboard/ticket/${ticket.id}`}
									>
										{TicketCardContent}
									</Link>
								);
							}

							return TicketCardContent;
						})}
					</div>
				)}
			</main>
		</div>
	);
}

