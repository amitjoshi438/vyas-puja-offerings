// ============================================
// Offerings page: year tabs, search & filters, letters grid, reader
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    if (!VP) return;

    const BATCH = 48;
    const EXCERPT = 300;

    const els = {};
    const state = {
        year: null,
        offerings: [],
        filtered: [],
        rendered: 0,
        query: '',
        country: '',
        city: '',
        readerIndex: -1,
        returnFocus: null,
        loadToken: 0
    };
    let observer = null;

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        [
            'year-tabs', 'hero-kicker', 'hero-lede', 'search', 'search-clear', 'country-filter', 'city-filter',
            'random-btn', 'results-count', 'reset-filters', 'notice', 'letters', 'letters-state', 'load-more',
            'load-more-btn', 'sentinel', 'reader', 'reader-pos', 'reader-share', 'reader-close', 'reader-paper',
            'reader-kicker', 'reader-text', 'reader-name', 'reader-place', 'reader-prev', 'reader-next', 'toast'
        ].forEach(id => { els[id.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = document.getElementById(id); });

        const params = new URLSearchParams(location.search);
        state.query = (params.get('q') || '').trim();
        state.country = params.get('country') || '';
        state.city = params.get('city') || '';
        els.search.value = state.query;

        bindControls();
        bindReader();
        setupInfiniteScroll();

        const requested = Number(params.get('year'));
        chooseInitialYear(VP.getYear(requested) ? requested : null);

        window.addEventListener('popstate', () => {
            const y = Number(new URLSearchParams(location.search).get('year'));
            if (VP.getYear(y) && y !== state.year) loadYear(y, { push: false });
        });
    }

    // ---------- Year selection ----------
    async function chooseInitialYear(requested) {
        if (requested) {
            loadYear(requested, { push: false });
            return;
        }
        const current = VP.currentYear();
        if (!current) return;
        renderTabs(current.year);
        showLoading();
        const result = await VP.loadYear(current.year);
        if (result.offerings.length) {
            loadYear(current.year, { push: false });
            return;
        }
        // Nothing published yet for the current year — open the most recent year that has offerings
        const fallback = await findYearWithOfferings(current.year);
        if (fallback) {
            await loadYear(fallback, { push: false, replace: true });
            const open = VP.isSubmissionOpen(current) && VP.hasEndpoint();
            showNotice(`
                <strong>Offerings for ${current.year} will appear here as they are approved.</strong>
                <span>Meanwhile, read the offerings from ${fallback}.</span>
                ${open ? '<a class="text-link" href="offer.html">Offer yours</a>' : ''}`);
        } else {
            loadYear(current.year, { push: false });
        }
    }

    async function findYearWithOfferings(exclude) {
        for (const y of VP.years) {
            if (y.year === exclude) continue;
            const r = await VP.loadYear(y.year);
            if (r.offerings.length) return y.year;
        }
        return null;
    }

    async function loadYear(year, { push = true, replace = false } = {}) {
        const token = ++state.loadToken;
        state.year = year;
        renderTabs(year);
        updateHero(year);
        hideNotice();
        showLoading();

        if (push || replace) {
            const url = new URL(location.href);
            url.searchParams.set('year', year);
            url.hash = replace ? location.hash : '';
            history[push ? 'pushState' : 'replaceState'](null, '', url);
        }

        const result = await VP.loadYear(year);
        if (token !== state.loadToken) return;

        state.offerings = result.offerings;
        state.errors = result.errors;
        populateCountries();
        applyFilters({ keepUrl: !push });

        if (!state.offerings.length) renderEmptyYear(result);
        openFromHash();
    }

    function renderTabs(active) {
        els.yearTabs.innerHTML = VP.years.map(y => {
            const live = VP.isSubmissionOpen(y) && VP.hasEndpoint();
            return `<a class="year-tab${live ? ' is-live' : ''}" href="?year=${y.year}" data-year="${y.year}"${y.year === active ? ' aria-current="page"' : ''}>
                <b>${y.year}</b>
            </a>`;
        }).join('');
    }

    function updateHero(year) {
        const y = VP.getYear(year);
        if (!y) return;
        els.heroKicker.textContent = `Offerings · ${y.year}`;
        document.title = `Offerings ${y.year} — HH Radhanath Swami Maharaj`;
    }

    // ---------- Controls ----------
    function bindControls() {
        els.yearTabs.addEventListener('click', e => {
            const tab = e.target.closest('.year-tab');
            if (!tab || e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            const y = Number(tab.dataset.year);
            if (y !== state.year) {
                state.query = '';
                state.country = '';
                state.city = '';
                els.search.value = '';
                loadYear(y);
            }
        });

        let searchTimer = 0;
        els.search.addEventListener('input', () => {
            els.searchClear.hidden = !els.search.value;
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.query = els.search.value.trim();
                applyFilters();
            }, 180);
        });
        els.search.addEventListener('keydown', e => {
            if (e.key === 'Escape' && els.search.value) {
                e.preventDefault();
                clearSearch();
            }
        });
        els.searchClear.addEventListener('click', () => { clearSearch(); els.search.focus(); });

        els.countryFilter.addEventListener('change', () => {
            state.country = els.countryFilter.value;
            state.city = '';
            populateCities();
            applyFilters();
        });
        els.cityFilter.addEventListener('change', () => {
            state.city = els.cityFilter.value;
            applyFilters();
        });

        els.resetFilters.addEventListener('click', () => {
            state.query = state.country = state.city = '';
            els.search.value = '';
            els.searchClear.hidden = true;
            els.countryFilter.value = '';
            populateCities();
            applyFilters();
        });

        els.randomBtn.addEventListener('click', () => {
            const list = state.filtered.length ? state.filtered : state.offerings;
            if (!list.length) return;
            const pick = list[Math.floor(Math.random() * list.length)];
            openReader(state.filtered.indexOf(pick) >= 0 ? state.filtered.indexOf(pick) : 0, els.randomBtn);
        });

        els.letters.addEventListener('click', e => {
            const card = e.target.closest('.letter');
            if (!card) return;
            openReader(Number(card.dataset.index), card);
        });

        els.loadMoreBtn.addEventListener('click', renderBatch);
    }

    function clearSearch() {
        els.search.value = '';
        els.searchClear.hidden = true;
        state.query = '';
        applyFilters();
    }

    function key(value) {
        return String(value || '').toLocaleLowerCase().trim();
    }

    function populateCountries() {
        const map = new Map();
        state.offerings.forEach(o => {
            if (!o.country) return;
            const k = key(o.country);
            if (!map.has(k)) map.set(k, { label: o.country, count: 0 });
            map.get(k).count++;
        });
        const list = [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
        els.countryFilter.innerHTML = '<option value="">All countries</option>' + list
            .map(([k, v]) => `<option value="${VP.escapeHtml(k)}">${VP.escapeHtml(v.label)} (${v.count})</option>`)
            .join('');
        if (state.country && !map.has(key(state.country))) state.country = '';
        state.country = key(state.country);
        els.countryFilter.value = state.country;
        populateCities();
    }

    function populateCities() {
        const map = new Map();
        state.offerings.forEach(o => {
            if (!o.city) return;
            if (state.country && key(o.country) !== state.country) return;
            const k = key(o.city);
            if (!map.has(k)) map.set(k, { label: o.city, count: 0 });
            map.get(k).count++;
        });
        const list = [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
        els.cityFilter.innerHTML = '<option value="">All cities</option>' + list
            .map(([k, v]) => `<option value="${VP.escapeHtml(k)}">${VP.escapeHtml(v.label)} (${v.count})</option>`)
            .join('');
        if (state.city && !map.has(key(state.city))) state.city = '';
        state.city = key(state.city);
        els.cityFilter.value = state.city;
        els.cityFilter.disabled = list.length === 0;
    }

    // ---------- Filtering ----------
    function applyFilters({ keepUrl = false } = {}) {
        const q = key(state.query);
        state.filtered = state.offerings.filter(o => {
            if (state.country && key(o.country) !== state.country) return false;
            if (state.city && key(o.city) !== state.city) return false;
            if (!q) return true;
            return key(o.name).includes(q) || key(o.city).includes(q) || key(o.country).includes(q) || key(o.text).includes(q);
        });

        if (!keepUrl) syncUrl();
        els.resetFilters.hidden = !(state.query || state.country || state.city);
        resetGrid();
    }

    function syncUrl() {
        const url = new URL(location.href);
        const set = (k, v) => (v ? url.searchParams.set(k, v) : url.searchParams.delete(k));
        set('q', state.query);
        set('country', state.country);
        set('city', state.city);
        history.replaceState(null, '', url);
    }

    function resetGrid() {
        state.rendered = 0;
        els.letters.innerHTML = '';
        els.lettersState.hidden = true;
        updateCount();
        if (state.offerings.length && !state.filtered.length) {
            els.lettersState.hidden = false;
            els.lettersState.innerHTML = `
                <div class="empty-mark" aria-hidden="true"></div>
                <p><strong>No offerings match your search.</strong></p>
                <p>Try a different name, place or word.</p>`;
        }
        renderBatch();
    }

    function updateCount() {
        const total = state.offerings.length;
        const shown = state.filtered.length;
        if (!total) {
            els.resultsCount.textContent = '';
            return;
        }
        const filtered = shown !== total;
        els.resultsCount.innerHTML = filtered
            ? `<strong>${VP.formatNumber(shown)}</strong> of ${VP.formatNumber(total)} offerings`
            : `<strong>${VP.formatNumber(total)}</strong> offerings · ${state.year}`;
    }

    // ---------- Rendering ----------
    function renderBatch() {
        const next = state.filtered.slice(state.rendered, state.rendered + BATCH);
        if (next.length) {
            const frag = document.createDocumentFragment();
            const tmp = document.createElement('div');
            tmp.innerHTML = next.map((o, i) => letterHtml(o, state.rendered + i)).join('');
            while (tmp.firstChild) frag.appendChild(tmp.firstChild);
            els.letters.appendChild(frag);
            state.rendered += next.length;
        }
        els.loadMore.hidden = state.rendered >= state.filtered.length;
    }

    function excerptFor(text, q) {
        const flat = text.replace(/\s+/g, ' ');
        if (q) {
            const idx = flat.toLocaleLowerCase().indexOf(q);
            if (idx > EXCERPT - 80) {
                const start = Math.max(0, flat.lastIndexOf(' ', idx - 60));
                return '…' + flat.slice(start, start + EXCERPT).trim() + (start + EXCERPT < flat.length ? '…' : '');
            }
        }
        if (flat.length <= EXCERPT) return flat;
        const cut = flat.lastIndexOf(' ', EXCERPT);
        return flat.slice(0, cut > EXCERPT * 0.6 ? cut : EXCERPT) + '…';
    }

    function highlight(text, q) {
        if (!q) return VP.escapeHtml(text);
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let out = '';
        let last = 0;
        text.replace(re, (m, offset) => {
            out += VP.escapeHtml(text.slice(last, offset)) + `<mark>${VP.escapeHtml(m)}</mark>`;
            last = offset + m.length;
            return m;
        });
        return out + VP.escapeHtml(text.slice(last));
    }

    function letterHtml(o, index) {
        const q = key(state.query);
        const place = VP.formatLocation(o);
        const no = String(index + 1).padStart(4, '0');
        const words = o.text ? o.text.split(/\s+/).length : 0;
        return `
            <button type="button" class="letter" data-index="${index}" aria-haspopup="dialog" aria-label="Read the offering from ${VP.escapeHtml(o.name)}">
                <span class="letter-top"><span class="letter-no">№ ${no}</span><span class="letter-len">${words ? `${VP.formatNumber(words)} words` : ''}</span></span>
                <span class="letter-text">${highlight(excerptFor(o.text || '', q), q)}</span>
                <span class="letter-sign">
                    <b>${highlight(o.name, q)}</b>
                    ${place ? `<small>${highlight(place, q)}</small>` : ''}
                </span>
            </button>`;
    }

    function showLoading() {
        els.letters.innerHTML = '';
        els.loadMore.hidden = true;
        els.resultsCount.textContent = 'Gathering offerings…';
        els.lettersState.hidden = false;
        els.lettersState.innerHTML = '<div class="spinner" aria-hidden="true"></div><p>Gathering offerings…</p>';
    }

    function renderEmptyYear(result) {
        const y = VP.getYear(state.year);
        const open = y && VP.isSubmissionOpen(y) && VP.hasEndpoint();
        const failed = result.errors && result.errors.length;
        els.resultsCount.textContent = '';
        els.lettersState.hidden = false;
        if (failed) {
            els.lettersState.innerHTML = `
                <div class="empty-mark" aria-hidden="true"></div>
                <p><strong>We couldn't gather the offerings just now.</strong></p>
                <p>Please check your connection and try again.</p>
                <button type="button" class="btn btn-ghost" id="retry-btn">Try again</button>`;
            document.getElementById('retry-btn').addEventListener('click', () => location.reload());
            return;
        }
        els.lettersState.innerHTML = `
            <div class="empty-mark" aria-hidden="true"></div>
            <p><strong>No offerings have been published for ${state.year} yet.</strong></p>
            <p>${open ? 'Be among the first to offer your words to Gurudev.' : 'Please check back soon.'}</p>
            ${open ? '<a class="btn" href="offer.html">Write your offering</a>' : ''}`;
    }

    function showNotice(html) {
        els.notice.innerHTML = html;
        els.notice.hidden = false;
    }

    function hideNotice() {
        els.notice.hidden = true;
        els.notice.innerHTML = '';
    }

    function setupInfiniteScroll() {
        if (!('IntersectionObserver' in window)) return;
        observer = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && state.rendered < state.filtered.length && !els.reader.open) renderBatch();
        }, { rootMargin: '900px 0px' });
        observer.observe(els.sentinel);
    }

    // ---------- Reader ----------
    function bindReader() {
        els.readerClose.addEventListener('click', closeReader);
        els.readerPrev.addEventListener('click', () => stepReader(-1));
        els.readerNext.addEventListener('click', () => stepReader(1));
        els.readerShare.addEventListener('click', shareCurrent);

        els.reader.addEventListener('close', onReaderClosed);
        els.reader.addEventListener('cancel', e => { e.preventDefault(); closeReader(); });
        els.reader.addEventListener('click', e => {
            if (e.target === els.reader) closeReader();
        });
        els.reader.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight') { e.preventDefault(); stepReader(1); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); stepReader(-1); }
        });

        let sx = 0, sy = 0, st = 0;
        els.reader.addEventListener('touchstart', e => {
            const t = e.changedTouches[0];
            sx = t.clientX; sy = t.clientY; st = Date.now();
        }, { passive: true });
        els.reader.addEventListener('touchend', e => {
            const t = e.changedTouches[0];
            const dx = t.clientX - sx;
            const dy = t.clientY - sy;
            if (Date.now() - st < 600 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) stepReader(dx < 0 ? 1 : -1);
        }, { passive: true });
    }

    function paragraphs(text) {
        return text
            .split(/\n{2,}/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => `<p>${VP.escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
            .join('');
    }

    function fillReader() {
        const o = state.filtered[state.readerIndex];
        if (!o) return;
        els.readerKicker.textContent = `Offering · ${o.year}`;
        els.readerText.innerHTML = paragraphs(o.text || '');
        els.readerName.textContent = o.name;
        els.readerPlace.textContent = VP.formatLocation(o);
        els.readerPos.textContent = `${VP.formatNumber(state.readerIndex + 1)} of ${VP.formatNumber(state.filtered.length)}`;
        els.readerPrev.disabled = state.readerIndex <= 0;
        els.readerNext.disabled = state.readerIndex >= state.filtered.length - 1;
        els.readerPaper.scrollTop = 0;
        els.reader.scrollTop = 0;
        const shell = els.reader.querySelector('.reader-shell');
        if (shell) shell.scrollTop = 0;
        history.replaceState(null, '', `${location.pathname}${location.search}#o=${encodeURIComponent(o.id)}`);
    }

    function openReader(index, trigger) {
        if (!state.filtered[index]) return;
        state.readerIndex = index;
        state.returnFocus = trigger || document.activeElement;
        fillReader();
        if (!els.reader.open) {
            if (typeof els.reader.showModal === 'function') els.reader.showModal();
            else els.reader.setAttribute('open', '');
            document.documentElement.classList.add('reader-open');
        }
        els.readerPaper.focus({ preventScroll: true });
    }

    function stepReader(dir) {
        const next = state.readerIndex + dir;
        if (next < 0 || next >= state.filtered.length) return;
        state.readerIndex = next;
        els.readerPaper.classList.remove('turn-next', 'turn-prev');
        void els.readerPaper.offsetWidth;
        els.readerPaper.classList.add(dir > 0 ? 'turn-next' : 'turn-prev');
        fillReader();
    }

    function closeReader() {
        if (typeof els.reader.close === 'function' && els.reader.open) els.reader.close();
        else { els.reader.removeAttribute('open'); onReaderClosed(); }
    }

    function onReaderClosed() {
        document.documentElement.classList.remove('reader-open');
        history.replaceState(null, '', `${location.pathname}${location.search}`);
        // Make sure the card we return to exists in the grid
        while (state.readerIndex >= state.rendered && state.rendered < state.filtered.length) renderBatch();
        const card = els.letters.querySelector(`.letter[data-index="${state.readerIndex}"]`);
        const target = card || state.returnFocus;
        if (target && typeof target.focus === 'function') {
            target.focus({ preventScroll: !card });
            if (card) card.scrollIntoView({ block: 'nearest' });
        }
        state.readerIndex = -1;
    }

    function openFromHash() {
        const m = location.hash.match(/^#o=(.+)$/);
        if (!m) return;
        const id = decodeURIComponent(m[1]);
        let index = state.filtered.findIndex(o => o.id === id);
        if (index < 0 && state.offerings.some(o => o.id === id)) {
            // Deep link to an offering hidden by current filters — clear them
            state.query = state.country = state.city = '';
            els.search.value = '';
            els.countryFilter.value = '';
            populateCities();
            applyFilters();
            index = state.filtered.findIndex(o => o.id === id);
        }
        if (index >= 0) openReader(index, null);
    }

    async function shareCurrent() {
        const o = state.filtered[state.readerIndex];
        if (!o) return;
        const url = new URL(VP.offeringUrl(o), location.href).href;
        const title = `Offering to Gurudev from ${o.name}`;
        if (navigator.share && matchMedia('(hover: none)').matches) {
            try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
        }
        try {
            await navigator.clipboard.writeText(url);
            toast('Link copied');
        } catch (e) {
            window.prompt('Copy this link:', url);
        }
    }

    let toastTimer = 0;
    function toast(message) {
        (els.reader.open ? els.reader : document.body).appendChild(els.toast);
        els.toast.textContent = message;
        els.toast.classList.add('is-visible');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
    }
})();
