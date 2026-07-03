# Microsoft 365 (Office 365) Provisioning — Al Hamra TAS

This guide activates the Microsoft 365 integrations the TAS uses. It is written to be handed to
whoever administers the Al Hamra **Entra ID (Azure AD)** tenant. Nothing here is live until an Entra
admin registers an app and its secrets are set — the app ships safe-by-default (in-app notifications
and in-app interview scheduling work regardless; the M365 layer only *adds* email + calendar/Teams
on top).

## Scope — the O365 services in use

| Service | What the TAS does with it | State today | Turns on with |
|---------|---------------------------|-------------|----------------|
| **Entra SSO** | User sign-in (OIDC) | ✅ **Live** | already configured |
| **Outlook email** | Send TAS notifications as a real mailbox | ⏸ Dormant | Graph app + `GRAPH_SENDER_UPN` |
| **Teams meeting + Outlook calendar** | When an interview is scheduled with mode **Teams**, create an Outlook calendar event **with a Teams online meeting** and email the invite (with the Teams join link) to the candidate + panellists. On-site/phone interviews still send a calendar invite (no Teams link). | ⏸ Dormant | Graph app + `GRAPH_ORGANIZER_UPN` |
| **SharePoint** (optional) | Store uploaded documents in SharePoint instead of built-in storage | ⏸ Dormant, **not required** for the above | Graph app + site/drive IDs |

All of this uses **one** Entra app registration via the **client-credentials** (application-permission)
flow — no per-user delegation to configure.

---

## Part 1 — Entra app registration (Entra admin)

1. **Azure Portal → Entra ID → App registrations → New registration.**
   - Name: `Al Hamra TAS – Graph Integration` (any name).
   - Supported account types: **Single tenant**. Redirect URI: leave blank.
   - Record the **Application (client) ID** and **Directory (tenant) ID**.

2. **Certificates & secrets → New client secret.** Copy the **Value** immediately (shown once); note
   the expiry/renewal date.

3. **API permissions → Add a permission → Microsoft Graph → _Application permissions_** (not
   Delegated). Add these, then **Grant admin consent** for the tenant:

   | Permission | Needed for |
   |------------|-----------|
   | `Mail.Send` | Outlook email notifications |
   | `Calendars.ReadWrite` | Create the interview calendar event on the organizer mailbox + send invites |
   | `OnlineMeetings.ReadWrite.All` | Attach the Teams online meeting to the event *(see note in step 5)* |

   SharePoint is out of scope here; add `Sites.ReadWrite.All` only if you later opt into SharePoint
   document storage.

4. **Restrict the app to the two service mailboxes (recommended).** Application `Mail.Send` /
   `Calendars.ReadWrite` otherwise let the app act on *any* mailbox. Scope it to just the TAS
   sender/organizer with an **Application Access Policy** (Exchange Online PowerShell):
   ```powershell
   New-ApplicationAccessPolicy `
     -AppId <Application (client) ID> `
     -PolicyScopeGroupId tas-interviews@alhamra.com.kw `
     -AccessRight RestrictAccess `
     -Description "Restrict TAS app to the TAS sender/organizer mailbox"
   ```
   Use a real/shared mailbox for both roles (it becomes `GRAPH_SENDER_UPN` and `GRAPH_ORGANIZER_UPN`
   — they can be the same mailbox).

5. **Teams online-meeting note.** The TAS creates the Teams meeting *via the calendar event*
   (`isOnlineMeeting: true`), which in most tenants only needs `Calendars.ReadWrite`. If Teams join
   links don't populate on created events, also grant the app app-only online-meeting rights with a
   Teams application access policy (Teams PowerShell):
   ```powershell
   New-CsApplicationAccessPolicy -Identity tas-online-meetings `
     -AppIds "<Application (client) ID>" -Description "TAS online meetings"
   Grant-CsApplicationAccessPolicy -PolicyName tas-online-meetings `
     -Identity tas-interviews@alhamra.com.kw
   ```

---

## Part 2 — Set the secrets (TAS admin, in Lovable/Supabase)

Set these as **edge-function environment variables** (Supabase → Edge Functions → Secrets).
**Never commit these to git.**

| Secret | Required for | Notes |
|--------|-------------|-------|
| `ENTRA_TENANT_ID` | all Graph | Directory (tenant) ID |
| `ENTRA_CLIENT_ID` | all Graph | Application (client) ID |
| `ENTRA_CLIENT_SECRET` | all Graph | client secret **Value** |
| `GRAPH_SCOPES` | optional | defaults to `https://graph.microsoft.com/.default` — leave unset |
| `GRAPH_SENDER_UPN` | Outlook email | sender mailbox, e.g. `tas-interviews@alhamra.com.kw` |
| `GRAPH_ORGANIZER_UPN` | Teams/calendar | organizer mailbox for interview events (falls back to `GRAPH_SENDER_UPN` if unset) |
| `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID` | SharePoint (optional) | only if you enable SharePoint storage |

The same three `ENTRA_*` values power email, calendar, and Teams (one app, one token).

---

## Part 3 — Enable the adapters in the app

Two gates per adapter: an **`is_enabled` toggle** (in-app) and a **`config_status = 'configured'`**
flag (service-role only; the seeded default is `unconfigured`). **Both** must be set.

1. **In-app toggle** — sign in as a user with `settings.manage`, go to **Administration →
   Integrations** (`/app/admin/integrations`) and enable **Outlook email** and **Teams**.

2. **`config_status` flip** — the toggle sets `is_enabled` but not `config_status`. The email
   dispatcher tolerates this, but the **interview scheduler requires `config_status = 'configured'`**
   for `outlook_email`/`teams` before it will create a calendar/Teams event (otherwise it safely
   records the interview's `calendar_status = 'skipped'`). This column has no UI. **Once your secrets
   are set, tell me and I'll run the one-line update** (`tas_comm_adapter_config` `config_status =
   'configured'` for channels `outlook_email` and `teams`) via the Lovable DB tooling — or your DBA
   can run it directly.

---

## Part 4 — Verify

- **Email**: trigger a notification (e.g. submit a requisition for approval) → the recipient gets it
  from `GRAPH_SENDER_UPN`; **Notifications → Log** shows *sent* (not *skipped*/*failed*).
- **Teams + calendar**: schedule an interview with mode **Teams**, adding the candidate (with an
  email) and panellists → they receive an **Outlook calendar invite** containing the **Teams join
  link**; the interview's `calendar_status` becomes **created** and `teams_join_url` is populated.
  An on-site interview sends a calendar invite with the location and no Teams link.

---

## Notes & limitations

- **Teams here means meetings, not chat.** Meetings are created as Outlook calendar events with an
  online meeting; there is no Teams channel/chat messaging.
- **Attendees need email addresses.** Candidates without an email and panellists without a `tas_user`
  email are simply omitted from the invite; the event is still created for the rest.
- **SMS** is a separate, non-O365 channel (`SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`) — ignore unless
  wanted.
- **Secrets never live in the repo** — environment variables only. The database stores just
  enable/status *flags* (`tas_comm_adapter_config`), never secrets.
- **Secret rotation**: update `ENTRA_CLIENT_SECRET` when it expires — no code change.
- **Fail-safe**: if a secret is missing/wrong the app never crashes — emails are marked *skipped* and
  interview `calendar_status` is *skipped* (or *failed* with a note on a Graph error), while in-app
  notifications and in-app scheduling keep working.
