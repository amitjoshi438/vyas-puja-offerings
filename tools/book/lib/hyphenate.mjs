import hyphen from 'hyphen/en-gb/index.js';

const SHY = '\u00AD';

// English patterns break Sanskrit badly ("har-inama", "bhakt-ivedanta"), so words with these roots stay whole.
const SANSKRIT = /bhakt|bhag|brahm|krish|krsn|kirt|nam[ae]|prabhu|prasad|vaish|vaisn|grih|griha|vrind|dham|seva|guru|swam|maharaj|achar|acar|sang|ashram|mantr|japa|gaur|nitai|radh|govind|gopi|gopal|dasa|devi|lila|tilak|kripa|krpa|mayap|jagann|yatr|sadhan|shastr|sastra|slok|darsh|prem|rasa|dharm|karm|jnan|ekadas|tulas|harinam|sankir|samsk|parampar|bhav|vedant|purush|siddh|mahaprab|chaitan|caitan|vigrah|bhog|naivedy|vyas|puja/i;

// Headless Chromium ships without hyphenation dictionaries, so soft hyphens are added here instead.
// Names, capitalised words, Sanskrit terms and links are left whole.
export function hyphenateEntries(entries) {
    for (const e of entries) {
        for (const b of e.blocks) {
            if (b.lang || b.kind === 'verse') continue;
            b.html = hyphen.hyphenateHTMLSync(b.html, { minWordLength: 7 })
                .replace(/(<[^>]*>)|([\p{L}\p{M}\u00AD]+)/gu, (m, tag, word) => {
                    if (tag || !word.includes(SHY)) return m;
                    const plain = word.replaceAll(SHY, '');
                    return /^\p{Lu}/u.test(plain) || /[^\x00-\x7F]/.test(plain) || SANSKRIT.test(plain) ? plain : word;
                })
                .replace(/[^\s<>]*[./@:](?=[\w\u00AD])[^\s<>]*/g, token => token.replaceAll(SHY, ''));
        }
    }
    return entries;
}
