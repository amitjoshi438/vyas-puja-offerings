// Turns raw offering text into clean, typeset-ready blocks and a tidy "City, Country" line.
// Everything here is deliberately conservative: it fixes mechanical problems (stray markdown,
// HTML entities, emoji, wrapped lines) and leaves judgement calls to the review report.

const B_ON = '\uE000';
const B_OFF = '\uE001';
const I_ON = '\uE002';
const I_OFF = '\uE003';
const BULLET = '\uE004';
const MARKS = /[\uE000-\uE004]/g;

const SHORT_LINE = 56;    // consecutive lines shorter than this are kept together as a verse/stanza
const WRAP_MIN = 35;      // a line at least this long that runs into a lowercase line was hard-wrapped

export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const NAMED_ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0', ndash: '–', mdash: '—',
    hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bull: '•', middot: '·'
};

export function decodeEntities(s) {
    let prev;
    let out = s;
    for (let i = 0; i < 2 && out !== prev; i++) {
        prev = out;
        out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
            if (e[0] === '#') {
                const cp = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
                return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
            }
            return NAMED_ENTITIES[e.toLowerCase()] ?? m;
        });
    }
    return out;
}

// Removes HTML-ish tags and model tokens such as <bos>, <br/>, <p>.
export function stripTags(s) {
    return s.replace(/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi, ' ');
}

const EMOJI = /(?:\p{Regional_Indicator}{1,2}|[#*0-9]\uFE0F?\u20E3|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})*)*)/gu;
const KEEP_SYMBOLS = new Set(['©', '®', '™']);

export function stripEmoji(s) {
    let count = 0;
    const text = s
        .replace(EMOJI, m => {
            if (KEEP_SYMBOLS.has(m)) return m;
            count++;
            return ' ';
        })
        .replace(/[\u{1F3FB}-\u{1F3FF}\uFE0F\u20E3]/gu, '');
    return { text, count };
}

function unquote(s) {
    let t = s.trim();
    if (t.length > 1 && t[0] === '"' && t[t.length - 1] === '"') return t.slice(1, -1).trim();
    const n = (t.match(/"/g) || []).length;
    if (n % 2 === 1) {
        if (t[0] === '"') t = t.slice(1).trimStart();
        else if (t[t.length - 1] === '"') t = t.slice(0, -1).trimEnd();
    }
    return t;
}

function markdown(s) {
    let t = s;
    t = t.replace(/^[ \t]*#{1,6}[ \t]+(.+)$/gm, `${B_ON}$1${B_OFF}`);
    t = t.replace(/^[ \t]*[*•●▪◦][ \t]+/gm, BULLET);
    t = t.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, `${B_ON}$1${B_OFF}`);
    t = t.replace(/__(?=\S)([^\n]*?\S)__/g, `${B_ON}$1${B_OFF}`);
    t = t.replace(/(^|[^\p{L}\p{N}*])\*(?=\S)([^*\n]*?[^\s*])\*(?![\p{L}\p{N}*])/gmu, `$1${I_ON}$2${I_OFF}`);
    return t.replace(/\*+/g, '');
}

const plain = s => s.replace(MARKS, '');

function toBlocks(text) {
    const lines = text.split('\n').map(l => l.replace(/[ \t\u00A0\u3000]+/g, ' ').trim());

    const joined = [];
    for (const line of lines) {
        const prev = joined.length ? joined[joined.length - 1] : '';
        const pp = plain(prev);
        const pl = plain(line);
        const softWrap = pp.length >= WRAP_MIN && pl && /[\p{L}\p{N},]$/u.test(pp) && /^[a-z(]/.test(pl) && !line.startsWith(BULLET);
        if (softWrap) joined[joined.length - 1] = `${prev} ${line}`;
        else joined.push(line);
    }

    const blocks = [];
    let run = [];
    const flush = () => {
        if (run.length) blocks.push({ kind: run.length > 1 ? 'verse' : 'p', lines: run });
        run = [];
    };
    for (const line of joined) {
        const pl = plain(line);
        if (!/[\p{L}\p{N}]/u.test(pl)) {
            flush();
            continue;
        }
        if (line.startsWith(BULLET)) {
            flush();
            blocks.push({ kind: 'li', lines: [line.slice(1)] });
            continue;
        }
        if (pl.length < SHORT_LINE) run.push(line);
        else {
            flush();
            blocks.push({ kind: 'p', lines: [line] });
        }
    }
    flush();
    return blocks;
}

// Converts sentinel-marked text to HTML, carrying bold/italic state across paragraphs.
function renderInline(str, state) {
    const open = () => (state.b ? '<strong>' : '') + (state.i ? '<em>' : '');
    const close = () => (state.i ? '</em>' : '') + (state.b ? '</strong>' : '');
    let html = open();
    let buf = '';
    for (const ch of str) {
        if (ch === B_ON || ch === B_OFF || ch === I_ON || ch === I_OFF) {
            html += escapeHtml(buf) + close();
            buf = '';
            if (ch === B_ON) state.b = true;
            else if (ch === B_OFF) state.b = false;
            else if (ch === I_ON) state.i = true;
            else state.i = false;
            html += open();
        } else {
            buf += ch;
        }
    }
    html += escapeHtml(buf) + close();
    let prev;
    while (prev !== html) {
        prev = html;
        html = html.replace(/<(strong|em)>(\s*)<\/\1>/g, '$2');
    }
    return html;
}

const SCRIPTS = [
    ['hi', /\p{Script=Devanagari}/gu], ['te', /\p{Script=Telugu}/gu], ['bn', /\p{Script=Bengali}/gu],
    ['or', /\p{Script=Oriya}/gu], ['gu', /\p{Script=Gujarati}/gu], ['ta', /\p{Script=Tamil}/gu],
    ['kn', /\p{Script=Kannada}/gu], ['ml', /\p{Script=Malayalam}/gu], ['pa', /\p{Script=Gurmukhi}/gu]
];

function scriptLang(text) {
    const letters = (text.match(/\p{L}/gu) || []).length;
    if (!letters) return null;
    for (const [lang, re] of SCRIPTS) {
        if ((text.match(re) || []).length / letters > 0.4) return lang;
    }
    return null;
}

// ---------- Names ----------

function titleCase(s) {
    return s.toLowerCase().replace(/(^|[\s\-(/.'’])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
}

export function cleanName(raw) {
    let t = stripEmoji(decodeEntities(stripTags(raw || ''))).text;
    t = t.replace(/[*_]+/g, '').replace(/\s+/g, ' ').trim();
    t = t.replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+([,.;:])/g, '$1').replace(/[\s,;:\-–—]+$/, '').trim();
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (letters.length > 3 && (t === t.toLowerCase() || t === t.toUpperCase()) && /[a-z]/i.test(letters)) t = titleCase(t);
    return t || 'Anonymous';
}

export function letterOf(name) {
    const c = name.normalize('NFD').replace(/\p{M}/gu, '').replace(/^[^\p{L}\p{N}]+/u, '').charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : '#';
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

// Word-by-word order, as in a printed index: "Padma Kishori" before "Padmagopika".
export function compareNames(a, b) {
    const key = s => s.normalize('NFKC').replace(/[^\p{L}\p{N}\s]+/gu, '').replace(/\s+/g, ' ').trim();
    return collator.compare(key(a), key(b));
}

// ---------- Locations ----------

const ALIASES = new Map(Object.entries({
    'usa': 'USA', 'us': 'USA', 'u.s.': 'USA', 'u.s': 'USA', 'u.s.a': 'USA', 'u.s.a.': 'USA', 'united states': 'USA',
    'united states of america': 'USA', 'america': 'USA',
    'uk': 'UK', 'u.k.': 'UK', 'u.k': 'UK', 'united kingdom': 'UK', 'great britain': 'UK', 'britain': 'UK',
    'uae': 'UAE', 'u.a.e': 'UAE', 'u.a.e.': 'UAE', 'united arab emirates': 'UAE',
    'italia': 'Italy', 'slovenija': 'Slovenia', 'deutschland': 'Germany', 'españa': 'Spain', 'espana': 'Spain',
    'russian federation': 'Russia', 'bharat': 'India', 'hindustan': 'India', 'republic of moldova': 'Moldova',
    'n.macedonia': 'North Macedonia', 'n. macedonia': 'North Macedonia', 'macedonia': 'North Macedonia',
    'bosnia and herzegovina': 'Bosnia and Herzegovina', 'bosnia & herzegovina': 'Bosnia and Herzegovina',
    'holland': 'Netherlands', 'the netherlands': 'Netherlands', 'czech republic': 'Czechia',
    'korea': 'South Korea', 'republic of korea': 'South Korea'
}));
const UK_PARTS = ['England', 'Scotland', 'Wales', 'Northern Ireland'];

const KNOWN = (() => {
    const map = new Map();
    const names = new Intl.DisplayNames(['en'], { type: 'region' });
    for (let a = 65; a <= 90; a++) {
        for (let b = 65; b <= 90; b++) {
            const code = String.fromCharCode(a, b);
            let name;
            try { name = names.of(code); } catch { continue; }
            if (!name || name === code || /unknown/i.test(name)) continue;
            const canon = ALIASES.get(name.toLowerCase()) || name.replace(/ & /g, ' and ');
            map.set(name.toLowerCase(), canon);
            map.set(name.replace(/ & /g, ' and ').toLowerCase(), canon);
        }
    }
    UK_PARTS.forEach(n => map.set(n.toLowerCase(), n));
    for (const v of ALIASES.values()) map.set(v.toLowerCase(), v);
    return map;
})();

const INDIA_REGIONS = new Set([
    'andhra pradesh', 'arunachal pradesh', 'assam', 'bihar', 'chhattisgarh', 'goa', 'gujarat', 'haryana',
    'himachal pradesh', 'jharkhand', 'karnataka', 'kerala', 'madhya pradesh', 'maharashtra', 'maharastra', 'manipur',
    'meghalaya', 'mizoram', 'nagaland', 'odisha', 'orissa', 'punjab', 'rajasthan', 'sikkim', 'tamil nadu', 'telangana',
    'tripura', 'uttar pradesh', 'uttarakhand', 'west bengal', 'delhi', 'new delhi', 'jammu and kashmir', 'ladakh',
    'puducherry', 'chandigarh', 'mumbai', 'pune', 'amritsar', 'kolkata', 'chennai', 'bengaluru', 'bangalore',
    'hyderabad', 'ahmedabad', 'nagpur', 'thane', 'vrindavan', 'mayapur'
]);

const SMALL_WORDS = new Set(['and', 'of', 'de', 'la', 'del', 'da', 'di', 'du', 'on', 'upon', 'the', 'am', 'im', 'an']);

function tidy(s) {
    return (s || '')
        .replace(/\s+/g, ' ')
        .replace(/\s*,\s*/g, ', ')
        .replace(/\s*\/\s*/g, ' / ')
        .replace(/(, ){2,}/g, ', ')
        .replace(/^[\s,.;:/\-–]+|[\s,.;:/\-–]+$/g, '')
        .trim();
}

function smartCase(s) {
    let first = true;
    return s.split(/(\s+|,|\/|-)/).map(w => {
        if (!/\p{L}/u.test(w)) return w;
        const letters = (w.match(/\p{L}/gu) || []).length;
        const isFirst = first;
        first = false;
        if (w === w.toUpperCase() && letters <= 3) return w;
        if (w === w.toLowerCase() && w.includes('.') && letters <= 3) return w.toUpperCase();
        if (!isFirst && SMALL_WORDS.has(w.toLowerCase())) return w.toLowerCase();
        if (w === w.toLowerCase() || (w === w.toUpperCase() && letters > 3)) return w[0].toUpperCase() + w.slice(1).toLowerCase();
        return w;
    }).join('');
}

function canonSingle(t) {
    const low = t.toLowerCase().replace(/\.$/, '');
    if (ALIASES.has(low)) return { name: ALIASES.get(low), known: true };
    if (KNOWN.has(low)) return { name: KNOWN.get(low), known: true };
    if (INDIA_REGIONS.has(low)) return { name: 'India', known: true, region: smartCase(t) };
    return null;
}

function canonCountry(raw) {
    const t = tidy(raw);
    if (!t) return { name: '', known: true };
    const whole = canonSingle(t);
    if (whole) return whole;
    const parts = t.split(/\s*(?:\/|&|\band\b)\s*/i).filter(Boolean);
    if (parts.length > 1) {
        const mapped = parts.map(p => canonSingle(p) || { name: smartCase(p), known: false });
        return { name: mapped.map(m => m.name).join(' / '), known: mapped.every(m => m.known) };
    }
    for (const w of t.split(/[\s,]+/)) {
        const hit = canonSingle(w);
        if (hit && !hit.region) return hit;
    }
    return { name: smartCase(t), known: false };
}

function equivalents(country) {
    const target = country.toLowerCase();
    const out = new Set([target]);
    for (const [k, v] of ALIASES) if (v.toLowerCase() === target) out.add(k);
    for (const [k, v] of KNOWN) if (v.toLowerCase() === target) out.add(k);
    const ukish = ['uk', ...UK_PARTS.map(p => p.toLowerCase())];
    if (ukish.includes(target)) {
        ukish.forEach(n => out.add(n));
        for (const [k, v] of ALIASES) if (v === 'UK') out.add(k);
    }
    return [...out].filter(Boolean).sort((a, b) => b.length - a.length);
}

function stripCountry(city, country) {
    if (!city || !country) return city;
    const names = country.split(' / ').flatMap(equivalents);
    let c = city;
    for (let guard = 0; guard < 4; guard++) {
        const low = c.toLowerCase();
        let changed = false;
        for (const n of names) {
            if (low === n) return '';
            const before = low.slice(0, low.length - n.length);
            if (low.endsWith(n) && /[\s,/]$/.test(before)) {
                c = tidy(c.slice(0, c.length - n.length));
                changed = true;
                break;
            }
            const after = c.slice(n.length);
            if (low.startsWith(n) && /^[\s,/]/.test(after) && !/^\s*city\b/i.test(after)) {
                c = tidy(after);
                changed = true;
                break;
            }
        }
        if (!changed) break;
    }
    return c;
}

export function formatLocation(rawCity, rawCountry) {
    const flags = [];
    let city = smartCase(tidy(stripEmoji(decodeEntities(rawCity || '')).text));
    const country = canonCountry(stripEmoji(decodeEntities(rawCountry || '')).text);
    let countryName = country.name;

    if (country.region && !city.toLowerCase().includes(country.region.toLowerCase())) {
        city = city ? `${city}, ${country.region}` : country.region;
    }
    if (!country.known && countryName) {
        if (city.toLowerCase().includes(countryName.toLowerCase())) countryName = '';
        else flags.push({ kind: 'location', detail: `Unrecognised country “${rawCountry}”` });
    }
    city = stripCountry(city, countryName);
    const text = [city, countryName].filter(Boolean).join(', ');
    return { text, country: countryName, flags };
}

// ---------- Offering ----------

export function prepareEntry(o, { keepEmoji = false } = {}) {
    const notes = { emoji: 0, markup: false };
    const original = o.text || '';
    let t = original.normalize('NFC');

    if (/<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>|&#?\w+;|\*/i.test(t)) notes.markup = true;
    t = decodeEntities(stripTags(t));
    if (!keepEmoji) {
        const r = stripEmoji(t);
        t = r.text;
        notes.emoji = r.count;
        if (r.count) t = t.replace(/[ \t]+(?=[,.;:!?])/g, '');
    }
    t = t.replace(/[\u200B\uFEFF\u2060]/g, '');
    t = unquote(t);
    t = markdown(t);

    const state = { b: false, i: false };
    const blocks = toBlocks(t).map(block => {
        const lines = block.lines.map(line => renderInline(line, state));
        const text = plain(block.lines.join('\n'));
        const out = { kind: block.kind, html: lines.join('<br>') };
        const lang = scriptLang(text);
        if (lang) out.lang = lang;
        return out;
    });

    const name = cleanName(o.name);
    const location = formatLocation(o.city, o.country);
    return {
        id: o.id,
        name,
        location: location.text,
        country: location.country,
        letter: letterOf(name),
        blocks,
        text: plain(toBlocks(t).map(b => b.lines.join('\n')).join('\n\n')),
        raw: o,
        notes,
        flags: location.flags
    };
}
