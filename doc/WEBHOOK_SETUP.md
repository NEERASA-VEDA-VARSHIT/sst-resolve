# Clerk Webhook Setup Guide

## Overview

The Clerk webhook automatically creates and updates user records in the database when users sign up or update their profiles. This ensures the `users` table stays in sync with Clerk.

## Setup Instructions

### 1. Install Dependencies

```bash
pnpm install
```

This will install the `svix` package needed for webhook verification.

### 2. Get Webhook Secret from Clerk

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Select your application
3. Navigate to **Webhooks** in the sidebar
4. Click **Add Endpoint**
5. Enter your webhook URL:
   - **Development**: `http://localhost:3000/api/webhooks/clerk` (use ngrok for local testing)
   - **Production**: `https://your-domain.com/api/webhooks/clerk`
6. Subscribe to these events:
   - ✅ `user.created`
   - ✅ `user.updated`
   - ✅ `user.deleted` (optional)
7. Copy the **Signing Secret** (starts with `whsec_...`)

### 3. Add Environment Variable

Add the webhook secret to your `.env.local` file:

```env
CLERK_WEBHOOK_SECRET=whsec_...
```

**Important**: Never commit this secret to version control!

### 4. Test the Webhook

#### Option A: Local Testing with ngrok

1. Install ngrok: `npm install -g ngrok` or download from [ngrok.com](https://ngrok.com)
2. Start your Next.js dev server: `pnpm dev`
3. In another terminal, expose your local server:
   ```bash
   ngrok http 3000
   ```
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. In Clerk Dashboard, add webhook endpoint: `https://abc123.ngrok.io/api/webhooks/clerk`
6. Test by creating a new user in Clerk

#### Option B: Test in Production

1. Deploy your application
2. Add webhook endpoint in Clerk Dashboard pointing to your production URL
3. Test by creating a new user

### 5. Verify Webhook is Working

After setting up, check:

1. **Database**: New users should appear in the `users` table automatically
2. **Logs**: Check your application logs for webhook events:
   ```
   [Clerk Webhook] Received event: user.created
   [Clerk Webhook] Created user record: <uuid> for Clerk user: <clerk_id>
   ```

## How It Works

### User Created Event

When a user signs up:
1. Clerk sends `user.created` webhook
2. Webhook handler creates record in `users` table:
   - `clerk_id`: Clerk's user ID
   - `email`: User's email
   - `name`: User's full name (from firstName + lastName)
   - `phone`: User's phone number (if provided)

### User Updated Event

When a user updates their profile:
1. Clerk sends `user.updated` webhook
2. Webhook handler syncs data to `users` table
3. Updates: email, name, phone

### User Deleted Event

Currently, user deletion is logged but doesn't remove the database record. You can modify `handleUserDeleted` in `src/app/api/webhooks/clerk/route.ts` to implement soft delete or hard delete.

## Troubleshooting

### Webhook Not Receiving Events

1. **Check webhook URL**: Ensure it's correct and accessible
2. **Check signing secret**: Verify `CLERK_WEBHOOK_SECRET` is set correctly
3. **Check logs**: Look for webhook verification errors
4. **Test endpoint**: Use Clerk's "Send test event" button in webhook settings

### Users Not Created in Database

1. **Check database connection**: Ensure database is accessible
2. **Check logs**: Look for database errors
3. **Verify schema**: Ensure `users` table exists and has correct structure
4. **Check permissions**: Ensure database user has INSERT/UPDATE permissions

### Webhook Verification Fails

1. **Check svix headers**: Ensure Clerk is sending proper headers
2. **Verify secret**: Double-check `CLERK_WEBHOOK_SECRET` matches Clerk dashboard
3. **Check request body**: Ensure body is not modified before verification

## Security Notes

- ✅ Webhook uses Svix signature verification
- ✅ Only processes events from Clerk (verified signatures)
- ✅ Idempotent: Won't create duplicate users
- ⚠️ Keep `CLERK_WEBHOOK_SECRET` secure
- ⚠️ Use HTTPS in production

## Manual User Sync

If webhook fails or you need to sync existing users:

```typescript
import { syncUserFromClerk } from "@/lib/user-sync";

// Sync a specific user
await syncUserFromClerk("clerk_user_id_here");
```

## Next Steps

After webhook is set up:

1. ✅ Users are auto-created on signup
2. ✅ Users are auto-updated on profile changes
3. ✅ Profile route can link `userNumber` to create `students` record
4. ✅ All existing code continues to work (backward compatible)

