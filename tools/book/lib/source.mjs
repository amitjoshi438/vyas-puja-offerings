// Loads offerings for one year exactly the way the website does (scripts/common.js),
// so ids line up with the site's share links (offerings.html?year=Y#o=<id>) and with edits files.
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

export async function loadSiteConfig(repoRoot) {
    const file = path.join(repoRoot, 'scripts', 'config.js');
    const code = await fs.readFile(file, 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox, { filename: file });
    const config = sandbox.window.VYASA_CONFIG;
    if (!config || !Array.isArray(config.years)) {
        throw new Error('scripts/config.js did not define window.VYASA_CONFIG.years');
    }
    return config;
}

const cleanLine = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
const cleanText = v => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim() : '');

// Same rules as normalizeOffering() in scripts/common.js.
export function normalizeOffering(raw, year, fallbackId) {
    if (!raw || typeof raw !== 'object') return null;
    const pick = (keys, cleaner) => {
        for (const key of keys) {
            const v = cleaner(raw[key]);
            if (v) return v;
        }
        return '';
    };
    const name = pick(['name', 'Your Name'], cleanLine);
    const text = pick(['offering', 'text', 'Your Offering ', 'Your Offering'], cleanText);
    if (!name && !text) return null;
    return {
        id: raw.id ? String(raw.id) : fallbackId,
        name: name || 'Anonymous',
        city: pick(['city', 'Name of City you are from'], cleanLine),
        country: pick(['country', 'Country'], cleanLine),
        text,
        year: Number(year),
        submittedAt: raw.submittedAt || null
    };
}

function asList(data, label) {
    const list = Array.isArray(data) ? data : (data && Array.isArray(data.offerings) ? data.offerings : null);
    if (!list) throw new Error(`${label} has no offerings array`);
    return list;
}

export async function loadStatic(file, year) {
    const raw = (await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, '');
    return asList(JSON.parse(raw), file)
        .map((r, i) => normalizeOffering(r, year, `${year}-${i}`))
        .filter(Boolean);
}

export async function loadLive(endpoint, year) {
    const url = `${endpoint.trim()}?action=list&year=${encodeURIComponent(year)}`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    const data = await res.json();
    if (!data || data.ok !== true || !Array.isArray(data.offerings)) {
        throw new Error((data && data.error) || `Unexpected response from ${url}`);
    }
    return data.offerings
        .map((r, i) => normalizeOffering(r, year, `${year}-live-${i}`))
        .filter(Boolean);
}

// source: 'auto' (what the website shows), 'static', 'live' or 'both'.
export async function loadOfferings({ repoRoot, config, year, source = 'auto', input, endpoint, log = () => {} }) {
    const yearConfig = config.years.find(y => Number(y.year) === Number(year));
    if (!yearConfig && !input) {
        throw new Error(`Year ${year} is not listed in scripts/config.js. Use --input <file> to read a file directly.`);
    }

    const parts = [];
    const file = input ? path.resolve(input) : (yearConfig && yearConfig.dataFile ? path.join(repoRoot, yearConfig.dataFile) : null);
    if (source !== 'live') {
        if (file) {
            const list = await loadStatic(file, year);
            log(`  static  ${list.length} offerings from ${path.relative(repoRoot, file) || file}`);
            parts.push(list);
        } else if (source === 'static') {
            throw new Error(`Year ${year} has no dataFile in scripts/config.js. Use --input <file>.`);
        }
    }

    const wantsLive = source === 'live' || source === 'both' || (source === 'auto' && yearConfig && yearConfig.live);
    if (wantsLive) {
        const url = endpoint || config.submissionEndpoint || '';
        if (!/^https:\/\//.test(url.trim())) {
            if (source === 'live' || source === 'both') {
                throw new Error('No submission endpoint. Set submissionEndpoint in scripts/config.js or pass --endpoint <url>.');
            }
            log('  live    skipped (no submissionEndpoint in scripts/config.js)');
        } else {
            const list = await loadLive(url, year);
            log(`  live    ${list.length} approved offerings from the Google Sheet`);
            parts.push(list);
        }
    }

    const seen = new Set();
    const offerings = [];
    for (const list of parts) {
        for (const o of list) {
            if (seen.has(o.id)) continue;
            seen.add(o.id);
            offerings.push(o);
        }
    }
    return { offerings, yearConfig: yearConfig || { year: Number(year) } };
}

// Editorial decisions for a year live in tools/book/edits/<year>.json:
//   { "exclude": { "<id>": "reason" }, "fix": { "<id>": { "name"?, "city"?, "country"?, "offering"? } },
//     "add": [ { "name", "city", "country", "offering" } ] }
export async function loadEdits(file) {
    const empty = { file: null, exclude: new Map(), fix: new Map(), add: [] };
    if (!file || !existsSync(file)) return empty;
    const json = JSON.parse((await fs.readFile(file, 'utf8')).replace(/^\uFEFF/, ''));
    const exclude = new Map();
    if (Array.isArray(json.exclude)) json.exclude.forEach(id => exclude.set(String(id), ''));
    else if (json.exclude && typeof json.exclude === 'object') {
        Object.entries(json.exclude).filter(([k]) => !k.startsWith('_')).forEach(([id, why]) => exclude.set(String(id), String(why || '')));
    }
    const fix = new Map(Object.entries(json.fix || {}).filter(([k]) => !k.startsWith('_')));
    const add = Array.isArray(json.add) ? json.add : [];
    return { file, exclude, fix, add };
}

export function applyEdits(offerings, edits, year) {
    const report = { excluded: [], fixed: [], added: [], unknownIds: [] };
    const ids = new Set(offerings.map(o => o.id));
    for (const id of [...edits.exclude.keys(), ...edits.fix.keys()]) {
        if (!ids.has(id)) report.unknownIds.push(id);
    }

    const out = [];
    for (const o of offerings) {
        if (edits.exclude.has(o.id)) {
            report.excluded.push({ id: o.id, name: o.name, reason: edits.exclude.get(o.id) });
            continue;
        }
        const f = edits.fix.get(o.id);
        if (f) {
            const next = { ...o };
            if (typeof f.name === 'string') next.name = cleanLine(f.name);
            if (typeof f.city === 'string') next.city = cleanLine(f.city);
            if (typeof f.country === 'string') next.country = cleanLine(f.country);
            const text = f.offering ?? f.text;
            if (typeof text === 'string') next.text = cleanText(text);
            report.fixed.push({ id: o.id, name: next.name, fields: Object.keys(f) });
            out.push(next);
            continue;
        }
        out.push(o);
    }
    edits.add.forEach((raw, i) => {
        const o = normalizeOffering(raw, year, `${year}-added-${i}`);
        if (o) {
            out.push(o);
            report.added.push({ id: o.id, name: o.name });
        }
    });
    return { offerings: out, report };
}
