# Field account context verification

Added two large field task cards: Contact information and View tastings.

Contact information shows linked people with primary contacts first, their roles and preferred contact method, account point-of-contact fields and business contact details. Call and email links open the device's corresponding application. An exact duplicate of an account point of contact is displayed once. No contact records are changed. Contact refresh failures preserve the last loaded details and identify them as potentially stale.

View tastings shows the most recent past non-cancelled, non-declined, non-requested booking and all upcoming or ongoing requested/scheduled/confirmed tastings. Each entry shows venue-local date/time, recorded status, assignee and recorded location. Past bookings without completed status are explicitly labelled. More dates can be expanded. The same history is shown above the scheduling form and refreshes after confirmed persistence. No new spacing threshold or booking restriction was introduced.

Root causes: the field UI previously queried taster availability only and had no account-history view; account reads omitted linked contacts and point-of-contact fields.

Authorization uses the existing field account scope before querying contacts or tastings. Standalone contacts and other accounts' contacts are excluded.

No migration, dependency or configuration change is required.

Verification: 14 isolated field workflow tests passed, including contact scope/primary ordering and past/ongoing/future end boundaries. Touch Chromium at 390px and desktop Chromium at 1280px passed, including retained refresh failures, call/email link targets, expandable future lists, immediate tasting updates and reload persistence. Production build and scoped lint passed. Test data uses isolated PGlite; no live business records were changed. Physical iPhone Safari was not tested.

Live browser verification was blocked because automatic approval review hit its usage limit. Production deployment status could not be confirmed through that browser.
