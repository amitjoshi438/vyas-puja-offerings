/* Lays the offerings out into fixed pages in the browser, then the build prints them to PDF.
   Opening the generated HTML directly in a browser runs the same code, so what you see is what prints. */
(() => {
    const data = JSON.parse(document.getElementById('book-data').textContent);
    const opt = data.options;
    const book = document.getElementById('book');
    const status = document.querySelector('.status');
    const warnings = [];
    const SVGNS = 'http://www.w3.org/2000/svg';
    const raf = () => new Promise(r => requestAnimationFrame(() => r()));
    const say = msg => { if (status) status.textContent = msg; };

    const el = (tag, cls, html) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (html != null) n.innerHTML = html;
        return n;
    };
    const orn = (name, cls) => {
        const svg = document.createElementNS(SVGNS, 'svg');
        svg.setAttribute('class', `orn ${cls || name}`);
        svg.setAttribute('aria-hidden', 'true');
        const use = document.createElementNS(SVGNS, 'use');
        use.setAttribute('href', `#orn-${name}`);
        svg.append(use);
        return svg;
    };
    const roman = n => {
        const map = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
        let out = '';
        for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
        return out;
    };

    function makePage(kind, columns) {
        const page = el('section', `page ${kind}`);
        for (const c of ['tl', 'tr', 'bl', 'br']) page.append(orn('corner', `corner ${c}`));
        // The title page has its own lotus heading instead of the crest.
        if (!kind.includes('title-page')) page.append(orn('crest'));
        page.append(orn('foot'));
        const frame = el('div', 'frame');
        const cols = [];
        for (let i = 0; i < columns; i++) {
            if (i) frame.append(el('i', 'rule'));
            const col = el('div', 'col');
            frame.append(col);
            cols.push(col);
        }
        page.append(frame);
        return { page, cols };
    }

    function addFolio(page, text) {
        const f = el('div', 'folio');
        f.textContent = text;
        page.append(f);
    }

    // A column filler shared by the body and the contents.
    function Flow(kind, columns, host, before = null) {
        const pages = [];
        let cols = [];
        let ci = -1;
        let col = null;
        let limit = 0;
        const self = {
            pages,
            get col() { return col; },
            get limit() { return limit; },
            next() {
                ci++;
                if (ci >= cols.length) {
                    const p = makePage(kind, columns);
                    host.insertBefore(p.page, before);
                    pages.push(p.page);
                    cols = p.cols;
                    ci = 0;
                }
                col = cols[ci];
                limit = col.getBoundingClientRect().bottom + 0.5;
                return col;
            },
            fits(node = col.lastElementChild) {
                return !node || node.getBoundingClientRect().bottom <= limit;
            }
        };
        self.next();
        return self;
    }

    // ---------- splitting a paragraph across columns ----------

    function wordStarts(block) {
        const out = [];
        let gap = true;
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (n.nodeType === 1) {
                if (n.tagName === 'BR') gap = true;
                continue;
            }
            const s = n.data;
            for (let i = 0; i < s.length; i++) {
                const ws = /\s/.test(s[i]);
                if (!ws && gap) out.push([n, i]);
                gap = ws || s[i] === '\u00AD';
            }
        }
        return out;
    }

    function lineStarts(block) {
        const range = document.createRange();
        const lines = [];
        for (const [node, i] of wordStarts(block)) {
            const cp = node.data.codePointAt(i);
            range.setStart(node, i);
            range.setEnd(node, Math.min(node.data.length, i + (cp > 0xffff ? 2 : 1)));
            const r = range.getBoundingClientRect();
            if (!r.height) continue;
            const last = lines[lines.length - 1];
            if (!last || r.top >= last.bottom - 1) lines.push({ node, i, top: r.top, bottom: r.bottom });
            else {
                last.top = Math.min(last.top, r.top);
                last.bottom = Math.max(last.bottom, r.bottom);
            }
        }
        return lines;
    }

    function trimEdge(node, atEnd) {
        for (;;) {
            const child = atEnd ? node.lastChild : node.firstChild;
            if (!child) return;
            if (child.nodeType === 3) {
                const t = atEnd ? child.data.replace(/\s+$/, '') : child.data.replace(/^\s+/, '');
                if (t) { child.data = t; return; }
                child.remove();
            } else if (child.tagName === 'BR') {
                child.remove();
            } else {
                trimEdge(child, atEnd);
                if (!child.textContent.trim() && !child.querySelector('br')) child.remove();
                else return;
            }
        }
    }

    // A paragraph split inside a hyphenated word ends with an invisible soft hyphen; print a real one.
    function showHyphen(block) {
        const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        let last = null;
        for (let n = walker.nextNode(); n; n = walker.nextNode()) last = n;
        if (last && last.data.endsWith('\u00AD')) last.data = `${last.data.slice(0, -1)}-`;
    }

    // Moves the lines that do not fit into a new element and returns it, or null when fewer than minLines fit.
    function split(block, flow, minLines) {
        // Measure with the same greedy wrapping the split block will use, so its justified last line is a full line.
        block.classList.add('split');
        const lines = lineStarts(block);
        block.classList.remove('split');
        if (lines.length < 2) return null;
        const lh = parseFloat(getComputedStyle(block).lineHeight) || 16;
        const boxTop = l => l.top - Math.max(0, (lh - (l.bottom - l.top)) / 2);
        let fit = 0;
        while (fit + 1 < lines.length && boxTop(lines[fit + 1]) <= flow.limit) fit++;
        if (fit === lines.length - 1 && boxTop(lines[fit]) + lh <= flow.limit) fit = lines.length;
        if (fit >= lines.length) return null;
        if (lines.length - fit === 1 && fit >= 3) fit--;

        for (let keep = fit; keep >= minLines; keep--) {
            const at = lines[keep];
            const range = document.createRange();
            range.setStart(at.node, at.i);
            range.setEnd(block, block.childNodes.length);
            const frag = range.extractContents();
            block.classList.add('split');
            if (flow.fits(block)) {
                const tail = block.cloneNode(false);
                tail.removeAttribute('id');
                tail.classList.remove('split');
                tail.classList.add('cont');
                tail.append(frag);
                trimEdge(block, true);
                trimEdge(tail, false);
                showHyphen(block);
                return tail;
            }
            block.classList.remove('split');
            block.append(frag);
            block.normalize();
        }
        return null;
    }

    // ---------- body ----------

    function headFor(entry, letterMark) {
        const head = el('header', 'eh');
        if (letterMark) {
            const lm = el('h1', 'lm');
            lm.textContent = entry.letter;
            lm.id = `letter-${entry.letter}`;
            head.append(lm);
        }
        const nm = el('h2', 'nm');
        nm.id = `e-${entry.id}`;
        nm.textContent = entry.name;
        head.append(nm);
        if (entry.location) {
            const loc = el('p', 'loc');
            loc.textContent = entry.location;
            head.append(loc);
        }
        return head;
    }

    function blockFor(b) {
        const p = el('p', `b ${b.kind === 'p' ? '' : b.kind}`.trim(), b.html);
        if (b.lang) p.lang = b.lang;
        return p;
    }

    function separator() {
        const d = el('div', 'sep');
        d.setAttribute('aria-hidden', 'true');
        const svg = orn('divider');
        svg.removeAttribute('class');
        d.append(svg);
        return d;
    }

    function layBody() {
        const flow = Flow('body', opt.columns, book);
        let prevLetter = null;
        const placed = [];

        data.entries.forEach((entry, idx) => {
            if (idx % 40 === 0) say(`Laying out ${idx + 1} / ${data.entries.length} offerings…`);
            const mark = opt.letterMarks && entry.letter !== prevLetter;
            prevLetter = entry.letter;

            if (flow.col.childElementCount) {
                const sep = separator();
                flow.col.append(sep);
                if (!flow.fits()) { sep.remove(); flow.next(); }
            }
            const head = headFor(entry, mark);
            flow.col.append(head);
            if (!flow.fits()) {
                head.remove();
                const last = flow.col.lastElementChild;
                if (last && last.classList.contains('sep')) last.remove();
                flow.next();
                flow.col.append(head);
                if (!flow.fits()) warnings.push(`Heading taller than a column: ${entry.name}`);
            }

            let last = head;
            entry.blocks.forEach((b, bi) => {
                let node = blockFor(b);
                for (let guard = 0; guard < 400; guard++) {
                    flow.col.append(node);
                    if (flow.fits()) break;
                    const first = flow.col.firstElementChild;
                    const atTop = first === node || (first === head && node.previousElementSibling === head && bi === 0);
                    const tail = split(node, flow, atTop ? 1 : 2);
                    if (tail) {
                        flow.next();
                        node = tail;
                        continue;
                    }
                    if (atTop) {
                        warnings.push(`Block taller than a column was clipped: ${entry.name}`);
                        break;
                    }
                    node.remove();
                    if (bi === 0 && flow.col.lastElementChild === head) {
                        head.remove();
                        const prev = flow.col.lastElementChild;
                        if (prev && prev.classList.contains('sep')) prev.remove();
                        flow.next();
                        flow.col.append(head);
                        continue;
                    }
                    flow.next();
                }
                last = node;
            });
            placed.push({ entry, head, last });
        });

        flow.pages.forEach((page, i) => {
            page.dataset.folio = String(i + 1);
            addFolio(page, String(i + 1));
            const cols = page.querySelectorAll('.col');
            if (cols.length > 1 && !cols[cols.length - 1].childElementCount) page.classList.add('half');
        });
        const pageOf = node => Number(node.closest('.page').dataset.folio);
        return { pages: flow.pages, placed: placed.map(p => ({ ...p, page: pageOf(p.head.querySelector('.nm')), end: pageOf(p.last) })) };
    }

    // ---------- front matter ----------

    function titlePage(firstBody) {
        const { page, cols } = makePage('front title-page', 1);
        const f = cols[0].parentElement;
        f.innerHTML = '';
        const lotus = orn('lotus', 'tp-lotus');
        lotus.classList.remove('orn');
        f.append(lotus);
        const t = opt.title;
        f.append(el('p', 'tp-eyebrow', t.eyebrow));
        f.append(el('h1', 'tp-title', t.title));
        f.append(el('p', 'tp-for', t.subtitle));
        if (t.range) {
            const r = el('p', 'tp-range');
            const [a, b] = t.range;
            r.innerHTML = b && b !== a ? `${a}<span class="to" role="img" aria-label="to"></span>${b}` : a;
            f.append(r);
        }
        if (t.label) f.append(el('p', 'tp-label', t.label));
        f.append(el('p', 'tp-stats', t.stats));
        if (t.verse) f.append(el('div', 'tp-verse', t.verse));
        if (t.site) f.append(el('p', 'tp-site', t.site));
        book.insertBefore(page, firstBody);
        return page;
    }

    function contents(placed, firstBody) {
        const flow = Flow('front toc', 1, book, firstBody);
        const title = el('h1', 'toc-title', 'Contents');
        flow.col.append(title);
        const orment = separator();
        orment.className = 'toc-orn sep';
        flow.col.append(orment);
        let letter = null;
        for (const { entry, page } of placed) {
            const items = [];
            if (opt.letterMarks && entry.letter !== letter) {
                letter = entry.letter;
                const h = el('div', 'toc-letter');
                h.textContent = letter;
                items.push(h);
            }
            const a = el('a', 'toc-e');
            a.href = `#e-${entry.id}`;
            const t = el('span', 't');
            t.textContent = entry.name;
            a.append(t, el('span', 'p'));
            a.lastChild.textContent = String(page);
            items.push(a);

            items.forEach(n => flow.col.append(n));
            if (!flow.fits()) {
                items.forEach(n => n.remove());
                const prev = flow.col.lastElementChild;
                if (prev && prev.classList.contains('toc-letter')) { prev.remove(); items.unshift(prev); }
                flow.next();
                items.forEach(n => flow.col.append(n));
            }
        }
        return flow.pages;
    }

    async function loadFonts() {
        say('Loading fonts…');
        const chars = [...new Set(data.entries.map(e => e.name + e.location + e.blocks.map(b => b.html.replace(/<[^>]+>/g, '')).join('')).join(''))]
            .filter(c => c.trim()).join('');
        const sample = chars + (opt.title.verse || '').replace(/<[^>]+>/g, '') + 'Contents0123456789ivxlcdm–';
        const indic = ['Devanagari', 'Telugu', 'Bengali', 'Oriya', 'Gujarati', 'Kannada', 'Tamil', 'Malayalam', 'Gurmukhi'];
        const specs = [
            '400 16px Newsreader', 'italic 400 16px Newsreader', '600 16px Newsreader', 'italic 600 16px Newsreader', '500 16px Newsreader',
            '500 16px Eczar', '600 16px Eczar', '400 16px "Tiro Devanagari Sanskrit"', 'italic 400 16px "Tiro Devanagari Sanskrit"',
            '400 16px "Noto Serif"', '600 16px "Noto Serif"', 'italic 400 16px "Noto Serif"',
            ...indic.flatMap(s => [`400 16px "Noto Serif ${s}"`, `600 16px "Noto Serif ${s}"`])
        ];
        await Promise.all(specs.map(s => document.fonts.load(s, sample).catch(() => [])));
        await document.fonts.ready;
        const missing = ['Newsreader', 'Eczar'].filter(f => ![...document.fonts].some(ff => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded'));
        if (missing.length) warnings.push(`Web fonts not loaded (${missing.join(', ')}); a fallback font was used. Check the internet connection.`);
    }

    async function run() {
        await loadFonts();
        await raf();
        await raf();
        const t0 = performance.now();
        const body = layBody();
        const firstBody = body.pages[0];
        say('Building contents…');
        const front = [];
        if (opt.titlePage) front.push(titlePage(firstBody));
        if (opt.contents) front.push(...contents(body.placed, firstBody));
        front.forEach((page, i) => {
            if (page.classList.contains('title-page')) return;
            addFolio(page, roman(i + 1));
        });

        const letterPages = {};
        for (const p of body.placed) {
            const l = letterPages[p.entry.letter] || (letterPages[p.entry.letter] = { first: p.page, last: p.end, entries: 0 });
            l.last = Math.max(l.last, p.end);
            l.entries++;
        }
        window.__book = {
            ok: true,
            bodyPages: body.pages.length,
            frontPages: front.length,
            entries: body.placed.length,
            letterPages,
            warnings,
            ms: Math.round(performance.now() - t0)
        };
        if (status) { status.textContent = `${front.length + body.pages.length} pages`; status.classList.add('done'); }
        document.documentElement.dataset.ready = 'true';
    }

    const start = () => run().catch(err => {
        console.error(err);
        window.__book = { ok: false, error: String(err && err.stack || err), warnings };
        say(`Layout failed: ${err}`);
    });
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
})();
