# JobHunt

Run your job search like a pipeline: search several job boards at once, track every application from saved to offer, check your CV against each posting, and keep a steady daily pace.

## Features

- **Paste a job post**: paste a job from WhatsApp, Telegram, LinkedIn or email (into *Add application*, or anywhere on the dashboard with Ctrl+V) and jobhunt fills in company, role, location, type, deadline, apply link or email, and channel. **Save & apply** opens the application page; when you come back it asks *Did you apply?* and one click counts it toward your streak.
- **Browser extension** (`extension/`): on any job page or application form it reads the job, tracks it, fills the form with your details and attaches your CV (including forms embedded in iframes, like Greenhouse), and drafts a cover letter for you to review. You click Submit; it then asks to mark the job applied. It never submits for you.
- **Find jobs** (`/dashboard/jobs`): one search across LinkedIn, Indeed, Glassdoor and others via [JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch) and [Adzuna](https://developer.adzuna.com/). Save a role or log it as applied in one click.
- **Applications** (`/dashboard/applications`): table or drag-and-drop board across Saved → Applied → Screening → Interview → Offer → Hired / Rejected, with undo on every stage change. Applied, replied and interview dates fill in automatically.
- **CV & tailoring** (`/dashboard/resume`): upload CVs as PDF, Word (.docx / .doc), RTF or text (text is extracted server-side and stays editable), see which skills a posting asks for that your CV doesn't mention. With `OPENAI_API_KEY`, also get a tailored summary, bullet points and a cover letter drafted only from your real experience.
- **Daily goal** (`/dashboard/goals`): min / stretch targets, streaks, a 16-week heatmap and weekly totals.
- **Analytics** (`/dashboard/analytics`): funnel, reply rate by channel, typical reply time.
- **Inbox** (`/dashboard/emails`): with Google sign-in, read-only Gmail sync that matches recruiter emails to your applications and sorts them into interviews, offers and rejections.
- **Demo workspace**: "Explore a demo workspace" on the login page creates a private account seeded with sample data.
- Design from the 2026 handoff: forest + lime palette, Bricolage Grotesque / Geist / JetBrains Mono, logo 3f. Light theme as designed; the dark theme is derived from the same tokens (not yet designed).
- Press <kbd>N</kbd> anywhere in the dashboard to add an application; crossing your daily minimum triggers a small celebration.

## Browser extension

1. In jobhunt, add your phone/LinkedIn under **Settings → Autofill details**, and upload your CV as a PDF or Word file in **CV & tailoring** (the original file is what gets attached to forms).
2. Open `edge://extensions` or `chrome://extensions`, turn on **Developer mode**, click **Load unpacked** and choose the `extension` folder.
3. In **Settings → Browser extension**, create a token. Click the jobhunt icon in the toolbar and paste the token and server address (e.g. `http://localhost:3000`).
4. On a job page: **Track job** saves it; **Fill this form** fills the application; **Write for this job** drafts a cover letter (needs `OPENAI_API_KEY`, otherwise your saved cover-letter template is used).

Tokens can be revoked any time in Settings. They can read and update your applications and documents, but can't change your password, manage tokens or delete your account.

## Stack

Next.js 16 (App Router, `proxy.ts`) · React 19 · TypeScript · Prisma 5 + MongoDB · Auth.js (NextAuth v5) · plain CSS design system (`src/app/globals.css`) · Bricolage Grotesque, Geist, JetBrains Mono.

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill it in. Only `DATABASE_URL` and `NEXTAUTH_SECRET` are required; every other key switches on an optional feature.

   | Variable | Needed for |
   |---|---|
   | `DATABASE_URL` | MongoDB connection string (Atlas, or a local replica set; Prisma requires a replica set) |
   | `NEXTAUTH_SECRET` | Session signing. Generate with `openssl rand -base64 32` |
   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | "Continue with Google" and Gmail sync (enable the Gmail API, add `http://localhost:3000/api/auth/callback/google` as a redirect URI) |
   | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | "Continue with GitHub" |
   | `RAPIDAPI_KEY` | Live job search via JSearch |
   | `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | Live job search via Adzuna |
   | `OPENAI_API_KEY` (optional `OPENAI_MODEL`) | AI-written tailoring drafts; without it you still get the keyword match |

   **MongoDB Atlas:** add your current IP under *Network Access*, or connections fail with a TLS `InternalError`.

3. Sync the schema (creates indexes)

   ```bash
   npx prisma db push
   ```

   **Upgrading an existing database?** The pipeline stages were renamed (Awaiting reply → Applied, Responded → Screening, Accepted → Offer, Declined → Rejected). Run this once, or Prisma will fail to read old records:

   ```bash
   npm run migrate:statuses
   ```

4. Run it

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Press <kbd>N</kbd> anywhere in the dashboard to add an application.

## Project layout

```
src/
  proxy.ts                 redirects signed-out visitors away from /dashboard
  app/
    page.tsx               landing page
    login/                 sign in / sign up / demo
    onboarding/            3-step setup (role, daily pace, CV)
    dashboard/             app pages (overview, applications, jobs, resume, goals, analytics, emails, settings)
    api/                   route handlers — all require a session and scope data to the user
  components/              AppShell, ApplicationDrawer, Charts, AppData (client store), …
  lib/                     auth, prisma, constants, stats & date helpers, skills matcher, Gmail client, demo seed
```

Stats are computed in the browser from the application list, so "today" and weekly buckets follow the viewer's timezone.
