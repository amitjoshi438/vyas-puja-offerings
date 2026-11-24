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
4. **Run `setup`.** Pick `setup` in the function dropdown and click **Run**. Approve the permissions prompt (it is your own script). Google lists "Connect to an external service": that is the email check. It also lists Google Drive: that is for [images](#images-handwritten-letters-and-artwork). This:
   - creates the **Offerings** tab with its header row;
   - adds an **Image** column and a private Drive folder for images;
   - links the script to this spreadsheet;
   - installs a trigger so that ticking **Approved** publishes immediately.
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
- You can fix typos directly in *Name*, *City*, *Country* or *Offering*.
- **Email** is private. It is never sent to the website and is only for contacting the devotee.
- **Notes** is free for moderators, e.g. who reviewed the offering. When a devotee's town wasn't in the form's list and they typed it themselves, the script writes *City typed by the devotee (not in the town list) — check the spelling.* here, so you can check *City* before approving.
- **Image** (after *Notes*) holds a **View image** link when the devotee sent a handwritten letter or artwork. Look at it before you tick *Approved*. **To keep an image off the website, clear its cell**; the offering's words stay. See [Images](#images-handwritten-letters-and-artwork).
- **To add an offering received by post or WhatsApp**, type a new row with *Name*, *City*, *Country* and *Offering*, then tick *Approved*. *Year*, *Id* and *Timestamp* can be left empty.
- **Do not insert, delete or reorder the first 11 columns.** If the header row changes, the script stops saving and listing rather than risk publishing the wrong column, such as emails. Add any extra columns of your own *after* **Notes**; the script finds its **Image** column by its header, so it never overwrites yours. If something goes wrong, restore the headers and run **Vyasa Puja → Set up / repair this sheet**.
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
- **Images:** the server checks that the file really is a JPEG under `IMAGE_MAX_BYTES`, and accepts at most `IMAGE_DAILY_MAX` images a day.
- **Speed:** the published list is cached for up to 15 minutes, and any edit to the sheet clears that cache.

## Images (handwritten letters and artwork)

A devotee can add **one** photo or scan of a handwritten letter or artwork, in place of typed words or alongside them. The browser shrinks it first (at most 1800 px on the long side, about 700 KB, saved as a JPEG; this also removes hidden details such as GPS location). The devotee must tick that the image is their own.

- **Where it is kept:** a private Drive folder named *Vyasa Puja offering images*, created by `setup`, one file per offering (`<Id>.jpg`). Drive links are never given to the website.
- **How the website gets it:** the reader asks the script for `?action=image&id=<Id>`. The script answers only while that offering is **Approved** *and* its **Image** cell is not empty. Untick *Approved* or clear the cell and the image is gone from the website at once.
- **Moderating:** open **View image** in the *Image* column before approving. The notification email also says when an image came with the offering.
- **Drive permission:** the script uses `DriveApp`, so Google asks for access to Google Drive when you run `setup`. Google words this broadly (all of Drive), but the script only creates and reads its own images folder.
- **Size:** at about 0.7 MB each, a thousand images use roughly 700 MB of the account's Drive storage.
- **Turning it on or off:** set `IMAGE_UPLOADS` in `Code.gs`, and `imageUploads` in `scripts/config.js`. **Deploy the script first, then switch the website on**, because the form's image field would otherwise be refused by the old script.
- **Year-end archive:** an archived offering with an image keeps `"hasImage": true` in its JSON, and the image is still read from the script. Keep that year's rows and the Drive folder.
- **The printed-book tool** (`tools/book`) skips offerings that have no typed words.

## Email check

The form already suggests fixes for common typos ("Did you mean ram@gmail.com?"). The server then asks Google Public DNS (`dns.google`) whether the email's domain can receive mail: it needs a mail (MX) record, or failing that an address record.

- Domains that don't exist, or that say "no mail here", are refused with a friendly message. Well-known providers (Gmail, Yahoo, Outlook…) skip the lookup.
- Results are cached for 6 hours.
- **If the lookup itself fails, the offering is accepted.** The check never blocks an offering because of a network problem.
- Only the domain is checked, not the mailbox: `nobody123@gmail.com` still passes.
- To turn it off, set `CHECK_EMAIL_DOMAIN: false` and deploy a new version.

## Changing the script later

After editing `Code.gs`, choose **Deploy → Manage deployments → ✏️ Edit**, set **Version: New version**, then **Deploy**. Editing the existing deployment keeps the same `/exec` URL. Creating a *new deployment* gives a new URL, which you would then have to paste into `config.js` again.

> **Updating from a version without the email check?** After pasting the new `Code.gs`, run `setup` once and approve the new "Connect to an external service" permission *before* deploying. Until that permission is approved, the web app answers every request (sending and listing) with an authorisation error.

> **Updating from a version without image support?** Do the same: paste the new `Code.gs`, run `setup` once and approve the Google Drive permission, then deploy a new version. Only after that, set `imageUploads: true` in `scripts/config.js`.

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
| `GET /exec?action=list&year=YYYY` | `{ ok, year, count, offerings: [{ id, name, city, country, offering, submittedAt, hasImage? }] }` (approved only) |
| `GET /exec?action=image&id=<Id>` | `{ ok: true, mime: "image/jpeg", data: "<base64>" }`, or `{ ok: false, code: "not_found" }` when the offering is not approved or has no image |
| `POST /exec` with `Content-Type: text/plain` and body `{ action: "submit", year, name, city, cityListed, country, email, offering, consent: true, website: "", elapsedMs, image?: { mime: "image/jpeg", data: "<base64>" }, imageConsent?: true }` | `{ ok: true, id }` or `{ ok: true, duplicate: true, id }` or `{ ok: false, code, field?, error? }` |

`cityListed` is `true` when the town was chosen from the form's list; otherwise the row is flagged in **Notes**. `country` must match a name in `COUNTRIES`. With an `image`, `offering` may be empty, and `imageConsent` must be `true`.

Error `code` values: `invalid` (with `field`), `closed`, `too_fast`, `rate_limited`, `image_limit`, `busy`, `error`.

The browser sends the POST as `text/plain` so that it is a "simple" cross-origin request. Apps Script cannot answer CORS preflight requests.

## Limits to know

- **Quotas:** consumer Google accounts can send about 100 notification emails a day (Google Workspace accounts more). If the quota runs out, offerings are still saved; only the email is skipped.
- **Concurrency:** Apps Script handles about 30 simultaneous requests. During a launch surge some devotees may see "Many devotees are offering right now…". Their draft stays saved on their device, so they can simply send again.
