// Finds things a human editor should decide before printing, and writes them to a review report.
// Only exact double-submissions (same name + same text) are removed automatically.

const fold = s => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const nameKey = s => fold(s).replace(/[^\p{L}\p{N}]+/gu, '');
const textKey = s => fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const PHONE = /(?:\+?\d[\d\s().-]{8,}\d)/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
const URL = /\bhttps?:\/\/|\bwww\./i;
const PLACEHOLDERS = new Set(['signature', 'your signature', 'name', 'your name', 'xxx', 'test', 'testing', 'lorem ipsum', 'na', 'n a']);
const OFF_TOPIC = ['project', 'status update', 'deadline', 'milestone', 'deliverable', 'invoice', 'meeting', 'stakeholder',
    'client', 'sprint', 'budget', 'quarter', 'initial phase', 'next steps', 'timeline', 'research and development', 'regards'];
const DEVOTIONAL = /krishna|krsna|kṛṣṇa|guru|maharaj|swami|svami|prabhupad|radhanath|hare|pranam|praṇām|obeisance|vyas|vyās|lotus|mercy|bless|lord|god|bhakti|seva|prabhu|dandavat|jaya|jai|गुरु|कृष्ण|महाराज|स्वामी|राधानाथ|प्रणाम|గురు|কৃষ্ণ|ଗୁରୁ/i;

function shingles(text, k = 5) {
    const words = textKey(text).split(' ').filter(Boolean);
    const out = new Set();
    for (let i = 0; i + k <= words.length; i++) out.add(words.slice(i, i + k).join(' '));
    return out;
}

const snippet = (s, n = 140) => {
    const t = s.replace(/\s+/g, ' ').trim();
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

export function review(entries) {
    const issues = [];
    const dropped = new Map();
    const add = (kind, entry, detail, extra = {}) => issues.push({ kind, id: entry.id, name: entry.name, location: entry.location, detail, snippet: snippet(entry.text), ...extra });

    // Exact double submissions, then same name with different text.
    const byName = new Map();
    for (const e of entries) {
        const k = nameKey(e.name);
        if (!byName.has(k)) byName.set(k, []);
        byName.get(k).push(e);
    }
    for (const group of byName.values()) {
        if (group.length < 2) continue;
        const kept = [];
        for (const e of group) {
            const twin = kept.find(k => textKey(k.text) === textKey(e.text));
            if (twin) dropped.set(e.id, twin.id);
            else kept.push(e);
        }
        if (kept.length > 1) {
            kept.forEach(e => add('same-name', e, `${kept.length} different offerings under this name: ${kept.map(k => `\`${k.id}\` (${k.location || 'no location'})`).join(', ')}`));
        }
    }

    // Near-identical text under different entries.
    const live = entries.filter(e => !dropped.has(e.id));
    const sets = new Map();
    const index = new Map();
    for (const e of live) {
        const s = shingles(e.text);
        if (s.size < 8) continue;
        sets.set(e.id, s);
        for (const sh of s) {
            if (!index.has(sh)) index.set(sh, []);
            index.get(sh).push(e.id);
        }
    }
    const shared = new Map();
    for (const ids of index.values()) {
        if (ids.length < 2 || ids.length > 25) continue;
        for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
                const key = `${ids[i]}\u0000${ids[j]}`;
                shared.set(key, (shared.get(key) || 0) + 1);
            }
        }
    }
    const byId = new Map(entries.map(e => [e.id, e]));
    for (const [key, inter] of shared) {
        const [a, b] = key.split('\u0000');
        const sa = sets.get(a).size;
        const sb = sets.get(b).size;
        const jaccard = inter / (sa + sb - inter);
        if (jaccard < 0.6) continue;
        const ea = byId.get(a);
        const eb = byId.get(b);
        const how = jaccard > 0.97 ? 'Identical text' : `${Math.round(jaccard * 100)}% the same text`;
        add('similar-text', ea, `${how} as **${eb.name}** \`${eb.id}\``);
        add('similar-text', eb, `${how} as **${ea.name}** \`${ea.id}\``);
    }

    for (const e of live) {
        const text = e.text;
        const phones = (text.match(PHONE) || []).filter(p => {
            const d = p.replace(/\D/g, '').length;
            return d >= 10 && d <= 15;
        });
        if (phones.length) add('contact', e, `Phone number: ${phones.map(p => `\`${p.trim()}\``).join(', ')}`);
        const email = text.match(EMAIL);
        if (email) add('contact', e, `Email address: \`${email[0]}\``);
        if (URL.test(text)) add('contact', e, 'Contains a web link');

        const lines = text.split('\n').map(l => fold(l).replace(/[^\p{L}\p{N} ]+/gu, '').trim());
        const ph = lines.find(l => PLACEHOLDERS.has(l));
        if (ph) add('placeholder', e, `Placeholder line “${ph}”`);

        const lower = fold(text);
        const off = OFF_TOPIC.filter(w => lower.includes(w));
        if (off.length >= 3) add('off-topic', e, `Reads like an unrelated message (${off.join(', ')})`);
        else if (!DEVOTIONAL.test(text) && !DEVOTIONAL.test(e.name)) add('off-topic', e, 'No devotional words found — check it is an offering');

        if (/ä/.test(text) && /[ñàçëòù]/.test(text) && (text.match(/[äñàçëòùåìïé]/g) || []).length >= 6) {
            add('legacy-font', e, 'Looks like legacy Balaram-font transliteration (ä=ā, ñ=ṣ, à=ṁ, ç=ś …); retype in Unicode via a fix');
        }
        if (text.replace(/\s+/g, ' ').trim().length < 25) add('short', e, `Very short (${text.trim().length} characters)`);
        if (/\d|@/.test(e.name)) add('name', e, 'Name contains digits or @');
        e.flags.forEach(f => add(f.kind, e, f.detail));
    }

    return { issues, dropped };
}

const SECTIONS = [
    ['similar-text', 'Same or near-identical text', 'Two entries share most of their text: a resubmission, a copied template, or two people sharing one offering.'],
    ['same-name', 'Same name, different offerings', 'Either two different devotees with the same name or a person who submitted twice. Keep one, or add a location to tell them apart.'],
    ['off-topic', 'Possibly not an offering', ''],
    ['placeholder', 'Placeholder text', ''],
    ['contact', 'Personal contact details', 'Phone numbers, emails and links are usually removed before printing.'],
    ['legacy-font', 'Legacy font encoding', 'Text typed with an old Sanskrit font prints as gibberish (duñpärasyädya). Replace it with Unicode IAST via "fix".'],
    ['name', 'Unusual names', ''],
    ['location', 'Unrecognised locations', 'Printed as written. Fix via "fix" if needed.'],
    ['short', 'Very short offerings', 'Usually fine; listed for completeness.']
];

export function writeReport({ year, entries, result, stats, edits, editsPath }) {
    const out = [];
    const by = kind => result.issues.filter(i => i.kind === kind);
    const decide = ['similar-text', 'same-name', 'off-topic', 'placeholder', 'contact', 'legacy-font', 'name'];
    const needs = new Set(result.issues.filter(i => decide.includes(i.kind)).map(i => i.id));

    out.push(`# Book review — ${year}`, '');
    out.push(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC by \`tools/book/build.mjs\`.`, '');
    out.push('| | |', '|---|---|');
    out.push(`| Offerings loaded | ${stats.loaded} |`);
    if (edits.excluded.length || edits.fixed.length || edits.added.length) {
        out.push(`| Edits applied | ${edits.excluded.length} excluded · ${edits.fixed.length} fixed · ${edits.added.length} added |`);
    }
    out.push(`| Exact double submissions removed | ${result.dropped.size} |`);
    out.push(`| Offerings in the book | ${stats.printed} |`);
    out.push(`| Emoji removed | ${stats.emoji} offerings |`);
    out.push(`| Markdown / HTML tidied | ${stats.markup} offerings |`);
    out.push(`| **Need a decision** | **${needs.size} offerings** |`, '');
    if (edits.unknownIds.length) {
        out.push(`> ⚠️ ${edits.unknownIds.length} id(s) in the edits file no longer exist: ${edits.unknownIds.map(i => `\`${i}\``).join(', ')}`, '');
    }

    out.push('## How to act on this', '');
    out.push(`Decisions go in \`${editsPath}\`, which the next build applies. Ids are the same ones the website uses in share links (\`offerings.html?year=${year}#o=<id>\`).`, '');
    out.push('```json', JSON.stringify({
        exclude: { '<id>': 'why it is left out' },
        fix: { '<id>': { name: 'Corrected Name', city: 'City', country: 'Country', offering: 'Corrected full text' } },
        add: [{ name: 'Late offering by email', city: 'City', country: 'Country', offering: 'Text' }]
    }, null, 2), '```', '');

    for (const [kind, title, help] of SECTIONS) {
        const list = by(kind);
        if (!list.length) continue;
        out.push(`## ${title} (${list.length})`, '');
        if (help) out.push(help, '');
        for (const i of list) {
            out.push(`- [ ] **${i.name}** · ${i.location || '—'} · \`${i.id}\` — ${i.detail}`);
            if (kind !== 'location') out.push(`  > ${i.snippet.replace(/\n/g, ' ')}`);
        }
        out.push('');
    }

    if (result.dropped.size) {
        out.push(`## Removed automatically (${result.dropped.size})`, '');
        out.push('Same name and same text as an earlier entry. Use `--keep-duplicates` to print them anyway.', '');
        const byId = new Map(entries.map(e => [e.id, e]));
        for (const [id, twin] of result.dropped) {
            const e = byId.get(id);
            out.push(`- **${e.name}** \`${id}\` duplicates \`${twin}\``);
        }
        out.push('');
    }
    return out.join('\n');
}
