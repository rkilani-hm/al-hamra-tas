---
name: tas-build
description: Build an Al Hamra TAS module from its spec file at specs/<module>.md, following the project's non-negotiable conventions. Use when the user runs "/tas-build <module>" (e.g. /tas-build identity). Reads the spec, builds exactly what it describes (migrations, edge functions, src/features/<module>, routes, i18n), then lists which spec requirements were covered so /tas-review can verify them. Does NOT commit or push.
---

# tas-build

Build the Al Hamra TAS module named by the argument, implementing **exactly** what its
spec describes — no more, no less.

## Input

- The argument is the module name. Read its spec at **`specs/<module>.md`** (relative to the
  repo root, `al-hamra-tas/`).
- If `specs/<module>.md` does not exist, stop and tell the user the spec is missing — do not
  guess or invent requirements.

## Workflow

1. **Git hygiene first.** Run `git pull origin main` before creating anything (Lovable
   authors commits between sessions).
2. **Read the spec fully** before writing any code. Extract a concrete checklist of
   requirements (tables, RPCs, edge functions, components, routes, i18n keys, env, RLS).
3. **Build exactly the spec**, obeying every convention in "Non-negotiable conventions"
   below. These override any default instinct.
4. **Verify** before reporting:
   - `npx tsc --noEmit` (run via the project's package manager) must exit 0.
   - The dev server must serve the new route(s) and all prior routes with HTTP 200
     (start/keep `npm run dev` on port 8080; hitting a new route also triggers the router
     plugin to regenerate `routeTree.gen.ts`).
   - Both `src/i18n/locales/en.json` and `ar.json` must parse as valid JSON.
5. **Do NOT commit or push.** Stop after building + verifying and hand off to review.
6. **Report coverage** (see "Output").

## Non-negotiable conventions (override any default instinct)

**Routing / build**
- TanStack Start **file-based routing** in `src/routes/` — never create `src/pages/`.
- **Never hand-edit `src/routeTree.gen.ts`** — the router plugin regenerates it. (You may
  stage it when origin genuinely needs new routes, but never edit it by hand.)
- **Never add Vite plugins** — the Lovable config owns them.

**Stack / structure**
- React 19, Tailwind v4, shadcn/ui (reuse existing `src/components/ui/*`).
- Module logic lives in **`src/features/<module>/`** (types.ts, api.ts, components/).
- **Single-namespace i18n**: add a `<module>` object to BOTH `src/i18n/locales/en.json` and
  `ar.json`. **Arabic must be key-complete with real translations** (no English fallback, no
  placeholders). Add the `nav.<module>` key when adding a sidebar entry.
- Bilingual **EN + AR with full RTL everywhere**: use logical Tailwind classes (`ms-`/`me-`,
  `text-start`/`text-end`, `ps-`/`pe-`), `dir="rtl"` on Arabic inputs, and mirror
  directional icons. Brand tokens: primary **#1B3A5B**, accent **#C9A14A**; fonts Inter (EN)
  / IBM Plex Sans Arabic (AR) — already wired in `styles.css`/`__root.tsx`, don't re-add.

**Supabase typing**
- Use the **strict typed `supabase` client** for tables that already exist in
  `src/integrations/supabase/types.ts`.
- For **brand-new tables this module creates** (not yet in `types.ts` until Lovable applies
  the migration), use an interim loose-typed cast, clearly commented:
  ```ts
  import type { SupabaseClient } from "@supabase/supabase-js";
  // INTERIM: swap to strict client after Lovable applies migration
  const db = supabase as unknown as SupabaseClient;
  ```
  (A follow-up `/tas-build` is not needed for the swap — it's a separate cleanup step after
  apply. Just leave the comment so it's findable.)

**Migrations**
- Write **files only** into `supabase/migrations/`. **NEVER run DB commands.**
- Filename: a **14-digit timestamp** (`YYYYMMDDHHMMSS_<name>.sql`) that **sorts AFTER every
  existing migration** in the folder. Use today's real date; if a same-day collision is
  possible, bump the time component so it sorts last.
- **NEVER write SQL that references the storage bucket table** (`storage.buckets`) — Lovable
  Cloud rejects the whole migration statically, even inside an exception handler, even in a
  comment that contains the literal token. If a private Storage bucket is needed, add a
  comment telling the user to provision it via the Lovable Storage UI.
- **Recursive CTEs must use exactly ONE `UNION`/`UNION ALL`** between the seed and the single
  recursive term (Postgres 42P19). Walk multi-direction chains in that one term and carry a
  `visited[]` array as a cycle guard.
- **Every new table: enable RLS.** Add explicit `GRANT SELECT ... TO authenticated` for
  tables that should be readable. Self-scope reads where the spec says so (resolve the caller
  via `auth.jwt() ->> 'oid'` / email, the established pattern). **Writes are service-role
  until M3.1** — add no authenticated write policy unless the spec explicitly requires
  own-row writes; comment "per-role write RLS tightened in M3.1".
- Reuse the shared `tas_set_updated_at()` trigger for `updated_at`. Append-only tables get no
  `updated_at` and no update/delete policy.
- Seeds idempotent via `ON CONFLICT DO NOTHING`.

**User-scoped views**
- Any view that depends on the signed-in user must **gate on `currentUserId`** (which may be
  `null`): render a "sign in" stub when null — same pattern as the existing workflow inbox
  and notification bell. **Entra sign-in is wired LAST**, so `currentUserId` stays null for
  now; thread it as a prop and don't block the build on it.

**Secrets / env**
- Never commit secrets. Add placeholders only to `.env.example`; never touch the real `.env`.
- Document any required edge-function secrets in-file; never hardcode them.

## Do NOT

- Do **not** add features, requirements, or tables the spec doesn't list.
- Do **not** refactor unrelated code or "improve" other modules.
- Do **not** invent requirements to fill gaps — if the spec is ambiguous, note it as an
  assumption in the report rather than inventing scope.
- Do **not** commit, push, or run database commands.

## Output (hand-off to /tas-review)

When finished, report:
1. **Files created / changed** (grouped: migrations, edge functions, feature module, routes,
   i18n, env, sidebar).
2. **`tsc --noEmit` result** and **dev server route status** (200s).
3. **New migration filename(s).**
4. **Spec coverage checklist** — list each requirement from `specs/<module>.md` and mark it
   covered (or note why deferred), so `/tas-review` can verify against the same list.
5. **Assumptions / tracked TODOs** (e.g. interim loose-cast to swap after apply, currentUserId
   gating pending Entra sign-in, any bucket provisioning the user must do in the Lovable UI).

Then **stop and wait for review** — do not commit.
