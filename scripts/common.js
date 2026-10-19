// ============================================
// Shared helpers (exposed as window.VP)
// Data loading, normalisation, header, reveal-on-scroll
// ============================================
(function () {
    'use strict';

    const config = window.VYASA_CONFIG || { years: [], limits: {} };
    const years = (config.years || []).slice().sort((a, b) => b.year - a.year);
    const yearCache = new Map();
    const LIVE_TIMEOUT_MS = 15000;

    // ---------- Formatting ----------
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function ordinal(n) {
        const s = ['th', 'st', 'nd', 'rd'];
        const v = n % 100;
        return n + (s[(v - 20) % 10] || s[v] || s[0]);
    }

    function formatNumber(n) {
        return Number(n || 0).toLocaleString('en-US');
    }

    function cleanLine(value) {
        return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    }

    function cleanText(value) {
        return typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
    }

    function formatLocation(offering) {
        return [offering.city, offering.country].filter(Boolean).join(', ');
    }

    // ---------- Years ----------
    function getYear(year) {
        return years.find(y => y.year === Number(year)) || null;
    }

    function currentYear() {
        return getYear(config.currentYear) || years[0] || null;
    }

    function isSubmissionOpen(yearConfig) {
        if (!yearConfig || !yearConfig.submissionsOpen) return false;
        if (!yearConfig.closesOn) return true;
        const closes = new Date(yearConfig.closesOn + 'T23:59:59');
        return !isNaN(closes) && Date.now() <= closes.getTime();
    }

    function hasEndpoint() {
        return typeof config.submissionEndpoint === 'string' && /^https:\/\//.test(config.submissionEndpoint.trim());
    }

    // ---------- Data ----------
    // Accepts both the legacy Google-Form shape ("Your Name", "Your Offering ", ...)
    // and the clean shape returned by the Apps Script ({ id, name, city, country, offering }).
    function normalizeOffering(raw, year, fallbackId) {
        if (!raw || typeof raw !== 'object') return null;
        const pick = (keys, cleaner) => {
            for (const key of keys) {
                const v = cleaner(raw[key]);
                if (v) return v;
            }
            return '';
        };
        const name = pick(['name', 'Your Name'], cleanLine);
        const text = pick(['offering', 'text', 'Your Offering ', 'Your Offering'], cleanText);
        if (!name && !text) return null;

        return {
            id: raw.id ? String(raw.id) : fallbackId,
            name: name || 'Anonymous',
            city: pick(['city', 'Name of City you are from'], cleanLine),
            country: pick(['country', 'Country'], cleanLine),
            text,
            year: Number(year),
            submittedAt: raw.submittedAt || null
        };
    }

    function compareByName(a, b) {
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    }

    async function fetchJson(url, options = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), options.timeout || 30000);
        try {
            const res = await fetch(url, { ...options, signal: controller.signal });
            if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
            return await res.json();
        } finally {
            clearTimeout(timer);
        }
    }

    async function loadStatic(yearConfig) {
        if (!yearConfig.dataFile) return [];
        const data = await fetchJson(yearConfig.dataFile);
        // Either a bare array, or a saved `?action=list` response ({ ok, offerings: [...] }).
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.offerings) ? data.offerings : null);
        if (!list) throw new Error(`${yearConfig.dataFile} has no offerings array`);
        return list
            .map((raw, i) => normalizeOffering(raw, yearConfig.year, `${yearConfig.year}-${i}`))
            .filter(Boolean);
    }

    async function loadLive(yearConfig) {
        if (!yearConfig.live || !hasEndpoint()) return [];
        const url = `${config.submissionEndpoint.trim()}?action=list&year=${encodeURIComponent(yearConfig.year)}`;
        const data = await fetchJson(url, { timeout: LIVE_TIMEOUT_MS });
        if (!data || data.ok !== true || !Array.isArray(data.offerings)) {
            throw new Error((data && data.error) || 'Unexpected response from submission endpoint');
        }
        return data.offerings
            .map((raw, i) => normalizeOffering(raw, yearConfig.year, `${yearConfig.year}-live-${i}`))
            .filter(Boolean);
    }

    function loadYear(year) {
        const yearConfig = getYear(year);
        if (!yearConfig) return Promise.resolve({ year: Number(year), offerings: [], errors: ['Unknown year'] });
        if (yearCache.has(yearConfig.year)) return yearCache.get(yearConfig.year);

        const promise = Promise.allSettled([loadStatic(yearConfig), loadLive(yearConfig)]).then(results => {
            const errors = [];
            const seen = new Set();
            const offerings = [];
            results.forEach(r => {
                if (r.status === 'rejected') {
                    console.warn(`[Vyasa Puja] Could not load part of ${yearConfig.year}:`, r.reason);
                    errors.push(String(r.reason && r.reason.message || r.reason));
                    return;
                }
                r.value.forEach(o => {
                    if (seen.has(o.id)) return;
                    seen.add(o.id);
                    offerings.push(o);
                });
            });
            offerings.sort(compareByName);
            return { year: yearConfig.year, offerings, errors };
        });

        yearCache.set(yearConfig.year, promise);
        return promise;
    }

    function loadAllYears() {
        return Promise.all(years.map(y => loadYear(y.year)));
    }

    function offeringUrl(offering) {
        return `offerings.html?year=${offering.year}#o=${encodeURIComponent(offering.id)}`;
    }

    function prefersReducedMotion() {
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // ---------- Header ----------
    function initHeader() {
        const header = document.querySelector('.site-header');
        if (!header) return;
        const toggle = header.querySelector('.nav-toggle');
        const nav = header.querySelector('.site-nav');

        if (toggle && nav) {
            const setOpen = open => {
                header.classList.toggle('nav-open', open);
                toggle.setAttribute('aria-expanded', String(open));
            };
            toggle.addEventListener('click', () => setOpen(!header.classList.contains('nav-open')));
            nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
            document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
        }

        const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    // ---------- Reveal on scroll ----------
    function initReveal(root = document) {
        const items = root.querySelectorAll('[data-reveal]:not(.is-visible)');
        if (!items.length) return;
        if (!('IntersectionObserver' in window) || prefersReducedMotion()) {
            items.forEach(el => el.classList.add('is-visible'));
            return;
        }
        const io = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    io.unobserve(entry.target);
                }
            });
        }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
        items.forEach(el => io.observe(el));
    }

    // ---------- Year text bindings ----------
    function bindYearText() {
        const cy = currentYear();
        if (!cy) return;
        document.querySelectorAll('[data-current-year]').forEach(el => { el.textContent = cy.year; });
        document.querySelectorAll('[data-current-edition]').forEach(el => { el.textContent = ordinal(cy.edition); });
    }

    window.VP = {
        config,
        years,
        getYear,
        currentYear,
        isSubmissionOpen,
        hasEndpoint,
        normalizeOffering,
        loadYear,
        loadAllYears,
        offeringUrl,
        escapeHtml,
        ordinal,
        formatNumber,
        formatLocation,
        prefersReducedMotion,
        initReveal
    };

    document.addEventListener('DOMContentLoaded', () => {
        bindYearText();
        initHeader();
        initReveal();
    });
})();
