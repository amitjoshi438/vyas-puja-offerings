// ============================================
// Places — the country and town lists behind the offering form.
// Data lives in data/places/ (GeoNames, CC BY 4.0) and is built by tools/places/build.mjs.
// ============================================
(function (root) {
    'use strict';

    const BASE = 'data/places/';
    const LIMIT = 8;

    // ---------- Matching ----------
    // Keep in sync with key() in tools/places/build.mjs.
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

    function prepare(item, name, aliases) {
        item.name = name;
        item.aliases = aliases;
        item.k = key(name);
        item.w = ` ${item.k}`;
        item.ak = aliases.map(key);
        return item;
    }

    // Edit distance between q and the closest prefix of s, counting a swap of neighbours as one edit.
    function prefixDistance(q, s, max) {
        const n = q.length;
        const m = Math.min(s.length, n + max);
        let before = null;
        let prev = [];
        for (let j = 0; j <= m; j++) prev[j] = j;
        for (let i = 1; i <= n; i++) {
            const cur = [i];
            let low = i;
            for (let j = 1; j <= m; j++) {
                let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (q[i - 1] === s[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && q[i - 1] === s[j - 2] && q[i - 2] === s[j - 1]) v = Math.min(v, before[j - 2] + 1);
                cur[j] = v;
                if (v < low) low = v;
            }
            if (low > max) return max + 1;
            before = prev;
            prev = cur;
        }
        return Math.min.apply(null, prev);
    }

    // 0 name · 1 other name · 2 start of name (or "name region") · 3 start of other name
    // 4 a later word of the name · 5 a later word of another name · 6 near spelling
    function rank(item, q, word) {
        if (item.k === q) return [0, ''];
        for (let i = 0; i < item.ak.length; i++) if (item.ak[i] === q) return [1, item.aliases[i]];
        if (item.k.startsWith(q) || (item.full && item.full.startsWith(q))) return [2, ''];
        for (let i = 0; i < item.ak.length; i++) if (item.ak[i].startsWith(q)) return [3, item.aliases[i]];
        if (item.w.includes(word)) return [4, ''];
        for (let i = 0; i < item.ak.length; i++) if (` ${item.ak[i]}`.includes(word)) return [5, item.aliases[i]];
        return null;
    }

    // `list` must already be in preferred order (largest towns first).
    function search(list, query, limit) {
        limit = limit || LIMIT;
        const q = key(query);
        if (!q) return [];
        const word = ` ${q}`;
        const buckets = [[], [], [], [], [], []];
        for (const item of list) {
            const r = rank(item, q, word);
            if (r) buckets[r[0]].push({ item, rank: r[0], via: r[1] });
        }
        const out = [];
        for (const bucket of buckets) {
            for (const hit of bucket) {
                if (out.length >= limit) return out;
                out.push(hit);
            }
        }
        if (q.length < 4) return out;

        const max = q.length <= 6 ? 1 : 2;
        const seen = new Set(out.map(hit => hit.item));
        const near = [];
        for (const item of list) {
            if (seen.has(item)) continue;
            let best = prefixDistance(q, item.k, max);
            let via = '';
            for (let i = 0; i < item.ak.length && best > 0; i++) {
                const d = prefixDistance(q, item.ak[i], max);
                if (d < best) { best = d; via = item.aliases[i]; }
            }
            if (best <= max) near.push({ item, rank: 6, dist: best, via });
        }
        near.sort((a, b) => a.dist - b.dist || a.item.order - b.item.order);
        return out.concat(near.slice(0, limit - out.length));
    }

    // The part of `label` that the query matched, for highlighting: [start, end] or null.
    function markRange(label, query) {
        const q = key(query);
        if (!q) return null;
        const letter = /[\p{L}\p{N}]/u;
        for (let s = 0; s < label.length; s++) {
            if (!letter.test(label[s]) || (s > 0 && letter.test(label[s - 1]))) continue;
            for (let e = s + 1; e <= label.length; e++) {
                const k = key(label.slice(s, e));
                if (k === q) return [s, e];
                if (!q.startsWith(k)) break;
            }
        }
        return null;
    }

    // Finds the one entry whose name (or, with aliases: true, other name) is exactly `text`.
    function exact(list, text, options) {
        const q = key(text);
        if (!q) return null;
        const named = list.filter(item => item.k === q || (item.full && item.full === q));
        if (named.length === 1) return named[0];
        if (named.length || !(options && options.aliases)) return null;
        const aka = list.filter(item => item.ak.includes(q));
        return aka.length === 1 ? aka[0] : null;
    }

    // ---------- Data ----------
    function prepareCountries(data) {
        const popular = data.popular || [];
        const list = data.countries.map((c, i) => {
            const p = popular.indexOf(c.code);
            return prepare({ code: c.code, cities: c.cities || 0, popular: p >= 0, order: p >= 0 ? p : popular.length + i }, c.name, c.aliases || []);
        }).sort((a, b) => a.order - b.order);
        return { version: data.version || '', list, byCode: new Map(list.map(c => [c.code, c])) };
    }

    function prepareCities(data) {
        const regions = data.regions || [];
        const list = data.cities.map((row, i) => {
            const region = row[1] >= 0 ? regions[row[1]] || '' : '';
            const item = prepare({ region, order: i }, row[0], row.slice(2));
            if (region) item.full = `${item.k} ${key(region)}`;
            return item;
        });
        return { code: data.country, list };
    }

    let countries = null;
    const cities = new Map();

    async function fetchJson(url, timeout) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    function loadCountries() {
        if (!countries) {
            countries = fetchJson(`${BASE}countries.json`, 20000)
                .then(prepareCountries)
                .catch(err => { countries = null; throw err; });
        }
        return countries;
    }

    function loadCities(data, code) {
        const country = data.byCode.get(code);
        if (!country || !country.cities) return Promise.resolve({ code, list: [] });
        if (!cities.has(code)) {
            const url = `${BASE}cities/${code}.json?v=${encodeURIComponent(data.version)}`;
            cities.set(code, fetchJson(url, 30000)
                .then(prepareCities)
                .catch(err => { cities.delete(code); throw err; }));
        }
        return cities.get(code);
    }

    // ---------- Combobox (ARIA 1.2, list autocomplete with manual selection) ----------
    // source(text) returns options: { label, value, detail, note, mark, kind, divider, current, sure, data }.
    class Combobox {
        constructor({ input, toggle, status, source, emptyText, onPick, onEdit, noun }) {
            this.input = input;
            this.toggle = toggle;
            this.status = status;
            this.source = source;
            this.emptyText = emptyText;
            this.onPick = onPick || (() => {});
            this.onEdit = onEdit || (() => {});
            this.noun = noun || ['result', 'results'];
            this.options = [];
            this.active = -1;
            this.isOpen = false;
            this.enabled = true;
            this.announceTimer = 0;

            this.wrap = input.closest('.cb');
            this.pop = document.createElement('div');
            this.pop.className = 'cb-pop';
            this.pop.hidden = true;
            this.list = document.createElement('ul');
            this.list.className = 'cb-list';
            this.list.id = `${input.id}-list`;
            this.list.setAttribute('role', 'listbox');
            const label = document.querySelector(`label[for="${input.id}"]`);
            if (label) {
                if (!label.id) label.id = `${input.id}-label`;
                this.list.setAttribute('aria-labelledby', label.id);
            }
            this.empty = document.createElement('p');
            this.empty.className = 'cb-empty';
            this.pop.append(this.list, this.empty);
            this.wrap.append(this.pop);

            this.setEnabled(true);
            this.bind();
        }

        bind() {
            const input = this.input;
            input.addEventListener('input', () => {
                if (!this.enabled) return;
                this.onEdit();
                this.update(false);
            });
            input.addEventListener('click', () => {
                if (this.enabled && !this.isOpen) this.update(true);
            });
            input.addEventListener('keydown', e => this.onKey(e));
            input.addEventListener('blur', () => this.close());

            if (this.toggle) {
                this.toggle.addEventListener('pointerdown', e => e.preventDefault());
                this.toggle.addEventListener('click', () => {
                    if (!this.enabled || this.input.disabled) return;
                    if (this.isOpen) { this.close(); return; }
                    this.input.focus();
                    this.update(true);
                });
            }
            // Keep focus in the text box while choosing with a pointer.
            this.pop.addEventListener('pointerdown', e => e.preventDefault());
            this.list.addEventListener('click', e => {
                const li = e.target.closest('[role="option"]');
                if (li) this.pick(Number(li.dataset.index));
            });
            this.list.addEventListener('pointermove', e => {
                const li = e.target.closest('[role="option"]');
                if (li && Number(li.dataset.index) !== this.active) this.highlight(Number(li.dataset.index), false);
            });
        }

        onKey(e) {
            if (!this.enabled || e.isComposing) return;
            const n = this.options.length;
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    if (!this.isOpen) { this.update(true); if (!e.altKey && this.options.length && this.active < 0) this.highlight(0); return; }
                    if (n && !e.altKey) this.highlight(this.active < n - 1 ? this.active + 1 : 0);
                    break;
                case 'ArrowUp':
                    if (!this.isOpen) return;
                    e.preventDefault();
                    if (e.altKey) { this.close(); return; }
                    if (n) this.highlight(this.active > 0 ? this.active - 1 : n - 1);
                    break;
                case 'Enter': {
                    if (!this.isOpen) return;
                    e.preventDefault();
                    // With nothing highlighted, Enter takes the one unmistakable match, if there is one.
                    const i = this.active >= 0 ? this.active : this.options.findIndex(o => o.sure);
                    if (i >= 0) this.pick(i);
                    else this.close();
                    break;
                }
                case 'Escape':
                    if (!this.isOpen) return;
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                    break;
            }
        }

        update(showAll) {
            const text = this.input.value;
            this.showAll = showAll;
            this.options = this.source(text, showAll) || [];
            this.render(text);
            if (this.options.length || text.trim() || showAll) this.open();
            else this.close();
            const current = this.options.findIndex(o => o.current);
            if (this.isOpen && current >= 0) this.highlight(current);
            this.announce(text);
        }

        // Re-run the search, e.g. once a list has finished loading.
        refresh() {
            if (this.isOpen && this.enabled) this.update(this.showAll);
        }

        render(text) {
            const frag = document.createDocumentFragment();
            this.options.forEach((opt, i) => {
                const li = document.createElement('li');
                li.id = `${this.list.id}-${i}`;
                li.setAttribute('role', 'option');
                li.setAttribute('aria-selected', 'false');
                li.dataset.index = String(i);
                li.className = `cb-option${opt.kind ? ` is-${opt.kind}` : ''}${opt.divider ? ' has-divider' : ''}${opt.current ? ' is-current' : ''}`;
                const main = document.createElement('span');
                main.className = 'cb-main';
                const name = document.createElement('span');
                name.className = 'cb-name';
                const mark = opt.mark === undefined ? markRange(opt.label, text) : opt.mark;
                if (mark) {
                    const b = document.createElement('b');
                    b.textContent = opt.label.slice(mark[0], mark[1]);
                    name.append(opt.label.slice(0, mark[0]), b, opt.label.slice(mark[1]));
                } else {
                    name.textContent = opt.label;
                }
                main.append(name);
                if (opt.note) {
                    const note = document.createElement('span');
                    note.className = 'cb-note';
                    note.textContent = opt.note;
                    main.append(note);
                }
                li.append(main);
                if (opt.detail) {
                    const detail = document.createElement('span');
                    detail.className = 'cb-detail';
                    detail.textContent = opt.detail;
                    li.append(detail);
                }
                frag.append(li);
            });
            this.list.replaceChildren(frag);
            this.list.hidden = !this.options.length;
            const q = text.trim();
            const custom = this.emptyText && this.emptyText(q);
            this.empty.textContent = this.options.length ? '' : custom || (q ? `No ${this.noun[1]} match “${q}”.` : `Start typing to find your ${this.noun[0]}.`);
            this.empty.hidden = Boolean(this.options.length);
            this.active = -1;
            this.input.removeAttribute('aria-activedescendant');
            this.list.scrollTop = 0;
        }

        highlight(index, scroll = true) {
            const prev = this.list.children[this.active];
            if (prev) prev.setAttribute('aria-selected', 'false');
            this.active = index;
            const li = this.list.children[index];
            if (!li) { this.input.removeAttribute('aria-activedescendant'); return; }
            li.setAttribute('aria-selected', 'true');
            this.input.setAttribute('aria-activedescendant', li.id);
            if (scroll) li.scrollIntoView({ block: 'nearest' });
        }

        pick(index) {
            const opt = this.options[index];
            if (!opt) return;
            if (opt.value !== undefined) this.input.value = opt.value;
            this.close();
            this.onPick(opt);
        }

        open() {
            if (!this.isOpen) {
                this.isOpen = true;
                this.pop.hidden = false;
                this.wrap.classList.add('is-open');
                this.input.setAttribute('aria-expanded', 'true');
                if (this.toggle) this.toggle.setAttribute('aria-expanded', 'true');
            }
            this.place();
        }

        // Open upwards when there isn't room below (e.g. above a phone keyboard).
        place() {
            const view = root.visualViewport ? root.visualViewport.height : root.innerHeight;
            const rect = this.input.getBoundingClientRect();
            const below = view - rect.bottom;
            this.wrap.classList.toggle('opens-up', below < 220 && rect.top > below);
        }

        close() {
            this.active = -1;
            this.input.removeAttribute('aria-activedescendant');
            if (!this.isOpen) return;
            this.isOpen = false;
            this.pop.hidden = true;
            this.wrap.classList.remove('is-open');
            this.input.setAttribute('aria-expanded', 'false');
            if (this.toggle) this.toggle.setAttribute('aria-expanded', 'false');
        }

        announce(text) {
            if (!this.status) return;
            clearTimeout(this.announceTimer);
            this.announceTimer = setTimeout(() => {
                if (!this.isOpen) return;
                const listed = this.options.filter(o => o.kind !== 'typed').length;
                const typed = this.options.some(o => o.kind === 'typed');
                let msg = listed
                    ? `${listed} ${listed === 1 ? this.noun[0] : this.noun[1]} found. Use the up and down arrows to choose.`
                    : this.empty.textContent || `No ${this.noun[1]} match.`;
                if (typed) msg += ' You can also keep your own spelling.';
                this.status.textContent = text.trim() || listed ? msg : '';
            }, 450);
        }

        // In typed mode the box is a plain text field.
        setEnabled(on) {
            this.enabled = on;
            const input = this.input;
            if (on) {
                input.setAttribute('role', 'combobox');
                input.setAttribute('aria-autocomplete', 'list');
                input.setAttribute('aria-expanded', 'false');
                input.setAttribute('aria-controls', this.list.id);
            } else {
                this.close();
                ['role', 'aria-autocomplete', 'aria-expanded', 'aria-controls', 'aria-activedescendant'].forEach(a => input.removeAttribute(a));
            }
            if (this.toggle) {
                this.toggle.hidden = !on;
                this.toggle.setAttribute('aria-controls', this.list.id);
                this.toggle.setAttribute('aria-expanded', 'false');
            }
            this.wrap.classList.toggle('is-plain', !on);
        }
    }

    const api = { key, search, exact, markRange, prefixDistance, prepareCountries, prepareCities, loadCountries, loadCities, Combobox, LIMIT };
    if (root.VP) root.VP.places = api;
    if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
