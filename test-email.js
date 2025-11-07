/**
 * Test SMTP Email Configuration
 * 
 * Run this script to test your email setup:
 * node test-email.js
 * 
 * Make sure your .env.local file has the correct SMTP credentials.
 */

// Load environment variables from .env.local
const fs = require('fs');
const path = require('path');

// Read .env.local file manually since we're in a Node script
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
	const envContent = fs.readFileSync(envPath, 'utf8');
	envContent.split('\n').forEach(line => {
		const trimmed = line.trim();
		if (trimmed && !trimmed.startsWith('#')) {
			const [key, ...values] = trimmed.split('=');
			if (key && values.length > 0) {
				process.env[key.trim()] = values.join('=').trim().replace(/^["']|["']$/g, '');
			}
		}
	});
}

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
	host: process.env.SMTP_HOST || "smtp.gmail.com",
	port: parseInt(process.env.SMTP_PORT || "587"),
	secure: process.env.SMTP_SECURE === "true",
	auth: {
		user: process.env.SMTP_USER,
		pass: process.env.SMTP_PASS,
	},
});

async function testEmail() {
	console.log('🔍 Testing SMTP Configuration...\n');
	console.log('SMTP_HOST:', process.env.SMTP_HOST || 'smtp.gmail.com');
	console.log('SMTP_PORT:', process.env.SMTP_PORT || '587');
	console.log('SMTP_USER:', process.env.SMTP_USER || '(not set)');
	console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***' + process.env.SMTP_PASS.slice(-4) : '(not set)');
	console.log('SMTP_FROM:', process.env.SMTP_FROM || process.env.SMTP_USER || '(not set)');
	console.log('\n');

	// Step 1: Verify connection
	try {
		console.log('Step 1: Verifying SMTP connection...');
		await transporter.verify();
		console.log('✅ SMTP connection verified successfully!\n');
	} catch (error) {
		console.error('❌ SMTP verification failed:', error.message);
		if (error.code === 'EAUTH') {
			console.error('\n⚠️  Authentication Error:');
			console.error('   For Gmail/Google Workspace:');
			console.error('   1. Enable 2-Step Verification');
			console.error('   2. Generate App Password: https://myaccount.google.com/apppasswords');
			console.error('   3. Use the App Password in SMTP_PASS (not your regular password)');
		}
		process.exit(1);
	}

	// Step 2: Send test email
	try {
		console.log('Step 2: Sending test email...');
		const testEmail = process.env.SMTP_USER || process.env.SMTP_FROM;
		
		if (!testEmail) {
			console.error('❌ No email address found to send test email to');
			process.exit(1);
		}

		const info = await transporter.sendMail({
			from: process.env.SMTP_FROM || process.env.SMTP_USER,
			to: testEmail,
			subject: 'Test Email - SST Resolve',
			html: `
				<h1>✅ Test Email Successful!</h1>
				<p>If you received this email, your SMTP configuration is working correctly.</p>
				<p><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
			`,
		});

		console.log('✅ Test email sent successfully!');
		console.log('   Message ID:', info.messageId);
		console.log('   Check your inbox:', testEmail);
		console.log('\n🎉 Email configuration is working correctly!');
	} catch (error) {
		console.error('❌ Failed to send test email:', error.message);
		process.exit(1);
	}
}

testEmail();

