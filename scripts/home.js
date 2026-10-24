// ============================================
// Home page: the sanctum garlands, stats, names strip, year cards
// Festoons of flowers hang across the top of the hero, two garlanded pillars flank Maharaj, and he
// sits on a seat of flowers. The flowers on the pillars stand for the most recent offerings.
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    if (!VP) return;

    const TAU = Math.PI * 2;
    const COUNTRY_ALIASES = {
        'usa': 'united states', 'us': 'united states', 'u s a': 'united states', 'united states of america': 'united states', 'america': 'united states',
        'uk': 'united kingdom', 'u k': 'united kingdom', 'england': 'united kingdom', 'great britain': 'united kingdom', 'britain': 'united kingdom', 'scotland': 'united kingdom', 'wales': 'united kingdom',
        'bharat': 'india', 'bharath': 'india', 'maharashtra': 'india',
        'uae': 'united arab emirates', 'dubai': 'united arab emirates'
    };

    const state = { years: [], all: [] };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        renderYearCards(null);
        renderSubmissionStatus();
        const garland = createGarland(renderGarlandNote);

        const results = await VP.loadAllYears();
        const byYear = new Map(results.map(r => [r.year, r]));
        state.years = VP.years.map(y => {
            const r = byYear.get(y.year) || {};
            return { ...y, offerings: r.offerings || [], failed: !!(r.errors && r.errors.length) };
        });
        state.all = state.years.flatMap(y => y.offerings);

        renderStats();
        renderNameStrip();
        renderYearCards(state.years);
        if (garland) garland.setYears(state.years);
        else renderGarlandNote({ assigned: 0, total: state.all.length });
    }

    // ---------- Helpers ----------
    // A fixed, repeatable scramble, so no name is favoured by its first letter
    function hashKey(value) {
        let h = 2166136261;
        const s = String(value);
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    // Newest first where a date is known; otherwise a fixed scramble (not A to Z)
    function recentOrder(offerings) {
        const stamp = o => {
            const t = Date.parse(o.submittedAt || '');
            return Number.isFinite(t) ? t : 0;
        };
        return offerings.slice().sort((a, b) => (stamp(b) - stamp(a)) || (hashKey(a.id) - hashKey(b.id)));
    }

    function normKey(value) {
        return String(value || '').toLowerCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function countryKey(value) {
        const k = normKey(value);
        return COUNTRY_ALIASES[k] || k;
    }

    function shuffle(list) {
        const a = list.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function countUp(el, target) {
        if (!el) return;
        if (VP.prefersReducedMotion() || target < 10) {
            el.textContent = VP.formatNumber(target);
            return;
        }
        const duration = 1600;
        const start = performance.now();
        const tick = now => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 4);
            el.textContent = VP.formatNumber(Math.round(target * eased));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    // ---------- Stats ----------
    function renderStats() {
        const countries = new Set();
        const cities = new Set();
        state.all.forEach(o => {
            if (o.country) countries.add(countryKey(o.country));
            if (o.city) cities.add(normKey(o.city) + '|' + countryKey(o.country));
        });
        countUp(document.getElementById('stat-offerings'), state.all.length);
        countUp(document.getElementById('stat-countries'), countries.size);
        countUp(document.getElementById('stat-cities'), cities.size);
    }

    // ---------- Strip of names ----------
    function renderNameStrip() {
        const track = document.getElementById('name-track');
        if (!track) return;
        const current = state.years[0];
        const pool = current && current.offerings.length >= 24 ? current.offerings : state.all;
        if (!pool.length) {
            track.closest('.name-strip').hidden = true;
            return;
        }
        const picks = shuffle(pool).slice(0, 36);
        const html = picks.map(o => `
            <a class="name-item" href="${VP.offeringUrl(o)}" tabindex="-1">
                <span><b>${VP.escapeHtml(o.name)}</b>${o.city || o.country ? `<small>${VP.escapeHtml(o.city || o.country)}</small>` : ''}</span>
            </a>`).join('');
        // Two identical halves → seamless translateX(-50%) loop
        track.innerHTML = html + html;
        track.style.animationDuration = `${Math.max(60, picks.length * 3.4)}s`;
    }

    // ---------- Submission status ----------
    function renderSubmissionStatus() {
        const el = document.getElementById('submission-status');
        if (!el) return;
        const cy = VP.currentYear();
        if (!cy) { el.hidden = true; return; }
        const open = VP.isSubmissionOpen(cy) && VP.hasEndpoint();
        let label;
        if (open && cy.closesOn) {
            const d = new Date(cy.closesOn + 'T00:00:00');
            label = `Receiving offerings until ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
        } else if (open) {
            label = `Receiving offerings for ${cy.year}`;
        } else if (VP.isSubmissionOpen(cy)) {
            label = `Offerings for ${cy.year} open soon`;
        } else {
            label = `Offerings for ${cy.year} are closed`;
        }
        el.innerHTML = `<span class="status-dot${open ? '' : ' is-closed'}"></span><span>${VP.escapeHtml(label)}</span>`;
    }

    // ---------- Year cards ----------
    function renderYearCards(years) {
        const wrap = document.getElementById('year-cards');
        if (!wrap) return;
        const list = years || VP.years.map(y => ({ ...y, offerings: null }));
        const cards = list.map(y => {
            const count = y.offerings ? y.offerings.length : null;
            const open = VP.isSubmissionOpen(y) && VP.hasEndpoint();
            const empty = count === 0;
            const href = empty && open ? 'offer.html' : `offerings.html?year=${y.year}`;
            let badge;
            if (open) badge = '<span class="yc-badge">Receiving offerings</span>';
            else if (y.year === VP.config.currentYear) badge = '<span class="yc-badge">This year</span>';
            else badge = '<span class="yc-badge is-archive">Archive</span>';
            let foot;
            if (count === null) foot = 'Gathering…';
            else if (empty && y.failed) foot = 'Couldn’t load just now · reload to try again';
            else if (empty && open) foot = 'Be the first to offer';
            else if (empty) foot = 'Offerings coming soon';
            else foot = `${VP.formatNumber(count)} offering${count === 1 ? '' : 's'}`;
            return `
                <a class="year-card" href="${href}" data-reveal>
                    ${badge}
                    <span class="yc-year">${y.year}</span>
                    <span class="yc-edition">${VP.ordinal(y.edition)} Vyāsa Pūjā</span>
                    <span class="yc-foot"><span>${foot}</span><span class="arrow" aria-hidden="true">→</span></span>
                </a>`;
        });
        cards.push(`
            <a class="year-card is-lectures" href="lectures.html" data-reveal>
                <span class="yc-badge is-archive">Hear</span>
                <span class="yc-year" lang="sa">श्रवणम्</span>
                <span class="yc-edition">Lectures by Maharaj</span>
                <span class="yc-foot"><span>Listen to the series</span><span class="arrow" aria-hidden="true">→</span></span>
            </a>`);
        const wasVisible = wrap.querySelector('.is-visible');
        wrap.innerHTML = cards.join('');
        if (wasVisible) wrap.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
        else VP.initReveal(wrap);
    }

    // ---------- What the garlands tell everyone ----------
    function renderGarlandNote(info) {
        const touch = window.matchMedia('(hover: none)').matches;
        const sr = document.getElementById('garland-sr');
        if (sr) {
            sr.textContent = 'Garlands of marigold, rose and jasmine hang across the top, and two garlanded pillars stand beside Maharaj’s portrait.'
                + (info.assigned ? ` The flowers on the pillars stand for the most recent offerings. ${VP.formatNumber(info.total)} have been published in all, and you can read them on the Offerings page.` : '');
        }
        const hint = document.getElementById('garland-hint');
        if (hint) {
            hint.textContent = `The flowers on the two pillars are recent offerings — ${touch ? 'tap' : 'hover'} one to see whose.`;
            hint.hidden = !info.assigned;
        }
        const note = document.getElementById('hero-note');
        if (note) {
            const failed = !info.total && state.years.some(y => y.failed);
            note.textContent = failed ? 'The offerings could not be loaded just now. Please reload the page to try again.' : '';
            note.hidden = !failed;
        }
    }

    // ---------- The sanctum garlands ----------
    function createGarland(onChange) {
        const hero = document.getElementById('hero');
        const back = document.getElementById('hero-garland');
        const front = document.getElementById('hero-garland-front');
        const stage = document.getElementById('hero-stage');
        const portrait = document.getElementById('hero-portrait');
        const tip = document.getElementById('flower-tip');
        if (!hero || !back || !back.getContext || !stage || !portrait) return null;

        const bctx = back.getContext('2d');
        const fctx = front ? front.getContext('2d') : null;
        const reduced = VP.prefersReducedMotion();
        const sprites = new Map();
        const SPR = 112;
        const KINDS = [
            { id: 'orange', weight: 34, shape: 'pom', color: '#F08A1C' },
            { id: 'yellow', weight: 26, shape: 'pom', color: '#F7C52C' },
            { id: 'rose', weight: 13, shape: 'rose', color: '#E0557F' },
            { id: 'red', weight: 7, shape: 'rose', color: '#C2332A' },
            { id: 'jasmine', weight: 20, shape: 'jasmine', color: '#FFFBEF' }
        ];
        const KIND_WEIGHT = KINDS.reduce((sum, k) => sum + k.weight, 0);
        const KNOT = { id: 'knot', shape: 'pom', color: '#F08A1C' };
        const KNOT_ROSE = { id: 'knotrose', shape: 'rose', color: '#C2332A' };

        let W = 0, H = 0, dpr = 1, mobile = false;
        let cx = 0, pw = 0, ph = 0, py = 0, gap = 14, pillarW = 60, S = 3;
        let D = 24, Df = 22, Ds = 26, valance = 24, hemY = 0, floorY = 0;
        let y0 = 0, span = 0, depth = 0, swagN = 3;
        let pillars = [], metas = [], offerings = [], assigned = 0;
        let base = null;
        let startT = 0, running = false, inView = true, rafId = 0;
        let hovered = null, touchPinned = null;

        function mulberry(seed) {
            let a = seed;
            return function () {
                a |= 0; a = a + 0x6D2B79F5 | 0;
                let t = Math.imul(a ^ a >>> 15, 1 | a);
                t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
                return ((t ^ t >>> 14) >>> 0) / 4294967296;
            };
        }
        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
        const easeOut = t => 1 - Math.pow(1 - t, 3);
        const easeOutBack = t => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

        function pickKind(rnd) {
            let r = rnd() * KIND_WEIGHT;
            for (const k of KINDS) {
                r -= k.weight;
                if (r <= 0) return k;
            }
            return KINDS[0];
        }

        function shade(hex, amount) {
            const n = parseInt(hex.slice(1), 16);
            const target = amount >= 0 ? 255 : 0;
            const k = Math.abs(amount);
            const mix = v => Math.round(v + (target - v) * k);
            return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
        }

        // ---------- Flower drawings ----------
        function drawPom(g, color, R, v) {
            const layers = [
                { n: 14, len: 1, tone: -0.1, turn: 0 },
                { n: 12, len: 0.78, tone: 0.08, turn: Math.PI / 12 },
                { n: 9, len: 0.56, tone: 0.28, turn: 0.2 },
                { n: 6, len: 0.34, tone: 0.45, turn: 0.5 }
            ];
            layers.forEach((L, li) => {
                const len = R * L.len;
                const half = Math.max(2.2, len * Math.sin(Math.PI / L.n) * 1.08);
                g.fillStyle = shade(color, L.tone);
                g.strokeStyle = shade(color, L.tone - 0.34);
                g.lineWidth = 1;
                for (let i = 0; i < L.n; i++) {
                    g.save();
                    g.rotate(L.turn + v * (0.37 + li * 0.11) + (i / L.n) * TAU);
                    g.beginPath();
                    g.ellipse(0, -len * 0.52, half, len * 0.5, 0, 0, TAU);
                    g.fill();
                    g.stroke();
                    g.restore();
                }
            });
            g.fillStyle = shade(color, -0.5);
            g.beginPath();
            g.arc(0, 0, R * 0.12, 0, TAU);
            g.fill();
        }

        function drawRose(g, color, R, v) {
            g.lineWidth = 1;
            g.fillStyle = shade(color, -0.06);
            g.strokeStyle = shade(color, -0.42);
            for (let i = 0; i < 5; i++) {
                const a = v * 0.5 + (i / 5) * TAU;
                g.beginPath();
                g.arc(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.52, 0, TAU);
                g.fill();
                g.stroke();
            }
            [0, 0.1, 0.2, 0.3].forEach((tone, i) => {
                const r = R * (0.74 - i * 0.16);
                const a = v * 0.7 + i * 1.9;
                const ox = Math.cos(a) * R * 0.06;
                const oy = Math.sin(a) * R * 0.06;
                g.fillStyle = shade(color, tone);
                g.beginPath();
                g.arc(ox, oy, r, 0, TAU);
                g.fill();
                g.strokeStyle = shade(color, -0.45);
                g.beginPath();
                g.arc(ox, oy, r * 0.8, a, a + Math.PI * 1.25);
                g.stroke();
            });
        }

        function drawJasmine(g, color, R, v) {
            g.lineWidth = 1;
            g.fillStyle = color;
            g.strokeStyle = '#cfa968';
            for (let i = 0; i < 5; i++) {
                g.save();
                g.rotate(v * 0.4 + (i / 5) * TAU);
                g.beginPath();
                g.ellipse(0, -R * 0.5, R * 0.37, R * 0.52, 0, 0, TAU);
                g.fill();
                g.stroke();
                g.restore();
            }
            g.fillStyle = '#E9B544';
            g.beginPath();
            g.arc(0, 0, R * 0.16, 0, TAU);
            g.fill();
        }

        function flowerSprite(kind, variant) {
            const key = kind.id + variant;
            if (sprites.has(key)) return sprites.get(key);
            const R = SPR / 2 - 10;
            const flat = document.createElement('canvas');
            flat.width = flat.height = SPR;
            const f = flat.getContext('2d');
            f.translate(SPR / 2, SPR / 2);
            if (kind.shape === 'pom') drawPom(f, kind.color, R, variant);
            else if (kind.shape === 'rose') drawRose(f, kind.color, R, variant);
            else drawJasmine(f, kind.color, R, variant);
            const c = document.createElement('canvas');
            c.width = c.height = SPR;
            const g = c.getContext('2d');
            g.shadowColor = 'rgba(20, 4, 2, 0.6)';
            g.shadowBlur = 6;
            g.shadowOffsetY = 3;
            g.drawImage(flat, 0, 0);
            sprites.set(key, c);
            return c;
        }

        function leafSprite() {
            if (sprites.has('leaf')) return sprites.get('leaf');
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            g.translate(size / 2, size * 0.64);
            [-1, 1].forEach(side => {
                g.save();
                g.rotate(side * 0.72);
                g.beginPath();
                g.moveTo(0, 0);
                g.bezierCurveTo(10, -7, 10, -25, 0, -32);
                g.bezierCurveTo(-10, -25, -10, -7, 0, 0);
                g.fillStyle = '#5e9246';
                g.fill();
                g.strokeStyle = 'rgba(20, 44, 16, .8)';
                g.lineWidth = 1;
                g.stroke();
                g.beginPath();
                g.moveTo(0, -2);
                g.lineTo(0, -25);
                g.strokeStyle = 'rgba(214, 240, 180, .6)';
                g.stroke();
                g.restore();
            });
            sprites.set('leaf', c);
            return c;
        }

        function glowSprite(rgb) {
            const key = 'glow' + rgb;
            if (sprites.has(key)) return sprites.get(key);
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, `rgba(${rgb}, 0.8)`);
            grad.addColorStop(0.5, `rgba(${rgb}, 0.22)`);
            grad.addColorStop(1, `rgba(${rgb}, 0)`);
            g.fillStyle = grad;
            g.fillRect(0, 0, size, size);
            sprites.set(key, c);
            return c;
        }

        function stamp(g, kind, variant, x, y, size) {
            g.drawImage(flowerSprite(kind, variant), x - size / 2, y - size / 2, size, size);
        }

        // ---------- Measuring ----------
        // Position of an element in hero coordinates (offset-based, so entry transforms don't skew it)
        function offsetBox(node) {
            let x = 0, y = 0, el = node;
            while (el && el !== hero) {
                x += el.offsetLeft;
                y += el.offsetTop;
                el = el.offsetParent;
            }
            return { x, y, w: node.offsetWidth, h: node.offsetHeight };
        }

        function swagY(x) {
            const i = Math.min(swagN - 1, Math.max(0, Math.floor(x / span)));
            const t = (x - i * span) / span;
            return y0 + depth * 4 * t * (1 - t);
        }

        function swagCurve(i) {
            const pts = [];
            let len = 0;
            const STEPS = 140;
            for (let k = 0; k <= STEPS; k++) {
                const t = k / STEPS;
                const x = i * span + span * t;
                const y = y0 + depth * 4 * t * (1 - t);
                if (k) len += Math.hypot(x - pts[k - 1].x, y - pts[k - 1].y);
                pts.push({ x, y, s: len });
            }
            return { pts, len };
        }

        // Points at equal spacing along a curve, with the normal at each
        function walk(curve, spacing, margin) {
            const out = [];
            const { pts, len } = curve;
            const usable = len - margin * 2;
            const n = Math.max(0, Math.floor(usable / spacing));
            if (!n) return out;
            const step = usable / n;
            let k = 0;
            for (let m = 0; m < n; m++) {
                const target = margin + (m + 0.5) * step;
                while (k < pts.length - 2 && pts[k + 1].s < target) k++;
                const a = pts[k], b = pts[k + 1];
                const f = b.s > a.s ? (target - a.s) / (b.s - a.s) : 0;
                const tx = b.x - a.x, ty = b.y - a.y, tl = Math.hypot(tx, ty) || 1;
                out.push({ x: a.x + tx * f, y: a.y + ty * f, nx: -ty / tl, ny: tx / tl });
            }
            return out;
        }

        function measure() {
            const rect = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(rect.width));
            H = Math.max(1, Math.round(rect.height));
            dpr = Math.min(2, window.devicePixelRatio || 1);
            [back, front].forEach(c => { if (c) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); } });

            mobile = W < 960;
            const s = offsetBox(stage);
            const p = offsetBox(portrait);
            pw = p.w;
            ph = p.h;
            py = p.y;
            cx = p.x + pw / 2;
            gap = mobile ? 6 : 14;
            pillarW = Math.max(28, (s.w - pw) / 2 - gap);
            S = pillarW >= 72 ? 3 : 2;
            D = clamp(pillarW / (0.9 * S + 0.1), 13, mobile ? 28 : 30);
            Df = mobile ? clamp(W / 19, 17, 21) : clamp(W / 50, 20, 27);
            Ds = Df * 1.15;
            const v = parseFloat(getComputedStyle(hero).getPropertyValue('--valance-h'));
            valance = Number.isFinite(v) ? v : 24;
            hemY = py + ph * 0.955;
            floorY = hemY + 4;

            y0 = valance + 8;
            swagN = Math.max(3, Math.round(W / (mobile ? 150 : 240)));
            span = W / swagN;
            depth = clamp(span * 0.2, 20, 50);
        }

        // ---------- Building ----------
        function buildPillars(rnd) {
            pillars = [];
            metas = [];
            const pitchY = D * 0.84;
            [-1, 1].forEach(side => {
                const pcx = cx + side * (pw / 2 + gap + pillarW / 2);
                const top = swagY(pcx) + Df * 0.95;
                const bottom = floorY + 6;
                const meta = { x: pcx, top, bottom, side, strands: [] };
                for (let si = 0; si < S; si++) {
                    const sx = pcx + (si - (S - 1) / 2) * 0.9 * D;
                    const items = [];
                    const n = Math.max(1, Math.floor((bottom - top) / pitchY));
                    for (let r = 0; r < n; r++) {
                        const y = top + r * pitchY + (si % 2) * pitchY * 0.5;
                        if (y > bottom) break;
                        const f = {
                            x: sx, y, sx, sy: y, side, si, r,
                            kind: pickKind(rnd), variant: Math.floor(rnd() * 3), size: 0.96 + rnd() * 0.1,
                            phase: rnd() * TAU, delay: 600 + r * 32 + (side > 0 ? 45 : 0) + si * 22,
                            off: null, life: 0
                        };
                        items.push(f);
                        pillars.push(f);
                    }
                    meta.strands.push({ x: sx, items });
                }
                metas.push(meta);
            });
        }

        function assign() {
            pillars.forEach(f => { f.off = null; });
            const order = pillars.slice().sort((a, b) => (a.r - b.r) || (a.side - b.side) || (a.si - b.si));
            offerings.forEach((o, i) => { if (order[i]) order[i].off = o; });
            assigned = Math.min(order.length, offerings.length);
        }

        function seatRows(rnd) {
            const seatW = pw * 1.1;
            const rows = [
                { y: hemY - 30, w: 0.62, front: false },
                { y: hemY - 17, w: 0.82, front: false },
                { y: hemY - 3, w: 0.98, front: true },
                { y: hemY + 11, w: 1.06, front: true }
            ];
            return rows.map(row => {
                const half = (seatW * row.w) / 2;
                const step = Ds * 0.78;
                const n = Math.max(3, Math.round((half * 2) / step));
                const items = [];
                for (let i = 0; i < n; i++) {
                    const dx = ((i + 0.5) / n - 0.5) * 2 * half;
                    const arch = (dx / half) * (dx / half);
                    items.push({ x: cx + dx + (rnd() - 0.5) * 3, y: row.y - arch * 9 + (rnd() - 0.5) * 3, kind: pickKind(rnd), v: Math.floor(rnd() * 3), size: Ds * (0.98 + rnd() * 0.12) });
                }
                return { front: row.front, items };
            });
        }

        function drawRosette(g, x, y, size) {
            stamp(g, KNOT, 1, x, y, size);
            stamp(g, KNOT_ROSE, 0, x, y, size * 0.52);
        }

        function drawTassel(g, x, y) {
            g.strokeStyle = '#d6a24a';
            g.fillStyle = '#d6a24a';
            g.lineWidth = 1;
            g.beginPath();
            g.moveTo(x, y); g.lineTo(x - 2.6, y + 9);
            g.moveTo(x, y); g.lineTo(x, y + 10);
            g.moveTo(x, y); g.lineTo(x + 2.6, y + 9);
            g.stroke();
            g.beginPath();
            g.arc(x, y, 2.8, 0, TAU);
            g.fill();
        }

        function drawRibbons(g, x, y, len) {
            g.lineWidth = 1;
            [-1, 1].forEach(sd => {
                g.beginPath();
                g.moveTo(x + sd * 3, y + 6);
                g.lineTo(x + sd * 13, y + 6);
                g.lineTo(x + sd * 21, y + len);
                g.lineTo(x + sd * 14, y + len - 7);
                g.lineTo(x + sd * 7, y + len + 2);
                g.closePath();
                g.fillStyle = '#b3261e';
                g.fill();
                g.strokeStyle = '#d6a24a';
                g.stroke();
            });
        }

        // Everything that does not move: the festoons, the tassels, the pillar caps and the back of the seat
        function buildBase(rnd, seat) {
            base = document.createElement('canvas');
            base.width = back.width;
            base.height = back.height;
            const g = base.getContext('2d');
            g.scale(dpr, dpr);

            const curves = [];
            for (let i = 0; i < swagN; i++) curves.push(swagCurve(i));

            g.lineCap = 'round';
            g.lineWidth = 1.5;
            g.strokeStyle = 'rgba(242, 209, 140, .7)';
            curves.forEach(c => {
                g.beginPath();
                c.pts.forEach((pt, k) => { if (k) g.lineTo(pt.x, pt.y); else g.moveTo(pt.x, pt.y); });
                g.stroke();
            });

            // Leaves peep out behind the flowers
            const leaf = leafSprite();
            const ls = Df * 1.7;
            curves.forEach(c => {
                walk(c, Df * 2.6, 16).forEach((pt, m) => {
                    g.save();
                    g.translate(pt.x + pt.nx * Df * 0.5, pt.y + pt.ny * Df * 0.5);
                    g.rotate(Math.atan2(pt.ny, pt.nx) + Math.PI / 2 + (m % 2 ? 0.4 : -0.4));
                    g.drawImage(leaf, -ls / 2, -ls * 0.64, ls, ls);
                    g.restore();
                });
            });

            // A thick mala: two rows of flowers, interleaved
            curves.forEach(c => {
                walk(c, Df * 0.74, 20).forEach((pt, m) => {
                    const off = (m % 2 ? 1 : -1) * Df * 0.26;
                    stamp(g, pickKind(rnd), Math.floor(rnd() * 3), pt.x + pt.nx * off, pt.y + pt.ny * off, Df * (0.98 + rnd() * 0.1));
                });
            });

            // Hanging strands and silk at each junction (never across the words)
            const words = [hero.querySelector('.hero-heading'), hero.querySelector('.hero-side')]
                .filter(Boolean)
                .map(offsetBox);
            for (let i = 0; i <= swagN; i++) {
                const x = i * span;
                const ribbonLen = mobile ? 30 : 42;
                drawRibbons(g, x, y0 + 2, ribbonLen);
                const clear = metas.every(m => Math.abs(x - m.x) > pillarW / 2 + Df)
                    && (mobile || words.every(b => x < b.x - 10 || x > b.x + b.w + 10 || y0 + 8 + 100 < b.y - 6));
                if (i > 0 && i < swagN && clear) {
                    const len = (i % 2 ? 80 : 56) * (mobile ? 0.8 : 1);
                    const size = Df * 0.8;
                    const n = Math.floor(len / (size * 0.78));
                    g.strokeStyle = 'rgba(242, 209, 140, .7)';
                    g.beginPath();
                    g.moveTo(x, y0 + 8);
                    g.lineTo(x, y0 + 8 + len);
                    g.stroke();
                    for (let k = 0; k < n; k++) stamp(g, pickKind(rnd), Math.floor(rnd() * 3), x, y0 + 14 + k * size * 0.78, size);
                    drawTassel(g, x, y0 + 12 + n * size * 0.78);
                }
                drawRosette(g, x, y0 + 2, Df * 1.9);
            }

            // A rosette caps each pillar where it hangs from the festoon
            metas.forEach(m => drawRosette(g, m.x, m.top - Df * 0.6, Df * 1.7));

            // The glow of the lamps beneath, and the back of the seat of flowers
            g.save();
            g.globalCompositeOperation = 'lighter';
            const gw = pw * 0.8;
            g.translate(cx, hemY + 8);
            g.scale(1, 0.18);
            const grad = g.createRadialGradient(0, 0, 0, 0, 0, gw);
            grad.addColorStop(0, 'rgba(255, 175, 70, .55)');
            grad.addColorStop(1, 'rgba(255, 175, 70, 0)');
            g.fillStyle = grad;
            g.beginPath();
            g.arc(0, 0, gw, 0, TAU);
            g.fill();
            g.restore();
            seat.filter(r => !r.front).forEach(r => r.items.forEach(f => stamp(g, f.kind, f.v, f.x, f.y, f.size)));
        }

        // The front of the seat lies over the hem of his robe, so it is drawn above the portrait
        function paintFront(seat) {
            if (!fctx) return;
            fctx.setTransform(1, 0, 0, 1, 0, 0);
            fctx.clearRect(0, 0, front.width, front.height);
            fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            seat.filter(r => r.front).forEach(r => r.items.forEach(f => stamp(fctx, f.kind, f.v, f.x, f.y, f.size)));
            // A few loose flowers rest on the floor beside the seat
            const rnd = mulberry(31);
            for (let i = 0; i < 7; i++) {
                const side = i % 2 ? 1 : -1;
                stamp(fctx, pickKind(rnd), i % 3, cx + side * (pw * 0.62 + i * Ds * 0.4), hemY + 20 + (i % 3) * 3, Ds * 0.8);
            }
        }

        function layout() {
            measure();
            const seat = seatRows(mulberry(5));
            buildPillars(mulberry(11));
            assign();
            buildBase(mulberry(19), seat);
            paintFront(seat);
            if (onChange && offerings.length) onChange({ assigned, total: offerings.total || offerings.length });
            if (!running) draw(performance.now());
        }

        function setYears(list) {
            const total = list.reduce((sum, y) => sum + y.offerings.length, 0);
            // Newest year first; within a year, newest first (else a fixed scramble)
            offerings = list.flatMap(y => recentOrder(y.offerings));
            offerings.total = total;
            assign();
            if (onChange) onChange({ assigned, total });
            startT = performance.now();
            start();
            if (!running) draw(performance.now());
        }

        // ---------- Drawing ----------
        function draw(now) {
            const el = reduced ? Infinity : now - startT;
            bctx.setTransform(1, 0, 0, 1, 0, 0);
            bctx.clearRect(0, 0, back.width, back.height);
            bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            const rv = reduced ? 1 : easeOut(clamp(el / 1300, 0, 1));
            bctx.globalAlpha = rv;
            if (base) bctx.drawImage(base, 0, (1 - rv) * -16, W, H);
            bctx.globalAlpha = 1;
            if (!pillars.length) return;

            // The strands sway a little, as if in a breeze
            metas.forEach(m => {
                const len = Math.max(1, m.bottom - m.top);
                m.strands.forEach(st => {
                    st.items.forEach(f => {
                        const k = (f.y - m.top) / len;
                        f.sx = f.x + (reduced ? 0 : Math.sin(now * 0.0011 + f.si * 0.8 + m.side * 1.3) * D * 0.14 * k * k);
                        f.sy = f.y;
                    });
                });
            });

            // Threads, then a faint glow, then the flowers
            bctx.lineWidth = 1.2;
            bctx.strokeStyle = 'rgba(242, 209, 140, .65)';
            bctx.beginPath();
            metas.forEach(m => m.strands.forEach(st => {
                st.items.forEach((f, k) => { if (k) bctx.lineTo(f.sx, f.sy); else bctx.moveTo(f.sx, m.top - Df * 0.4); });
            }));
            bctx.stroke();
            metas.forEach(m => m.strands.forEach(st => {
                const last = st.items[st.items.length - 1];
                if (last) drawTassel(bctx, last.sx, last.sy + D * 0.7);
            }));

            bctx.globalCompositeOperation = 'lighter';
            const glow = glowSprite('255, 176, 80');
            for (const f of pillars) {
                f.life = clamp((el - f.delay) / 600, 0, 1);
                if (f.life <= 0 || !f.off) continue;
                const s = D * 2.6 * f.life;
                bctx.globalAlpha = 0.32;
                bctx.drawImage(glow, f.sx - s / 2, f.sy - s / 2, s, s);
            }
            bctx.globalCompositeOperation = 'source-over';

            const leaf = leafSprite();
            for (const f of pillars) {
                if (f.life <= 0 || f.si !== 0 || f.r % 3 !== 1) continue;
                bctx.globalAlpha = f.life;
                bctx.save();
                bctx.translate(f.sx + (f.side > 0 ? 1 : -1) * D * 0.55, f.sy + D * 0.3);
                bctx.rotate(Math.PI / 2 * (f.side > 0 ? 1 : -1) + 0.3);
                bctx.drawImage(leaf, -D * 0.8, -D * 1.0, D * 1.6, D * 1.6);
                bctx.restore();
            }
            for (const f of pillars) {
                if (f.life <= 0) continue;
                const s = D * 1.1 * f.size * easeOutBack(f.life);
                bctx.globalAlpha = Math.min(1, f.life * 1.5);
                stamp(bctx, f.kind, f.variant, f.sx, f.sy, s);
            }
            bctx.globalAlpha = 1;

            const f = touchPinned || hovered;
            if (f) {
                const s = Math.max(30, D * 1.9);
                bctx.globalCompositeOperation = 'lighter';
                bctx.drawImage(glowSprite('255, 210, 130'), f.sx - s * 1.3, f.sy - s * 1.3, s * 2.6, s * 2.6);
                bctx.globalCompositeOperation = 'source-over';
                stamp(bctx, f.kind, f.variant, f.sx, f.sy, s);
                bctx.strokeStyle = 'rgba(255, 231, 176, .95)';
                bctx.lineWidth = 1.2;
                bctx.beginPath();
                bctx.arc(f.sx, f.sy, s * 0.62, 0, TAU);
                bctx.stroke();
                placeTip({ x: f.sx, y: f.sy });
            }
        }

        function frame(now) {
            if (!running) return;
            draw(now);
            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (reduced) { draw(performance.now()); return; }
            if (running || !inView || document.hidden) return;
            running = true;
            rafId = requestAnimationFrame(frame);
        }

        function stop() {
            running = false;
            cancelAnimationFrame(rafId);
        }

        // ---------- Interaction (only the flowers that stand for offerings) ----------
        function nearest(x, y) {
            const touch = matchMedia('(hover: none)').matches;
            const radius = touch ? Math.max(20, D * 0.95) : Math.max(11, D * 0.75);
            let best = null;
            let bestD = radius * radius;
            for (const f of pillars) {
                if (!f.off || f.life < 0.5) continue;
                const dx = f.sx - x, dy = f.sy - y;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = f; }
            }
            return best;
        }

        function localPoint(e) {
            const rect = hero.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function blocked(target) {
            return !!(target && target.closest && target.closest('.hero-heading, .hero-side, .hero-portrait, .hero-inscription, .flower-tip, a, button'));
        }

        function showTip(f) {
            if (!f || !tip) return;
            const o = f.off;
            const where = VP.formatLocation(o);
            tip.innerHTML = `<strong>${VP.escapeHtml(o.name)}</strong>`
                + (where ? `<span>${VP.escapeHtml(where)}</span>` : '')
                + `<em>${o.year} · ${matchMedia('(hover: none)').matches ? 'Tap again to read' : 'Click to read'}</em>`;
            tip.classList.add('is-visible');
        }

        function hideTip() {
            if (tip) tip.classList.remove('is-visible');
        }

        function placeTip(p) {
            if (!tip || !tip.classList.contains('is-visible')) return;
            const tw = tip.offsetWidth || 220;
            const th = tip.offsetHeight || 80;
            const below = p.y - th - 24 < 8;
            const x = Math.max(tw / 2 + 8, Math.min(W - tw / 2 - 8, p.x));
            tip.classList.toggle('is-below', below);
            tip.style.left = `${x}px`;
            tip.style.top = `${p.y}px`;
            tip.style.setProperty('--arrow-x', `${Math.max(14, Math.min(tw - 14, tw / 2 + (p.x - x)))}px`);
        }

        function setHover(f) {
            if (f === hovered) return;
            hovered = f;
            hero.classList.toggle('is-flower-hover', !!f);
            if (f) showTip(f); else if (!touchPinned) hideTip();
            if (!running) draw(performance.now());
        }

        hero.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch' || !assigned) return;
            if (blocked(e.target)) { setHover(null); return; }
            const pt = localPoint(e);
            setHover(nearest(pt.x, pt.y));
        });
        hero.addEventListener('pointerleave', () => setHover(null));

        hero.addEventListener('click', e => {
            if (!assigned || blocked(e.target)) return;
            const pt = localPoint(e);
            const f = nearest(pt.x, pt.y);
            const touch = matchMedia('(hover: none)').matches;
            if (!f) {
                touchPinned = null;
                hideTip();
                if (!running) draw(performance.now());
                return;
            }
            if (touch && touchPinned !== f) {
                touchPinned = f;
                showTip(f);
                if (!running) draw(performance.now());
                return;
            }
            window.location.href = VP.offeringUrl(f.off);
        });

        // ---------- Lifecycle ----------
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(entries => {
                inView = entries[0].isIntersecting;
                if (inView) start(); else stop();
            }).observe(hero);
        }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) stop(); else start();
        });

        let resizeTimer = 0;
        const onResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => { touchPinned = null; hovered = null; hideTip(); layout(); }, 120);
        };
        if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(hero);
        else window.addEventListener('resize', onResize);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

        startT = performance.now();
        layout();
        start();
        return { setYears };
    }
})();
