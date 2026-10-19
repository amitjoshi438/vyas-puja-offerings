// ============================================
// Home page: lamp mandala, stats, garland, year cards
// Every lamp in the mandala is one published offering.
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    if (!VP) return;

    const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
    // Newest year first: bright lamp-light, then marigold, saffron, kumkum…
    const YEAR_COLORS = ['#FFE7B0', '#F2A33A', '#E0662A', '#C8432B', '#D9B26A', '#B8875A'];
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
        const mandala = createMandala();

        const results = await VP.loadAllYears();
        const byYear = new Map(results.map(r => [r.year, r.offerings]));
        state.years = VP.years.map((y, i) => ({
            ...y,
            color: YEAR_COLORS[i % YEAR_COLORS.length],
            offerings: byYear.get(y.year) || []
        }));
        state.all = state.years.flatMap(y => y.offerings);

        renderStats();
        renderGarland();
        renderYearCards(state.years);
        renderLegend();
        if (mandala) mandala.setYears(state.years);
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

    // ---------- Garland of names ----------
    function renderGarland() {
        const track = document.getElementById('garland-track');
        if (!track) return;
        const current = state.years[0];
        const pool = current && current.offerings.length >= 24 ? current.offerings : state.all;
        if (!pool.length) {
            track.closest('.garland').hidden = true;
            return;
        }
        const picks = shuffle(pool).slice(0, 36);
        const html = picks.map(o => `
            <a class="garland-item" href="${VP.offeringUrl(o)}" tabindex="-1">
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
        const el = document.getElementById('mandala-legend');
        if (!el) return;
        el.innerHTML = state.years
            .filter(y => y.offerings.length)
            .slice()
            .reverse()
            .map(y => `<span><i style="--c:${y.color}"></i>${y.year} · ${VP.formatNumber(y.offerings.length)}</span>`)
            .join('');
        const hint = document.querySelector('.mandala-hint');
        if (hint && window.matchMedia('(hover: none)').matches) {
            hint.textContent = 'Each lamp is an offering — tap one to see whose.';
        }
    }

    // ---------- Mandala ----------
    function createMandala() {
        const hero = document.getElementById('hero');
        const canvas = document.getElementById('mandala');
        const portrait = document.getElementById('hero-portrait');
        const tip = document.getElementById('lamp-tip');
        if (!hero || !canvas || !canvas.getContext) return null;

        const ctx = canvas.getContext('2d');
        const reduced = VP.prefersReducedMotion();
        const sprites = new Map();
        let lamps = [];
        let years = [];
        let W = 0, H = 0, dpr = 1;
        let cx = 0, cy = 0, r0 = 0, rOuter = 0, spacing = 10;
        let rotation = 0;
        let lastTime = 0;
        let igniteStart = 0;
        let running = false;
        let inView = true;
        let rafId = 0;
        let hovered = -1;
        let touchPinned = -1;
        let ring = null;

        function sprite(color) {
            if (sprites.has(color)) return sprites.get(color);
            const size = 64;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const g = c.getContext('2d');
            const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
            grad.addColorStop(0, 'rgba(255,250,235,1)');
            grad.addColorStop(0.12, 'rgba(255,240,205,0.95)');
            grad.addColorStop(0.28, hexToRgba(color, 0.55));
            grad.addColorStop(0.6, hexToRgba(color, 0.12));
            grad.addColorStop(1, hexToRgba(color, 0));
            g.fillStyle = grad;
            g.fillRect(0, 0, size, size);
            sprites.set(color, c);
            return c;
        }

        function hexToRgba(hex, a) {
            const n = parseInt(hex.slice(1), 16);
            return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
        }

        // Centre of the portrait in hero coordinates (offset-based, so entry transforms don't skew it)
        function portraitCentre() {
            if (!portrait) return { x: W * 0.7, y: H * 0.5, w: 260, h: 340 };
            let x = 0, y = 0, el = portrait;
            while (el && el !== hero) {
                x += el.offsetLeft;
                y += el.offsetTop;
                el = el.offsetParent;
            }
            return { x: x + portrait.offsetWidth / 2, y: y + portrait.offsetHeight / 2, w: portrait.offsetWidth, h: portrait.offsetHeight };
        }

        function layout() {
            const rect = hero.getBoundingClientRect();
            W = Math.max(1, Math.round(rect.width));
            H = Math.max(1, Math.round(rect.height));
            dpr = Math.min(2, window.devicePixelRatio || 1);
            canvas.width = Math.round(W * dpr);
            canvas.height = Math.round(H * dpr);

            const p = portraitCentre();
            cx = p.x;
            cy = p.y;
            const mobile = W < 960;
            r0 = Math.hypot(p.w, p.h) / 2 + (mobile ? 16 : 26);

            const n = lamps.length;
            const minSpacing = mobile ? 6.5 : 8.5;
            const maxSpacing = mobile ? 16 : 22;
            if (n) {
                const edge = Math.min(cx, W - cx, cy, H - cy);
                const target = Math.max(r0 + (mobile ? 50 : 80), edge - 12);
                const ideal = Math.sqrt(Math.PI * (target * target - r0 * r0) / n);
                spacing = Math.max(minSpacing, Math.min(maxSpacing, ideal));
                const c2 = Math.pow(spacing / 1.77, 2);
                lamps.forEach((l, i) => {
                    l.r = Math.sqrt(r0 * r0 + c2 * (i + 0.5)) + l.jitter * spacing * 0.22;
                });
                rOuter = Math.sqrt(r0 * r0 + c2 * n);
            } else {
                rOuter = r0 + 60;
            }
            buildRing();
            if (!running) draw(performance.now());
        }

        // Static yantra: fine gold circles and petal ticks framing the lamps
        function buildRing() {
            ring = document.createElement('canvas');
            ring.width = canvas.width;
            ring.height = canvas.height;
            const g = ring.getContext('2d');
            g.scale(dpr, dpr);
            g.translate(cx, cy);
            g.strokeStyle = 'rgba(242, 209, 140, 0.22)';
            g.lineWidth = 1;
            const inner = r0 - 10;
            g.beginPath();
            g.arc(0, 0, inner, 0, Math.PI * 2);
            g.stroke();

            const petals = 24;
            g.strokeStyle = 'rgba(242, 209, 140, 0.14)';
            for (let i = 0; i < petals; i++) {
                const a0 = (i / petals) * Math.PI * 2;
                const a1 = ((i + 1) / petals) * Math.PI * 2;
                const am = (a0 + a1) / 2;
                const outer = rOuter + 22;
                g.beginPath();
                g.moveTo(Math.cos(a0) * (outer - 4), Math.sin(a0) * (outer - 4));
                g.quadraticCurveTo(Math.cos(am) * (outer + 30), Math.sin(am) * (outer + 30), Math.cos(a1) * (outer - 4), Math.sin(a1) * (outer - 4));
                g.stroke();
            }
            g.setLineDash([1, 7]);
            g.strokeStyle = 'rgba(242, 209, 140, 0.3)';
            g.beginPath();
            g.arc(0, 0, rOuter + 12, 0, Math.PI * 2);
            g.stroke();
        }

        function setYears(list) {
            years = list;
            // Oldest year innermost, like the rings of a tree
            const ordered = list.slice().reverse();
            lamps = [];
            ordered.forEach(y => {
                y.offerings.forEach(o => {
                    lamps.push({
                        o,
                        color: y.color,
                        size: 0.85 + Math.min(1, (o.text || '').length / 4500) * 0.75,
                        phase: Math.random() * Math.PI * 2,
                        speed: 0.0018 + Math.random() * 0.0026,
                        jitter: Math.random() - 0.5,
                        r: 0,
                        delay: 0
                    });
                });
            });
            const n = lamps.length;
            lamps.forEach((l, i) => { l.delay = (i / Math.max(1, n)) * 2400 + Math.random() * 260; });
            layout();
            igniteStart = performance.now();
            start();
        }

        function lampPos(i, rot) {
            const l = lamps[i];
            const a = i * GOLDEN_ANGLE + rot;
            return { x: cx + Math.cos(a) * l.r, y: cy + Math.sin(a) * l.r };
        }

        function draw(now) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            if (ring) ctx.drawImage(ring, 0, 0);
            if (!lamps.length) return;

            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.globalCompositeOperation = 'lighter';
            const base = spacing * 1.9;
            const elapsed = reduced ? Infinity : now - igniteStart;

            for (let i = 0; i < lamps.length; i++) {
                const l = lamps[i];
                const life = Math.min(1, Math.max(0, (elapsed - l.delay) / 500));
                if (life <= 0) continue;
                const flicker = reduced ? 0.92 : 0.8 + 0.2 * Math.sin(now * l.speed + l.phase);
                const a = i * GOLDEN_ANGLE + rotation;
                const x = cx + Math.cos(a) * l.r;
                const y = cy + Math.sin(a) * l.r;
                if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
                const s = base * l.size * (0.85 + 0.15 * flicker) * (0.6 + 0.4 * life);
                ctx.globalAlpha = 0.62 * flicker * life;
                ctx.drawImage(sprite(l.color), x - s / 2, y - s / 2, s, s);
            }

            const active = touchPinned >= 0 ? touchPinned : hovered;
            if (active >= 0 && lamps[active]) {
                const p = lampPos(active, rotation);
                const s = Math.max(34, base * 3.4);
                ctx.globalAlpha = 1;
                ctx.drawImage(sprite('#FFE7B0'), p.x - s / 2, p.y - s / 2, s, s);
                ctx.globalCompositeOperation = 'source-over';
                ctx.strokeStyle = 'rgba(255, 231, 176, 0.85)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(p.x, p.y, Math.max(9, spacing * 0.9), 0, Math.PI * 2);
                ctx.stroke();
                placeTip(p);
            }
            ctx.globalAlpha = 1;
            ctx.globalCompositeOperation = 'source-over';
        }

        function frame(now) {
            if (!running) return;
            const dt = lastTime ? Math.min(64, now - lastTime) : 16;
            lastTime = now;
            // Hold still while a lamp is being read
            if (hovered < 0 && touchPinned < 0) rotation += dt * 0.000012;
            draw(now);
            rafId = requestAnimationFrame(frame);
        }

        function start() {
            if (reduced) { draw(performance.now()); return; }
            if (running || !inView || document.hidden) return;
            running = true;
            lastTime = 0;
            rafId = requestAnimationFrame(frame);
        }

        function stop() {
            running = false;
            cancelAnimationFrame(rafId);
        }

        // ---------- Interaction ----------
        function nearest(x, y) {
            const radius = Math.max(14, spacing * 1.1);
            let best = -1;
            let bestD = radius * radius;
            for (let i = 0; i < lamps.length; i++) {
                const p = lampPos(i, rotation);
                const dx = p.x - x;
                const dy = p.y - y;
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
            return !!(target && target.closest && target.closest('.hero-copy, .hero-portrait, .lamp-tip, a, button'));
        }

        function showTip(i) {
            const l = lamps[i];
            if (!l || !tip) return;
            const where = VP.formatLocation(l.o);
            tip.innerHTML = `<strong>${VP.escapeHtml(l.o.name)}</strong>`
                + (where ? `<span>${VP.escapeHtml(where)}</span>` : '')
                + `<em>${l.o.year} · ${matchMedia('(hover: none)').matches ? 'Tap again to read' : 'Click to read'}</em>`;
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
            hero.classList.toggle('is-lamp-hover', i >= 0);
            if (i >= 0) showTip(i); else if (touchPinned < 0) hideTip();
            if (!running) draw(performance.now());
        }

        hero.addEventListener('pointermove', e => {
            if (e.pointerType === 'touch' || !lamps.length) return;
            if (blocked(e.target)) { setHover(-1); return; }
            const pt = localPoint(e);
            setHover(nearest(pt.x, pt.y));
        });
        hero.addEventListener('pointerleave', () => setHover(-1));

        hero.addEventListener('click', e => {
            if (!lamps.length || blocked(e.target)) return;
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
            window.location.href = VP.offeringUrl(lamps[i].o);
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
