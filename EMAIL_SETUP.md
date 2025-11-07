# Email Setup Guide

## Gmail / Google Workspace SMTP Configuration

To send emails using Gmail or Google Workspace (like `@sst.scaler.com`), you need to use an **App Password** instead of your regular password.

**Note**: If you're using an institutional email (like `@sst.scaler.com`), you may need to:
- Contact your IT admin to enable SMTP access
- Or use an App Password if 2FA is enabled
- Or check if your organization has specific SMTP settings

### Step 1: Enable 2-Step Verification

1. Go to your [Google Account](https://myaccount.google.com/)
2. Click on **Security** in the left sidebar
3. Under "How you sign in to Google", find **2-Step Verification**
4. Click on it and follow the prompts to enable it

### Step 2: Generate an App Password

1. Go back to your [Google Account Security](https://myaccount.google.com/security)
2. Under "How you sign in to Google", click on **2-Step Verification** (if not already enabled)
3. Scroll down and click on **App passwords**
4. You may need to sign in again
5. Select **Mail** as the app
6. Select **Other (Custom name)** as the device
7. Enter a name like "SST Resolve" and click **Generate**
8. Google will show you a 16-character password (like `abcd efgh ijkl mnop`)
9. **Copy this password** - you won't be able to see it again!

### Step 3: Configure Environment Variables

Add these to your `.env.local` file:

```env
# Gmail SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-character-app-password
SMTP_FROM=your-email@gmail.com
```

**Important Notes:**
- Use your **full Gmail address** for `SMTP_USER` (e.g., `yourname@gmail.com`)
- Use the **16-character App Password** (remove spaces if present) for `SMTP_PASS`
- Don't use your regular Gmail password - it won't work!

### Step 4: Test the Configuration

After setting up, restart your dev server. You should see:
- ✅ `SMTP server is ready to send emails` on startup (if configured correctly)
- ❌ `SMTP server verification failed` if there's an issue

### Alternative: Other Email Providers

If you're not using Gmail, configure accordingly:

**Outlook/Hotmail:**
```env
SMTP_HOST=smtp-mail.outlook.com
SMTP_PORT=587
SMTP_SECURE=false
```

**SendGrid:**
```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
```

**Custom SMTP:**
```env
SMTP_HOST=your-smtp-server.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
```

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"
- **Solution**: Make sure you're using an App Password, not your regular password
- Verify 2-Step Verification is enabled
- Regenerate the App Password if needed

### Error: "Connection timeout"
- Check your firewall settings
- Verify SMTP_HOST and SMTP_PORT are correct
- Try using port 465 with `SMTP_SECURE=true` instead

### Emails not sending
- Check the server logs for detailed error messages
- Verify all environment variables are set correctly
- Test with a simple email first

