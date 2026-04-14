# Documentation Hub

Welcome to the AHAWC Distribution Portal documentation. This folder contains comprehensive guides for understanding, developing, and maintaining the portal.

**Last Updated:** April 14, 2026
**Status:** Current

## Getting Started

### New to the Project?
Start here: **[CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md)**
- System-wide architecture overview
- All major system areas explained
- Tech stack and deployment guide
- 5-minute read for architectural context

### Working on CRM Features?
Start here: **[CODEMAPS/crm.md](./CODEMAPS/crm.md)**
- CRM module architecture
- Data models and flows
- Recent optimizations (April 2026)
- Integration with HubSpot

### Building/Extending CRM?
Start here: **[CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md)**
- Complete server action documentation
- Function signatures and parameters
- Return types and error handling
- Code examples

### Understanding Recent Changes?
Start here: **[APRIL_2026_UPDATE_SUMMARY.md](./APRIL_2026_UPDATE_SUMMARY.md)**
- Website field addition to accounts
- N+1 query elimination in HubSpot sync
- 4 new database indexes
- Performance improvements
- Testing recommendations

### Planning Industry News?
Start here: **[INDUSTRY_NEWS_REQUIREMENTS.md](./INDUSTRY_NEWS_REQUIREMENTS.md)**
- Industry News product requirements
- source catalog and prioritization
- role-targeted feed logic
- user news notification controls

## Documentation Index

### Architecture & Design

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| [CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md) | System-wide overview (10 areas) | Architects, leads, onboarding | 15 min |
| [CODEMAPS/crm.md](./CODEMAPS/crm.md) | CRM module deep dive | Developers, architects | 10 min |

### Development & API

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| [CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md) | Complete API documentation | Developers, integrators | 20 min |
| [APRIL_2026_UPDATE_SUMMARY.md](./APRIL_2026_UPDATE_SUMMARY.md) | Recent changes and features | All technical staff | 15 min |
| [INDUSTRY_NEWS_REQUIREMENTS.md](./INDUSTRY_NEWS_REQUIREMENTS.md) | Industry News feature requirements | Product, developers, architects | 15 min |

### Maintenance & QA

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| [DOCUMENTATION_AUDIT.md](./DOCUMENTATION_AUDIT.md) | Docs verification, maintenance guide | Tech leads, documentation team | 10 min |
| [../CHANGES.md](../CHANGES.md) | Historical change log (March-April 2026) | All staff, stakeholders | Variable |

## Quick Answers

**Q: How do I create a new customer account?**
A: See [CRM_API_REFERENCE.md § createCustomerAccount()](./CRM_API_REFERENCE.md#createcustomeraccount)

**Q: What's the HubSpot integration architecture?**
A: See [CODEMAPS/crm.md § HubSpot Integration](./CODEMAPS/crm.md#hubspot-integration)

**Q: Why did performance improve in April 2026?**
A: See [APRIL_2026_UPDATE_SUMMARY.md § Performance Optimizations](./APRIL_2026_UPDATE_SUMMARY.md#backend-changes)

**Q: What are the database tables?**
A: See [CODEMAPS/INDEX.md § Database Layer](./CODEMAPS/INDEX.md#2-database-layer)

**Q: How do I test the contact sync?**
A: See [APRIL_2026_UPDATE_SUMMARY.md § Testing Recommendations](./APRIL_2026_UPDATE_SUMMARY.md#testing-recommendations)

**Q: How do I deploy changes?**
A: See [CODEMAPS/INDEX.md § Deployment](./CODEMAPS/INDEX.md#deployment-vercel)

## Document Organization

**Q: What is the Industry News build plan?**
A: See [INDUSTRY_NEWS_REQUIREMENTS.md](./INDUSTRY_NEWS_REQUIREMENTS.md)

```
docs/
├── README.md (this file)
├── CODEMAPS/
│   ├── INDEX.md (system overview)
│   └── crm.md (CRM module)
├── CRM_API_REFERENCE.md (API documentation)
├── APRIL_2026_UPDATE_SUMMARY.md (recent changes)
└── DOCUMENTATION_AUDIT.md (verification log)
```

### Future Codemaps (To Be Added)
- `CODEMAPS/sales.md` — Sales portal architecture
- `CODEMAPS/admin.md` — Admin portal features
- `CODEMAPS/database.md` — Database schema deep dive
- `CODEMAPS/integrations.md` — External API integrations
- `CODEMAPS/workers.md` — Background jobs and cron routes

## How to Use This Documentation

### For Development
1. Read [CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md) for system overview
2. Go to specific module codemap (e.g., [CODEMAPS/crm.md](./CODEMAPS/crm.md))
3. Reference [CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md) for API details
4. Check [../CHANGES.md](../CHANGES.md) for related recent changes
5. Use [INDUSTRY_NEWS_REQUIREMENTS.md](./INDUSTRY_NEWS_REQUIREMENTS.md) for the Industry News implementation plan

### For Code Review
1. Check [APRIL_2026_UPDATE_SUMMARY.md](./APRIL_2026_UPDATE_SUMMARY.md) for context
2. Reference [CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md) for function signatures
3. Check [CODEMAPS/crm.md](./CODEMAPS/crm.md) for architectural concerns

### For Deployment
1. Review [CODEMAPS/INDEX.md § Setup & Deployment](./CODEMAPS/INDEX.md#setup--deployment)
2. Follow [APRIL_2026_UPDATE_SUMMARY.md § Deployment Notes](./APRIL_2026_UPDATE_SUMMARY.md#deployment-notes)
3. Check [DOCUMENTATION_AUDIT.md](./DOCUMENTATION_AUDIT.md) for verification steps

### For Onboarding
1. Start: [CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md) (system overview, 15 min)
2. Deep dive: [CODEMAPS/crm.md](./CODEMAPS/crm.md) (CRM focus, 10 min)
3. API details: [CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md) (as needed)
4. Recent context: [APRIL_2026_UPDATE_SUMMARY.md](./APRIL_2026_UPDATE_SUMMARY.md) (5 min)
5. Planned feature scope: [INDUSTRY_NEWS_REQUIREMENTS.md](./INDUSTRY_NEWS_REQUIREMENTS.md)

## Key Information at a Glance

### Tech Stack
- **Frontend:** Next.js 16, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Node.js, Drizzle ORM, NextAuth v5
- **Database:** Neon PostgreSQL (fully managed)
- **Deployment:** Vercel with cron jobs
- **Integrations:** HubSpot, Stripe, Twilio, Resend, Google Cloud, Google Chat

### Project Structure
- **Workspaces:** Single monorepo (Next.js)
- **Portals:** Admin, Staff, Sales, Driver, Customer
- **Roles:** admin, staff, driver, customer
- **Database Tables:** 16 core tables + activity events, preferences, etc.
- **User Roles:** 4 role-based portals with different permissions

### Recent Changes (April 2026)
- Website field added to customer accounts
- 4 new database indexes for performance
- N+1 query elimination in HubSpot contact sync
- Simplified CRM account query logic
- 2,300+ lines of new documentation

## Keeping Documentation Current

### When to Update
- **Code changes:** Update docs when adding features or changing APIs
- **Architecture changes:** Update CODEMAPS immediately
- **Bug fixes:** No doc update needed (unless architectural)
- **Performance improvements:** Update APRIL_2026_UPDATE_SUMMARY.md style changelog

### How to Update
1. Identify which doc(s) need updates
2. Follow the structure in existing docs
3. Include dates and version info
4. Cross-reference related sections
5. Verify all code examples compile
6. Test all file paths exist
7. Add entry to CHANGES.md
8. Commit with code changes

### Contact
Documentation is maintained by the technical team. Questions? See [DOCUMENTATION_AUDIT.md](./DOCUMENTATION_AUDIT.md) for contacts.

## Document Freshness

| Document | Last Updated | Status |
|----------|--------------|--------|
| [CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md) | 2026-04-02 | ✓ Current |
| [CODEMAPS/crm.md](./CODEMAPS/crm.md) | 2026-04-02 | ✓ Current |
| [CRM_API_REFERENCE.md](./CRM_API_REFERENCE.md) | 2026-04-02 | ✓ Current |
| [APRIL_2026_UPDATE_SUMMARY.md](./APRIL_2026_UPDATE_SUMMARY.md) | 2026-04-02 | ✓ Current |
| [DOCUMENTATION_AUDIT.md](./DOCUMENTATION_AUDIT.md) | 2026-04-02 | ✓ Current |
| [../CHANGES.md](../CHANGES.md) | 2026-04-02 | ✓ Current |

## Tips for Best Results

1. **Search the docs:** Use browser find (Ctrl+F / Cmd+F) to search across documents
2. **Cross-reference:** Click links to jump between related sections
3. **Read architecture first:** Always read CODEMAPS before diving into APIs
4. **Check the summary:** Start with APRIL_2026_UPDATE_SUMMARY for context
5. **Verify your changes:** Use DOCUMENTATION_AUDIT.md checklist when updating

## License

These documents describe the AHAWC Distribution Portal, proprietary software of AHAWC. Internal use only.

---

**Last Updated:** April 14, 2026
**Documentation Version:** 1.0
**Portal Version:** Next.js 16

Ready to get started? [Open CODEMAPS/INDEX.md](./CODEMAPS/INDEX.md)
