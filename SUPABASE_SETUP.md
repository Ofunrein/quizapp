# Supabase Setup Guide

This guide will help you set up Supabase for the QuizMaster app.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New project"
4. Fill in the project details:
   - Name: QuizMaster (or your preferred name)
   - Database Password: Choose a strong password
   - Region: Select the closest region to you
5. Click "Create new project"

## 2. Get Your API Keys

Once your project is created:

1. Go to Settings → API
2. Copy your project URL (looks like `https://xxxxx.supabase.co`)
3. Copy your `anon` public key

## 3. Set Up Environment Variables

1. Open the `.env.local` file in your project
2. Replace the placeholder values:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 4. Run Database Migrations

1. Go to the SQL Editor in your Supabase dashboard
2. Click "New query"
3. Copy and paste the entire contents of `supabase/schema.sql`
4. Click "Run" to execute the SQL

This will create all the necessary tables, indexes, and security policies.

## 5. Enable Email Authentication (Optional)

1. Go to Authentication → Providers
2. Enable Email provider
3. Configure email settings:
   - Enable email confirmations (recommended)
   - Customize email templates if desired

## 6. Test the Integration

1. Restart your development server: `npm run dev`
2. Click "Sign In" in the app
3. Create a new account
4. Check your email for confirmation (if enabled)
5. Sign in with your credentials

## Features with Supabase

When signed in, your data will be:
- **Persisted**: All topics, questions, and progress saved to the cloud
- **Secure**: Row-level security ensures only you can see your data
- **Real-time**: Changes sync across devices (if implemented)
- **Backed up**: Supabase handles automatic backups

## Local vs Cloud Storage

The app supports both modes:
- **Local Storage**: No sign-in required, data stored in browser memory
- **Cloud Storage**: Sign in to save data to Supabase

You can see which mode you're in by checking the header indicator.

## Troubleshooting

### "Invalid API key" error
- Double-check your `.env.local` file
- Make sure you're using the `anon` key, not the `service_role` key
- Restart the development server after changing environment variables

### "User not authenticated" error
- Make sure you're signed in
- Check if email confirmation is required
- Try signing out and back in

### Tables not found
- Run the SQL migration script in `supabase/schema.sql`
- Check for any errors in the SQL editor

## Next Steps

1. **Enable Google/GitHub OAuth**: Go to Authentication → Providers
2. **Set up Storage**: For file uploads, enable Storage in your project
3. **Configure Email Templates**: Customize confirmation and recovery emails
4. **Enable Realtime**: Subscribe to changes for collaborative features
5. **Set up Edge Functions**: For server-side AI processing 