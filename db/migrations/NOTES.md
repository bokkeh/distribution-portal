# Migration Notes

## The 0023 gap

The migration sequence jumps from `0022_taster_stripe_connect` to `0024_preferences_and_automations`.
File `0023_*.sql` does not exist and there is no entry for it in `_journal.json`.

**What happened:** A migration was generated as `0023_*.sql` to create `activity_events`,
`sms_threads`, and `reply_templates`. Those tables had already been applied to production
via `db/repair-platform-ops.ts` (a manual patch that predated the formal migration). The
`0023` file was deleted to avoid a conflict, and the journal was updated so Drizzle skips
that slot cleanly.

**Impact:** None. The journal's internal idx numbering (0, 1, 2 … 29) is contiguous.
The filename gap is cosmetic only. `drizzle-kit generate` and `drizzle-kit push` are
unaffected.

**Do not** create a new file named `0023_*.sql`. If you need to add a migration, let
`drizzle-kit generate` assign the next available number (currently `0031_*`).

---

## Repair scripts

Two one-time repair scripts live in `db/`:

| Script | Purpose |
|---|---|
| `repair-platform-ops.ts` | Re-applies the 0021 DDL using `IF NOT EXISTS`. Safe to re-run. |
| `repair-migration-history.ts` | Rebuilds `drizzle.__drizzle_migrations` from `_journal.json`. Use when migration history is lost (DB restore, fresh Neon branch). |

Both scripts have detailed usage instructions in their file headers.
