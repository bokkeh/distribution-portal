# Field account context verification

Added two large field task cards: Contact information and View tastings.

Contact information shows linked people with primary contacts first, their roles and preferred contact method, account point-of-contact fields and business contact details. Call and email links open the device's corresponding application. An exact duplicate of an account point of contact is displayed once. No contact records are changed. Contact refresh failures preserve the last loaded details and identify them as potentially stale.

View tastings shows the most recent past non-cancelled, non-declined, non-requested booking and all upcoming or ongoing requested/scheduled/confirmed tastings. Each entry shows venue-local date/time, recorded status, assignee and recorded location. Past bookings without completed status are explicitly labelled. More dates can be expanded. The same history is shown above the scheduling form and refreshes after confirmed persistence. No new spacing threshold or booking restriction was introduced.

Root causes: the field UI previously queried taster availability only and had no account-history view; account reads omitted linked contacts and point-of-contact fields.

Authorization uses the existing field account scope before querying contacts or tastings. Standalone contacts and other accounts' contacts are excluded.

No migration, dependency or configuration change is required.

Verification: 14 isolated field workflow tests passed, including contact scope/primary ordering and past/ongoing/future end boundaries. Touch Chromium at 390px and desktop Chromium at 1280px passed, including retained refresh failures, call/email link targets, expandable future lists, immediate tasting updates and reload persistence. Production build and scoped lint passed. Test data uses isolated PGlite; no live business records were changed. Physical iPhone Safari was not tested.

The contacts and tasting-history release (993046e) was subsequently confirmed Ready in the correct production Vercel project, with both live field views verified read-only.


## Quick contact addition

Contact information now includes Add contact, with only name required. Phone and email are optional; role, preferred contact method and primary-contact designation are expandable. Saves use the selected account and existing field account permissions. Existing primary contacts are preserved. No marketing consent, account pipeline or account point-of-contact fields are changed.

A stable request ID prevents repeated taps and lost-response retries from inserting duplicate contact rows. Obvious account-local duplicates are reported without merging records. Failed saves retain form input; confirmed saves update the field card, survive navigating away/back, and invalidate CRM contact/account views.

Verification: 15 isolated field workflow tests, mobile (390px) and desktop (1280px) browser checks, scoped lint and production build passed. Tests include name-only creation, authorization, validation, existing primaries, duplicate matches, concurrent retries, lost save responses, retained input, repeated taps, immediate display and navigation persistence. No migration or new dependency is required. No live contacts were created during testing.


## Taster photos on availability cards

Field scheduling cards now show each taster's existing profile photo beside their name. The availability query and row mapping previously omitted avatar URLs. Existing avatar display rules proxy GCS images through the portal; missing, invalid or failed images show initials. Booking buttons and name/date text remain accessible. No profile or business records are changed, and no migration is required.

Verification: 16 field workflow tests, scoped lint and a production build passed. Touch Chromium at 390px and desktop Chromium at 1280px verify a real image load through the proxy URL, broken-image fallback, no horizontal overflow and booking/reload behavior. No physical iPhone Safari testing was available.
