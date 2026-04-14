# Industry News Requirements

## Overview

Add an `Industry News` feature to the AHAWC Distribution Portal so users can see curated alcohol-beverage industry news, role-specific market intelligence, trend reporting, and AHAWC/Wisher-specific updates without leaving the portal.

**Date:** April 14, 2026  
**Type:** Product Requirements  
**Scope:** Admin, Staff, Sales, Taster, Driver portals + notifications

## Goals

1. Centralize industry news relevant to AHAWC Distribution and Wisher Vodka.
2. Highlight stories that matter operationally, commercially, and regionally.
3. Tailor the feed for different roles such as admins, sales reps, tasters, and drivers.
4. Connect the feature to the existing portal notification system.
5. Let users mute news alerts or choose how they receive them.

## Primary Users

- `admin`
- `staff`
- `sales_manager`
- `sales_rep`
- `taster`
- `driver`

Optional phase 2:
- `customer`

## Navigation

Add role-appropriate news routes:

- `/admin/news`
- `/staff/news`
- `/sales/news`
- `/taster/news`
- `/driver/news`

Optional detail/admin routes:

- `/admin/news/[itemId]`
- `/admin/news/sources`
- `/admin/news/settings`

## Content Coverage

The feature should organize:

- breaking trade news
- distributor and supplier strategy news
- Wisher Vodka mentions
- AHAWC-relevant stories
- category and competitor updates
- trend reports
- consumer reports
- retail and on-premise insights
- compliance and disruption alerts
- Maryland and regional news

## Source Network

Seed the source catalog with the following sites. These must be configurable in the source management layer and not hard-coded into feed logic.

### Tier 1: Must-Read Trade Publications

- Shanken News Daily
- Market Watch Magazine
- SevenFifty Daily
- Just Drinks

### Tier 2: Brand + Category + Trend Coverage

- The Spirits Business
- The Drinks Business
- Drinks International
- Chilled Magazine
- Imbibe Magazine

### Tier 3: Beverage + Startup + Innovation

- BevNET
- Beverage Industry Magazine
- Beverage Daily

### Tier 4: Retail + Restaurant + On-Premise

- Cheers Magazine
- StateWays
- Beverage Dynamics
- The Beverage Journal

## Suggested Source Priority

For AHAWC and Wisher use cases, the default priority stack should emphasize:

**Highest priority**
- Shanken News Daily
- SevenFifty Daily
- The Spirits Business
- Market Watch Magazine
- StateWays

**High priority**
- BevNET
- Drinks International
- Cheers Magazine
- The Beverage Journal

**Standard priority**
- The Drinks Business
- Just Drinks
- Beverage Industry Magazine
- Beverage Daily
- Beverage Dynamics
- Chilled Magazine
- Imbibe Magazine

## News Item Types

Support these content types:

- `breaking_news`
- `brand_mention`
- `competitor_news`
- `trend_report`
- `consumer_report`
- `market_insight`
- `retail_insight`
- `on_premise_insight`
- `compliance_update`
- `distribution_alert`
- `weather_alert`
- `event_opportunity`
- `internal_note`

## Relevance Flags

Each story should support:

- `isAHAWCRelevant`
- `isWisherRelevant`
- `isMarylandRelevant`
- `isDistributorRelevant`
- `isRetailRelevant`
- `isOnPremiseRelevant`
- `isTastingRelevant`
- `isDriverRelevant`
- `isHighPriority`
- `isPinned`

## Tags

Support tags such as:

- `spirits`
- `vodka`
- `rtd`
- `distribution`
- `retail`
- `bars_restaurants`
- `pricing`
- `consumer_trends`
- `compliance`
- `supply_chain`
- `mergers_acquisitions`
- `maryland`
- `regional_market`

## Role-Based Feed Logic

### Admin

Show:

- all high-priority stories
- Wisher Vodka mentions
- AHAWC-relevant stories
- distributor moves
- M&A
- compliance
- Maryland and regional market updates
- market and pricing reports

### Staff

Show:

- broad mix of operations, invoicing, fulfillment, and sales-relevant news
- retail and distribution updates
- notable consumer trends
- important disruptions

### Sales Manager / Sales Rep

Show:

- retail buyer behavior
- chain activity
- pricing and category shifts
- competitor launches
- on-premise menu trends
- distributor relationship stories
- Market Watch, StateWays, Cheers, SevenFifty, Spirits Business emphasis

### Taster

Show:

- sampling trends
- bartender culture
- consumer preference stories
- event and activation trends
- drink culture and brand-positioning signals
- Chilled, Imbibe, Drinks International emphasis

### Driver

Show:

- delivery-impacting disruptions
- weather and route alerts
- local/regional compliance changes
- warehouse, logistics, and supply chain updates

## Feed Sections

Each role-specific news page should support sections such as:

- `Top Stories`
- `Wisher Watch`
- `AHAWC Relevance`
- `Maryland / Regional Market`
- `Trend Reports`
- `Consumer Reports`
- `Retail + On-Premise`
- `Alerts`
- `Role Briefing`

## Admin Controls

Admins should be able to:

- add, edit, disable, and reprioritize sources
- pin stories
- archive stories
- mark stories as high priority
- override role targeting
- add internal notes
- edit AI-generated summary content
- manually publish internal news items
- force-notify selected roles for urgent items

## Notification Integration

Tie the feature into the current notification system with these events:

- `news.published`
- `news.high_priority`
- `news.wisher_mention`
- `news.ahawc_relevant`
- `news.role_briefing`
- `news.disruption_alert`

## User Notification Controls

Users must be able to:

- mute all news notifications
- choose digest frequency:
  - `urgent_only`
  - `daily_digest`
  - `weekly_digest`
  - `important_only`
- choose delivery channels:
  - `in_app`
  - `email`
  - `sms`

Optional controls:

- Wisher-only alerts
- Maryland-only alerts
- role-briefing alerts only

## Notification Behavior

- Urgent or high-priority items can trigger immediate in-app notifications.
- Email and SMS should only be sent when explicitly enabled by the user.
- General stories should prefer digest delivery rather than immediate alerts.
- Mute settings must be enforced server-side.
- Notification delivery should reuse existing user preference and notification infrastructure where possible.

## AI Enrichment

Each story can include AI-generated metadata such as:

- `aiSummary`
- `aiWhyItMatters`
- `aiActionItems`
- `aiImpactedRoles`
- `aiConfidence`

Examples:

- Why it matters to sales reps
- Why it matters to tasters
- Why it matters to operations
- Recommended next action for AHAWC

## Data Model

### `industry_news_sources`

- `id`
- `name`
- `baseUrl`
- `rssUrl`
- `apiConfig`
- `sourceTier`
- `coverageTypes`
- `defaultRoleTargets`
- `isActive`
- `isPriority`
- `regions`
- `notes`
- `createdAt`
- `updatedAt`

### `industry_news_items`

- `id`
- `sourceId`
- `title`
- `summary`
- `sourceName`
- `sourceUrl`
- `publishedAt`
- `fetchedAt`
- `contentType`
- `tags`
- `regions`
- `brandsMentioned`
- `companiesMentioned`
- `roleTargets`
- `isAHAWCRelevant`
- `isWisherRelevant`
- `isMarylandRelevant`
- `isHighPriority`
- `isPinned`
- `aiSummary`
- `aiWhyItMatters`
- `aiActionItems`
- `adminNotes`
- `heroImageUrl`
- `isActive`
- `isArchived`
- `createdAt`
- `updatedAt`

### `industry_news_user_state`

- `id`
- `userId`
- `newsItemId`
- `readAt`
- `savedAt`
- `dismissedAt`
- `clickedAt`
- `createdAt`
- `updatedAt`

### `industry_news_user_preferences`

- `userId`
- `muted`
- `deliveryMode`
- `emailEnabled`
- `smsEnabled`
- `inAppEnabled`
- `roleBriefingEnabled`
- `wisherAlertsEnabled`
- `ahawcAlertsEnabled`
- `marylandAlertsEnabled`
- `updatedAt`

### `industry_news_item_events`

- `id`
- `newsItemId`
- `eventType`
- `actorUserId`
- `metadata`
- `createdAt`

## UI Requirements

### Shared News Feed Requirements

Each role page should support:

- search
- filter by source
- filter by content type
- filter by tag
- filter by date range
- unread/read state
- pinned story styling
- role-relevance badges

### Story Card Requirements

Show:

- title
- source
- publish time
- short summary
- why it matters
- tags
- role badges
- Wisher/AHAWC highlight badge when relevant
- source link
- save / mark-read controls

### Admin Screens

Admins need:

- all-news dashboard
- source manager
- pinned/high-priority manager
- moderation and archive controls
- notification escalation controls

## Ingestion Requirements

Phase 1 can support manual admin entry plus source configuration.

Phase 2 should support automated ingestion from:

- RSS feeds
- APIs
- monitored alerts / curated source scraping where legally acceptable

Important:

- do not store or render full copyrighted article bodies unless licensing permits it
- prefer summaries, metadata, and source links
- deduplicate stories by source URL and content fingerprint

## Reporting

Admins should be able to see:

- most-read stories
- unread high-priority items by role
- Wisher-related story volume
- source performance and clickthrough
- role engagement with news content

## Suggested Build Phases

### Phase 1

- schema
- admin manual story creation
- source catalog
- role-scoped feed pages
- read/unread tracking

### Phase 2

- notification preferences
- in-app notification integration
- digests
- pin/high-priority workflow

### Phase 3

- AI summaries
- why-it-matters role messaging
- automated ingestion
- analytics

## Acceptance Criteria

- the portal includes a new Industry News tab for each relevant role
- source catalog includes the alcohol industry publications listed above
- admins can manage active sources and source priority
- stories can be tagged as Wisher/AHAWC/Maryland relevant
- role-specific feeds show tailored news
- users can mute news notifications
- users can choose in-app, email, SMS, and digest behavior
- urgent stories can trigger notifications through the existing system
- admins can pin, archive, and elevate stories

## Key Risks

- notification spam if delivery rules are too aggressive
- duplicate news items from overlapping sources
- source licensing and copyright compliance
- weak role targeting if server-side enforcement is not strict
- overreliance on AI summaries without admin override

## Implementation Notes

- Reuse the existing notification preferences model where possible instead of creating parallel logic unless the current schema cannot represent per-feature channel choices cleanly.
- Prioritize role-targeted relevance and source management before building automation.
- Treat Wisher Vodka, Maryland, and AHAWC relevance as first-class ranking signals.
