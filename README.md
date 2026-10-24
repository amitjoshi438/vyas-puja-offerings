# Vyasa Puja Offerings — HH Radhanath Swami Maharaj

Every year, disciples and well-wishers from around the world write offerings for His Holiness Radhanath Swami Maharaj's Vyasa Puja, his appearance day. This site gathers them in one place. Devotees can now **write and send their offering directly on the website**. It appears in the garland once a moderator approves it.

Live at **[rnsmvyaspujaofferings.co.in](https://rnsmvyaspujaofferings.co.in)**. It is a static site on GitHub Pages; submissions go to a Google Sheet through Google Apps Script.

## Pages

| Page | What it does |
|---|---|
| `index.html` | Home page: a temple-sanctum hero with Maharaj seated between two garlanded pillars, festoons of marigold, rose and jasmine across the top, and a seat of flowers beneath him. The flowers on the pillars stand for the most recent offerings. Also live counts, a moving strip of names, how to offer, and the year-by-year archive. |
| `offerings.html` | Read every offering. Choose a year, search by name, city, country or words, filter by country and city, pick one at random, and open any letter in a full reader (←/→ to move between letters). Each letter has a shareable link. |
| `offer.html` | **Write your offering.** The draft is saved on the device as you type. The devotee signs with their initiated name, or their official name if not initiated. Country and town are chosen from searchable lists, so every place is spelled one way; a devotee whose town is missing can type it, and the sheet flags it for checking. Email typos such as `gmial.com` get a suggested fix. The form is validated and protected against spam. Before anything is sent, the devotee sees the offering as it will be published and confirms it; then they see a thank-you. If no endpoint is configured, the page explains that offerings are not open yet. |
| `lectures.html` | Initiation lecture series, laid out as palm-leaf pages with a downloadable PDF booklet. |

## How it fits together

```
scripts/config.js ── years, submission endpoint, limits  (the only file you normally edit)
       │
scripts/common.js ── loads each year's offerings and merges two sources:
       ├─ data/<year>/offerings.json          static archive (GitHub Pages)
       └─ <Apps Script>/exec?action=list      approved offerings for the open year (live)

offer.html ──POST──▶ Google Apps Script ──▶ Google Sheet  (moderator ticks “Approved” to publish)
```

## Project structure

```
├── index.html, offerings.html, offer.html, lectures.html
├── scripts/
│   ├── config.js        # years, endpoint URL, field limits
│   ├── common.js        # shared helpers (window.VP): data loading, header, reveal animations
│   ├── home.js          # home page: sanctum garlands (canvas), counts, strip of names
│   ├── offerings.js     # browse, search, filter, reader
│   ├── offer.js         # submission form
│   ├── places.js        # country/town search and the dropdowns on the form
│   └── lectures.js      # lecture series
├── styles/
│   ├── main.css         # design system (tokens, type, header/footer, buttons) + home page
│   ├── offerings.css, offer.css, lectures.css
├── data/
│   ├── 2025/offerings.json     # archived offerings (75th Vyasa Puja)
│   ├── lectures/               # lecture index + per-series JSON
│   └── places/                 # generated country and town lists (GeoNames)
├── backend/google-apps-script/ # Code.gs + setup guide for submissions
├── tools/book/                 # optional Node tool: print-ready PDF book of a year's offerings
├── tools/places/               # Node script that generates data/places/
├── .github/workflows/          # "Offerings book": builds that PDF on GitHub on demand
├── assets/                     # images, favicon, PDFs
└── CNAME                       # custom domain for GitHub Pages
```

## Turning on online submissions

Until a submission endpoint is configured, `offer.html` shows a gentle "not open yet" note and the site displays only the static archive.

1. Follow **[backend/google-apps-script/README.md](backend/google-apps-script/README.md)** to create the Google Sheet, add the script and deploy it as a web app.
2. Paste the web app URL (ending in `/exec`) into `scripts/config.js`:

   ```js
   submissionEndpoint: 'https://script.google.com/macros/s/AKfy…/exec',
   ```

3. Commit and push. Moderators then publish offerings by ticking **Approved** in the sheet.

## Opening a new year / archiving the last one

Everything year-related lives in `scripts/config.js`:

```js
currentYear: 2026,
years: [
  { year: 2026, edition: 76, dataFile: null, live: true, submissionsOpen: true, closesOn: null },
  { year: 2025, edition: 75, dataFile: 'data/2025/offerings.json', live: false, submissionsOpen: false, closesOn: null }
]
```

| Field | Meaning |
|---|---|
| `edition` | Which Vyasa Puja this is (shown as "76th"). |
| `dataFile` | Static JSON for archived offerings (optional). |
| `live` | Also fetch approved offerings from the Apps Script. |
| `submissionsOpen` | Show the form for this year. |
| `closesOn` | Optional `'YYYY-MM-DD'`. The form closes automatically after this day. |

**At the end of a year**, follow *Closing a year and archiving it* in the [backend guide](backend/google-apps-script/README.md#closing-a-year-and-archiving-it). In short:

1. Close submissions.
2. Save `<exec>?action=list&year=YYYY` as `data/YYYY/offerings.json`.
3. Set `dataFile` and `live: false` for that year.
4. Add the next year at the top of `years`.

See [data/README.md](data/README.md) for the file formats.

## Printing the offerings book

[`tools/book`](tools/book/README.md) turns a year's offerings into a print-ready PDF in the style of the Vyasa Puja books. The layout has two columns, gold ornaments, a title page and a contents list. You can print one book per letter range, or let the tool split the year into volumes. It reads the same data as the website: the archived JSON plus approved live offerings. It also writes a review report of entries an editor should check before printing.

```bash
cd tools/book && npm install
node build.mjs --year 2025 --letters P-R --label "Book 3"
```

Or, without installing anything, go to **Actions → Offerings book → Run workflow** on GitHub and download the PDFs from the run's artifacts.

The tool is separate from the site, which still has no build step.

## Country and town lists

The form's dropdowns read `data/places/`: 246 countries and about 169,000 towns from [GeoNames](https://www.geonames.org) (CC BY 4.0). Each country's towns load only when it is chosen. To add a missing town, an ISKCON community or another spelling, edit `tools/places/extra.json` and run:

```bash
node tools/places/build.mjs
```

This also updates the country list in `Code.gs`; paste that file into Apps Script and deploy a new version. See [tools/places/README.md](tools/places/README.md).

## Run locally

No build step and no dependencies. Serve the folder over HTTP; `fetch` does not work from `file://`.

```bash
python -m http.server 8000
# visit http://localhost:8000
```

To try the submission flow locally, point `submissionEndpoint` at a test deployment of the Apps Script.

## Design

The direction is *"a garland of words"*: a warm temple sanctum. Deep maroon silk, gold and lamp-glow surround garlands of marigold, rose and jasmine; hand-made paper is kept for the places where offerings are read as letters. Garland lines run along the seams between sections.

- **Type:**
  - [Eczar](https://fonts.google.com/specimen/Eczar) for display;
  - [Newsreader](https://fonts.google.com/specimen/Newsreader) for reading;
  - [Mukta](https://fonts.google.com/specimen/Mukta) for the interface;
  - [Tiro Devanagari Sanskrit](https://fonts.google.com/specimen/Tiro+Devanagari+Sanskrit) for Sanskrit and Hindi.
- **Colour:** temple maroon, kumkum red, marigold and champa gold, tulasi green, ivory and paper tones. All of them are CSS custom properties at the top of `styles/main.css`.
- **Motion:** gentle reveals, flowers blooming into the garland and swaying softly. All of it respects `prefers-reduced-motion`.
- **Accessibility:**
  - semantic landmarks;
  - visible focus;
  - keyboard support throughout (reader, accordions, form);
  - `aria-live` status messages;
  - form errors announced and linked to their fields.

## Deployment

The site deploys from the `main` branch through GitHub Pages; the custom domain is set in `CNAME`. To share a branch with testers before it goes live, see [Sharing a test version first](DEPLOYMENT.md#-sharing-a-test-version-first). See [DEPLOYMENT.md](DEPLOYMENT.md) for details and alternatives.

---

**All glories to Śrīla Prabhupāda · All glories to HH Radhanath Swami Maharaj**

*Hare Kṛṣṇa Hare Kṛṣṇa Kṛṣṇa Kṛṣṇa Hare Hare · Hare Rāma Hare Rāma Rāma Rāma Hare Hare*
