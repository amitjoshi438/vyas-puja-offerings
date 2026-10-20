# Country and town lists

`build.mjs` generates the lists behind the **Country** and **Town or city** dropdowns on the offering form. Devotees pick from these lists, so the sheet gets one spelling per place ("Bengaluru", never "Banglore" or "BLR").

It writes:

- `data/places/countries.json` and `data/places/cities/<CC>.json`, which the website loads (format in [`data/README.md`](../../data/README.md#country-and-town-lists));
- the `COUNTRIES` list at the end of `backend/google-apps-script/Code.gs`, so the server accepts exactly the countries the form offers.

## Running it

Needs Node 18 or later; there is nothing to install.

```sh
node tools/places/build.mjs             # uses the downloads cached in tools/places/.cache
node tools/places/build.mjs --refresh   # downloads the latest GeoNames files first (about 13 MB)
```

The first run downloads automatically. `.cache/` is gitignored.

**After running it:**

1. Check the summary it prints and any `! extra.json:` warnings.
2. Commit `data/places/` and `Code.gs`.
3. If the `COUNTRIES` list in `Code.gs` changed, paste the new `Code.gs` into Apps Script and deploy a new version (see the [Apps Script README](../../backend/google-apps-script/README.md#changing-the-script-later)). Otherwise the server may refuse a country the form offers.

Browsers re-download town files when the data changes, because `countries.json` carries a `version` hash that the form appends to each town file URL.

## Where the data comes from

[GeoNames](https://www.geonames.org), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The attribution is in the footer of `offer.html`; keep it there.

- **Towns:** `cities1000`, every populated place with 1,000+ people. Historical and abandoned places are skipped. Towns are listed largest first.
- **Countries and regions:** `countryInfo.txt` and `admin1CodesASCII.txt`.
- **Old and local names** (Bombay, Poona, Calcutta): GeoNames' alternate names, only for the countries in `aliasCountries`. These help search but are never shown as the chosen value.

## Hand-made additions: `extra.json`

| Key | What it does |
|---|---|
| `popular` | Country codes shown first in the country list, above a divider. |
| `excludeCountries` | Codes to leave out (uninhabited or obsolete territories). |
| `countryNames` | Overrides GeoNames' country name, e.g. `"NL": "Netherlands"`. The server stores this name. |
| `countryAliases` | Other names devotees type, e.g. `"US": ["USA", "America"]`. Search finds the country by these. |
| `regionsAsCountryAliases` | Countries whose regions also find the country, e.g. typing "Maharashtra" offers India. |
| `regionNames` *(optional)* | Overrides a region name, keyed by GeoNames admin1 code, e.g. `"IN.16"`. |
| `aliasCountries` | Countries that get old and local town names from GeoNames. |
| `aliasLanguages` | Which alternate-name languages to use for those (`""` = language not recorded). |
| `places` | Towns to add or enrich (below). |

A `places` entry looks like this:

```json
{ "country": "IN", "name": "Mira Road", "region": "Maharashtra", "aliases": ["Mira Bhayandar", "Miraroad"], "weight": 400000 }
```

- If a town with the same name and region already exists, only the `aliases` are added.
- Otherwise it is added as a new town. Use this for ISKCON communities and neighbourhoods that devotees call home but GeoNames doesn't list.
- `weight` ranks it like a town of that population, so a higher weight shows it higher in the results.
- `region` must be spelled exactly as in the generated `regions` list for that country; the script warns if it isn't.

## Search

The form's search lives in `scripts/places.js`. It ignores case, accents and punctuation (so "sao paulo" finds São Paulo), and tolerates small typos ("Banglore" finds Bengaluru).

Matching uses `key()`, which **must stay identical** in `build.mjs` and `scripts/places.js`. If you change one, change both.
