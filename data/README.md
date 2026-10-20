# Data folder

```
data/
├── 2025/
│   └── offerings.json      # archived offerings for the 75th Vyasa Puja
├── <year>/
│   └── offerings.json      # add one per archived year
├── lectures/
│   ├── index.json          # list of lecture series
│   └── 2026.json           # lectures of one series
└── places/                 # generated: country and town lists for the offering form
    ├── countries.json
    └── cities/<CC>.json    # one file per country, loaded when it is chosen
```

Years are configured in `scripts/config.js`, not here. Each archived year points at its file with `dataFile: 'data/<year>/offerings.json'`.

## Offerings files

A file can take either of two shapes.

**1. The Apps Script export.** This is what you get by saving `<exec URL>?action=list&year=2026` from the browser:

```json
{
  "ok": true,
  "year": 2026,
  "count": 1,
  "offerings": [
    {
      "id": "a1b2c3d4e5f6",
      "name": "Devotee Name",
      "city": "City",
      "country": "Country",
      "offering": "The offering text…",
      "submittedAt": "2026-07-01T09:30:00.000Z"
    }
  ]
}
```

**2. A plain array.** Either the clean keys above, or the legacy Google Form column names used in 2025:

```json
[
  {
    "Your Name": "Devotee Name",
    "Name of City you are from": "City",
    "country": "Country",
    "Your Offering ": "The offering text…"
  }
]
```

Notes:

- Rows with neither a name nor text are skipped.
- Missing names show as "Anonymous".
- Keep `id`s stable once published, because shared links such as `offerings.html?year=2026#o=<id>` depend on them. The Apps Script export already provides stable ids.

## Adding an archived year

1. Save the export (or convert your sheet) to `data/<year>/offerings.json`, encoded as UTF-8.
2. In `scripts/config.js`, add or update the year:

   ```js
   { year: 2026, edition: 76, dataFile: 'data/2026/offerings.json', live: false, submissionsOpen: false, closesOn: null }
   ```

3. Commit and push. The year appears in the year picker on **Read offerings** and on the home page.

## Lectures

`lectures/index.json` lists each series. The page shows year tabs when there is more than one year, and series tabs when a year has more than one series.

```json
[
  {
    "id": "2026-initiation",
    "year": 2026,
    "title": "The Most Important Day in the Journey of the Soul",
    "subtitle": "Harinām-dīkṣā Initiation Lectures, 7–11 March 2026",
    "location": "ISKCON Govardhan Eco Village, Wada, Palghar, Maharashtra",
    "speaker": "His Holiness Radhanatha Swami Mahārāja",
    "lectureCount": 5,
    "pdf": "assets/pdfs/RNSM_Initiation_Lectures_2026.pdf",
    "dataFile": "data/lectures/2026.json"
  }
]
```

The series `dataFile` is an array of days:

```json
[
  {
    "date": "2026-03-07",
    "title": "Honouring the Lineage",
    "subtitle": "…",
    "location": "ISKCON Govardhan Eco Village, Wada, Palghar",
    "type": "Harinām-dīkṣā Ceremony",
    "summary": "One or two paragraphs…",
    "topics": ["Opening Invocation — Honouring the Lineage", "…"]
  }
]
```

## Country and town lists

`places/` is **generated** by `node tools/places/build.mjs`; don't edit it by hand. To add a town, an alias or a country name, edit `tools/places/extra.json` and regenerate. See [`tools/places/README.md`](../tools/places/README.md).

Place data © [GeoNames](https://www.geonames.org), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

`countries.json`:

```json
{
  "version": "f7f9e84b3b",
  "source": "GeoNames (https://www.geonames.org), licensed under CC BY 4.0. …",
  "popular": ["IN", "US", "GB", "AE", "CA", "AU"],
  "countries": [
    { "code": "US", "name": "United States", "aliases": ["USA", "America"], "cities": 17101 }
  ]
}
```

- `name` is what the form shows and the sheet stores.
- `aliases` only help search.
- `cities` is the number of towns in that country's file.
- `version` changes whenever any list changes. The form adds it to town file URLs so browsers fetch fresh copies.

`cities/IN.json` (towns largest first; each row is name, region index, then aliases):

```json
{
  "country": "IN",
  "regions": ["Andaman and Nicobar", "Andhra Pradesh", "…"],
  "cities": [
    ["Mumbai", 20, "Bombay", "Juhu"],
    ["Bengaluru", 15, "Bangalore"]
  ]
}
```

The region index points into `regions`; `-1` means no region. The form shows the region beside the town so that two towns of the same name can be told apart.
