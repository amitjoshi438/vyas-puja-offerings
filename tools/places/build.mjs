#!/usr/bin/env node
// Builds the country and town lists behind the offering form's dropdowns, from GeoNames.
//
//   node tools/places/build.mjs             uses the cached GeoNames downloads when present
//   node tools/places/build.mjs --refresh   downloads the latest GeoNames files first
//
// Writes data/places/countries.json and data/places/cities/<CC>.json, and refreshes the
// COUNTRIES list in backend/google-apps-script/Code.gs so the server accepts the same names.
// Towns come from cities1000 (places of 1,000+ people). Old and local names (Bombay, Poona)
// come from the per-country alternate names, only for the countries in extra.json's aliasCountries.
// Hand-made additions (ISKCON communities, aliases, renamed towns) live in extra.json.
// Place data © GeoNames (https://www.geonames.org), CC BY 4.0.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(ROOT, 'data', 'places');
const CODE_GS = path.join(ROOT, 'backend', 'google-apps-script', 'Code.gs');
const BASE_URL = 'https://download.geonames.org/export/dump/';
const FILES = { cities: 'cities1000.zip', countries: 'countryInfo.txt', admin1: 'admin1CodesASCII.txt' };

// Places that no longer exist (historical, abandoned, destroyed).
const SKIP_CODES = new Set(['PPLH', 'PPLQ', 'PPLW', 'PPLCH']);
// Countries where GeoNames' macrons and under-dots are the everyday spelling, not a transliteration.
const NATIVE_DIACRITICS = new Set(['LV', 'LT', 'VN', 'NZ']);
const TRANSLIT_MARKS = /[\u0304\u0323\u0331\u02BB\u02BC\u02BE\u02BF]/;
const NON_LATIN = /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u;

// Keep in sync with key() in scripts/places.js — search matches on this form.
const FOLD = { 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ł': 'l', 'đ': 'd', 'ð': 'd', 'þ': 'th', 'ı': 'i' };
function key(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .replace(/[ßæœøłđðþı]/g, c => FOLD[c])
        .replace(/['’`ʻʼ]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const stripMarks = value => clean(value).normalize('NFD').replace(/\p{M}/gu, '').normalize('NFC');

function displayName(name, ascii, country) {
    name = clean(name);
    ascii = clean(ascii);
    if (!name) return ascii;
    if (!ascii) return name;
    if (NON_LATIN.test(name)) return ascii;
    if (!NATIVE_DIACRITICS.has(country) && TRANSLIT_MARKS.test(name.normalize('NFD'))) return ascii;
    return name;
}

function maxAliases(population) {
    if (population >= 1000000) return 10;
    if (population >= 100000) return 6;
    return 3;
}

function pickAliases(rawList, shown, population) {
    const shownKey = key(shown);
    const seen = new Set([shownKey]);
    const out = [];
    for (const raw of rawList) {
        const alias = stripMarks(raw);
        if (alias.length < 3 || alias.length > 40) continue;
        if (!/^[A-Za-z][A-Za-z .'’-]*[A-Za-z.]$/.test(alias)) continue;
        if (/^[A-Z]{2,4}$/.test(alias)) continue;                 // airport and postal codes
        const k = key(alias);
        if (!k || seen.has(k)) continue;
        if (k.startsWith(shownKey) || shownKey.startsWith(k)) continue;   // the name already matches these
        seen.add(k);
        out.push(alias);
    }
    return out.slice(0, maxAliases(population));
}

// GeoNames' per-country alternate names, keeping only those in the given languages
// ('' means the language isn't recorded — usually local romanisations like Poona or Baroda).
async function readAlternateNames(code, languages, refresh) {
    const file = await ensure(`alternatenames/${code}.zip`, refresh);
    const text = unzipEntry(await readFile(file), `${code}.txt`).toString('utf8');
    const rank = new Map(languages.map((l, i) => [l, i]));
    const byId = new Map();
    for (const r of tsv(text)) {
        if (!rank.has(r[2])) continue;
        const list = byId.get(r[1]) || [];
        list.push({ name: r[3], order: rank.get(r[2]) * 2 + (r[4] === '1' ? 0 : 1) });
        byId.set(r[1], list);
    }
    const out = new Map();
    for (const [id, list] of byId) out.set(id, list.sort((a, b) => a.order - b.order).map(x => x.name));
    return out;
}

// ---------- Downloads ----------
async function ensure(file, refresh) {
    const dest = path.join(CACHE, file.replace(/\//g, '-'));
    if (!refresh && existsSync(dest)) return dest;
    await mkdir(CACHE, { recursive: true });
    console.log(`Downloading ${BASE_URL}${file} …`);
    const res = await fetch(BASE_URL + file);
    if (!res.ok) throw new Error(`Download failed (HTTP ${res.status}) for ${BASE_URL}${file}`);
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return dest;
}

// Minimal zip reader for GeoNames' archives (stored or deflated entries).
function unzipEntry(buffer, wanted) {
    let end = buffer.length - 22;
    while (end >= 0 && buffer.readUInt32LE(end) !== 0x06054b50) end--;
    if (end < 0) throw new Error('Not a zip file');
    const count = buffer.readUInt16LE(end + 10);
    let entry = buffer.readUInt32LE(end + 16);
    for (let i = 0; i < count; i++) {
        const nameLength = buffer.readUInt16LE(entry + 28);
        const name = buffer.toString('utf8', entry + 46, entry + 46 + nameLength);
        if (!wanted || name === wanted) {
            const method = buffer.readUInt16LE(entry + 10);
            const size = buffer.readUInt32LE(entry + 20);
            const local = buffer.readUInt32LE(entry + 42);
            const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
            const data = buffer.subarray(start, start + size);
            return method === 8 ? zlib.inflateRawSync(data) : data;
        }
        entry += 46 + nameLength + buffer.readUInt16LE(entry + 30) + buffer.readUInt16LE(entry + 32);
    }
    throw new Error(`${wanted} is missing from the zip`);
}

const tsv = text => text.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => line.split('\t'));

// ---------- Build ----------
async function main() {
    const refresh = process.argv.includes('--refresh');
    const extra = JSON.parse(await readFile(path.join(HERE, 'extra.json'), 'utf8'));
    const [citiesZip, countriesTxt, admin1Txt] = await Promise.all([
        ensure(FILES.cities, refresh), ensure(FILES.countries, refresh), ensure(FILES.admin1, refresh)
    ]);

    const exclude = new Set(extra.excludeCountries || []);
    const countries = new Map();
    for (const r of tsv(await readFile(countriesTxt, 'utf8'))) {
        const code = r[0];
        if (exclude.has(code)) continue;
        countries.set(code, {
            code,
            name: (extra.countryNames || {})[code] || clean(r[4]),
            aliases: [...((extra.countryAliases || {})[code] || [])],
            places: new Map()
        });
    }

    const admin1 = new Map();
    for (const r of tsv(await readFile(admin1Txt, 'utf8'))) {
        const code = r[0].split('.')[0];
        admin1.set(r[0], (extra.regionNames || {})[r[0]] || displayName(r[1], r[2], code));
    }

    const rows = tsv(unzipEntry(await readFile(citiesZip), 'cities1000.txt').toString('utf8'))
        .map(r => ({ r, pop: Number(r[14]) || 0 }))
        .sort((a, b) => b.pop - a.pop);

    const languages = extra.aliasLanguages || ['en', ''];
    const alternates = new Map();
    for (const code of extra.aliasCountries || []) {
        if (countries.has(code)) alternates.set(code, await readAlternateNames(code, languages, refresh));
    }

    for (const { r, pop } of rows) {
        const country = countries.get(r[8]);
        if (!country || SKIP_CODES.has(r[7])) continue;
        const name = displayName(r[1], r[2], r[8]);
        if (!name) continue;
        const region = admin1.get(`${r[8]}.${r[10]}`) || '';
        const id = `${key(name)}|${key(region)}`;
        const aliases = pickAliases([r[2], ...((alternates.get(r[8]) || new Map()).get(r[0]) || [])], name, pop);
        const existing = country.places.get(id);
        if (existing) {
            existing.aliases = mergeAliases(existing, aliases);
        } else {
            country.places.set(id, { name, region, pop, aliases });
        }
    }

    applyExtraPlaces(countries, extra.places || []);

    for (const code of extra.regionsAsCountryAliases || []) {
        const country = countries.get(code);
        if (!country) continue;
        const regions = new Set([...country.places.values()].map(p => p.region).filter(Boolean));
        country.aliases.push(...[...regions].sort());
    }

    // ---------- Write ----------
    const citiesDir = path.join(OUT, 'cities');
    await rm(citiesDir, { recursive: true, force: true });
    await mkdir(citiesDir, { recursive: true });

    const hash = createHash('sha1');
    const list = [];
    let totalPlaces = 0;
    let totalBytes = 0;
    const sizes = [];
    const sorted = [...countries.values()].sort((a, b) => a.name.localeCompare(b.name, 'en'));

    for (const country of sorted) {
        const places = [...country.places.values()]
            .sort((a, b) => b.pop - a.pop || a.name.localeCompare(b.name, 'en'));
        const entry = { code: country.code, name: country.name };
        const aliases = dedupeAliases(country.aliases, country.name);
        if (aliases.length) entry.aliases = aliases;
        entry.cities = places.length;
        list.push(entry);
        hash.update(JSON.stringify(entry));
        if (!places.length) continue;

        const regions = [...new Set(places.map(p => p.region).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'en'));
        const index = new Map(regions.map((r, i) => [r, i]));
        const lines = places.map(p => JSON.stringify([p.name, p.region ? index.get(p.region) : -1, ...p.aliases]));
        const body = `{"country":${JSON.stringify(country.code)},"regions":${JSON.stringify(regions)},"cities":[\n${lines.join(',\n')}\n]}\n`;
        await writeFile(path.join(citiesDir, `${country.code}.json`), body);
        hash.update(body);
        totalPlaces += places.length;
        totalBytes += Buffer.byteLength(body);
        sizes.push([country.code, places.length, Buffer.byteLength(body)]);
    }

    const out = {
        version: hash.digest('hex').slice(0, 10),
        source: 'GeoNames (https://www.geonames.org), licensed under CC BY 4.0. Generated by tools/places/build.mjs.',
        popular: (extra.popular || []).filter(code => countries.has(code)),
        countries: list
    };
    await writeFile(path.join(OUT, 'countries.json'), `${JSON.stringify(out, null, 1)}\n`);
    await updateCodeGs(list.map(c => c.name));

    sizes.sort((a, b) => b[2] - a[2]);
    console.log(`Countries: ${list.length} · places: ${totalPlaces.toLocaleString('en')} · ${(totalBytes / 1048576).toFixed(1)} MB in ${sizes.length} files`);
    console.log(`Largest: ${sizes.slice(0, 5).map(([c, n, b]) => `${c} ${n.toLocaleString('en')} (${Math.round(b / 1024)} KB)`).join(', ')}`);
    console.log(`Version: ${out.version}`);
}

function mergeAliases(place, more) {
    const seen = new Set([key(place.name), ...place.aliases.map(key)]);
    const out = place.aliases.slice();
    for (const a of more) {
        const k = key(a);
        if (!seen.has(k)) { seen.add(k); out.push(a); }
    }
    return out;
}

function dedupeAliases(aliases, name) {
    const seen = new Set([key(name)]);
    return aliases.filter(a => {
        const k = key(a);
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
    });
}

function applyExtraPlaces(countries, places) {
    for (const p of places) {
        const country = countries.get(p.country);
        if (!country) { console.warn(`! extra.json: unknown country "${p.country}" for ${p.name}`); continue; }
        const regions = new Set([...country.places.values()].map(x => x.region));
        if (p.region && !regions.has(p.region)) {
            console.warn(`! extra.json: region "${p.region}" is not used in ${p.country} — check the spelling (${p.name})`);
        }
        const id = `${key(p.name)}|${key(p.region)}`;
        const existing = country.places.get(id);
        if (existing) {
            existing.aliases = mergeAliases(existing, p.aliases || []);
            if (p.weight) existing.pop = Math.max(existing.pop, p.weight);
        } else {
            country.places.set(id, { name: p.name, region: p.region || '', pop: p.weight || 0, aliases: dedupeAliases(p.aliases || [], p.name) });
            console.log(`+ added ${p.name}, ${p.region || '—'} (${p.country})`);
        }
    }
}

async function updateCodeGs(names) {
    const source = await readFile(CODE_GS, 'utf8');
    const pattern = /(\/\/ <countries>[^\n]*\n)[\s\S]*?(\r?\n\/\/ <\/countries>)/;
    if (!pattern.test(source)) {
        throw new Error('Code.gs is missing the "// <countries>" … "// </countries>" markers around the COUNTRIES list.');
    }
    const lines = [];
    let line = '';
    for (const name of names.map(n => JSON.stringify(n))) {
        if (line && line.length + name.length + 2 > 104) { lines.push(line.trimEnd()); line = ''; }
        line += `${name}, `;
    }
    if (line) lines.push(line.replace(/, $/, ''));
    const block = `const COUNTRIES = [\n${lines.map(l => `  ${l}`).join('\n')}\n];`;
    const eol = source.includes('\r\n') ? '\r\n' : '\n';
    const next = source.replace(pattern, (_, start, end) => `${start}${block}${end}`).replace(/\r?\n/g, eol);
    if (next !== source) {
        await writeFile(CODE_GS, next);
        console.log('Updated the COUNTRIES list in backend/google-apps-script/Code.gs — redeploy the Apps Script.');
    }
}

main().catch(err => {
    console.error(err.message || err);
    process.exit(1);
});
