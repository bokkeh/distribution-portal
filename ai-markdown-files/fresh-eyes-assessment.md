# Fresh Eyes Assessment — Distribution Portal
_Date: 2026-03-22_

---

## What Makes Sense

**The core architecture is solid.**
- Middleware + route groups for RBAC is clean and scalable. It's one of the best ways to handle this in Next.js App Router.
- Server actions pattern is appropriate for this scale — no unnecessary API layer for internal operations.
- Drizzle + Neon is a good fit. Type-safe queries, serverless-friendly.
- The `actions/` → `lib/` → `db/` separation is logical and consistent.

**The delivery/driver flow reads like a real product.**
Deliveries, stops, photos, sharing links, maps, geocoding — this feels like it was built from actual operational needs, not guesswork. Same with invoicing and orders.

**Auth is properly layered.**
Rate limiting, session management, role impersonation (`view-as`), access event logging — these are things that get bolted on later and cause pain. They're in from the start here.

---

## What Feels Off

**1. The tasting feature has become a product within a product.**
Six server actions, 5+ dedicated tables (`tastings`, `tastingReports`, `tastingAnalyses`, `tasterAvailability`, `tastingSmsTemplates`), a separate user role (`taster`), a signup flow, payout tracking, ROI analysis, SMS scheduling series, and its own route group. This is bigger than the driver portal. If it's a core revenue feature, fine — but it feels like scope that drifted in and now owns a large chunk of the codebase.

**2. The repair scripts are a warning sign.**
`repair-migration-history.ts` and `repair-platform-ops.ts` in `/scripts` mean the schema has been manually patched more than once. When Drizzle's migration history gets out of sync with the actual DB, it tends to compound — each future migration carries the risk of the same problem. Worth cleaning up before the schema grows more.

**3. 39 tables is a lot, and some feel speculative.**
Tables like `shelfAnalyses`, `activityEvents`, `userAccessEvents`, `emailAutomationTemplates`, `scheduledSmsJobs`, `replyTemplates` — it's hard to tell from the outside if these are actively used features or were built in anticipation of something. Dead schema adds cognitive overhead and migration surface area.

**4. 8+ external integrations with no abstraction layer.**
HubSpot, Stripe, Telnyx, Google (Maps + Cloud + Chat), Resend, OpenAI, Upstash. Each one is wired directly into actions/lib. If any of these change (pricing, API deprecation, vendor swap), the blast radius is large. The Google Chat webhook notification pattern especially — it's scattered. A single `notify()` interface that dispatches to Chat/SMS/email/in-app would be cleaner.

**5. OpenAI is in the dependencies but it's unclear where it's used.**
If it's powering something real (inbox summarization? shelf analysis?), great. If it's aspirational, it's dead weight and another API key to manage.

**6. The `(sales)` role feels underdeveloped compared to tasting.**
Sales gets dashboards, routes, commissions, and territories — but the forecast, regions, and commissions features may be thin. Hard to tell without reading the pages, but the surface area feels smaller than what a sales manager would actually need.

**7. Cron jobs are fire-and-forget.**
Three cron endpoints (`daily-digest`, `hubspot-sync`, `tasting-sms`) with no visible monitoring or retry logic. The `/admin/jobs` page might cover this, but cron failures are typically silent until a user notices something missing.

---

## The Bigger Picture

This started as a distribution portal and has grown into something closer to a field operations platform — CRM, events, sales territories, VoIP, SMS threading, delivery tracking, accounting. That's not inherently wrong, but it means:

- The "what is this for" answer has gotten blurry
- Testing coverage probably hasn't kept up with the feature count
- The next person to onboard will have a steep ramp

The bones are good. The main risk is continued feature addition without occasionally pruning what isn't used or consolidating what's fragmented.

---

## By the Numbers

| Category | Count |
|---|---|
| User Roles | 7 |
| Route Groups | 7 |
| Server Actions | 33 |
| Database Tables | 39 |
| API Routes | 15+ |
| Component Files | 114 |
| External Integrations | 8+ |
| Cron Jobs | 3 |

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16, React 19 |
| Styling | Tailwind v4, Radix UI |
| Database | Neon PostgreSQL, Drizzle ORM |
| Auth | NextAuth v5 |
| Payments | Stripe v2026 |
| Messaging | Telnyx (SMS/Voice), Resend (Email) |
| CRM | HubSpot API |
| Cloud | Google Cloud Storage, Maps, Chat |
| Caching | Upstash Redis |
| State | Zustand (client) |
