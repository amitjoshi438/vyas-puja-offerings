import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml } from './clean.mjs';

const TEMPLATE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'template');

// Google Fonts css2 specs, fetched one family at a time so a failure does not take the others with it.
export const FONTS = [
    // A static file has a single optical size, so Newsreader is pinned to its 14 (10–11pt) text cut.
    'Newsreader:ital,opsz,wght@0,14,400;0,14,500;0,14,600;1,14,400;1,14,600',
    'Eczar:wght@500;600;700',
    'Tiro+Devanagari+Sanskrit:ital@0;1',
    'Noto+Serif:ital,wght@0,400;0,600;1,400',
    'Noto+Serif+Devanagari:wght@400;600',
    'Noto+Serif+Telugu:wght@400;600',
    'Noto+Serif+Bengali:wght@400;600',
    'Noto+Serif+Oriya:wght@400;600',
    'Noto+Serif+Gujarati:wght@400;600',
    'Noto+Serif+Kannada:wght@400;600',
    'Noto+Serif+Tamil:wght@400;600',
    'Noto+Serif+Malayalam:wght@400;600',
    'Noto+Serif+Gurmukhi:wght@400;600'
];

export const SIZES = {
    a4: { css: 'A4', columns: 2 },
    letter: { css: 'letter', columns: 2 },
    a5: { css: 'A5', columns: 1 }
};

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Each ornaments/<name>.svg becomes <symbol id="orn-<name>">. Ids inside a file are prefixed with
// the file name so artwork from different files (or replaced by a designer) cannot clash.
async function sprite() {
    const dir = path.join(TEMPLATE, 'ornaments');
    const files = (await readdir(dir)).filter(f => f.endsWith('.svg')).sort();
    const defs = [];
    const symbols = [];
    for (const file of files) {
        const name = path.basename(file, '.svg');
        const svg = await readFile(path.join(dir, file), 'utf8');
        const open = svg.match(/<svg\b[^>]*>/i);
        if (!open) continue;
        const viewBox = (open[0].match(/viewBox="([^"]+)"/i) || [])[1];
        if (!viewBox) throw new Error(`${file} needs a viewBox`);
        let inner = svg.slice(open.index + open[0].length, svg.lastIndexOf('</svg>')).replace(/<!--[\s\S]*?-->/g, '');
        for (const [, id] of inner.matchAll(/\bid="([^"]+)"/g)) {
            inner = inner.replace(new RegExp(`(id="|url\\(#|href="#)${escapeRe(id)}(?=["')])`, 'g'), `$1${name}-${id}`);
        }
        inner = inner.replace(/<defs\b[^>]*>([\s\S]*?)<\/defs>/g, (_, body) => {
            defs.push(body.trim());
            return '';
        });
        symbols.push(`<symbol id="orn-${name}" viewBox="${viewBox}">${inner.trim()}</symbol>`);
    }
    return `<svg class="sprite" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false"><defs>${defs.join('')}</defs>${symbols.join('')}</svg>`;
}

// `fonts` is the markup from fontMarkup(); without it the page links to Google Fonts directly.
export async function renderHtml({ entries, options, fonts }) {
    const [css, js, ornaments] = await Promise.all([
        readFile(path.join(TEMPLATE, 'book.css'), 'utf8'),
        readFile(path.join(TEMPLATE, 'paginate.js'), 'utf8'),
        sprite()
    ]);
    const size = SIZES[options.size] || SIZES.a4;
    const payload = {
        options,
        entries: entries.map(e => ({ id: e.id, name: e.name, location: e.location, letter: e.letter, blocks: e.blocks }))
    };
    const json = JSON.stringify(payload).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const fontHtml = fonts || FONTS.map(f => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${f}&amp;display=block">`).join('\n');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(options.documentTitle)}</title>
${fontHtml}
<style>
${css}
@page { size: ${size.css}; margin: 0; }
</style>
</head>
<body class="size-${options.size} cols-${options.columns}">
${ornaments}
<main id="book"></main>
<div class="status" role="status">Preparing pages…</div>
<script type="application/json" id="book-data">${json}</script>
<script>
${js}
</script>
</body>
</html>
`;
}
