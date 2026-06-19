---
name: tas-review
description: Grade the current Al Hamra TAS build for a module against its spec (specs/<module>.md) AND the project rubric of hard gates. Use when the user runs "/tas-review <module>" (e.g. /tas-review identity). Goes item by item; for every gap, bug, or violation names the exact spec item or rubric rule it fails and hands specific fixes back for /tas-build. Reports PASS only when every spec requirement and every rubric rule is fully met. Read-only: never commits, pushes, applies migrations, or contacts Lovable.
---

# tas-review

Grade the current working-tree build of the module named by the argument against **two**
sources, item by item:
1. its spec at **`specs/<module>.md`**, and
2. the **project rubric** (hard gates) below.

For every gap, bug, or violation, name the **exact spec item or rubric rule** it fails and
hand back a **specific fix** that `/tas-build` can act on. Only report **PASS** when every
spec requirement and every rubric rule is fully met.

## Scope (CRITICAL)

This skill is **read-only verification**. Your scope **ends at a clean, verified, uncommitted
working tree**.
- Do **NOT** commit. Do **NOT** push. Do **NOT** apply migrations or run DB commands.
- Do **NOT** contact Lovable or trigger a sync.
- You may run read-only checks: `git status`/`git diff` (no staging), `tsc --noEmit`, hitting
  dev routes, parsing JSON, grepping the migration/SQL/feature files.

## Input

- The argument is the module name. Read **`specs/<module>.md`**. If it is missing, stop and
  say so — you cannot grade against an absent spec.
- Determine the module's changed files from `git status` / the spec (migrations, edge
  functions, `src/features/<module>/`, routes, i18n, sidebar, `.env.example`).

## How to grade

Go **item by item**. Two passes:

### Pass A — Spec coverage (`specs/<module>.md`)
Build a checklist of every requirement the spec states (tables, columns, RPCs, edge
functions, components, routes, i18n keys, env, RLS posture, seeds). For each: mark **met** or
**FAIL** with the exact spec line/requirement and what's missing or wrong.

### Pass B — Project rubric (hard gates)
Verify each rule. Any failure blocks PASS.

1. **Typecheck.** `tsc --noEmit` exits **0**. (Run it; quote the first errors if not.)
2. **Routes 200.** Every route returns HTTP 200 on the dev server (port 8080) — the new
   module route(s) **and** all prior: `/app/identity`, `/app/config`, `/app/workflow`,
   `/app/notifications`, `/app/audit`, `/app/documents`. (If dev isn't running, start it;
   hitting a new route also regenerates `routeTree.gen.ts`.)
3. **i18n parity.** `en.json` and `ar.json` both parse as JSON, **and `ar.json` is
   key-complete vs `en.json`** — no missing keys (deep key-set diff, both directions). Report
   any missing/extra keys by path.
4. **No `storage.buckets`.** No SQL anywhere references the storage bucket table — not in
   statements, not in comments (grep the literal token across `supabase/migrations/`).
5. **Recursive CTEs.** Every `with recursive` has **exactly one** `UNION`/`UNION ALL` between
   the seed and the single recursive term (42P19). Flag any with two+.
6. **New-table RLS + grants.** Every new table has **RLS enabled** and an explicit
   `GRANT SELECT ... TO authenticated` where reads are exposed; **writes restricted to
   service-role** with an **M3.1 comment** (or an explicit own-row write policy only where the
   spec requires it).
7. **Migration timestamp.** Each new migration filename is **14-digit** and **sorts after
   every existing** migration in `supabase/migrations/`.
8. **Loose-casts.** Any interim loose-typed cast is **commented for the post-apply swap**
   (`// INTERIM: swap to strict client after Lovable applies migration`); and there is **no
   stray loose-cast on a table that already exists** in `src/integrations/supabase/types.ts`
   (those must use the strict client).
9. **Git hygiene.** `.env` is **not staged** (and ideally nothing is staged — review leaves
   the tree uncommitted). `routeTree.gen.ts` churn is left **unstaged unless it carries new
   routes** for this module (verify the diff adds the module's route registrations and drops
   nothing).
10. **User-scoped gating.** Any user-scoped view gates on `currentUserId` and **degrades
    gracefully when null** (renders a sign-in/empty stub, no crash). Confirm the null path.
11. **No unsupported integrations.** No SAP / Oracle / Workday / Dynamics / Power BI; no M365
    surface beyond Outlook / Teams / SharePoint / Entra; HRMS references are **MenaME only**.
    (Grep code, SQL, deps, and copy.)

## Verdict

- **PASS** — only if **every** Pass-A spec requirement **and every** Pass-B rubric rule is
  fully met. State it plainly.
- **FAIL** — otherwise. Produce a numbered failure list. For each failure give:
  - the **exact** spec item or rubric rule number it violates,
  - the offending file/line (or what's missing),
  - a **specific, actionable fix** `/tas-build` can apply.
  Order failures: hard-gate blockers first (1–11), then spec gaps, then nits.

Do not soften a FAIL to a PASS. A single unmet item = FAIL. End the report with the verdict
and, if FAIL, the fix list — nothing committed, nothing pushed, working tree untouched.
