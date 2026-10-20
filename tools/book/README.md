# Offerings book (print PDF)

Turns a year's offerings into a print-ready book in the style of the Vyasa Puja books. The layout:

- A4 page with ornamental gold corners and a crest;
- two justified columns with a gold rule between them;
- names in teal and the city in italics, with a divider between offerings;
- a large initial at each new letter, and a page number in a gold tab;
- a title page and a contents list with page numbers.

The PDF has clickable contents entries and a bookmark for every letter and name.

It reads the same data the website shows, so nothing has to be copied by hand. It is a separate Node tool: the website itself still has no build step.

## Requirements

- Node 18 or newer.
- A Chromium-based browser. The tool uses Playwright's Chromium if installed (`npx playwright install chromium`); otherwise it uses Microsoft Edge or Google Chrome.
- Internet access on the first run, to download the fonts. They are cached in `tools/book/.cache/fonts`, so later builds work offline.

## Quick start

```bash
cd tools/book
npm install
node build.mjs --year 2025 --review-only            # writes out/vyasa-puja-2025-review.md
node build.mjs --year 2025 --letters P-R --label "Book 3"
```

This writes `out/vyasa-puja-2025-book-3-P-R.pdf`, plus an `.html` preview you can open in a browser.

## Running it on GitHub (nothing to install)

1. Open the repository on GitHub and go to **Actions → Offerings book → Run workflow**.
2. Choose the branch and fill in:
   - the year;
   - either **letters** for one book (for example `P-R`) or **volumes** for several (for example `A-C,D-J,K-N,P-R,S,T-Z`, or `auto`);
   - optionally a label, the paper size, or "review only".
3. When the run finishes (a few minutes), download `offerings-book-<year>` from **Artifacts** at the bottom of the run page. It holds the PDFs and the review report for 30 days.

Leave both letters and volumes empty for the whole year in one book.

The workflow uses the edits file committed on the branch you choose, so commit `edits/<year>.json` first. The **Run workflow** button only appears once [`.github/workflows/offerings-book.yml`](../../.github/workflows/offerings-book.yml) is on the default branch.

The repository is public, so anyone signed in to GitHub can download the artifacts. They contain only offerings that are already published on the website.

## The yearly workflow

1. **Collect.** By default (`--source auto`) the tool loads what the website shows for that year:
   - the static `dataFile`;
   - plus approved live submissions, if the year is `live`.

   You can choose a source instead: `--source static`, `--source live` or `--source both`. You can also point at a file with `--input offerings.json`.
2. **Review.** Every run writes `out/vyasa-puja-<year>-review.md`, a checklist of things an editor should decide. Exact double submissions are removed automatically; everything else is only flagged. The checklist covers:
   - near-identical text and the same name sent twice;
   - messages that may not be offerings, and placeholder text;
   - phone numbers, emails and links;
   - text typed in old Sanskrit fonts (it prints as gibberish such as *duñpärasyädya*);
   - unusual names, unrecognised locations and very short messages.
3. **Decide.** Record decisions in `edits/<year>.json`; see [`edits/example.json`](edits/example.json). Ids are the same ones the website uses in share links (`offerings.html?year=2025#o=2025-943`).

   ```json
   {
     "exclude": { "2025-1114": "legacy font, devotee re-sent it" },
     "fix": { "2025-512": { "name": "Corrected Name", "city": "Pune", "offering": "Corrected full text" } },
     "add": [{ "name": "Late offering by email", "city": "Vrindavan", "country": "India", "offering": "Text" }]
   }
   ```

   Keys starting with `_` are ignored, so you can leave notes. Run the review again to see the decisions applied. Any unknown id is reported.
4. **Build** one book or a whole set (see below), and read through the PDF.
5. **Print.** Fonts are embedded as TrueType and pages carry no crop marks or bleed. The corner ornaments sit 4mm from the trim, so check with the printer how much the page may shift when it is cut.

## Splitting into books

| Command | Result |
|---|---|
| `--letters P-R` | One book with names from P to R. Lists work too: `A,B,D-F`. |
| `--volumes "A-C,D-J,K-N,P-R,S,T-Z"` | Several books in one run, numbered Book 1, Book 2, … Use `+` to join ranges inside a book: `A-C+E`. |
| `--volumes auto --max-pages 200` | Lays everything out once, then groups whole letters into books of at most 200 pages. |

The plan for `auto` is printed; copy it into `--volumes` if you want to fix it for later runs. Names that start with a digit or a non-Latin letter are filed under `#`.

## Options

Run `node build.mjs --help` for the full list. The most useful options:

| Option | |
|---|---|
| `--year 2025` | Year to print (default: `currentYear` in `scripts/config.js`). |
| `--size a4 \| letter \| a5` | Paper size. A5 uses one column. |
| `--title`, `--subtitle`, `--label` | Title page text. |
| `--no-title-page`, `--no-contents`, `--no-letter-marks` | Leave parts out. |
| `--keep-emoji`, `--keep-duplicates`, `--no-hyphenation` | Turn off parts of the clean-up. |
| `--html-only` | Write the HTML preview only. |
| `--out <dir>` | Output folder (default `tools/book/out`, which git ignores). |

## What the clean-up does

- **Names.**
  - Fixes names typed in all capitals or all lower case (`PRIYA DEVI DASI` → `Priya Devi Dasi`). Mixed-case names are left as typed.
  - Sorts names word by word, as in an index ("Padma Kishori" before "Padmagopika"), ignoring punctuation and accents.
  - Joins city, state and country without repeats (`Pune, Maharashtra, India`).
- **Text.**
  - Removes HTML and emoji, and turns markdown (`**bold**`, `# heading`, bullet lists) into proper formatting.
  - Rejoins lines that were wrapped by the sender's email client.
  - Keeps verses line by line.
- **Scripts.**
  - Paragraphs mostly in Devanagari, Bengali, Odia, Telugu, Gujarati, Kannada, Tamil, Malayalam or Gurmukhi are set ragged-right with extra line spacing, using Noto Serif fonts.
  - Sanskrit and Hindi use Tiro Devanagari Sanskrit.
- **Hyphenation.** Long English words are hyphenated so justified columns do not open wide gaps. Names, capitalised words, Sanskrit terms (*Bhāgavatam*, *Vaiṣṇava*, …), links and non-English text are never split.

## Changing the look

- **Colours, sizes, margins:** the custom properties at the top of [`template/book.css`](template/book.css).
- **Fonts:** the `FONTS` list in [`lib/html.mjs`](lib/html.mjs) and the `--serif` and `--display` stacks in `book.css`.
  - The tool asks Google Fonts for static TrueType files. Chromium can only embed variable fonts as Type 3, which printers' preflight checks often reject.
  - After changing a font, delete `.cache/fonts` if it does not update.
- **Ornaments:** the SVGs in [`template/ornaments`](template/ornaments) (`corner`, `crest`, `foot`, `divider`, `lotus`). Replace them with a designer's artwork of the same name; each file needs a `viewBox`. Ids inside a file are prefixed automatically so files cannot clash.
- **Pagination:** [`template/paginate.js`](template/paginate.js) runs in the browser. It fills the columns and splits paragraphs at line boundaries. A name always moves with the first lines of its offering. Where possible, at least two lines stay at the foot of a column and no single line is carried over to the next. It then writes the contents with the final page numbers.

## Files

```
tools/book/
├── build.mjs            # command line: load → clean → review → lay out → PDF
├── lib/
│   ├── source.mjs       # site config, static + live data, edits
│   ├── clean.mjs        # names, locations, text → blocks, sorting
│   ├── review.mjs       # checks and the review report
│   ├── hyphenate.mjs    # soft hyphens for English text
│   ├── fonts.mjs        # downloads and caches static font files
│   └── html.mjs         # builds the self-laying-out HTML page
├── template/            # book.css, paginate.js, ornaments/*.svg
├── edits/               # <year>.json editorial decisions (example.json shows the format)
└── out/                 # generated PDFs, previews and review reports (ignored by git)
```
