---
name: tas-loop
description: Autonomously build-and-review an Al Hamra TAS module until it passes. Use when the user runs "/tas-loop <module>" (e.g. /tas-loop identity). Runs /tas-build <module>, then /tas-review <module>; if review FAILS, applies the named fixes and re-runs /tas-review; repeats until /tas-review returns PASS. Then STOPS with the final PASS report (files changed, tsc result, migration filenames, assumptions/TODOs). Never commits, pushes, applies migrations, or contacts Lovable — waits for the user's review before any commit.
---

# tas-loop

Drive a module from spec to a verified PASS, autonomously, by looping build → review → fix.

## Input

- The argument is the module name. It maps to the spec at **`specs/<module>.md`** (used by
  `/tas-build` and `/tas-review`). If that spec is missing, stop and say so.

## The loop

1. **Build.** Run **`/tas-build <module>`** (it does `git pull` first, builds exactly the
   spec, verifies `tsc`/routes, and reports coverage). Do NOT commit.
2. **Review.** Run **`/tas-review <module>`** — grade against the spec + the 11 hard-gate
   rubric. It returns **PASS** or a numbered **FAIL** list.
3. **Decide.**
   - If **PASS** → exit the loop, go to "Final report".
   - If **FAIL** → go to step 4.
4. **Fix.** Apply **only** the specific fixes named in the FAIL list (each failure cites an
   exact spec item / rubric rule + a fix). Use the `/tas-build` conventions when editing —
   same non-negotiables (file-based routing, no `routeTree.gen.ts` hand-edits, no Vite
   plugins, key-complete Arabic, strict-vs-interim typing rules, migration rules incl. no
   `storage.buckets` and one-UNION recursive CTEs, RLS+grants, currentUserId gating, no
   unsupported integrations). Do **not** add scope beyond what the failures require.
5. **Re-review.** Go back to step 2. Repeat **autonomously** — no need to ask the user
   between iterations — until `/tas-review` returns PASS.

### Loop guardrails

- Keep iterating without pausing for confirmation; the whole point is hands-off convergence.
- After each fix round, re-run the **full** `/tas-review` (not a partial check) so a fix can't
  silently break another gate.
- If the same rubric rule / spec item fails **3 times in a row** despite fixes, stop and
  surface it: report what won't converge, the attempts made, and why — rather than looping
  forever. (Genuine blockers — e.g. a requirement that needs the user's decision, or
  something only resolvable after Lovable applies a migration — belong in this surfaced note,
  not in an infinite loop.)
- **Never** commit, push, stage for commit, run DB commands, apply migrations, or contact
  Lovable at any point in the loop. Migrations stay as files; the working tree stays
  uncommitted.

## Final report (on PASS)

Stop and give the user:
1. **The final `/tas-review` PASS report** (verbatim verdict + the spec/rubric items it
   confirmed).
2. **Files created / changed** — grouped (migrations, edge functions, `src/features/<module>`,
   routes, i18n, env, sidebar).
3. **`tsc --noEmit` result** (should be exit 0).
4. **New migration filename(s).**
5. **Assumptions / tracked TODOs** — e.g. interim loose-cast(s) to swap after Lovable applies
   the migration, `currentUserId` gating pending Entra sign-in, any private Storage bucket the
   user must provision via the Lovable UI, and how many build↔review iterations it took.

Then **STOP and wait for the user's review of the PASS report before the commit step.** Do
not commit or push — that is the user's call after they read the report.
