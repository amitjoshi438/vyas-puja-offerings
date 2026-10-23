// ============================================
// Home page: flower garland, stats, names strip, year cards
// Every flower in the garland is one published offering.
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    if (!VP) return;

    const TAU = Math.PI * 2;
    // Newest year first: fresh champa-gold, then marigold, saffron, rose…
    const YEAR_COLORS = ['#FFE2A0', '#F2A33A', '#E8702A', '#D9534A', '#E8C46A', '#C9899A'];
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
        state.years = VP.years.map((y, i) => ({
            ...y,
            color: YEAR_COLORS[i % YEAR_COLORS.length],
            offerings: byYear.get(y.year) || []
        }));
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
        // Same order as the garland: this year's flowers hang closest to Maharaj
        el.innerHTML = state.years
            .filter(y => y.offerings.length)
            .map(y => `<span><i style="--c:${y.color}"></i>${y.year} · ${VP.formatNumber(y.offerings.length)}</span>`)
            .join('');
        const hint = document.querySelector('.garland-hint');
        if (hint && window.matchMedia('(hover: none)').matches) {
            hint.textContent = 'Each flower is an offering — tap one to see whose.';
        }
    }

    // ---------- Flower garland ----------
    // Garlands hang in strands around the arch of Maharaj's portrait, like a torana. Each flower is one
    // offering. The newest year hangs closest to him, crowning the arch from its apex, and older years
    // hang outside it. The band keeps a fixed footprint: as offerings grow the flowers become smaller,
    // down to a floor, after which the outer strands simply run past the edge of the hero.
    function createGarland() {
        const hero = document.getElementById('hero');
        const canvas = document.getElementById('hero-garland');
        const portrait = document.getElementById('hero-portrait');
        const tip = document.getElementById('flower-tip');
        if (!hero || !canvas || !canvas.getContext) return null;

        const ctx = canvas.getContext('2d');
        const reduced = VP.prefersReducedMotion();
        const sprites = new Map();
        const SPRITE = 72;
        const VARIANTS = 3;
        const FRAME_GAP = 14; // the gold frame sits this far outside the photo (see .hero-portrait::before)
        let flowers = [];
        let strands = [];
        let W = 0, H = 0, dpr = 1;
        let cx = 0, halfW = 0, archY = 0, endY = 0, dLimit = 0, pitch = 12;
        let bloomStart = 0;
        let running = false;
        let inView = true;
        let rafId = 0;
        let hovered = -1;
        let touchPinned = -1;
        let base = null;

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

        // A marigold: three rings of petals, deeper at the rim, with a small dark heart
        function flowerSprite(color, variant) {
            const key = color + variant;
            if (sprites.has(key)) return sprites.get(key);
            const c = document.createElement('canvas');
            c.width = c.height = SPRITE;
            const g = c.getContext('2d');
            const R = SPRITE / 2 - 2;
            g.translate(SPRITE / 2, SPRITE / 2);
            const layers = [
                { n: 13, len: 1, tone: -0.1, turn: 0 },
                { n: 11, len: 0.76, tone: 0.1, turn: Math.PI / 11 },
                { n: 8, len: 0.52, tone: 0.34, turn: 0.2 }
            ];
            layers.forEach((L, li) => {
                const len = R * L.len;
                const half = Math.max(2.2, len * Math.sin(Math.PI / L.n) * 1.05);
                g.fillStyle = shade(color, L.tone);
                g.strokeStyle = shade(color, L.tone - 0.3);
                g.lineWidth = 0.9;
                for (let i = 0; i < L.n; i++) {
                    g.save();
                    g.rotate(L.turn + variant * (0.37 + li * 0.11) + (i / L.n) * TAU);
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
            g.fillStyle = shade(color, 0.55);
            g.beginPath();
            g.arc(-R * 0.04, -R * 0.04, R * 0.06, 0, TAU);
            g.fill();
            sprites.set(key, c);
            return c;
        }

        // A pair of tulasi leaves pointing up, for the thread between flowers
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
                g.fillStyle = '#6a9a52';
                g.fill();
                g.strokeStyle = 'rgba(30, 58, 24, .7)';
                g.lineWidth = 1;
                g.stroke();
                g.beginPath();
                g.moveTo(0, -2);
                g.lineTo(0, -22);
                g.strokeStyle = 'rgba(214, 240, 180, .55)';
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
            grad.addColorStop(0, hexToRgba(color, 0.55));
            grad.addColorStop(0.45, hexToRgba(color, 0.16));
            grad.addColorStop(1, hexToRgba(color, 0));
            g.fillStyle = grad;
            g.fillRect(0, 0, size, size);
            sprites.set(key, c);
            return c;
        }

        // Centre and size of the portrait in hero coordinates (offset-based, so entry transforms don't skew it)
        function portraitBox() {
            if (!portrait) return { x: W * 0.7, y: H * 0.5, w: 260, h: 340 };
            let x = 0, y = 0, el = portrait;
            while (el && el !== hero) {
                x += el.offsetLeft;
                y += el.offsetTop;
                el = el.offsetParent;
            }
            return { x: x + portrait.offsetWidth / 2, y: y + portrait.offsetHeight / 2, w: portrait.offsetWidth, h: portrait.offsetHeight };
        }

        // ---------- Geometry ----------
        // A strand at radius R follows the portrait's arch: up the left side, over the top, down the right.
        function strandLength(R) {
            return 2 * (endY - archY) + Math.PI * R;
        }

        function strandPoint(R, s) {
            const side = endY - archY;
            if (s < side) return { x: cx - R, y: endY - s, nx: -1, ny: 0 };
            s -= side;
            const arc = Math.PI * R;
            if (s < arc) {
                const th = Math.PI + s / R;
                const c = Math.cos(th);
                const sn = Math.sin(th);
                return { x: cx + c * R, y: archY + sn * R, nx: c, ny: sn };
            }
            return { x: cx + R, y: archY + (s - arc), nx: 1, ny: 0 };
        }

        function slotsOn(R) {
            return Math.max(6, Math.floor(strandLength(R) / pitch));
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

        // Distance from the frame needed by the outermost strand when `n` flowers hang at pitch `p`
        function outerOffset(p, n) {
            let d = p * 0.9;
            let left = n;
            for (;;) {
                const L = strandLength(halfW + d);
                left -= Math.max(6, Math.floor(L / p));
                if (left <= 0) return d;
                d += p * 1.22;
            }
        }

        function layout() {
            const rect = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(rect.width));
            H = Math.max(1, Math.round(rect.height));
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);

            const b = portraitBox();
            cx = b.x;
            halfW = b.w / 2 + FRAME_GAP;
            const frameTop = b.y - b.h / 2 - FRAME_GAP;
            archY = frameTop + halfW;
            endY = b.y + b.h / 2 + 22;

            const mobile = W < 960;
            const dTop = frameTop - 6;
            const dSide = Math.min(cx, W - cx) - halfW - 4;
            const dText = cx - halfW - textRight() - 10;
            // Desktop may overrun the side edge slightly; on a phone the arch rises off the top and the text sits
            // below, so only the sides count
            dLimit = mobile ? Math.max(30, dSide) : Math.max(60, Math.min(dTop, dSide + 22, dText));

            const n = flowers.length;
            const pMax = mobile ? 14 : 17;
            const pMin = mobile ? 6.5 : 8;
            pitch = pMax;
            if (n) {
                // Largest flowers that still keep every strand inside the hero; stop at the floor
                for (let t = pMax; t >= pMin; t -= 0.25) {
                    pitch = t;
                    if (outerOffset(t, n) <= dLimit) break;
                }
            }
            stringFlowers();
            buildBase();
            if (!running) draw(performance.now());
        }

        function stringFlowers() {
            strands = [];
            const n = flowers.length;
            let d = pitch * 0.9;
            let i = 0;
            let k = 0;
            while (i < n) {
                const R = halfW + d;
                const L = strandLength(R);
                const slots = slotsOn(R);
                const spacing = L / slots;
                const slotList = [];
                for (let j = 0; j < slots; j++) slotList.push({ j, s: (j + 0.25 + (k % 2) * 0.5) * spacing });
                // Fill from the apex outwards, so a part-filled strand sits centred over the portrait
                slotList.sort((a, b) => Math.abs(a.s - L / 2) - Math.abs(b.s - L / 2));
                const count = Math.min(slots, n - i);
                let sMin = L;
                let sMax = 0;
                for (let m = 0; m < count; m++, i++) {
                    const f = flowers[i];
                    const slot = slotList[m];
                    const pt = strandPoint(R, slot.s);
                    f.x = pt.x;
                    f.y = pt.y;
                    f.nx = pt.nx;
                    f.ny = pt.ny;
                    f.d = d;
                    f.leafAt = pitch >= 8.5 && slot.j % 4 === 2 ? slot.s + spacing / 2 : -1;
                    f.R = R;
                    sMin = Math.min(sMin, slot.s);
                    sMax = Math.max(sMax, slot.s);
                }
                strands.push({ R, L, d, sMin, sMax, full: count >= slots });
                d += pitch * 1.22;
                k++;
            }
        }

        // Static layer: the thread, tulasi leaves and a scalloped border. Flowers are drawn over it.
        function buildBase() {
            base = document.createElement('canvas');
            base.width = canvas.width;
            base.height = canvas.height;
            const g = base.getContext('2d');
            g.scale(dpr, dpr);

            g.lineWidth = 1;
            g.lineCap = 'round';
            g.strokeStyle = 'rgba(242, 209, 140, 0.4)';
            g.fillStyle = 'rgba(242, 209, 140, 0.85)';
            strands.forEach(st => {
                const from = st.full ? 0 : Math.max(0, st.sMin - pitch * 0.5);
                const to = st.full ? st.L : Math.min(st.L, st.sMax + pitch * 0.5);
                g.beginPath();
                for (let s = from; s <= to; s += 4) {
                    const pt = strandPoint(st.R, s);
                    if (s === from) g.moveTo(pt.x, pt.y); else g.lineTo(pt.x, pt.y);
                }
                g.stroke();
                if (st.full) {
                    // Each full strand ends in a small gold bead
                    [cx - st.R, cx + st.R].forEach(x => {
                        g.beginPath();
                        g.moveTo(x, endY);
                        g.lineTo(x, endY + 5);
                        g.stroke();
                        g.beginPath();
                        g.arc(x, endY + 7, 2.2, 0, TAU);
                        g.fill();
                    });
                }
            });

            if (pitch >= 8.5) {
                const leaf = leafSprite();
                const ls = pitch * 2;
                flowers.forEach(f => {
                    if (f.leafAt < 0) return;
                    const pt = strandPoint(f.R, f.leafAt);
                    g.save();
                    g.translate(pt.x, pt.y);
                    g.rotate(Math.atan2(pt.ny, pt.nx) + Math.PI / 2);
                    g.globalAlpha = 0.9;
                    g.drawImage(leaf, -ls / 2, -ls * 0.62, ls, ls);
                    g.restore();
                });
            }

            // Lotus-petal scallops along the outside of the outermost strand
            if (strands.length) {
                const outer = strands[strands.length - 1];
                const Ro = outer.R + pitch * 1.1 + 8;
                const Lo = strandLength(Ro);
                const petals = Math.max(8, Math.round(Lo / 56));
                g.strokeStyle = 'rgba(242, 209, 140, 0.16)';
                for (let m = 0; m < petals; m++) {
                    const s0 = (m / petals) * Lo;
                    const s1 = ((m + 1) / petals) * Lo;
                    const a = strandPoint(Ro, s0);
                    const b = strandPoint(Ro, s1);
                    const mid = strandPoint(Ro, (s0 + s1) / 2);
                    g.beginPath();
                    g.moveTo(a.x, a.y);
                    g.quadraticCurveTo(mid.x + mid.nx * 40, mid.y + mid.ny * 40, b.x, b.y);
                    g.stroke();
                }
            }
        }

        function setYears(list) {
            // Newest year first, so it hangs closest to Maharaj
            const current = VP.currentYear();
            flowers = [];
            list.forEach(y => {
                y.offerings.forEach(o => {
                    flowers.push({
                        o,
                        color: y.color,
                        fresh: !!current && y.year === current.year,
                        variant: Math.floor(Math.random() * VARIANTS),
                        size: 0.9 + Math.min(1, (o.text || '').length / 4500) * 0.2,
                        phase: Math.random() * TAU,
                        speed: 0.0012 + Math.random() * 0.0018,
                        x: 0, y: 0, nx: 0, ny: 0, d: 0, R: 0, leafAt: -1,
                        life: 0, fade: 1, sx: 0, sy: 0,
                        delay: 0
                    });
                });
            });
            const n = flowers.length;
            flowers.forEach((f, i) => { f.delay = (i / Math.max(1, n)) * 2600 + Math.random() * 300; });
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
            if (!flowers.length) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const elapsed = reduced ? Infinity : now - bloomStart;
            const fadeFrom = dLimit + 8;
            const margin = pitch * 2;
            const visible = [];

            for (let i = 0; i < flowers.length; i++) {
                const f = flowers[i];
                const life = Math.min(1, Math.max(0, (elapsed - f.delay) / 650));
                if (life <= 0) continue;
                // A gentle sway, as if in a breeze
                const sway = reduced ? 0 : Math.sin(now * 0.0007 + f.phase) * pitch * 0.12;
                f.sx = f.x + f.nx * sway;
                f.sy = f.y + f.ny * sway;
                if (f.sx < -margin || f.sy < -margin || f.sx > W + margin || f.sy > H + margin) continue;
                f.life = life;
                f.fade = f.d > fadeFrom ? Math.max(0, 1 - (f.d - fadeFrom) / 80) : 1;
                if (f.fade > 0) visible.push(f);
            }

            // A soft glow behind this year's flowers
            ctx.globalCompositeOperation = 'lighter';
            for (const f of visible) {
                if (!f.fresh) continue;
                const s = pitch * 3.2 * f.life;
                ctx.globalAlpha = 0.5 * f.fade;
                ctx.drawImage(glowSprite(f.color), f.sx - s / 2, f.sy - s / 2, s, s);
            }
            ctx.globalCompositeOperation = 'source-over';

            for (const f of visible) {
                const breathe = reduced ? 1 : 1 + 0.035 * Math.sin(now * f.speed + f.phase);
                const s = pitch * 1.02 * f.size * easeOutBack(f.life) * breathe;
                ctx.globalAlpha = f.life * f.fade;
                ctx.drawImage(flowerSprite(f.color, f.variant), f.sx - s / 2, f.sy - s / 2, s, s);
            }

            const active = touchPinned >= 0 ? touchPinned : hovered;
            if (active >= 0 && flowers[active]) {
                const f = flowers[active];
                const s = Math.max(26, pitch * 2.6);
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = 'lighter';
                ctx.drawImage(glowSprite('#FFE7B0'), f.x - s * 1.3, f.y - s * 1.3, s * 2.6, s * 2.6);
                ctx.globalCompositeOperation = 'source-over';
                ctx.drawImage(flowerSprite(f.color, f.variant), f.x - s / 2, f.y - s / 2, s, s);
                ctx.strokeStyle = 'rgba(255, 231, 176, 0.85)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(f.x, f.y, s * 0.62, 0, TAU);
                ctx.stroke();
                placeTip(f);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
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
            const radius = Math.max(12, pitch * 0.8);
            let best = -1;
            let bestD = radius * radius;
            for (let i = 0; i < flowers.length; i++) {
                const dx = flowers[i].x - x;
                const dy = flowers[i].y - y;
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
            if (e.pointerType === 'touch' || !flowers.length) return;
            if (blocked(e.target)) { setHover(-1); return; }
            const pt = localPoint(e);
            setHover(nearest(pt.x, pt.y));
        });
        hero.addEventListener('pointerleave', () => setHover(-1));

        hero.addEventListener('click', e => {
            if (!flowers.length || blocked(e.target)) return;
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
