#!/usr/bin/env node
// Builds the printed Vyasa Puja offerings book (PDF) from the same data the website shows.
// Run `node build.mjs --help` for options. See README.md for the full workflow.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadSiteConfig, loadOfferings, loadEdits, applyEdits } from './lib/source.mjs';
import { prepareEntry, compareNames } from './lib/clean.mjs';
import { hyphenateEntries } from './lib/hyphenate.mjs';
import { review, writeReport } from './lib/review.mjs';
import { renderHtml, SIZES, FONTS } from './lib/html.mjs';
import { fontMarkup } from './lib/fonts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

const HELP = `
Usage: node build.mjs [options]

What to print
  --year <yyyy>          Year to print (default: currentYear in scripts/config.js)
  --letters <range>      Only names starting with these letters, e.g. P-R or A,B,C or A-D,F
  --volumes <list|auto>  Several books in one go, e.g. "A-D,E-K,L-O,P-R,S-Z" (use + inside a book: "A-C+E"), or "auto"
  --max-pages <n>        Page budget per volume for --volumes auto (default 200)
  --label <text>         Label on the title page, e.g. "Book 3" (volumes are numbered automatically)

Where the offerings come from
  --source <mode>        auto (what the website shows, default) | static | live | both
  --input <file>         Read offerings from this JSON file instead of scripts/config.js
  --endpoint <url>       Apps Script URL for live offerings (default: submissionEndpoint in config)
  --edits <file>         Editorial decisions (default: tools/book/edits/<year>.json)

Look
  --size <a4|letter|a5>  Paper size (default a4; a5 is single column)
  --columns <1|2>        Override the number of columns
  --title <text>         Title page heading (default "Offerings")
  --subtitle <text>      Line under the title
  --no-title-page        Start with the contents
  --no-contents          Leave out the contents
  --no-letter-marks      No large letter between letter groups
  --keep-emoji           Keep emoji (most print fonts cannot show them)
  --keep-duplicates      Keep exact double submissions
  --no-hyphenation       Do not hyphenate long words

Output
  --out <dir>            Output folder (default tools/book/out)
  --html-only            Write the HTML preview but not the PDF
  --review-only          Only write the review report
  --browser <name>       chromium | msedge | chrome (default: first one that works)
`;

function parseArgs(argv) {
    const flags = new Set(['html-only', 'review-only', 'no-title-page', 'no-contents', 'no-letter-marks', 'keep-emoji', 'keep-duplicates', 'no-hyphenation', 'help']);
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) throw new Error(`Unexpected argument "${a}"`);
        const [key, inline] = a.slice(2).split(/=(.*)/s);
        if (flags.has(key)) { args[key] = true; continue; }
        const value = inline ?? argv[++i];
        if (value === undefined) throw new Error(`--${key} needs a value`);
        args[key] = value;
    }
    return args;
}

// "P-R" → [P,Q,R]; "A-D,F" → [A,B,C,D,F]
function parseLetters(spec) {
    const out = [];
    for (const part of String(spec).toUpperCase().split(/[,\s]+/).filter(Boolean)) {
        const m = part.match(/^([A-Z#])(?:[-–]([A-Z#]))?$/);
        if (!m) throw new Error(`Cannot read letter range "${part}" (use e.g. P-R or A,B,C)`);
        const from = m[1].charCodeAt(0);
        const to = (m[2] || m[1]).charCodeAt(0);
        if (m[1] === '#' || m[2] === '#') { out.push(m[1]); if (m[2]) out.push(m[2]); continue; }
        for (let c = Math.min(from, to); c <= Math.max(from, to); c++) out.push(String.fromCharCode(c));
    }
    return [...new Set(out)];
}

const ordinal = n => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

const rangeLabel = letters => (letters.length > 1 ? `${letters[0]}-${letters[letters.length - 1]}` : letters[0]);

async function launchBrowser(preferred) {
    let playwright;
    try {
        playwright = await import('playwright');
    } catch {
        throw new Error('Playwright is not installed. Run `npm install` inside tools/book first (see README.md).');
    }
    const tries = preferred ? [preferred] : ['chromium', 'msedge', 'chrome'];
    const errors = [];
    for (const name of tries) {
        try {
            const browser = await playwright.chromium.launch(name === 'chromium' ? {} : { channel: name });
            return { browser, name };
        } catch (err) {
            errors.push(`${name}: ${String(err.message).split('\n')[0]}`);
        }
    }
    throw new Error(`Could not start a browser.\n  ${errors.join('\n  ')}\nRun \`npx playwright install chromium\` in tools/book, or pass --browser msedge / chrome.`);
}

async function layout(browser, htmlFile) {
    const page = await browser.newPage({ viewport: { width: 1000, height: 1200 } });
    await page.emulateMedia({ media: 'print' });
    page.on('pageerror', err => console.error(`  page error: ${err.message}`));
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load', timeout: 120000 });
    await page.waitForFunction(() => window.__book, null, { timeout: 30 * 60 * 1000, polling: 500 });
    const result = await page.evaluate(() => window.__book);
    if (!result.ok) throw new Error(`Layout failed in the browser:\n${result.error}`);
    return { page, result };
}

function countries(entries) {
    const set = new Set();
    entries.forEach(e => (e.country || '').split(' / ').map(s => s.trim()).filter(Boolean).forEach(c => set.add(c.toLowerCase())));
    return set.size;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (args.help) {
        console.log(HELP);
        return;
    }

    const config = await loadSiteConfig(REPO);
    const year = Number(args.year || config.currentYear);
    const outDir = path.resolve(args.out || path.join(HERE, 'out'));
    await mkdir(outDir, { recursive: true });
    const log = msg => console.log(msg);

    console.log(`\nVyasa Puja ${year} — book export`);
    const { offerings: loaded, yearConfig } = await loadOfferings({
        repoRoot: REPO, config, year, source: args.source || 'auto', input: args.input, endpoint: args.endpoint, log
    });
    if (!loaded.length) throw new Error(`No offerings found for ${year}.`);

    const editsPath = path.resolve(args.edits || path.join(HERE, 'edits', `${year}.json`));
    const edits = await loadEdits(editsPath);
    const { offerings, report: editReport } = applyEdits(loaded, edits, year);
    if (edits.file) log(`  edits   ${editReport.excluded.length} excluded, ${editReport.fixed.length} fixed, ${editReport.added.length} added (${path.relative(REPO, editsPath)})`);
    editReport.unknownIds.forEach(id => console.warn(`  ! edits mention ${id}, which is not in the data`));

    const prepared = offerings.map(o => prepareEntry(o, { keepEmoji: !!args['keep-emoji'] }));
    const checked = review(prepared);
    let entries = prepared;
    if (!args['keep-duplicates']) entries = prepared.filter(e => !checked.dropped.has(e.id));
    entries.sort((a, b) => (a.letter === '#') - (b.letter === '#') || compareNames(a.name, b.name) || a.id.localeCompare(b.id, 'en', { numeric: true }));

    const reportFile = path.join(outDir, `vyasa-puja-${year}-review.md`);
    await writeFile(reportFile, writeReport({
        year,
        entries: prepared,
        result: checked,
        edits: editReport,
        editsPath: path.relative(REPO, editsPath).replace(/\\/g, '/'),
        stats: {
            loaded: loaded.length,
            printed: entries.length,
            emoji: prepared.filter(e => e.notes.emoji).length,
            markup: prepared.filter(e => e.notes.markup).length
        }
    }));
    const decisions = new Set(checked.issues.filter(i => !['short', 'location'].includes(i.kind)).map(i => i.id)).size;
    log(`  review  ${decisions} offerings to look at, ${checked.dropped.size} duplicates removed → ${path.relative(process.cwd(), reportFile)}`);
    if (args['review-only']) return;
    if (!args['no-hyphenation']) hyphenateEntries(entries);

    const fonts = await fontMarkup(FONTS, path.join(HERE, '.cache', 'fonts'));
    if (fonts.web.length) {
        console.warn(`  ! could not download ${fonts.web.map(w => w.family.split(':')[0].replace(/\+/g, ' ')).join(', ')} (${fonts.web[0].error})`);
        console.warn('    linking Google Fonts instead; those fonts will be embedded as Type 3, which some printers reject');
    }

    const size = (args.size || 'a4').toLowerCase();
    if (!SIZES[size]) throw new Error(`Unknown --size ${args.size} (use a4, letter or a5)`);
    const columns = Number(args.columns || SIZES[size].columns);
    const edition = yearConfig.edition ? ordinal(yearConfig.edition) : '';
    const cname = existsSync(path.join(REPO, 'CNAME')) ? (await readFile(path.join(REPO, 'CNAME'), 'utf8')).trim() : '';
    const baseOptions = {
        size,
        columns,
        titlePage: !args['no-title-page'],
        contents: !args['no-contents'],
        letterMarks: !args['no-letter-marks']
    };

    const lettersPresent = [...new Set(entries.map(e => e.letter))];
    let volumes = [];
    if (args.volumes) {
        if (args.letters) throw new Error('Use either --letters or --volumes, not both.');
        if (args.volumes === 'auto') {
            volumes = await planVolumes({ entries, baseOptions, outDir, year, maxPages: Number(args['max-pages'] || 200), browser: args.browser, fonts: fonts.html });
        } else {
            volumes = args.volumes.split(',').map(v => v.trim()).filter(Boolean).map(v => parseLetters(v.replace(/\+/g, ',')));
        }
        const covered = new Set(volumes.flat());
        const left = lettersPresent.filter(l => !covered.has(l));
        if (left.length) console.warn(`  ! letters not in any volume: ${left.join(' ')}`);
    } else {
        volumes = [args.letters ? parseLetters(args.letters) : null];
    }

    let launched = null;
    try {
        for (const [vi, letters] of volumes.entries()) {
            const subset = letters ? entries.filter(e => letters.includes(e.letter)) : entries;
            if (!subset.length) {
                console.warn(`  ! no offerings for ${letters.join(',')}; skipped`);
                continue;
            }
            const present = [...new Set(subset.map(e => e.letter))];
            const label = volumes.length > 1 ? `Book ${vi + 1}` : (args.label || '');
            const range = letters ? [present[0], present[present.length - 1]] : null;
            const slug = [
                `vyasa-puja-${year}`,
                label ? label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '',
                range ? rangeLabel(present.length > 1 ? [range[0], range[1]] : [range[0]]).replace('#', 'other') : ''
            ].filter(Boolean).join('-');

            const options = {
                ...baseOptions,
                documentTitle: `Vyasa Puja ${year} Offerings${range ? ` ${range[0]}${range[1] !== range[0] ? `–${range[1]}` : ''}` : ''}${label ? ` · ${label}` : ''}`,
                title: {
                    eyebrow: [edition && `${edition} Vyāsa Pūjā`, year].filter(Boolean).join(' · '),
                    title: args.title || 'Offerings',
                    subtitle: args.subtitle || 'to His Holiness Radhanath Swami Maharaj',
                    range,
                    label,
                    stats: `${subset.length} offerings · ${countries(subset)} countries`,
                    verse: '<p lang="sa">ॐ अज्ञानतिमिरान्धस्य ज्ञानाञ्जनशलाकया ।<br>चक्षुरुन्मीलितं येन तस्मै श्रीगुरवे नमः ॥</p><small>To the spiritual master, who opened my eyes — blinded by the darkness of ignorance — with the torch of knowledge, I offer my respectful obeisances.</small>',
                    site: cname
                }
            };

            const htmlFile = path.join(outDir, `${slug}.html`);
            await writeFile(htmlFile, await renderHtml({ entries: subset, options, fonts: fonts.html }));
            log(`\n  ${label || 'Book'}${range ? ` (${range[0] === range[1] ? range[0] : `${range[0]}–${range[1]}`})` : ''}: ${subset.length} offerings`);
            log(`  html    ${path.relative(process.cwd(), htmlFile)}`);
            if (args['html-only']) continue;

            if (!launched) {
                launched = await launchBrowser(args.browser);
                log(`  browser ${launched.name}`);
            }
            const t0 = Date.now();
            const { page, result } = await layout(launched.browser, htmlFile);
            result.warnings.forEach(w => console.warn(`  ! ${w}`));
            const pdfFile = path.join(outDir, `${slug}.pdf`);
            await page.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
            await page.close();
            log(`  pdf     ${path.relative(process.cwd(), pdfFile)} — ${result.frontPages + result.bodyPages} pages (${result.frontPages} front + ${result.bodyPages}), ${Math.round((Date.now() - t0) / 1000)}s`);
        }
    } finally {
        if (launched) await launched.browser.close();
    }
    log('');
}

// Lays every offering out once, then groups whole letters into books of at most maxPages.
async function planVolumes({ entries, baseOptions, outDir, year, maxPages, browser, fonts }) {
    const htmlFile = path.join(outDir, `vyasa-puja-${year}-measure.html`);
    const options = { ...baseOptions, titlePage: false, contents: false, documentTitle: 'measure', title: {} };
    await writeFile(htmlFile, await renderHtml({ entries, options, fonts }));
    console.log('  measuring all offerings to plan volumes…');
    const launched = await launchBrowser(browser);
    let pages;
    try {
        const { result } = await layout(launched.browser, htmlFile);
        pages = result.letterPages;
    } finally {
        await launched.browser.close();
        await rm(htmlFile, { force: true });
    }
    const front = n => (baseOptions.titlePage ? 1 : 0) + (baseOptions.contents ? Math.ceil((n + 8) / 34) : 0);
    const volumes = [];
    let cur = [];
    let curPages = 0;
    let curEntries = 0;
    for (const [letter, p] of Object.entries(pages)) {
        const span = p.last - p.first + 1;
        if (cur.length && curPages + span + front(curEntries + p.entries) > maxPages) {
            volumes.push(cur);
            cur = [];
            curPages = 0;
            curEntries = 0;
        }
        cur.push(letter);
        curPages += span;
        curEntries += p.entries;
    }
    if (cur.length) volumes.push(cur);
    console.log(`  plan    ${volumes.map((v, i) => `Book ${i + 1}: ${rangeLabel(v)}`).join(' · ')}`);
    return volumes;
}

main().catch(err => {
    console.error(`\n✖ ${err.message}\n`);
    process.exit(1);
});
