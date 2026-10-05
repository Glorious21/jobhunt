# jobhunt — Product Requirements & Build Record

| | |
|---|---|
| **Product** | jobhunt: a job-search tracker that runs your search like a pipeline |
| **Repository** | https://github.com/Glorious21/jobhunt |
| **Owner** | Glorious (Glorious21) |
| **Status** | v1 built and tested locally; not yet deployed |
| **Last updated** | 5 October 2026 |

This document has two jobs. Part 1 to Part 4 is the **product requirements**: what jobhunt is, who it's for, and what it must do. Part 5 to Part 9 is the **build record**: how it's put together, the order it was built in and why, how it was tested, and what's still open.

---

## Contents

1. [Problem, goals and users](#part-1--problem-goals-and-users)
2. [Features and requirements](#part-2--features-and-requirements)
3. [Design](#part-3--design)
4. [Security and privacy requirements](#part-4--security-and-privacy-requirements)
5. [Architecture](#part-5--architecture)
6. [Build history, step by step](#part-6--build-history-step-by-step)
7. [Testing and quality](#part-7--testing-and-quality)
8. [Setup and operations](#part-8--setup-and-operations)
9. [Limitations, risks and roadmap](#part-9--limitations-risks-and-roadmap)

---

## Part 1 — Problem, goals and users

### 1.1 The problem

Job hunting is a volume game with a lot of admin:

- Jobs arrive from everywhere: LinkedIn, Indeed, company sites, and very often **WhatsApp and Telegram groups** that forward posts like *"MO Foundation is Hiring Graduates… Deadline: October 9… Apply: [link]"*.
- People lose track of where they applied, who replied and what to follow up on.
- Every application form asks for the same details (name, email, phone, LinkedIn, CV), typed again each time.
- CVs are rarely checked against the job they're sent to, so applicant tracking systems filter them out.
- Motivation drops without visible progress; there's no sense of a daily pace.

### 1.2 Goals

| Goal | How jobhunt meets it |
|---|---|
| One place for every application | A 7-stage pipeline (Saved → Applied → Screening → Interview → Offer → Hired / Rejected) as a table or a drag-and-drop board |
| Capture jobs from anywhere in seconds | Paste a job post, use the browser extension on job pages, or search job boards inside the app |
| Less form-filling | The extension fills application forms with your details and attaches your CV; you review and submit |
| Better-targeted CVs | Check your CV against any posting; see matching and missing skills; optional AI-drafted cover letters from your real experience |
| Steady momentum | A daily minimum and stretch goal, streaks, a 16-week heatmap and a small celebration when you hit your minimum |
| Know what's working | Response rate, interview rate, funnel conversion, reply rate by channel, typical reply time |
| Don't miss replies | Gmail matching (read-only) labels recruiter emails and suggests moving the application forward |

### 1.3 Non-goals (deliberately out of scope for v1)

- **Submitting applications automatically.** The user always clicks Submit. Automated applying breaks LinkedIn/Indeed terms, risks account bans, and sends mistakes straight to employers.
- Sending email on the user's behalf (Gmail access is read-only).
- A job board of our own; jobs come from existing boards and from the user.
- Mobile apps (the web app is responsive; the extension is desktop-only).
- Team or recruiter-side features.

### 1.4 Target users

**Primary persona — the active job seeker.** Recent graduate or early-career professional (designers, analysts, developers), often in Nigeria, applying to many roles a week. Finds jobs in WhatsApp/Telegram groups as well as job boards. Wants structure and momentum more than another job board.

**Secondary persona — the switcher.** Employed, applying a few times a week in spare time. Values the "Steady" pace (3 a day, stretch 5) and the follow-up list.

### 1.5 Core user stories

1. *As a job seeker*, when I see a job post in WhatsApp, I want to paste it and have the application filled in, so I can track it in seconds.
2. *As a job seeker*, when I'm on an application form, I want my details and CV filled in for me, so I only have to review and submit.
3. *As a job seeker*, I want each application I send to count toward a daily goal, so I keep a steady pace.
4. *As a job seeker*, I want to see every application by stage and move it as things progress, so nothing slips.
5. *As a job seeker*, I want to know which applications have gone quiet for a week, so I can follow up.
6. *As a job seeker*, I want to check my CV against a posting before I apply, so I can fix gaps first.
7. *As a job seeker*, I want recruiter replies matched to the right application, so I see what changed without digging through email.
8. *As a job seeker*, I want to know which channels actually get replies, so I spend time where it works.
9. *As a visitor*, I want to try the product with sample data before signing up.

### 1.6 Success measures

| Measure | Target |
|---|---|
| Time to capture a job from a pasted post | under 15 seconds |
| Fields filled automatically on a standard ATS form (Greenhouse/Lever style) | all personal fields + CV |
| Weekly active users who hit their daily minimum at least 3 days a week | 40% |
| Applications tracked per active user per week | 10+ |
| Share of applications that reach a reply (shown in Analytics) | visible to every user from their 3rd sent application |

---

## Part 2 — Features and requirements

Each feature lists what it must do (**requirements**) and how we know it works (**acceptance**). Every item below is implemented.

### 2.1 Accounts and access

**Requirements**
- Sign up with email + password (min 8 characters); sign in with email + password.
- Google and GitHub sign-in buttons appear only when their keys are configured.
- "Explore a demo workspace" creates a **private, fresh** account seeded with sample data for each visitor.
- New accounts go through onboarding before reaching the dashboard.
- The login page is always reachable; if already signed in it shows *"You're signed in as …"* with **Go to dashboard** and **Sign out**.
- Session cookies for accounts that no longer exist are cleared automatically.

**Acceptance**
- An empty or wrong password is rejected by the server (`CredentialsSignin`), including when calling the API directly.
- Unknown emails are not auto-registered at sign-in.
- Visiting `/dashboard` without a session redirects to `/login?next=/dashboard`.

### 2.2 Onboarding (3 steps)

1. **What are you looking for?** Full name, target role, location.
2. **Set your daily pace.** Presets Steady (3/5), Focused (5/8), Full-time (10/15), or custom steppers. The stretch goal can never be below the minimum; editing either switches the preset to "Custom".
3. **Add your CV.** Upload (PDF, Word .docx/.doc, RTF, .txt/.md, up to 5 MB) or paste text. Optional.

**Acceptance:** finishing saves profile, targets and the CV (text, detected skills and the original file) and lands on Overview.

### 2.3 Overview (dashboard home)

- Greeting by time of day with a dynamic line: *"You've sent X of Y applications today. Z more to hit your minimum."*, or a stretch-goal line once the minimum is met.
- Four KPI cards: **Today** (X / min with progress bar), **Streak** (current + best), **Active pipeline** (Applied through Offer), **Response rate** (last 90 days).
- Pipeline strip: count per stage; clicking a stage opens Applications filtered to it.
- **Last 14 days** bar chart: today in lime, days at/above the minimum in forest, below in muted green; a dashed line marks the daily minimum and moves when the goal changes.
- **Upcoming interviews** (date tile, company, interview type and time).
- **Recently updated** (top 5) and **Follow up** (Applied more than 7 days ago with no reply).
- **Closing soon** (appears when needed): Saved jobs whose deadline is within 14 days, soonest first; 2 days or less shows in red.

### 2.4 Applications

- Search by company/role; filter chips for All + each stage with counts.
- **Table:** Company, Role, Status (inline select), Channel, Applied date, Updated; click a header to sort.
- **Board:** 7 columns; drag a card to change its stage (hovered column highlights; the dropped card does a small "pop").
- Every stage change shows *"{Company} moved to {Stage}"* with **Undo**.
- Saved jobs with a deadline show *"Closes 9 Oct"* (red within 2 days, grey once passed) in the table and on board cards.
- Milestone dates fill themselves: `appliedAt` the first time an application is sent, `respondedAt` the first time it reaches Screening/Interview/Offer/Hired.
- **Application editor** (side panel) with tabs **Details**, **Notes & cover letter**, **Emails**:
  - Company, role, status, channel, location, salary, deadline (for Saved), interview date/type (for Interview), job posting link, job description.
  - Delete with confirmation.

### 2.5 Paste a job post (headline feature)

**Requirements**
- In **Add application**, *"Paste a job post"* accepts text from WhatsApp, Telegram, email, LinkedIn or a web page.
- Pressing **Ctrl+V** anywhere on the dashboard (outside a text field) with a job post opens Add application and fills it automatically.
- The parser extracts: company, role, location, job type, salary, **deadline**, **apply link or apply email**, requirements, and **channel** (WhatsApp is detected from `*bold*`/`_italic_` formatting).
- Parsed jobs are saved as **Saved**, because they haven't been sent yet.
- **Save & apply** saves the job and opens the apply link in a new tab (or an email draft for "send your CV to…" posts).
- When the user returns to the jobhunt tab, a toast asks *"Did you apply to {Company}?"* with **Mark applied**, which moves it to Applied and counts it toward today's goal.
- With `OPENAI_API_KEY` set, an AI pass fills any fields the rules missed. Without it, the rule-based parser works on its own.

**Acceptance (the real post that inspired the feature)**

Input: the *MO Foundation Trainee Analyst Program* WhatsApp post. Output:

| Field | Value |
|---|---|
| Company | MO Foundation |
| Role | Trainee Analyst Program |
| Status | Saved |
| Channel | WhatsApp |
| Location | Nigeria (inferred from "NYSC") |
| Type | Full-time |
| Deadline | 9 Oct 2026 |
| Apply link | https://jobs.smartyacad.com/mo-foundation-is-hiring-graduates-for-its-trainee-analyst-program/ |
| Requirements | all 5 bullet points |

### 2.5a Share to jobhunt (Android)

**Requirements**
- jobhunt is installable as an app (web app manifest, icons, service worker).
- Once installed on Android, **jobhunt appears in the system share sheet**. Sharing a job post from WhatsApp, Telegram or Chrome opens jobhunt with *Add application* already filled from the post.
- The share title (often just the app or chat name) is ignored when there's shared text; a shared link is added if it isn't already in the text.
- Shares that arrive while signed out go through the login page and continue afterwards.
- Home-screen shortcuts: **Add application** and **Applications**.

**Acceptance:** sharing the MO Foundation post with title "WhatsApp" opens Overview with Company *MO Foundation*, Role *Trainee Analyst Program*, deadline 9 Oct and the apply link filled.

### 2.6 Browser extension (Chrome / Edge)

**Requirements**
- Connects to the user's jobhunt server with a **personal access token** created in Settings.
- On any job page it reads the job: structured `JobPosting` data first (used by most job boards and ATSs), then known selectors (LinkedIn, Indeed, Greenhouse, Lever), then the page text through the same parser as "Paste a job post".
- **Track job** saves it as Saved. If the page belongs to a job already saved (for example from a WhatsApp post), the popup offers *"Save to: {that job}"*.
- **Fill this form** fills empty fields only — first/last/full name, email, phone, LinkedIn, GitHub, portfolio, city — and **attaches the CV file**. It works inside embedded iframes (Greenhouse/Lever/Workday embeds). It skips fields like "Company name (current employer)".
- **Write for this job** drafts a cover letter from the user's CV (OpenAI) or their saved template; the user edits it, then **Insert into form** or **Copy**.
- When the user clicks Submit on the page, the extension asks — by notification and in the popup — whether to **Mark applied**.
- **Never submits anything itself.**

**Acceptance (automated test against a local employer site)**
- Reads "Junior Product Designer @ Harbor Transit" from structured data.
- Fills 6 fields and attaches `Grace_CV.pdf` (50 KB); a framework-controlled form registers every value.
- Leaves "Company name (current employer)" empty.
- After Submit, the popup asks to mark it applied; confirming sets it to Applied in jobhunt.
- Fills a form embedded in an iframe.

### 2.7 Find jobs

- One search across job boards via **JSearch** (RapidAPI; aggregates LinkedIn, Indeed, Glassdoor…) and **Adzuna**; runs on arrival with the user's target role and location.
- Filters: posted (any time / past 24 hours / past week), type (any / full-time / contract), remote only.
- Each result: **Save** (toggles Saved), **Applied** (adds as Applied and counts toward today). Jobs already tracked show their stage instead.
- Job panel with "About the role" and "What you'll do" bullets, **Track this job**.
- Without provider keys, 6 clearly labelled sample listings are shown.

### 2.8 CV & tailoring

- Store documents: CV, Portfolio, Cover-letter template. Upload or paste; skills are detected automatically.
- **Check against a job**: pick a tracked application (uses its job description) or paste a posting.
- Result: match score ring, verdict (Strong / Partial / Weak), *You have* and *Missing from your CV* skills.
- With an OpenAI key: tailored summary, rewritten bullets (only from facts in the CV), cover letter, recruiter message, interview tips; **Save cover letter to application**.
- The model is instructed never to invent employers, numbers, degrees or skills.

### 2.9 Daily goal

- Today ring (today of minimum), streak and best streak, *days you hit your minimum* out of the last 30.
- 16-week heatmap (5 levels relative to the user's minimum and stretch goal).
- Weekly totals (8 weeks) and minimum/stretch steppers that save automatically.
- **Celebration:** crossing the daily minimum triggers 42-piece confetti and *"Daily minimum reached. Streak extended to N days"*.

### 2.10 Analytics

- Range: 30 days / 90 days / all time.
- KPIs: applications sent, response rate, interview rate, typical reply time (median days from applied to first reply).
- Funnel Applied → Replied → Interviewed → Offer with step conversion.
- By channel: volume or reply rate.
- Applications per week (12 weeks) and status breakdown.
- **Definition:** a *reply* is a reply date or a stage of Screening or later. A Rejected application without a reply date counts as no reply (often "ghosted").

### 2.11 Inbox (Gmail)

- Connect Gmail with Google sign-in (read-only scope `gmail.readonly`).
- **Sync Gmail** searches recent mail for each company you've applied to and stores matching messages against that application.
- Each email is labelled Interview / Offer / Rejection / Reply / Confirmation by keyword rules.
- If an email implies a later stage than the application is in, a **Move to {Stage}** button appears (never moves backwards).
- The connected card shows *"last synced N minutes ago"*.

### 2.12 Settings

- Profile: name, portfolio link, target role, location.
- **Autofill details:** phone, LinkedIn, GitHub (used by the extension).
- **Browser extension:** setup steps, create token (shown once, with copy), list and revoke tokens.
- Theme: System / Light / Dark (Light is the default).
- Connected accounts: Google/Gmail (Connect / Disconnect), email & password (Change / Set password).
- Sign out; **Delete account** (type "delete" to confirm).

### 2.13 Keyboard and global behaviour

| Action | Shortcut |
|---|---|
| Add application | **N** (outside text fields, no panel open) |
| Close panel / dialog | **Esc** |
| Add a job post from the clipboard | **Ctrl+V** on the dashboard |

---

## Part 3 — Design

The UI follows a high-fidelity design handoff (`JobHunt App.dc.html` and the logo file), recreated screen by screen and compared against screenshots of the prototype.

### 3.1 Visual language

| Token | Value | Use |
|---|---|---|
| Forest | `oklch(0.33 0.07 160)` ≈ #1E4A3A | Primary buttons, logo, dark panels, chart bars |
| Lime | `oklch(0.84 0.18 128)` ≈ #B5E04A | Accent: logo handle, progress, today's bar, CTAs on dark |
| Lime tint | `oklch(0.95 0.05 128)` | Active nav, selected states |
| Warn | `oklch(0.6 0.15 40)` | Daily-minimum line, follow-up days |
| Danger | `oklch(0.55 0.19 25)` | Delete actions |
| Ink / muted / faint | #16201a / #5b6760 / #8a948d | Text |
| Background / surface / line | #f6f7f4 / #ffffff / #e3e7e1 | Page, cards, borders |

- **Stage colours:** one hue per stage — Saved 250, Applied 215, Screening 290, Interview 140, Offer 80, Hired 160, Rejected 25 — rendered as chip background `oklch(0.95 0.045 H)` and text `oklch(0.45 0.12 H)`.
- **Type:** Bricolage Grotesque (display, headings, big numbers; optical-size axis on), Geist (UI, 14 px base), JetBrains Mono (counts, dates, shortcuts).
- **Shape:** cards 14 px radius, inputs/buttons 10 px, pills fully rounded.
- **Logo (3f):** wordmark "jobhunt" in Bricolage 800 where the "o" is a magnifier with a lime handle; app icon is a forest square with a white ring and lime handle.

### 3.2 Screens

| # | Screen | Route |
|---|---|---|
| 1 | Landing | `/` |
| 2 | Sign in / Create account | `/login` |
| 3 | Onboarding (3 steps) | `/onboarding` |
| 4 | Overview | `/dashboard` |
| 5 | Applications (table + board) | `/dashboard/applications` |
| 6 | Find jobs | `/dashboard/jobs` |
| 7 | CV & tailoring | `/dashboard/resume` |
| 8 | Daily goal | `/dashboard/goals` |
| 9 | Analytics | `/dashboard/analytics` |
| 10 | Inbox | `/dashboard/emails` |
| 11 | Settings | `/dashboard/settings` |
| — | Share target (redirects to Overview with the editor open) | `/dashboard/share` |

Plus: application editor, job panel and document panel (540 px side panels), confirm dialog, toast, demo banner, extension popup.

### 3.3 Motion

Page entrances (fade + 8 px rise, 350 ms), staggered hero fade-up, bars growing from the baseline, progress rings filling (CSS `@property`), side panels sliding in (340 ms), dialogs scaling in, toasts rising, board drag/drop "pop", confetti. All motion is disabled under `prefers-reduced-motion`.

### 3.4 Deviations from the handoff (and why)

| Deviation | Reason |
|---|---|
| Editor has extra fields: job posting link, job description, interview date/type, deadline | The CV check, "Upcoming interviews" and paste-a-post need somewhere to store these |
| Google/GitHub buttons only appear when configured; "OpenAI key connected" only shows when true; job search labels sample results | Never show controls or claims that don't work |
| Demo numbers differ from the prototype (e.g. 373 applications) | 16 weeks of history are seeded so streaks, heatmap and analytics are computed from real records, not hard-coded |
| Dark theme exists but is derived, not designed | The handoff says dark "is not designed yet"; Light is the default |
| Logo built from styled HTML, not SVG | Reproduces the handoff's exact em-based geometry with the real font |

---

## Part 4 — Security and privacy requirements

| Requirement | Implementation |
|---|---|
| Passwords checked on every sign-in | bcrypt comparison; empty or wrong passwords rejected; OAuth-only accounts can't use the password form |
| No account enumeration via auto-signup | Sign-up is a separate endpoint; sign-in never creates accounts |
| Users only ever see their own data | Every API route resolves the user server-side and scopes queries by `userId`; IDs are validated as ObjectIds |
| Demo isolation | Each demo click creates a new account; demo accounts can't create extension tokens or passwords |
| Extension access without sharing the browser session | Personal access tokens (`jh_…`), stored only as SHA-256 hashes, shown once, revocable; last-used time tracked |
| Tokens can't escalate | Token-authenticated requests can't manage tokens, change the password, disconnect Google or delete the account (session-only routes) |
| Read-only Gmail | Only `gmail.readonly` is requested; nothing is sent or deleted |
| Large/untrusted uploads | 5 MB limit, file-type allow-list, text extracted server-side, original stored only for the owner, never returned in list responses |
| Honest AI | Prompts forbid inventing facts; without an API key the app gives keyword analysis only instead of fabricated text |
| Never auto-submit | The extension fills and asks; the user always submits |
| Secrets stay out of git | `.env*` ignored except `.env.example` (placeholders only); verified before publishing |
| Account deletion | Removes applications, emails, documents, accounts, sessions and the user |

---

## Part 5 — Architecture

### 5.1 Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript |
| Data | MongoDB (Atlas in production; local replica set for development) via Prisma 5 |
| Auth | Auth.js / NextAuth v5 (JWT sessions, Prisma adapter): credentials, demo, Google, GitHub |
| Styling | Hand-written CSS design system (`src/app/globals.css`), `next/font` (Bricolage Grotesque, Geist, JetBrains Mono) |
| Documents | `unpdf` (PDF), `mammoth` (.docx), `word-extractor` (.doc), built-in RTF/text handling |
| Integrations | JSearch (RapidAPI), Adzuna, OpenAI Chat Completions, Gmail REST API |
| Extension | Manifest V3, plain ES modules, `chrome.scripting` / `storage` / `notifications` |

### 5.2 How it fits together

```
Browser (dashboard, client components)
  └─ AppDataProvider (one store: applications, profile, emails; optimistic updates, undo, goal celebration)
       └─ fetch /api/*  ──►  Next.js route handlers ──► getUserId() (session or token) ──► Prisma ──► MongoDB
                                         │
                                         ├─► JSearch / Adzuna (job search)
                                         ├─► OpenAI (parse refinement, tailoring, cover letters)
                                         └─► Gmail API (read-only sync)

Browser extension (popup + background + content script)
  └─ Bearer jh_ token ──► the same /api/* routes
```

- **Server layouts** check the session and onboarding state; **`proxy.ts`** only does a fast cookie check to bounce signed-out visitors from `/dashboard` and `/onboarding`.
- **Stats are computed in the browser** from the application list, so "today", streaks and weekly buckets follow the viewer's timezone.
- **One client store** (`AppDataProvider`) owns data, the editor panel (so **N** works on every page), status changes with undo, and the goal celebration.

### 5.3 Data model (Prisma, MongoDB)

| Model | Key fields |
|---|---|
| `User` | name, email, password (hash), isDemo, onboarded, targetRole, targetLocation, dailyMin, dailyMax, portfolioUrl, phone, linkedinUrl, githubUrl, gmailSyncedAt |
| `Application` | userId, status, source, jobTitle, company, location, salary, jobUrl, description, jobType, remote, notes, coverLetterUsed, appliedAt, respondedAt, interviewAt, interviewType, deadline |
| `Email` | applicationId, gmailMessageId, threadId, subject, snippet, from, to, date, category, isResponse |
| `UserDocument` | userId, type (cv / portfolio / cover_letter_template), fileName, parsedText, skills, fileData (original bytes), mimeType |
| `ApiToken` | userId, name, tokenHash (unique), prefix, lastUsedAt |
| `Account`, `Session`, `VerificationToken` | Auth.js tables |

Enums — **ApplicationStatus:** SAVED, APPLIED, SCREENING, INTERVIEW, OFFER, HIRED, REJECTED. **JobSource:** LINKEDIN, COMPANY_SITE, REFERRAL, INDEED, RECRUITER, GLASSDOOR, ADZUNA, THE_MUSE, TWITTER, WHATSAPP, TELEGRAM, MANUAL, OTHER.

### 5.4 API

All routes require a signed-in user (browser session or extension token) unless noted.

| Route | Methods | Purpose |
|---|---|---|
| `/api/auth/[...nextauth]` | — | Auth.js (sign-in, callbacks, session) |
| `/api/auth/register` | POST | Create an email/password account (public) |
| `/api/session/clear` | GET | Drop a dead session cookie and go to /login (public) |
| `/manifest.webmanifest` | GET | Web app manifest with the share target (public) |
| `/api/onboarding` | POST | Save setup; returns the created CV document id |
| `/api/profile` | GET, PATCH, DELETE | Profile, targets, autofill details; DELETE = delete account (session only) |
| `/api/profile/password` | POST | Change/set password (session only) |
| `/api/applications` | GET, POST | List (or `?url=` lookup for the extension), create |
| `/api/applications/[id]` | PATCH, DELETE | Update (sets milestone dates), delete |
| `/api/jobs/search` | GET | JSearch + Adzuna search with filters; sample results without keys |
| `/api/jobs/parse` | POST | Pasted job post → structured fields |
| `/api/documents` | GET, POST, PATCH, DELETE | CV/portfolio/template text and skills |
| `/api/documents/parse` | POST | Uploaded file → plain text |
| `/api/documents/file` | GET, PUT | Store / download the original CV file |
| `/api/ai/tailor` | POST | CV vs job: score, skills, optional AI drafts |
| `/api/ai/cover-letter` | POST | Cover letter for one job (OpenAI or template) |
| `/api/emails` | GET | Matched emails + Gmail connection state |
| `/api/emails/sync` | POST | Pull matching Gmail messages |
| `/api/accounts/google` | DELETE | Disconnect Google (session only) |
| `/api/tokens` | GET, POST, DELETE | Extension tokens (session only) |

### 5.5 Code map

```
src/
  proxy.ts                     signed-out redirect for /dashboard and /onboarding
  app/
    page.tsx                   landing
    login/                     sign in / create account / demo
    onboarding/                3-step setup
    dashboard/                 overview, applications, jobs, resume, goals, analytics, emails, settings
    api/                       route handlers (see 5.4)
  components/                  AppData (store), AppShell, ApplicationEditor, Dialog, Toast, Confetti, Logo, …
  lib/
    auth.ts, auth-client.ts    Auth.js config; sign-in helper with CSRF retry
    api.ts                     getUserId (session or token), validation helpers, token hashing
    job-post.ts                job-post parser
    extract-text.ts            PDF / Word / RTF / text extraction
    skills.ts                  skill vocabulary and CV ↔ job matching
    stats.ts, dates.ts         streaks, funnel, weekly totals, timezone-safe dates
    gmail.ts                   Gmail token refresh, search, categorisation
    demo.ts                    demo workspace seed
extension/                     MV3 extension (popup, background, content script, icons)
scripts/migrate-statuses.mjs   one-off stage rename migration
prisma/schema.prisma           data model
```

---

## Part 6 — Build history, step by step

The app was built in eight phases. Each lists what was done, the key decisions and how it was checked.

### Phase 0 — Audit of the starting project

**Starting point:** a Next.js 16 project with Prisma/MongoDB, NextAuth and a first-pass UI. Every dashboard page except Overview and CV showed hard-coded mock data.

**Problems found:**
1. **Login bypass:** the password was only checked if one was typed, so an empty password logged into any account; unknown emails were auto-registered.
2. **Any user could delete any document** (no ownership check).
3. Documents weren't linked to users in the schema.
4. The AI tailoring endpoint was public (anyone could spend the OpenAI budget).
5. No route protection; "today" used server midnight (wrong across timezones); goal completion never set; invalid statuses caused 500 errors.
6. The fallback "AI" invented achievements and percentages.

### Phase 1 — Security and data foundations

1. Rewrote sign-in: bcrypt check always, no auto-registration, separate sign-up endpoint with validation.
2. Demo becomes its own sign-in provider that creates an isolated, seeded account per visitor.
3. Every API route resolves the user server-side and scopes by `userId`; strict input validation (enums, lengths, dates, ObjectIds).
4. Added `proxy.ts` (Next 16's renamed middleware) for signed-out redirects.
5. Moved goals onto the user (daily min/max) and computed daily counts from applications **in the browser**, fixing the timezone bug.
6. Replaced fabricated AI fallback text with honest keyword analysis; locked AI endpoints behind auth with input limits.
7. Added Gmail sync (token refresh, search by company, categorisation) and a profile/settings API.

*Checked:* empty/wrong passwords rejected; lint, typecheck and production build green.

### Phase 2 — First full UI rebuild

1. A neutral design system (zinc + blue) with light/dark themes, replacing the purple-glow first pass.
2. Rebuilt all 11 pages on a shared client data store; every page moved from mock data to real data.
3. Custom accessible SVG charts with hover tooltips (removed Recharts and date-fns).
4. Seeded a realistic demo workspace.

*Checked:* scripted browser run through every screen with screenshots; fixed issues it found (analytics counted "closed" applications as replies; unrealistic demo data).

**Environment note:** MongoDB Atlas refused this machine's IP (TLS `InternalError`), so a **local MongoDB replica set** was started for development, leaving `.env` and Atlas untouched.

### Phase 3 — CV upload for PDF and Word

1. Server-side text extraction: `unpdf` (PDF), `mammoth` (.docx), `word-extractor` (.doc), plus RTF and text; 5 MB limit and clear errors (including scanned PDFs with no text).
2. Upload in onboarding and CV & tailoring; extracted text stays editable.
3. **Bug found and fixed while testing:** on a first visit, parallel auth requests each set a new CSRF cookie, so a fast click on sign-in could fail with `MissingCSRF`. Fix: retry once, after the cookie has settled.

*Checked:* real PDF and .docx extracted correctly; invalid file rejected; auth re-verified with valid CSRF tokens.

### Phase 4 — Implementing the design handoff

1. Read the full prototype (markup, seed data and logic), then screenshotted every prototype screen as a reference.
2. **Data model changes:** new stages (Screening, Hired; Awaiting/Responded/Accepted/Declined retired) and channels (Company site, Referral, Recruiter); interview type; Gmail last-synced time.
3. **Migration script** `npm run migrate:statuses` renames old stage values in place (AWAITING→APPLIED, RESPONDED→SCREENING, ACCEPTED→OFFER, DECLINED→REJECTED).
4. New design tokens, fonts, logo 3f, app icon; rebuilt landing, login, onboarding, shell and all 8 dashboard pages plus panels, dialogs and toasts.
5. Behaviour from the prototype: N shortcut, undo on every stage change, board drag/drop with pop, confetti on hitting the minimum, top-bar search.
6. Demo reseeded with the design's sample data (Alex Morgan, 11 applications, 6 emails, 3 documents) plus 16 weeks of history.
7. Added **Disconnect Gmail** and **Change password**, which the design shows.

*Checked:* side-by-side screenshot comparison with the prototype. Fixes from that pass:
- The hero headline was wider than the prototype; fixed by turning on the font's optical-size axis.
- The status toast appeared only after the server replied; now it shows immediately.
- The goal toast was being overwritten by other toasts; now it takes precedence.
- "Testing" was falsely detected inside "A/B testing"; nested skills are now de-duplicated.
- The mobile sidebar cast a shadow while closed.

### Phase 5 — Theme default

Light became the default (the handoff only designs Light); System and Dark are opt-ins in Settings. *Checked* in a browser set to dark mode.

### Phase 6 — Paste a job post and the browser extension

1. **Parser** (`src/lib/job-post.ts`): headline patterns ("X is hiring…", "Role at Company"), labelled lines, Nigerian and global cities, NYSC → Nigeria, deadline formats (including day-first dates), apply link/email, requirements bullets, WhatsApp detection. Tested on the MO Foundation post and two others; fixed one-line posts and "before 15/10/2026" deadlines.
2. **In-app flow:** paste box in Add application, Ctrl+V anywhere, Save & apply, *"Did you apply?"* on return.
3. **Schema:** deadline, autofill fields (phone, LinkedIn, GitHub), stored CV file, `ApiToken`.
4. **Tokens:** hashed personal access tokens; `getUserId()` accepts them; sensitive routes stay session-only.
5. **Extension:** popup in the same design language, content script for extraction and filling (React-safe value setting, iframe support, CV attachment), background worker for submit detection and "Mark applied" notifications.
6. Onboarding now asks for the user's full name, because forms would otherwise get the email prefix.

*Checked:* two end-to-end runs — the in-app flow (sign-up → PDF CV → paste → Save & apply → Mark applied → counts toward today) and the extension in Edge against a local employer site (job read, 6 fields + CV filled, employer field left alone, submit → Mark applied, iframe form filled). The iframe test exposed a bug (fields counted in the top frame only), which was fixed.

### Phase 7 — Login page always reachable

A signed-in browser could never see `/login`, because the proxy redirected any request with a session cookie to the dashboard, even a stale one. Now:
- the proxy no longer touches `/login`;
- the page always shows the form, plus *"You're signed in as …"* when relevant;
- dead sessions are cleared through `/api/session/clear`;
- the landing page shows **Sign in** even when signed in.

### Phase 8 — Deadlines and Share to jobhunt

1. **Deadline reminders:** a *Closing soon* card on Overview and *"Closes {date}"* tags on Saved jobs in the table and board; the demo's saved job closes in 2 days so it's visible.
2. **Installable app + share target:** `src/app/manifest.ts` (with `share_target` → `/dashboard/share`), 192/512 and maskable icons, a minimal service worker (no caching, served with no-cache headers), and a share page that hands the post to *Add application*.
3. **Bug found while testing:** Android puts the app or chat name in the share title; it was being read as the post's headline. The title is now only used when there's no text.

*Checked:* 13 automated checks — manifest, icons, service worker headers and registration, Closing soon, table/board deadline tags, a simulated WhatsApp share, signed-out share through login, and the Add application shortcut.

### Phase 9 — Publishing

1. Scanned every file to be committed for secrets (none; `.env` ignored, `.env.example` has placeholders only).
2. Committed the app (excluding local AI tooling in `.agents/`) with the owner as sole author.
3. Created the public repository **Glorious21/jobhunt** and pushed `master`.

---

## Part 7 — Testing and quality

| Check | How |
|---|---|
| Lint | ESLint (Next.js core-web-vitals + TypeScript rules, React Compiler rules), plus an extension block |
| Types | `tsc --noEmit` |
| Build | `next build` (production) |
| Visual fidelity | Prototype vs build screenshots for all 11 screens at 1440×900, plus 390 px mobile |
| End-to-end | Playwright driving Microsoft Edge: sign-up/onboarding, demo, every page, status change + undo, confetti, paste-a-post, Save & apply, extension fill/submit/mark-applied, iframe forms |
| Security | Direct API calls with valid CSRF tokens for empty/wrong passwords; token scoping; ownership checks |
| Parser | Sample posts with expected outputs (WhatsApp format, labelled fields, one-line post) |

All checks passed at the time of writing. The automated test scripts live outside the repository; adding them to the repo as a proper test suite is on the roadmap.

---

## Part 8 — Setup and operations

### 8.1 Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | MongoDB connection string (Atlas, or a local replica set) |
| `NEXTAUTH_SECRET` | Yes | Session signing (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Yes | e.g. `http://localhost:3000` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | For Gmail / Google sign-in | Google Cloud OAuth client |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | Optional | GitHub sign-in |
| `RAPIDAPI_KEY` | For live job search | JSearch |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Optional | Adzuna job search |
| `OPENAI_API_KEY` (and optional `OPENAI_MODEL`) | For AI features | Tailoring, cover letters, parse refinement |

### 8.2 Run locally

```bash
npm install
cp .env.example .env            # then fill it in
npx prisma db push              # sync indexes
npm run migrate:statuses        # only when upgrading an older database
npm run dev                     # http://localhost:3000
```

MongoDB Atlas must allow your IP under **Network Access**.

### 8.3 Google / Gmail setup

1. In Google Cloud, create a project and enable the **Gmail API**.
2. Set the OAuth consent screen to **External**:
   - add the scope `gmail.readonly`;
   - add your Gmail address as a **test user**.
3. Create an **OAuth client ID** of type Web application:
   - origin `http://localhost:3000`;
   - redirect URI `http://localhost:3000/api/auth/callback/google`.
4. Put the Client ID and secret in `.env`, then restart the server.

While the Google app is in Testing mode, the Gmail permission expires after about 7 days and needs reconnecting.

### 8.4 Install the extension

1. In jobhunt, fill in **Settings → Autofill details** and upload your CV (PDF/Word) in CV & tailoring.
2. Load the extension:
   - open `edge://extensions` or `chrome://extensions`;
   - turn on Developer mode;
   - click **Load unpacked** and choose `extension/`.
3. In **Settings → Browser extension**, create a token, then paste it and the server address into the extension.

---

## Part 9 — Limitations, risks and roadmap

### 9.1 Known limitations

- **Real-site autofill is untested** on live LinkedIn, Indeed, Workday and Google Forms; their markup changes often, so some forms will fill only partly. The rules cover common labels in English.
- **Scanned PDFs** have no text layer; OCR isn't supported.
- **Gmail categorisation** is keyword-based and can mislabel; matching is by company name.
- **Gmail sync** hasn't been tested against a real inbox yet (needs the Google keys).
- **The `.doc` path** hasn't been tested against a real legacy Word file.
- **Dark theme** is derived, not designed.
- **The Save & apply tab**, in automated tests, opened before the external site had loaded; the hand-off is believed correct but wasn't confirmed against the live site.
- **No automated test suite in the repo yet** (the tests were run as scripts during the build).
- **Share to jobhunt** needs the app installed on Android over HTTPS (i.e. deployed); iPhone browsers don't support web share targets. It was tested by simulating the share request, not on a real phone.

### 9.2 Risks

| Risk | Mitigation |
|---|---|
| Job sites change markup → autofill breaks | Structured `JobPosting` data first; generic label matching; never overwrite user input; user reviews before submit |
| Job board API limits / costs | Results cached 10 minutes; sample results without keys |
| OpenAI cost or outages | Every AI feature has a non-AI fallback; inputs capped |
| Google verification for Gmail in production | Personal use works in Testing mode; publishing needs Google's restricted-scope review |
| Extension token leakage | Hashed at rest, revocable, cannot change password or tokens, shown once |

### 9.3 Roadmap

1. **Deploy** (e.g. Vercel + Atlas); production Google OAuth.
2. **Publish the extension** to the Chrome Web Store / Edge Add-ons.
3. Commit the end-to-end tests as a CI suite (Playwright) with a seeded test database.
4. Deadline reminders as push notifications (on-screen reminders are done).
5. Telegram bot: forward a job post to a bot that adds it (the Android share target already covers sharing from WhatsApp/Telegram).
6. OCR for scanned CVs; multiple CV versions per role.
7. A properly designed dark theme.
8. Weekly email digest: applications sent, replies, follow-ups due.

### 9.4 Open questions

- Should Saved jobs past their deadline be hidden or flagged automatically?
- Is a team/coach view (a mentor sees a mentee's pipeline) worth building?
- Should the follow-up threshold (7 days) be configurable?
