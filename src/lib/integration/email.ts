import nodemailer from "nodemailer";
import { db } from "@/db";
import { students } from "@/db";
import { eq } from "drizzle-orm";

import { escapeHtml } from "@/utils";

function areEmailNotificationsEnabled(): boolean {
	const flag = process.env.ENABLE_EMAIL_NOTIFICATIONS;
	if (flag === undefined) return true;
	return flag !== "false";
}

// Helper function to get student email by roll number or user_id
export async function getStudentEmail(rollNoOrUserId: string): Promise<string | null> {
	try {
		// Try to find by roll_no first
		const [student] = await db
			.select({ user_id: students.user_id })
			.from(students)
			.where(eq(students.roll_no, rollNoOrUserId))
			.limit(1);

		if (!student) {
			return null;
		}

		// Get email from users table
		const { users } = await import("@/db");
		const [user] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, student.user_id))
			.limit(1);

		return user?.email || null;
	} catch (error) {
		console.error(`Error fetching student email for ${rollNoOrUserId}:`, error);
		return null;
	}
}

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || "smtp.gmail.com",
	port: parseInt(process.env.SMTP_PORT || "587"),
	secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
	// Add connection timeout and retry options
	connectionTimeout: 10000, // 10 seconds
	greetingTimeout: 10000,
	pool: true,
	maxConnections: 1,
	maxMessages: 100,
});

// Verify transporter on startup (non-blocking)
if (process.env.SMTP_USER && process.env.SMTP_PASS) {
	transporter.verify().then(() => {
		console.log("✅ SMTP server is ready to send emails");
	}).catch((error: unknown) => {
		type SMTPError = {
			message?: string;
			code?: string;
		};
		const smtpError = error as SMTPError;
		console.error("❌ SMTP server verification failed:", smtpError.message);
		if (smtpError.code === "EAUTH") {
			console.error("⚠️  Authentication failed. For Gmail:");
			console.error("   1. Enable 2-Step Verification on your Google Account");
			console.error("   2. Generate an App Password at: https://myaccount.google.com/apppasswords");
			console.error("   3. Use the App Password (not your regular password) in SMTP_PASS");
			console.error("   See EMAIL_SETUP.md for detailed instructions");
		} else {
			console.warn("⚠️  Email sending may not work. Please check your SMTP configuration.");
		}
	});
} else {
	console.warn("⚠️  SMTP credentials not configured. Email notifications will be disabled.");
	console.warn("   Set SMTP_USER and SMTP_PASS in .env.local to enable email notifications.");
}

export interface EmailOptions {
	to: string;
	subject: string;
	html: string;
	ticketId?: number; // Optional ticket ID for email threading
	threadMessageId?: string; // Optional Message-ID to thread replies
	originalSubject?: string; // Optional original subject for threading replies
}

// Generate a consistent Message-ID for a ticket
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTicketMessageId(_ticketId: number): string {
	const domain = process.env.EMAIL_DOMAIN || "sst-resolve.local";
	return `<ticket-${_ticketId}@${domain}>`;
}

export async function sendEmail({ to, subject, html, ticketId, threadMessageId, originalSubject }: EmailOptions) {
	console.log(`[sendEmail] Attempting to send email to ${to}${ticketId ? ` for ticket #${ticketId}` : ''}`);
	
	// Check if email notifications are enabled
	if (!areEmailNotificationsEnabled()) {
		console.log(`[sendEmail] Email notifications are disabled in settings; skipping email send to ${to}`);
		return null;
	}
	
	if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
		console.error("❌ [sendEmail] SMTP credentials not configured; skipping email send.");
		console.error(`   SMTP_USER: ${process.env.SMTP_USER ? 'set' : 'NOT SET'}`);
		console.error(`   SMTP_PASS: ${process.env.SMTP_PASS ? 'set' : 'NOT SET'}`);
		return null;
	}

	// Validate email address
	if (!to || !to.includes("@")) {
		console.error(`❌ [sendEmail] Invalid email address: ${to}`);
		return null;
	}

	try {
		type MailOptions = {
			from?: string;
			to: string;
			subject: string;
			html: string;
			text?: string;
			attachments?: Array<{ filename: string; path: string }>;
			headers?: Record<string, string>;
			messageId?: string;
			inReplyTo?: string;
			references?: string;
		};
		const mailOptions: MailOptions = {
			from: process.env.SMTP_FROM || process.env.SMTP_USER,
			to,
			subject,
			html,
		};

		// Add email threading headers if ticketId is provided
		if (ticketId && threadMessageId) {
			// Ensure Message-ID is in correct format (with angle brackets)
			const originalMessageId = threadMessageId.startsWith("<") && threadMessageId.endsWith(">")
				? threadMessageId
				: `<${threadMessageId}>`;
			
			// This is a reply - add threading headers to link to the original email
			// In-Reply-To should match the original Message-ID exactly
			mailOptions.inReplyTo = originalMessageId;
			// References should include the original Message-ID (and optionally chain of previous messages)
			mailOptions.references = originalMessageId;
			// Also set headers directly for better compatibility
			// Safety check: ensure headers is a valid object before spreading
			const existingHeaders = mailOptions.headers && typeof mailOptions.headers === 'object' && !Array.isArray(mailOptions.headers)
				? mailOptions.headers
				: {};
			mailOptions.headers = {
				...existingHeaders,
				"In-Reply-To": originalMessageId,
				"References": originalMessageId,
			};
			
			// For proper threading, use the original subject with "Re:" prefix
			// Email clients require matching subjects for threading to work properly
			// Use originalSubject if provided (from ticket details), otherwise use current subject
			if (originalSubject) {
				// Use the original subject to ensure perfect threading
				mailOptions.subject = `Re: ${originalSubject}`;
			} else if (!mailOptions.subject?.startsWith("Re:")) {
				// Fallback: add "Re:" to current subject if original not available
				mailOptions.subject = `Re: ${mailOptions.subject}`;
			}
			
			console.log(`   🔗 Threading as reply to: ${originalMessageId}`);
			console.log(`   📋 Threading headers: In-Reply-To="${originalMessageId}", References="${originalMessageId}"`);
			console.log(`   📝 Subject: ${mailOptions.subject}`);
		} else if (ticketId && !threadMessageId) {
			console.log(`   📧 First email for ticket #${ticketId} - will store Message-ID for threading`);
		}
		// For the first email, let Nodemailer generate the Message-ID automatically
		// We'll store the actual Message-ID returned from sendMail() in ticket details

		console.log(`[sendEmail] Sending mail via SMTP to ${to}...`);
		const info = await transporter.sendMail(mailOptions);

		if (info && info.messageId) {
			console.log(`✅ [sendEmail] Email sent successfully to ${to} (Message-ID: ${info.messageId})`);
			if (ticketId && threadMessageId) {
				const originalMessageId = threadMessageId.startsWith("<") && threadMessageId.endsWith(">")
					? threadMessageId
					: `<${threadMessageId}>`;
				console.log(`   ✅ Threaded as reply to: ${originalMessageId}`);
				console.log(`   📋 Headers set: In-Reply-To=${originalMessageId}, References=${originalMessageId}`);
			}
		} else {
			console.warn(`⚠️  [sendEmail] Email sent but no Message-ID returned for ${to}`);
			console.warn(`   Info object: ${JSON.stringify(info)}`);
		}

		return info;
	} catch (error: unknown) {
		type EmailError = {
			message?: string;
			code?: string;
			command?: string;
			response?: string;
			responseCode?: number;
			[key: string]: unknown;
		};
		const emailError = error as EmailError;
		// Log detailed error information
		console.error(`❌ [sendEmail] Error sending email to ${to}:`, {
			message: emailError.message,
			code: emailError.code,
			command: emailError.command,
			response: emailError.response,
			responseCode: emailError.responseCode,
		});
		
		// Log specific error details
		if (emailError.code === "EAUTH") {
			console.error("   ❌ Authentication failed. Check SMTP credentials.");
			console.error("   For Gmail: Use App Password, not regular password.");
		} else if (emailError.code === "ECONNECTION") {
			console.error("   ❌ Connection failed. Check SMTP host and port.");
		} else if (emailError.response) {
			console.error(`   ❌ SMTP Server Response: ${emailError.response}`);
		}
		
		if (error instanceof Error && error.stack) {
			console.error(`   Stack trace:`, error.stack);
		}
		
		// Don't throw - return null so calling code can handle gracefully
		return null;
	}
}

// Email templates
export function getTicketCreatedEmail(
	ticketId: number, 
	category: string, 
	subcategory: string, 
	description?: string,
	contactName?: string,
	contactPhone?: string,
	roomNumber?: string,
	batchYear?: number,
	classSection?: string
) {
	const contactInfo = [];
	if (contactName) contactInfo.push(`<p><strong>Name:</strong> ${escapeHtml(contactName)}</p>`);
	if (contactPhone) contactInfo.push(`<p><strong>Phone:</strong> ${escapeHtml(contactPhone)}</p>`);
	if (category === "Hostel" && roomNumber) {
		contactInfo.push(`<p><strong>Room Number:</strong> ${escapeHtml(roomNumber)}</p>`);
	}
	if (category === "College") {
		if (batchYear) contactInfo.push(`<p><strong>Batch Year:</strong> ${batchYear}</p>`);
		if (classSection) contactInfo.push(`<p><strong>Class Section:</strong> ${escapeHtml(classSection)}</p>`);
	}

	return {
		subject: `Ticket #${ticketId} Created - ${category}`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.ticket-info { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
					.contact-info { background-color: #f0f9ff; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #0ea5e9; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🎫 Ticket Created</h1>
					</div>
					<div class="content">
						<p>Your ticket has been successfully created!</p>
						<div class="ticket-info">
							<p><strong>Ticket ID:</strong> #${ticketId}</p>
							<p><strong>Category:</strong> ${escapeHtml(category)}</p>
							<p><strong>Subcategory:</strong> ${escapeHtml(subcategory)}</p>
							${description ? `<p><strong>Description:</strong> ${escapeHtml(description)}</p>` : ""}
							<p><strong>Status:</strong> Open</p>
						</div>
						${contactInfo.length > 0 ? `
						<div class="contact-info">
							<h3 style="margin-top: 0;">Contact Information</h3>
							${contactInfo.join('')}
						</div>
						` : ''}
						<p>We'll keep you updated on the progress of your ticket.</p>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

export function getStatusUpdateEmail(ticketId: number, status: string, category: string) {
	const statusMessages: Record<string, { emoji: string; message: string }> = {
		in_progress: { emoji: "🔄", message: "Your ticket is now in progress" },
		closed: { emoji: "✅", message: "Your ticket has been closed" },
		open: { emoji: "🔄", message: "Your ticket has been reopened" },
	};

	const statusInfo = statusMessages[status] || { emoji: "📝", message: `Your ticket status has been updated to ${status}` };

	return {
		subject: `Re: ${statusInfo.emoji} Ticket #${ticketId} - Status Updated`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; }
					.status-open { background-color: #10b981; color: white; }
					.status-in-progress { background-color: #f59e0b; color: white; }
					.status-closed { background-color: #6b7280; color: white; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>${statusInfo.emoji} ${statusInfo.message}</h1>
					</div>
					<div class="content">
						<p>Your ticket status has been updated:</p>
						<p>
							<strong>Ticket ID:</strong> #${ticketId}<br>
							<strong>Category:</strong> ${escapeHtml(category)}<br>
							<strong>New Status:</strong> 
							<span class="status-badge status-${status.replace("_", "-")}">${status.replace("_", " ").toUpperCase()}</span>
						</p>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

export function getCommentAddedEmail(ticketId: number, comment: string, author: string, category: string) {
	return {
		subject: `Re: 💬 New Comment on Ticket #${ticketId}`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.comment-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>💬 New Comment Added</h1>
					</div>
					<div class="content">
						<p>A new comment has been added to your ticket:</p>
						<div class="comment-box">
							<p><strong>Ticket ID:</strong> #${ticketId}</p>
							<p><strong>Category:</strong> ${escapeHtml(category)}</p>
							<p><strong>Comment by:</strong> ${escapeHtml(author)}</p>
							<p><strong>Comment:</strong></p>
							<p style="white-space: pre-wrap;">${escapeHtml(comment)}</p>
						</div>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

export function getTATSetEmail(ticketId: number, tat: string, tatDate: string, category: string, isExtension: boolean = false, markInProgress: boolean = false) {
	const targetDate = new Date(tatDate).toLocaleDateString();
	const title = markInProgress 
		? (isExtension ? "TAT Extended & In Progress" : "TAT Set & Ticket In Progress")
		: (isExtension ? "TAT Extended" : "TAT Set");
	
	return {
		subject: `Re: ⏱️ ${title} - Ticket #${ticketId}`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.tat-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #4F46E5; }
					.status-badge { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; margin: 10px 0; background-color: #f59e0b; color: white; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>⏱️ ${escapeHtml(title)}</h1>
					</div>
					<div class="content">
						${markInProgress 
							? `<p>Your ticket has been marked as <span class="status-badge">IN PROGRESS</span> and ${isExtension ? "the Turnaround Time (TAT) has been extended." : "a Turnaround Time (TAT) has been set."}</p>`
							: `<p>${isExtension ? "The Turnaround Time (TAT) for your ticket has been extended." : "A Turnaround Time (TAT) has been set for your ticket."}</p>`
						}
						<div class="tat-box">
							<p><strong>Ticket ID:</strong> #${ticketId}</p>
							<p><strong>Category:</strong> ${escapeHtml(category)}</p>
							${markInProgress ? `<p><strong>Status:</strong> <span class="status-badge">IN PROGRESS</span></p>` : ""}
							<p><strong>TAT:</strong> ${escapeHtml(tat)}</p>
							<p><strong>Target Date:</strong> ${targetDate}</p>
							<p>We'll work to resolve your ticket within this timeframe and keep you updated on the progress.</p>
						</div>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

export function getTATReminderEmail(ticketId: number, tat: string, category: string) {
	return {
		subject: `Re: ⏰ TAT Reminder - Ticket #${ticketId}`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.reminder-box { background-color: #fef3c7; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #f59e0b; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>⏰ TAT Reminder</h1>
					</div>
					<div class="content">
						<p>This is a reminder that your ticket has reached its Turnaround Time (TAT) date.</p>
						<div class="reminder-box">
							<p><strong>Ticket ID:</strong> #${ticketId}</p>
							<p><strong>Category:</strong> ${escapeHtml(category)}</p>
							<p><strong>TAT:</strong> ${escapeHtml(tat)}</p>
							<p>Please note that the ticket is still being processed. We'll update you on any progress.</p>
						</div>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

export function getEscalationEmail(ticketId: number, category: string, escalationCount: number) {
	const isUrgent = escalationCount >= 2;
	return {
		subject: `Re: 🚨 Ticket #${ticketId} Escalated${isUrgent ? " (URGENT)" : ""}`,
		html: `
			<!DOCTYPE html>
			<html>
			<head>
				<style>
					body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
					.container { max-width: 600px; margin: 0 auto; padding: 20px; }
					.header { background-color: ${isUrgent ? "#dc2626" : "#ef4444"}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
					.content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
					.escalation-box { background-color: ${isUrgent ? "#fee2e2" : "#fef2f2"}; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid ${isUrgent ? "#dc2626" : "#ef4444"}; }
					.footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
				</style>
			</head>
			<body>
				<div class="container">
					<div class="header">
						<h1>🚨 Ticket Escalated${isUrgent ? " (URGENT)" : ""}</h1>
					</div>
					<div class="content">
						<p>Your ticket has been escalated to ensure prompt attention.</p>
						<div class="escalation-box">
							<p><strong>Ticket ID:</strong> #${ticketId}</p>
							<p><strong>Category:</strong> ${escapeHtml(category)}</p>
							<p><strong>Escalation Count:</strong> ${escalationCount}</p>
							${isUrgent ? "<p><strong>Priority:</strong> URGENT - This ticket has been escalated multiple times and requires immediate attention.</p>" : ""}
							<p>We will prioritize your ticket and update you shortly.</p>
						</div>
					</div>
					<div class="footer">
						<p>This is an automated email from SST Resolve</p>
					</div>
				</div>
			</body>
			</html>
		`,
	};
}

