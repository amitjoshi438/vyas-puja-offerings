import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Google Fonts sends browsers variable WOFF2 files, and Chromium can only put variable fonts into a
// PDF as Type 3 outlines, which printers' preflight checks often reject. Asked by a non-browser
// client, the API returns static TrueType instances instead; those embed as ordinary TrueType
// fonts. Files are cached in tools/book/.cache/fonts so later builds also work offline.
const API = 'https://fonts.googleapis.com/css2';
const AGENT = 'vyasa-puja-book (static TrueType)';

const slug = family => `${family.split(':')[0].replace(/\+/g, '-').toLowerCase()}-${createHash('sha1').update(family).digest('hex').slice(0, 8)}`;

async function download(url, file) {
    const res = await fetch(url, { headers: { 'User-Agent': AGENT } });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
}

// Returns the <link>/<style> markup for the given css2 family specs. Families that cannot be
// fetched or found in the cache fall back to a normal Google Fonts link and are listed in `web`.
export async function fontMarkup(families, cacheDir) {
    const files = path.join(cacheDir, 'files');
    await mkdir(files, { recursive: true });
    const local = [];
    const web = [];
    for (const family of families) {
        const cssFile = path.join(cacheDir, `${slug(family)}.css`);
        try {
            if (!existsSync(cssFile)) await download(`${API}?family=${family}&display=block`, cssFile);
            let css = await readFile(cssFile, 'utf8');
            for (const [, url] of [...css.matchAll(/url\((https:[^)]+)\)/g)]) {
                const file = path.join(files, path.basename(new URL(url).pathname));
                if (!existsSync(file)) await download(url, file);
                css = css.replace(url, pathToFileURL(file).href);
            }
            if (!/url\(file:/.test(css)) throw new Error('no font files in the stylesheet');
            local.push(css.trim());
        } catch (err) {
            web.push({ family, error: String(err.message || err) });
        }
    }
    const links = web.map(w => `<link rel="stylesheet" href="${API}?family=${w.family}&amp;display=block">`);
    return {
        html: [...links, local.length ? `<style>\n${local.join('\n')}\n</style>` : ''].filter(Boolean).join('\n'),
        web
    };
}
