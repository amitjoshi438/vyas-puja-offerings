// ============================================
// Home page: festival flower garland, stats, names strip, year cards
// Every flower in the garland is one published offering.
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
        const garland = createGarland();

        const results = await VP.loadAllYears();
        const byYear = new Map(results.map(r => [r.year, r.offerings]));
        state.years = VP.years.map(y => ({ ...y, offerings: byYear.get(y.year) || [] }));
        state.all = state.years.flatMap(y => y.offerings);

        renderStats();
        renderNameStrip();
        renderYearCards(state.years);
        renderLegend();
        if (garland) garland.setYears(state.years);
    }

    // ---------- Helpers ----------
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

    // ---------- Legend ----------
    function renderLegend() {
        const el = document.getElementById('garland-legend');
        if (!el) return;
        const current = VP.currentYear();
        el.innerHTML = state.years
            .filter(y => y.offerings.length)
            .map(y => `<span${current && y.year === current.year ? ' class="is-fresh"' : ''}><i></i>${y.year} · ${VP.formatNumber(y.offerings.length)}</span>`)
            .join('');
        const hint = document.querySelector('.garland-hint');
        if (hint && window.matchMedia('(hover: none)').matches) {
            hint.textContent = 'Each flower is an offering — tap one to see whose.';
        }
    }

    // ---------- Festival garland ----------
    // Swags of flowers hang from a valance across the top of the hero, like the decoration of a festival
    // pandal, and strands of flowers hang from the swags beside and above Maharaj's portrait. Each flower
    // is one offering. The newest hang closest to him: first along the swag above the portrait, then in
    // the strands nearest to it. Flowers shrink as offerings grow, down to a floor; any that still do
    // not fit are simply not drawn (the counts and the Offerings page still include them).
    function createGarland() {
        const hero = document.getElementById('hero');
        const canvas = document.getElementById('hero-garland');
        const portrait = document.getElementById('hero-portrait');
        const tip = document.getElementById('flower-tip');
        if (!hero || !canvas || !canvas.getContext) return null;

        const ctx = canvas.getContext('2d');
        const reduced = VP.prefersReducedMotion();
        const sprites = new Map();
        const SPRITE = 80;
        const VARIANTS = 3;
        const FRAME_GAP = 14; // the gold frame sits this far outside the photo (see .hero-portrait::before)
        const KINDS = [
            { id: 'orange', weight: 36, shape: 'pom', color: '#F08A1C' },
            { id: 'yellow', weight: 24, shape: 'pom', color: '#F7C52C' },
            { id: 'rose', weight: 14, shape: 'rose', color: '#E0557F' },
            { id: 'red', weight: 8, shape: 'rose', color: '#C2332A' },
            { id: 'jasmine', weight: 18, shape: 'jasmine', color: '#FFFBEF' }
        ];
        const KIND_WEIGHT = KINDS.reduce((sum, k) => sum + k.weight, 0);
        const KNOT_KIND = { id: 'knot', shape: 'pom', color: '#F08A1C' };
        const KNOT_ROSE = { id: 'knotrose', shape: 'rose', color: '#C2332A' };

        let flowers = [];
        let placed = [];
        let strandGroups = [];
        let plan = null;
        let W = 0, H = 0, dpr = 1, pitch = 12;
        let cx = 0, halfW = 0, archY = 0, endY = 0, valance = 30, textR = 0, textT = 0;
        let bloomStart = 0;
        let running = false;
        let inView = true;
        let rafId = 0;
        let hovered = -1;
        let touchPinned = -1;
        let base = null;

        function pickKind() {
            let r = Math.random() * KIND_WEIGHT;
            for (const k of KINDS) {
                r -= k.weight;
                if (r <= 0) return k;
            }
            return KINDS[0];
        }

        function smooth(x) {
            const t = Math.min(1, Math.max(0, x));
            return t * t * (3 - 2 * t);
        }

        function shade(hex, amount) {
            const n = parseInt(hex.slice(1), 16);
            const target = amount >= 0 ? 255 : 0;
            const k = Math.abs(amount);
            const mix = v => Math.round(v + (target - v) * k);
            return `rgb(${mix((n >> 16) & 255)},${mix((n >> 8) & 255)},${mix(n & 255)})`;
        }

        function hexToRgba(hex, a) {
            const n = parseInt(hex.slice(1), 16);
            return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        }

        // ---------- Flower drawings ----------
        // A marigold: three rings of petals, deeper at the rim, with a small dark heart
        function drawPom(g, color, R, v) {
            const layers = [
                { n: 13, len: 1, tone: -0.08, turn: 0 },
                { n: 11, len: 0.76, tone: 0.1, turn: Math.PI / 11 },
                { n: 8, len: 0.52, tone: 0.34, turn: 0.2 }
            ];
            layers.forEach((L, li) => {
                const len = R * L.len;
                const half = Math.max(2.2, len * Math.sin(Math.PI / L.n) * 1.05);
                g.fillStyle = shade(color, L.tone);
                g.strokeStyle = shade(color, L.tone - 0.34);
                g.lineWidth = 0.9;
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
            g.arc(0, 0, R * 0.15, 0, TAU);
            g.fill();
        }

        // A rose seen from above: a ring of round petals around a swirl
        function drawRose(g, color, R, v) {
            g.lineWidth = 1;
            g.fillStyle = shade(color, -0.08);
            g.strokeStyle = shade(color, -0.42);
            for (let i = 0; i < 5; i++) {
                const a = v * 0.5 + (i / 5) * TAU;
                g.beginPath();
                g.arc(Math.cos(a) * R * 0.5, Math.sin(a) * R * 0.5, R * 0.52, 0, TAU);
                g.fill();
                g.stroke();
            }
            const tones = [0, 0.1, 0.2, 0.3];
            tones.forEach((tone, i) => {
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

        // A jasmine: five soft white petals with a gold heart
        function drawJasmine(g, color, R, v) {
            g.lineWidth = 0.9;
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

        // Each flower is drawn once, with a soft shadow beneath it, and then stamped many times
        function flowerSprite(kind, variant) {
            const key = kind.id + variant;
            if (sprites.has(key)) return sprites.get(key);
            const R = SPRITE / 2 - 8;
            const flat = document.createElement('canvas');
            flat.width = flat.height = SPRITE;
            const f = flat.getContext('2d');
            f.translate(SPRITE / 2, SPRITE / 2 - 1);
            if (kind.shape === 'pom') drawPom(f, kind.color, R, variant);
            else if (kind.shape === 'rose') drawRose(f, kind.color, R, variant);
            else drawJasmine(f, kind.color, R, variant);

            const c = document.createElement('canvas');
            c.width = c.height = SPRITE;
            const g = c.getContext('2d');
            g.shadowColor = 'rgba(86, 38, 8, 0.4)';
            g.shadowBlur = 4;
            g.shadowOffsetY = 2;
            g.drawImage(flat, 0, 0);
            sprites.set(key, c);
            return c;
        }

        // A pair of leaves pointing up, for the thread between flowers
        function leafSprite() {
            if (sprites.has('leaf')) return sprites.get('leaf');
            const size = 56;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            g.translate(size / 2, size * 0.62);
            [-1, 1].forEach(side => {
                g.save();
                g.rotate(side * 0.72);
                g.beginPath();
                g.moveTo(0, 0);
                g.bezierCurveTo(9, -6, 9, -22, 0, -28);
                g.bezierCurveTo(-9, -22, -9, -6, 0, 0);
                g.fillStyle = '#5e9246';
                g.fill();
                g.strokeStyle = 'rgba(28, 62, 24, .75)';
                g.lineWidth = 1;
                g.stroke();
                g.beginPath();
                g.moveTo(0, -2);
                g.lineTo(0, -22);
                g.strokeStyle = 'rgba(214, 240, 180, .6)';
                g.stroke();
                g.restore();
            });
            sprites.set('leaf', c);
            return c;
        }

        function glowSprite(color) {
            const key = 'glow' + color;
            if (sprites.has(key)) return sprites.get(key);
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, hexToRgba(color, 0.7));
            grad.addColorStop(0.5, hexToRgba(color, 0.22));
            grad.addColorStop(1, hexToRgba(color, 0));
            g.fillStyle = grad;
            g.fillRect(0, 0, size, size);
            sprites.set(key, c);
            return c;
        }

        // ---------- Measuring the hero ----------
        // Position of an element in hero coordinates (offset-based, so entry transforms don't skew it)
        function offsetBox(el) {
            let x = 0, y = 0, node = el;
            while (node && node !== hero) {
                x += node.offsetLeft;
                y += node.offsetTop;
                node = node.offsetParent;
            }
            return { x, y, w: el.offsetWidth, h: el.offsetHeight };
        }

        // Right-hand edge of the hero text, so a garland beside it never runs behind the words
        function textRight() {
            const left = hero.getBoundingClientRect().left;
            let right = 0;
            hero.querySelectorAll('.hero-verse p, .hero-title .t-big, .hero-for, .hero-lede, .hero-actions').forEach(el => {
                const range = document.createRange();
                range.selectNodeContents(el);
                right = Math.max(right, range.getBoundingClientRect().right - left);
            });
            return right;
        }

        function measure() {
            const rect = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(rect.width));
            H = Math.max(1, Math.round(rect.height));
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);

            const mobile = W < 960;
            if (portrait) {
                const b = offsetBox(portrait);
                cx = b.x + b.w / 2;
                halfW = b.w / 2 + FRAME_GAP;
                archY = b.y - FRAME_GAP + halfW;
                endY = b.y + b.h + 22;
            } else {
                cx = W * 0.72;
                halfW = 160;
                archY = H * 0.3;
                endY = H * 0.8;
            }
            const v = parseFloat(getComputedStyle(hero).getPropertyValue('--valance-h'));
            valance = Number.isFinite(v) ? v : 30;
            const verse = hero.querySelector('.hero-verse');
            textR = mobile ? 0 : textRight();
            textT = mobile || !verse ? 0 : offsetBox(verse).y;
        }

        // ---------- The plan: where every flower can hang ----------
        function buildPlan(p) {
            const mobile = W < 960;
            const y0 = valance - 4;
            const count = Math.max(2, Math.round(W / (mobile ? 190 : 235)));
            const span = W / count;
            const depth = Math.min(44, Math.max(22, span * 0.19));
            const swagAt = x => {
                const i = Math.min(count - 1, Math.max(0, Math.floor(x / span)));
                const t = (x - i * span) / span;
                return y0 + depth * 4 * t * (1 - t);
            };

            const swags = [];
            const STEPS = 160;
            for (let i = 0; i < count; i++) {
                const x0 = i * span;
                const pts = [];
                let len = 0;
                for (let k = 0; k <= STEPS; k++) {
                    const t = k / STEPS;
                    const x = x0 + span * t;
                    const y = y0 + depth * 4 * t * (1 - t);
                    if (k) len += Math.hypot(x - pts[k - 1].x, y - pts[k - 1].y);
                    pts.push({ x, y, s: len });
                }
                // Keep clear of the knot at each end, then walk the curve by arc length
                const margin = 20;
                const usable = len - margin * 2;
                const n = Math.max(0, Math.floor(usable / (p * 1.02)));
                const along = [];
                if (n) {
                    const gap = usable / n;
                    let k = 0;
                    for (let m = 0; m < n; m++) {
                        const target = margin + (m + 0.5) * gap;
                        while (k < STEPS && pts[k + 1].s < target) k++;
                        const a = pts[k];
                        const b = pts[Math.min(STEPS, k + 1)];
                        const f = b.s > a.s ? (target - a.s) / (b.s - a.s) : 0;
                        along.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, s: target });
                    }
                }
                // Fill from the middle of the swag outwards
                const slots = along.slice().sort((a, b) => Math.abs(a.s - len / 2) - Math.abs(b.s - len / 2));
                swags.push({ type: 'swag', x: x0 + span / 2, pts, along, slots, priority: Math.abs(x0 + span / 2 - cx) });
            }

            const strands = [];
            const spacing = p * 1.32;
            const rowH = p * 1.05;
            const rr = halfW + 8;
            let index = 0;
            for (let x = spacing / 2; x < W; x += spacing, index++) {
                if (Math.abs(x - Math.round(x / span) * span) < 20) continue;
                const top = swagAt(x);
                const startY = top + p * 1.1;
                let maxY = endY;
                if (!mobile) {
                    // Only a short fringe beside the text, lengthening as it sweeps toward the portrait
                    const fringe = textT - 10;
                    maxY = fringe + (endY - fringe) * smooth((x - (textR + 14)) / 150);
                }
                const dx = Math.abs(x - cx);
                if (dx < rr) {
                    // Above the portrait the strands follow the arch, like a crown
                    maxY = Math.min(maxY, archY - Math.sqrt(rr * rr - dx * dx) - 6);
                } else if (x > cx + rr + 30) {
                    const reach = Math.max(60, W - (cx + rr + 30));
                    maxY -= (maxY - startY) * 0.5 * smooth((x - (cx + rr + 30)) / reach);
                }
                if (index % 2) maxY -= p * 2.2;
                const n = Math.floor((maxY - startY) / rowH);
                if (n < 1) continue;
                const slots = [];
                for (let j = 0; j < n; j++) slots.push({ x, y: startY + (j + 0.5) * rowH, j });
                strands.push({ type: 'strand', x, top, slots, priority: dx });
            }

            swags.sort((a, b) => a.priority - b.priority);
            strands.sort((a, b) => a.priority - b.priority);
            const total = swags.reduce((s, g) => s + g.slots.length, 0) + strands.reduce((s, g) => s + g.slots.length, 0);
            return { swags, strands, total, count, span, y0, depth };
        }

        function layout() {
            measure();
            const mobile = W < 960;
            const n = flowers.length;
            const pMax = mobile ? 13 : 16;
            const pMin = mobile ? 5.5 : 6.5;
            pitch = pMax;
            plan = buildPlan(pitch);
            // Largest flowers that still let every offering hang; stop at the floor
            for (let t = pMax - 0.5; t >= pMin && plan.total < n; t -= 0.5) {
                pitch = t;
                plan = buildPlan(t);
            }
            assign();
            buildBase();
            if (!running) draw(performance.now());
        }

        function assign() {
            const groups = plan.swags.concat(plan.strands);
            const n = flowers.length;
            let i = 0;
            placed = [];
            strandGroups = [];
            flowers.forEach(f => { f.placed = false; });
            groups.forEach((gr, gi) => {
                gr.items = [];
                const lead = (gi / Math.max(1, groups.length)) * 1800;
                for (let s = 0; s < gr.slots.length && i < n; s++, i++) {
                    const f = flowers[i];
                    const slot = gr.slots[s];
                    f.x = f.sx = slot.x;
                    f.y = f.sy = slot.y;
                    f.group = gr;
                    f.swag = gr.type === 'swag';
                    f.leaf = gr.type === 'strand' && slot.j % 3 === 1;
                    f.delay = lead + s * (f.swag ? 26 : 16) + Math.random() * 90;
                    f.placed = true;
                    gr.items.push(f);
                    placed.push(f);
                }
                if (gr.type === 'strand' && gr.items.length) {
                    gr.tipY = gr.items[gr.items.length - 1].y + pitch * 0.55;
                    gr.dx = 0;
                    strandGroups.push(gr);
                }
            });
        }

        // Static layer: the swag threads, leaves, and the rosette knots where the swags meet
        function buildBase() {
            base = document.createElement('canvas');
            base.width = canvas.width;
            base.height = canvas.height;
            const g = base.getContext('2d');
            g.scale(dpr, dpr);

            g.lineWidth = 1.5;
            g.lineCap = 'round';
            g.strokeStyle = 'rgba(140, 92, 36, 0.6)';
            plan.swags.forEach(sw => {
                g.beginPath();
                sw.pts.forEach((pt, k) => { if (k) g.lineTo(pt.x, pt.y); else g.moveTo(pt.x, pt.y); });
                g.stroke();
            });

            if (pitch >= 8) {
                const leaf = leafSprite();
                const ls = pitch * 1.9;
                plan.swags.forEach(sw => {
                    for (let m = 0; m + 1 < sw.along.length; m += 3) {
                        const a = sw.along[m];
                        const b = sw.along[m + 1];
                        g.save();
                        g.translate((a.x + b.x) / 2, (a.y + b.y) / 2 + pitch * 0.15);
                        g.rotate(Math.PI + (m % 2 ? 0.25 : -0.25));
                        g.drawImage(leaf, -ls / 2, -ls * 0.62, ls, ls);
                        g.restore();
                    }
                });
            }

            for (let i = 0; i <= plan.count; i++) drawKnot(g, i * plan.span, plan.y0);
        }

        // Two silk ribbon tails and a marigold-and-rose rosette
        function drawKnot(g, x, y) {
            g.lineWidth = 1;
            [-1, 1].forEach(side => {
                const x0 = x + side * 4;
                g.beginPath();
                g.moveTo(x0 - 5, y + 8);
                g.lineTo(x0 + 5, y + 8);
                g.lineTo(x0 + 5 + side * 4, y + 50);
                g.lineTo(x0 + side * 4, y + 43);
                g.lineTo(x0 - 5 + side * 4, y + 50);
                g.closePath();
                g.fillStyle = '#b3261e';
                g.fill();
                g.strokeStyle = '#d6a24a';
                g.stroke();
            });
            g.drawImage(flowerSprite(KNOT_KIND, 1), x - 19, y + 8 - 19, 38, 38);
            g.drawImage(flowerSprite(KNOT_ROSE, 0), x - 11, y + 8 - 11, 22, 22);
        }

        function setYears(list) {
            // Newest year first, so it hangs closest to Maharaj
            const current = VP.currentYear();
            flowers = [];
            list.forEach(y => {
                y.offerings.forEach(o => {
                    flowers.push({
                        o,
                        kind: pickKind(),
                        fresh: !!current && y.year === current.year,
                        variant: Math.floor(Math.random() * VARIANTS),
                        size: 0.92 + Math.min(1, (o.text || '').length / 4500) * 0.18,
                        tilt: (Math.random() - 0.5) * 0.7,
                        x: 0, y: 0, sx: 0, sy: 0, life: 0,
                        placed: false, swag: false, leaf: false, group: null, delay: 0
                    });
                });
            });
            layout();
            bloomStart = performance.now();
            start();
        }

        function easeOutBack(t) {
            const c1 = 1.5;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        function draw(now) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (base) ctx.drawImage(base, 0, 0);
            if (!placed.length) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const elapsed = reduced ? Infinity : now - bloomStart;

            // The strands sway a little, as if in a breeze; the thread is a curve that the flowers follow
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(140, 92, 36, 0.6)';
            ctx.beginPath();
            for (const gr of strandGroups) {
                const len = gr.tipY - gr.top;
                gr.dx = reduced ? 0 : Math.sin(now * 0.0011 + gr.x * 0.018) * Math.min(5, 1.2 + len * 0.007);
                ctx.moveTo(gr.x, gr.top);
                ctx.quadraticCurveTo(gr.x, (gr.top + gr.tipY) / 2, gr.x + gr.dx, gr.tipY);
                for (const f of gr.items) {
                    const t = (f.y - gr.top) / len;
                    f.sx = gr.x + gr.dx * t * t;
                }
            }
            ctx.stroke();

            // A small gold tassel at the end of each strand
            ctx.strokeStyle = '#d6a24a';
            ctx.fillStyle = '#d6a24a';
            ctx.beginPath();
            for (const gr of strandGroups) {
                const tx = gr.x + gr.dx;
                ctx.moveTo(tx, gr.tipY);
                ctx.lineTo(tx - 2.4, gr.tipY + 8);
                ctx.moveTo(tx, gr.tipY);
                ctx.lineTo(tx, gr.tipY + 9);
                ctx.moveTo(tx, gr.tipY);
                ctx.lineTo(tx + 2.4, gr.tipY + 8);
            }
            ctx.stroke();
            ctx.beginPath();
            for (const gr of strandGroups) {
                const tx = gr.x + gr.dx;
                ctx.moveTo(tx + 2.6, gr.tipY);
                ctx.arc(tx, gr.tipY, 2.6, 0, TAU);
            }
            ctx.fill();

            const margin = pitch * 2;
            const visible = [];
            for (const f of placed) {
                f.life = Math.min(1, Math.max(0, (elapsed - f.delay) / 600));
                if (f.life <= 0) continue;
                if (f.sx < -margin || f.sy < -margin || f.sx > W + margin || f.sy > H + margin) continue;
                visible.push(f);
            }

            if (pitch >= 8) {
                const leaf = leafSprite();
                const ls = pitch * 1.9;
                for (const f of visible) {
                    if (!f.leaf) continue;
                    ctx.save();
                    ctx.translate(f.sx, f.sy + pitch * 0.2);
                    ctx.rotate(Math.PI + f.tilt);
                    ctx.globalAlpha = f.life;
                    ctx.drawImage(leaf, -ls / 2, -ls * 0.62, ls, ls);
                    ctx.restore();
                }
            }

            // This year's flowers are lit with a little gold
            for (const f of visible) {
                if (!f.fresh) continue;
                const s = pitch * 3.1 * f.life;
                ctx.globalAlpha = 0.85;
                ctx.drawImage(glowSprite('#FFC24A'), f.sx - s / 2, f.sy - s / 2, s, s);
            }

            for (const f of visible) {
                const s = pitch * (f.swag ? 1.34 : 1.14) * f.size * easeOutBack(f.life);
                ctx.globalAlpha = Math.min(1, f.life * 1.4);
                ctx.drawImage(flowerSprite(f.kind, f.variant), f.sx - s * 0.5, f.sy - s * 0.5, s, s);
            }

            const active = touchPinned >= 0 ? touchPinned : hovered;
            const f = active >= 0 ? flowers[active] : null;
            if (f && f.placed) {
                const s = Math.max(30, pitch * 2.8);
                ctx.globalAlpha = 1;
                ctx.drawImage(glowSprite('#FFC24A'), f.sx - s * 1.2, f.sy - s * 1.2, s * 2.4, s * 2.4);
                ctx.drawImage(flowerSprite(f.kind, f.variant), f.sx - s / 2, f.sy - s / 2, s, s);
                ctx.strokeStyle = 'rgba(179, 38, 30, 0.85)';
                ctx.lineWidth = 1.2;
                ctx.beginPath();
                ctx.arc(f.sx, f.sy, s * 0.62, 0, TAU);
                ctx.stroke();
                placeTip({ x: f.sx, y: f.sy });
            }
            ctx.globalAlpha = 1;
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

        // ---------- Interaction ----------
        function nearest(x, y) {
            const radius = Math.max(11, pitch * 0.8);
            let best = -1;
            let bestD = radius * radius;
            for (let i = 0; i < flowers.length; i++) {
                const f = flowers[i];
                if (!f.placed) continue;
                const dx = f.sx - x;
                const dy = f.sy - y;
                const d = dx * dx + dy * dy;
                if (d < bestD) { bestD = d; best = i; }
            }
            return best;
        }

        function localPoint(e) {
            const rect = hero.getBoundingClientRect();
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        }

        function blocked(target) {
            return !!(target && target.closest && target.closest('.hero-copy, .hero-portrait, .flower-tip, a, button'));
        }

        function showTip(i) {
            const f = flowers[i];
            if (!f || !tip) return;
            const where = VP.formatLocation(f.o);
            tip.innerHTML = `<strong>${VP.escapeHtml(f.o.name)}</strong>`
                + (where ? `<span>${VP.escapeHtml(where)}</span>` : '')
                + `<em>${f.o.year} · ${matchMedia('(hover: none)').matches ? 'Tap again to read' : 'Click to read'}</em>`;
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

        function setHover(i) {
            if (i === hovered) return;
            hovered = i;
            hero.classList.toggle('is-flower-hover', i >= 0);
            if (i >= 0) showTip(i); else if (touchPinned < 0) hideTip();
            if (!running) draw(performance.now());
        }

        hero.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch' || !placed.length) return;
            if (blocked(e.target)) { setHover(-1); return; }
            const pt = localPoint(e);
            setHover(nearest(pt.x, pt.y));
        });
        hero.addEventListener('pointerleave', () => setHover(-1));

        hero.addEventListener('click', e => {
            if (!placed.length || blocked(e.target)) return;
            const pt = localPoint(e);
            const i = nearest(pt.x, pt.y);
            const touch = matchMedia('(hover: none)').matches;
            if (i < 0) {
                touchPinned = -1;
                hideTip();
                if (!running) draw(performance.now());
                return;
            }
            if (touch && touchPinned !== i) {
                touchPinned = i;
                showTip(i);
                if (!running) draw(performance.now());
                return;
            }
            window.location.href = VP.offeringUrl(flowers[i].o);
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
            resizeTimer = setTimeout(layout, 120);
        };
        if ('ResizeObserver' in window) new ResizeObserver(onResize).observe(hero);
        else window.addEventListener('resize', onResize);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);

        layout();
        return { setYears };
    }
})();
