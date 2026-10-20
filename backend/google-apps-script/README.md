# Offering submissions — Google Apps Script backend

The website is static (GitHub Pages). Devotees' offerings are stored in a **Google Sheet** through a small **Google Apps Script web app** (`Code.gs`). Nothing is published until a moderator ticks **Approved**.

```
offer.html ──POST──▶ Apps Script web app ──▶ Google Sheet "Offerings" (Approved ☐)
offerings.html ◀──GET ?action=list── only rows with Approved ☑ (emails never leave the sheet)
```

## One-time setup (about 10 minutes)

1. **Create the sheet.** In Google Drive, create a new Google Sheet, e.g. *Vyasa Puja Offerings*. Use the Google account that should own the data (ideally a shared seva account, not a personal one).
2. **Add the script.** In the sheet, choose **Extensions → Apps Script**.
   - Replace the contents of `Code.gs` with this folder's `Code.gs`.
   - Open **Project Settings** (gear icon), tick **Show "appsscript.json" manifest file in editor**, then replace that file's contents with this folder's `appsscript.json`.
3. **Check the settings** at the top of `Code.gs`:
   - `CURRENT_YEAR`: must equal `currentYear` in `scripts/config.js`.
   - `NOTIFY_EMAIL` (optional): addresses to email whenever a new offering arrives.
   - `CLOSES_ON` (optional): last day to accept offerings, as `'YYYY-MM-DD'`.
   - `CHECK_EMAIL_DOMAIN`: when `true` (the default), an email whose domain cannot receive mail (such as `gmial.com`) is refused. See [Email check](#email-check).
4. **Run `setup`.** Pick `setup` in the function dropdown and click **Run**. Approve the permissions prompt (it is your own script). Google lists "Connect to an external service": that is the email check. This:
   - creates the **Offerings** tab with its header row;
   - links the script to this spreadsheet;
   - installs triggers so that ticking **Approved**, or deleting a row, publishes immediately.
5. **Deploy.** Click **Deploy → New deployment**, choose type **Web app**, and set:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone**

   Click **Deploy** and copy the **Web app URL**. It ends in `/exec`.
6. **Connect the website.** Paste that URL into `scripts/config.js`:

   ```js
   submissionEndpoint: 'https://script.google.com/macros/s/AKfy…/exec',
   ```

   Commit and push. The **Offer yours** page now accepts offerings, and approved ones appear on **Read offerings** alongside the archive.

> **Test it:** open `<your /exec URL>?action=list` in a browser. You should see `{"ok":true,"year":2026,"count":0,"offerings":[]}`.

## Moderating

Each offering arrives as a new row in **Offerings**:

| Timestamp | Year | Name | City | Country | Email | Offering | Approved | Id | Fingerprint | Notes |
|---|---|---|---|---|---|---|---|---|---|---|

- **To publish an offering, tick Approved. To hide it again, untick it.** The website updates on its next page load.
- **Prefer unticking to deleting.** Deleting a row also removes the site's copy straight away, but it loses the record, and the duplicate check with it: the same offering sent again would be stored again. Years already saved to `data/<year>/offerings.json` are served from that file, so edit the file to remove an offering there.
- You can fix typos directly in *Name*, *City*, *Country* or *Offering*.
- **Email** is private. It is never sent to the website and is only for contacting the devotee.
- **Notes** is free for moderators, e.g. who reviewed the offering. When a devotee's town wasn't in the form's list and they typed it themselves, the script writes *City typed by the devotee (not in the town list) — check the spelling.* here, so you can check *City* before approving.
- **To add an offering received by post or WhatsApp**, type a new row with *Name*, *City*, *Country* and *Offering*, then tick *Approved*. *Year*, *Id* and *Timestamp* can be left empty.
- **Do not insert, delete or reorder the first 11 columns.** If the header row changes, the script stops saving and listing rather than risk publishing the wrong column, such as emails. Add any extra columns of your own *after* **Notes**. If something goes wrong, restore the headers and run **Vyasa Puja → Set up / repair this sheet**.
- **The Vyasa Puja menu** in the sheet:
  - *Publish changes to the website now* clears the cache, in case an edit was not picked up.
  - *Set up / repair this sheet* re-runs `setup`.

## Built-in protection

- **Validation:** the server enforces the same length and required-field rules as the form.
- **Country:** must be one of the names the form offers (the `COUNTRIES` list at the end of `Code.gs`), so the sheet never holds "USA" in one row and "United States" in the next.
- **Email:** the address must be well formed, and with `CHECK_EMAIL_DOMAIN` its domain must be able to receive mail (see below).
- **Spam:** a hidden honeypot field, plus a minimum time on the page before sending.
- **Duplicates:** the same name and offering text for the same year is stored once. The devotee still sees a thank-you.
- **Rate limit:** at most 5 offerings per name + city in 10 minutes.
- **Formula injection:** values starting with `=`, `+`, `-` or `@` are stored as plain text.
- **Concurrency:** a script lock prevents two submissions from overwriting the same row.
- **Speed:** the published list is cached for up to 15 minutes, and any edit to the sheet clears that cache.

## Email check

The form already suggests fixes for common typos ("Did you mean ram@gmail.com?"). The server then asks Google Public DNS (`dns.google`) whether the email's domain can receive mail: it needs a mail (MX) record, or failing that an address record.

- Domains that don't exist, or that say "no mail here", are refused with a friendly message. Well-known providers (Gmail, Yahoo, Outlook…) skip the lookup.
- Results are cached for 6 hours.
- **If the lookup itself fails, the offering is accepted.** The check never blocks an offering because of a network problem.
- Only the domain is checked, not the mailbox: `nobody123@gmail.com` still passes.
- To turn it off, set `CHECK_EMAIL_DOMAIN: false` and deploy a new version.

## Changing the script later

After editing `Code.gs`, choose **Deploy → Manage deployments → ✏️ Edit**, set **Version: New version**, then **Deploy**. Editing the existing deployment keeps the same `/exec` URL. Creating a *new deployment* gives a new URL, which you would then have to paste into `config.js` again.

> **After pasting a new `Code.gs`, run `setup` once before deploying.** It refreshes the triggers (the one that publishes deleted rows immediately was added later) and asks for any new permission. Updating from a version without the email check? Approve the new "Connect to an external service" permission; until you do, the web app answers every request (sending and listing) with an authorisation error. `setup` never touches existing rows.

The `COUNTRIES` list at the end of `Code.gs` is generated with the website's country list (`node tools/places/build.mjs`). If you regenerate the lists, paste the updated `Code.gs` and deploy a new version so that the form and the server agree.

## Closing a year and archiving it

1. **Stop new offerings.** Set `SUBMISSIONS_OPEN: false` in `Code.gs` (or set `CLOSES_ON`) and deploy a new version. On the website, set `submissionsOpen: false` for that year in `scripts/config.js`.
2. **Snapshot the approved offerings.** Open `<your /exec URL>?action=list&year=2026` and save the page as `data/2026/offerings.json` in this repository. The site reads this format directly.
3. **Point the website at the file.** In `scripts/config.js`, set `dataFile: 'data/2026/offerings.json'` and `live: false` for that year, then commit and push. The archive is now served from GitHub Pages and no longer depends on the sheet.
4. **Open the next year.** Add a new year at the top of `years` in `config.js` and update `currentYear`. In `Code.gs`, set `CURRENT_YEAR` to the same value and `SUBMISSIONS_OPEN: true`, then deploy a new version. You can keep using the same sheet; the **Year** column keeps the years apart.

## API reference

| Request | Response |
|---|---|
| `GET /exec` | `{ ok, service, currentYear, submissionsOpen }` |
| `GET /exec?action=list&year=YYYY` | `{ ok, year, count, offerings: [{ id, name, city, country, offering, submittedAt }] }` (approved only) |
| `POST /exec` with `Content-Type: text/plain` and body `{ action: "submit", year, name, city, cityListed, country, email, offering, consent: true, website: "", elapsedMs }` | `{ ok: true, id }` or `{ ok: true, duplicate: true, id }` or `{ ok: false, code, field?, error? }` |

`cityListed` is `true` when the town was chosen from the form's list; otherwise the row is flagged in **Notes**. `country` must match a name in `COUNTRIES`.

Error `code` values: `invalid` (with `field`), `closed`, `too_fast`, `rate_limited`, `busy`, `error`.

The browser sends the POST as `text/plain` so that it is a "simple" cross-origin request. Apps Script cannot answer CORS preflight requests.

## Limits to know

- **Quotas:** consumer Google accounts can send about 100 notification emails a day (Google Workspace accounts more). If the quota runs out, offerings are still saved; only the email is skipped.
- **Concurrency:** Apps Script handles about 30 simultaneous requests. During a launch surge some devotees may see "Many devotees are offering right now…". Their draft stays saved on their device, so they can simply send again.
