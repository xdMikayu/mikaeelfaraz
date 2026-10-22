# Moving Mifolio to its own Supabase project

Mifolio started on a Supabase project shared with other apps. Before anyone else's data
goes in, it moves to a project of its own. Nothing is deleted from the old project until
you've checked the new one.

1. **Create the project.** supabase.com → New project, named `mifolio`, region **Frankfurt
   (eu-central-1)**, the nearest to the UAE. Keep the database password somewhere safe.
2. **Create the tables.** SQL Editor → run every file in `supabase/migrations/`, oldest first.
3. **Auth settings.**
   - Authentication → Sign In / Providers → Email: on; turn **off** "Allow new users to sign up"
     (invites only).
   - Authentication → URL Configuration: Site URL `https://mikaeelfaraz.com`, and add
     `https://mikaeelfaraz.com/finance/welcome` to Redirect URLs.
   - Authentication → Emails → SMTP: set up a sender (e.g. Resend). Supabase's built-in one
     sends only a few emails an hour.
4. **Create your own login.** Authentication → Users → Add user (with a password). Copy its
   User ID.
5. **Copy your data** (from your computer, with both projects' service-role keys):
   ```sh
   FROM_URL=… FROM_SERVICE_KEY=… FROM_USER_ID=<old id> \
   TO_URL=…   TO_SERVICE_KEY=…   TO_USER_ID=<new id> \
   node scripts/finance/move-project.mjs        # dry run
   # …same with --go
   ```
6. **Point the site at it.** Netlify → Environment variables:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   = the new project's; `FINANCE_OWNER_USER_ID` = your new user ID; `FINANCE_MULTI_USER=true`;
   `FINANCE_INVITE_CODES` = a few codes to hand out; optionally
   `NEXT_PUBLIC_FINANCE_CONTACT_EMAIL`. Redeploy.
7. **Switch your devices to API keys.** Sign in → Setup → API keys → create one per device,
   put it in each Shortcut and the Gmail script, then remove `FINANCE_INGEST_TOKEN` from Netlify.
8. **Clean up.** Once everything looks right on the new project, delete the `fin_*` tables'
   rows (or the tables) from the old one.
