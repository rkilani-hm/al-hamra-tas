# Microsoft 365 (Office 365) Provisioning — Al Hamra TAS

This guide activates the **dormant** Microsoft 365 integrations in the TAS. It is written to be
handed to whoever administers the Al Hamra **Entra ID (Azure AD)** tenant. Nothing here is live
until an Entra admin registers an app and its secrets are set — the app ships safe-by-default and
falls back gracefully (documents go to built-in Supabase Storage; notifications are marked
*skipped*, never failed) until you complete these steps.

## What's already live vs. dormant

| Component | Purpose | State today | Turns on with |
|-----------|---------|-------------|---------------|
| **Entra SSO** | User sign-in (OIDC) | ✅ **Live** (M0.1) | already configured |
| **Outlook email** | Send TAS notifications as a real mailbox via Graph | ⏸ Dormant | app + `GRAPH_SENDER_UPN` |
| **SharePoint** | Store uploaded documents in SharePoint instead of Supabase Storage | ⏸ Dormant | app + site/drive IDs + config flip |
| **Teams** | Post notifications to Teams | 🚫 Not implemented | needs chat/channel target design (future) |

All three dormant pieces share **one** Entra app registration using the **client-credentials**
(application-permission) flow — there is no per-user delegation to configure.

---

## Part 1 — Entra app registration (Entra admin)

1. **Azure Portal → Entra ID → App registrations → New registration.**
   - Name: `Al Hamra TAS – Graph Integration` (any name).
   - Supported account types: **Single tenant**.
   - Redirect URI: leave blank (client-credentials flow needs none).
   - Record the **Application (client) ID** and the **Directory (tenant) ID**.

2. **Certificates & secrets → New client secret.**
   - Description `tas-graph`, expiry per your policy (e.g. 12–24 months — note the renewal date).
   - Copy the secret **Value** immediately (shown once).

3. **API permissions → Add a permission → Microsoft Graph → _Application permissions_** (not
   Delegated). Add only what each feature needs, then **Grant admin consent** for the tenant:

   | Permission | Needed for | Least-privilege note |
   |------------|-----------|----------------------|
   | `Mail.Send` | Outlook email | Scope it to the single sender mailbox (step 4) so the app can't send as anyone. |
   | `Sites.ReadWrite.All` *(or `Files.ReadWrite.All`)* | SharePoint document storage | Grants write to SharePoint drives. If your policy allows, restrict via [Sites.Selected] instead and grant the app access to only the TAS site. |

   Skip Teams permissions — the Teams sender isn't built yet.

4. **(Recommended) Restrict `Mail.Send` to one mailbox.** By default `Mail.Send` (application) lets
   the app send as *any* mailbox. Lock it to the TAS sender with an **Application Access Policy**
   (Exchange Online PowerShell):
   ```powershell
   New-ApplicationAccessPolicy `
     -AppId <Application (client) ID> `
     -PolicyScopeGroupId tas-sender@alhamra.com.kw `
     -AccessRight RestrictAccess `
     -Description "Restrict TAS app to the TAS sender mailbox"
   ```
   Use a real/shared mailbox as the sender (this becomes `GRAPH_SENDER_UPN`).

---

## Part 2 — Collect the SharePoint site & drive IDs (for document storage)

Only needed if you want documents stored in SharePoint. Using the app token (or Graph Explorer as
an admin), resolve the target library:

- **Site ID** — `GET https://graph.microsoft.com/v1.0/sites/alhamra.sharepoint.com:/sites/<SiteName>`
  → use the returned `id` (the full `host,siteGuid,webGuid` triplet) as `SHAREPOINT_SITE_ID`.
- **Drive ID** — `GET https://graph.microsoft.com/v1.0/sites/<SITE_ID>/drives`
  → pick the document library (usually **Documents**) and use its `id` as `SHAREPOINT_DRIVE_ID`.

---

## Part 3 — Set the secrets (TAS admin, in Lovable/Supabase)

Set these as **edge-function environment variables** in the Lovable Cloud project (Supabase →
Edge Functions → Secrets). **Never commit these to git.**

| Secret | Required for | Example / notes |
|--------|-------------|-----------------|
| `ENTRA_TENANT_ID` | all Graph | Directory (tenant) ID from Part 1 |
| `ENTRA_CLIENT_ID` | all Graph | Application (client) ID |
| `ENTRA_CLIENT_SECRET` | all Graph | client secret **Value** |
| `GRAPH_SCOPES` | optional | defaults to `https://graph.microsoft.com/.default` — leave unset |
| `GRAPH_SENDER_UPN` | Outlook email | the sender mailbox, e.g. `tas-sender@alhamra.com.kw` |
| `SHAREPOINT_SITE_ID` | SharePoint | from Part 2 |
| `SHAREPOINT_DRIVE_ID` | SharePoint | from Part 2 |

The same three `ENTRA_*` values power email **and** SharePoint (one app, one token).

---

## Part 4 — Enable the adapters in the app

Two things gate each adapter: an **`is_enabled` toggle** (in-app) and, for SharePoint, a
**`config_status = 'configured'`** flag (service-role only). Both must be set.

1. **In-app toggle** — sign in as a user with `settings.manage`, go to
   **Administration → Integrations** (`/app/admin/integrations`) and enable:
   - **Outlook email** (comm adapter `outlook_email`)
   - **SharePoint** (storage adapter `sharepoint`)

2. **`config_status` flip (SharePoint only)** — the toggle sets `is_enabled` but *not*
   `config_status`, which the storage router also checks before routing to SharePoint (otherwise it
   safely falls back to Supabase Storage). This column is service-role only and has no UI. **Once
   your secrets are set, tell me and I'll run the one-line update** (`tas_storage_adapter_config`
   `config_status = 'configured'` for `provider = 'sharepoint'`) via the Lovable DB tooling — or
   your DBA can run it directly.

   > Outlook email does **not** need this — the dispatcher just tries Graph and marks a send
   > *skipped* if creds are missing, so once the secret is set and the toggle is on, it's live.

---

## Part 5 — Verify

- **Outlook email**: trigger any TAS notification (e.g. submit a requisition for approval) and
  confirm the recipient receives it from `GRAPH_SENDER_UPN`. In **Notifications → Log** the row
  should read *sent* (not *skipped*/*failed*).
- **SharePoint**: upload a document (e.g. a pre-boarding item) and confirm the file appears in the
  SharePoint library; the stored reference will be a Graph drive-item id rather than a bucket path.
- **Status view**: `/app/admin/integrations` should show Outlook and SharePoint as **enabled**;
  the unified `m365_status` reports Entra *live* and the two adapters *enabled/configured*.

---

## Notes & limitations

- **Teams** notifications are not implemented — even with credentials the Teams adapter stays
  *skipped* until a chat/channel target-resolution design is added. Out of scope for now.
- **SMS** is a separate, non-O365 channel (`SMS_GATEWAY_URL`, `SMS_GATEWAY_KEY`) — ignore unless
  you want SMS.
- **Secrets never live in the repo.** They are environment variables only. The database stores just
  enable/status *flags* (`tas_comm_adapter_config`, `tas_storage_adapter_config`) — never secrets.
- **Secret rotation**: when the client secret expires, update `ENTRA_CLIENT_SECRET` and the
  integrations keep working — no code change.
- **Fail-safe**: if a secret is missing or wrong, the app does not crash — email sends are *skipped*
  and documents fall back to the private Supabase Storage bucket `tas-documents`.
