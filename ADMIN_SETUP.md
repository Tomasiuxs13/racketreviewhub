# Admin Panel Setup Guide

This guide explains how to set up the admin panel with Supabase authentication.

## Prerequisites

1. A Supabase project with Authentication enabled
2. A user account in Supabase with email `tomasnorkuss@gmail.com`
3. Supabase project URL and anon key

## Setup Steps

### 1. Get Supabase Credentials

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Go to **Settings** → **API**
4. Copy the following:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (under "Project API keys")

### 2. Configure Supabase Credentials

You have two options to configure Supabase:

#### Option A: Environment Variables (Recommended for Render)

1. In your Render dashboard, go to your service
2. Navigate to **Environment** tab
3. Add the following environment variables:
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   ```

#### Option B: Set in HTML (For Testing)

If you need to test locally, you can temporarily set the credentials in `admin.html`:

```html
<script>
  window.SUPABASE_URL = 'https://xxxxx.supabase.co';
  window.SUPABASE_ANON_KEY = 'your-anon-key-here';
</script>
```

**⚠️ Warning:** Never commit credentials to your repository. Use environment variables in production.

### 3. Create Admin User in Supabase

1. Go to Supabase Dashboard → **Authentication** → **Users**
2. Click **Add user** → **Create new user**
3. Enter:
   - **Email**: `tomasnorkuss@gmail.com`
   - **Password**: (set a secure password)
   - **Auto Confirm User**: ✅ (check this)
4. Click **Create user**

Alternatively, you can use the Supabase Auth UI to let users sign up, but make sure `tomasnorkuss@gmail.com` is in the admin list in `js/config.js`.

### 4. Verify Admin Configuration

The admin email is configured in `js/config.js`:

```javascript
const ADMIN_CONFIG = {
  adminEmails: [
    'tomasnorkuss@gmail.com'
  ],
  // ...
};
```

To add more admins, simply add their emails to the `adminEmails` array.

### 5. Deploy to Render

1. Push your changes to your repository
2. Render will automatically deploy the updated files
3. Visit `https://racketreviewhub.com/admin` to test

## Usage

### Accessing the Admin Panel

1. Navigate to `https://racketreviewhub.com/admin`
2. Enter your Supabase credentials:
   - **Email**: `tomasnorkuss@gmail.com`
   - **Password**: (the password you set in Supabase)
3. Click **Login**

### Admin Features

Once logged in as an admin, you'll see:
- Admin dashboard with statistics
- Logout button
- Access to admin functions (to be expanded)

### Troubleshooting

#### "Supabase credentials not found"
- Make sure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Render environment variables
- Restart your Render service after adding environment variables

#### "Access restricted" after login
- Verify your email is in the `adminEmails` array in `js/config.js`
- Check that you're logging in with `tomasnorkuss@gmail.com` (case-insensitive)

#### "Supabase library not loaded"
- Check that the Supabase CDN script is included in `admin.html`
- Verify your internet connection (CDN scripts require internet access)

#### Login fails
- Verify the user exists in Supabase Authentication
- Check that the email and password are correct
- Ensure "Auto Confirm User" is enabled for the user in Supabase

## Security Notes

1. **Never commit credentials** to your repository
2. Always use environment variables for sensitive data
3. The admin check is done client-side - for production, consider adding server-side validation
4. Keep your Supabase anon key secure (it's safe to expose, but limit RLS policies)

## Adding More Admins

To add more admin users:

1. Add their email to `ADMIN_CONFIG.adminEmails` in `js/config.js`:
   ```javascript
   adminEmails: [
     'tomasnorkuss@gmail.com',
     'another-admin@example.com'
   ]
   ```

2. They must have a Supabase account (created via Auth UI or manually)

3. Deploy the updated configuration

