// ============================================
// Lectures Page — fully data-driven
// ============================================
// To add a new lecture series:
//   1. Add a PDF to assets/pdfs/
//   2. Create data/lectures/<id>.json with the lectures array
//   3. Add an entry to data/lectures/index.json with a unique "id"
// Multiple series per year are supported automatically.
// No HTML or JS changes needed.
// ============================================

let lectureIndex = [];
let seriesByYear = {};     // { 2026: [entry, entry], 2027: [entry] }
let selectedYear = null;
let selectedSeries = null; // the currently active entry from index.json
let loadToken = 0;

const ICONS = {
    place: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 18s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="8" r="2.2" stroke="currentColor" stroke-width="1.5"/></svg>',
    book: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5v-11zM10 5v11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    download: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 16.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevron: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M5 8l5 5 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};

document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.lectures-page')) return;
    initLecturesPage();
});

async function initLecturesPage() {
    try {
        const res = await fetch('data/lectures/index.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        lectureIndex = await res.json();
    } catch (err) {
        console.error('Failed to load lecture index:', err);
        document.getElementById('lectures-container').innerHTML =
            '<li class="days-empty"><p>The lectures could not be loaded just now. Please refresh the page to try again.</p></li>';
        return;
    }

    // Group entries by year
    seriesByYear = {};
    lectureIndex.forEach(entry => {
        if (!seriesByYear[entry.year]) seriesByYear[entry.year] = [];
        seriesByYear[entry.year].push(entry);
    });

    // Sort years descending (newest first)
    const years = Object.keys(seriesByYear).map(Number).sort((a, b) => b - a);
    if (!years.length) {
        document.getElementById('lectures-container').innerHTML =
            '<li class="days-empty"><p>No lectures have been added yet.</p></li>';
        return;
    }

    renderYearTabs(years);

    const fromUrl = parseInt(new URLSearchParams(location.search).get('year'), 10);
    selectYear(seriesByYear[fromUrl] ? fromUrl : years[0], false);
}

// ---- Year Tabs ----
function renderYearTabs(years) {
    const container = document.getElementById('year-selector');
    container.innerHTML = '';
    // A single year needs no chooser
    container.hidden = years.length < 2;

    years.forEach(year => {
        const count = seriesByYear[year].reduce((sum, e) => sum + (e.lectureCount || 0), 0);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'year-tab';
        btn.dataset.year = year;
        btn.innerHTML = `<b>${year}</b><small>${count} lecture${count !== 1 ? 's' : ''}</small>`;
        btn.addEventListener('click', () => selectYear(year, true));
        container.appendChild(btn);
    });
}

function selectYear(year, updateUrl) {
    selectedYear = year;
    const entries = seriesByYear[year];
    if (!entries || entries.length === 0) return;

    document.querySelectorAll('.year-tab').forEach(tab => {
        tab.setAttribute('aria-pressed', String(parseInt(tab.dataset.year, 10) === year));
    });

    if (updateUrl) {
        const url = new URL(location.href);
        url.searchParams.set('year', year);
        history.replaceState(null, '', url);
    }

    // Render series selector (shows only when >1 series for the year)
    renderSeriesSelector(entries);

    // Select first series by default
    selectSeries(entries[0]);
}

// ---- Series Selector ----
function renderSeriesSelector(entries) {
    const section = document.getElementById('series-selector-section');
    const container = document.getElementById('series-selector');
    container.innerHTML = '';
    section.hidden = entries.length <= 1;
    if (entries.length <= 1) return;

    entries.forEach(entry => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'series-tab';
        btn.dataset.id = entry.id;
        btn.innerHTML = `
            <span class="series-tab-title">${escHTML(entry.title)}</span>
            <span class="series-tab-meta">${escHTML(entry.subtitle || '')}${entry.subtitle ? ' · ' : ''}${entry.lectureCount} lecture${entry.lectureCount !== 1 ? 's' : ''}</span>
        `;
        btn.addEventListener('click', () => selectSeries(entry));
        container.appendChild(btn);
    });
}

function selectSeries(entry) {
    selectedSeries = entry;

    document.querySelectorAll('.series-tab').forEach(tab => {
        tab.setAttribute('aria-pressed', String(tab.dataset.id === entry.id));
    });

    renderHero(entry);
    loadLectures(entry);
}

// ---- Hero ----
function titleWithEmphasis(title) {
    // Set the final word in the italic reading face, as on the other pages
    const parts = String(title || '').trim().split(/\s+/);
    if (parts.length < 2) return escHTML(title || '');
    const last = parts.pop();
    return `${escHTML(parts.join(' '))} <em>${escHTML(last)}</em>`;
}

function renderHero(entry) {
    const hero = document.getElementById('lectures-hero-content');
    const count = entry.lectureCount || 0;

    const actions = entry.pdf
        ? `<div class="lectures-actions">
                <a href="${esc(entry.pdf)}" target="_blank" rel="noopener" class="btn btn-marigold">
                    ${ICONS.book}
                    Read the booklet
                </a>
                <a href="${esc(entry.pdf)}" download class="btn btn-ghost on-dark">
                    ${ICONS.download}
                    Download PDF
                </a>
            </div>`
        : '';

    hero.innerHTML = `
        <span class="kicker on-dark">${escHTML(entry.subtitle || 'Initiation lectures')}</span>
        <h1 class="page-title" id="page-title">${titleWithEmphasis(entry.title)}</h1>
        <p class="page-lede">Reflections by ${escHTML(entry.speaker || 'His Holiness Radhanath Swami Mahārāja')}</p>
        <dl class="lectures-facts">
            ${entry.location ? `<div><dt>Where</dt><dd>${escHTML(entry.location)}</dd></div>` : ''}
            <div><dt>Lectures</dt><dd>${count} ${count === 1 ? 'day' : 'days'}</dd></div>
        </dl>
        ${actions}
    `;

    document.title = `${entry.title} — Initiation lectures · Vyasa Puja`;
}

// ---- Lectures ----
async function loadLectures(entry) {
    const container = document.getElementById('lectures-container');
    const token = ++loadToken;
    container.setAttribute('aria-busy', 'true');
    container.innerHTML = '<li class="days-loading"><div class="spinner"></div><span>Opening the booklet…</span></li>';

    try {
        const res = await fetch(entry.dataFile);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const lectures = await res.json();
        if (token !== loadToken) return;
        renderLectures(lectures, container, entry);
    } catch (err) {
        if (token !== loadToken) return;
        console.error('Error loading lectures:', err);
        container.innerHTML = '<li class="days-empty"><p>No lecture details are available yet.</p></li>';
    } finally {
        if (token === loadToken) container.removeAttribute('aria-busy');
    }
}

function renderLectures(lectures, container, entry) {
    container.innerHTML = '';
    if (!Array.isArray(lectures) || !lectures.length) {
        container.innerHTML = '<li class="days-empty"><p>No lecture details are available yet.</p></li>';
        return;
    }

    lectures.forEach((lecture, idx) => {
        const n = idx + 1;
        const topicsId = `topics-${entry.id}-${n}`;
        const node = document.createElement('li');
        node.className = 'day';
        node.setAttribute('data-reveal', '');
        node.style.setProperty('--reveal-delay', `${Math.min(idx, 3) * 0.06}s`);

        const date = lecture.date ? new Date(lecture.date + 'T00:00:00') : null;
        const valid = date && !isNaN(date);
        const dayOfMonth = valid ? date.getDate() : '';
        const month = valid ? date.toLocaleDateString('en-GB', { month: 'long' }) : '';
        const weekday = valid ? date.toLocaleDateString('en-GB', { weekday: 'long' }) : '';
        const year = valid ? date.getFullYear() : '';
        const longDate = valid ? date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '';
        const topics = Array.isArray(lecture.topics) ? lecture.topics : [];

        const topicsHTML = topics.length ? `
            <button type="button" class="topics-toggle" aria-expanded="false" aria-controls="${topicsId}">
                <span class="topics-toggle-label">${topics.length} topics covered</span>
                ${ICONS.chevron}
            </button>
            <div class="topics" id="${topicsId}">
                <div class="topics-inner">
                    <ol class="topic-list">
                        ${topics.map(t => `<li>${escHTML(t)}</li>`).join('')}
                    </ol>
                </div>
            </div>` : '';

        node.innerHTML = `
            <div class="day-mark">
                <span class="day-count">Day <b>${n}</b></span>
                ${valid ? `<time class="day-date" datetime="${esc(lecture.date)}" aria-label="${esc(longDate)}">
                    <span class="day-dom">${dayOfMonth}</span>
                    <span class="day-month">${escHTML(month)} ${year}</span>
                    <span class="day-week">${escHTML(weekday)}</span>
                </time>` : ''}
            </div>
            <span class="day-flower" aria-hidden="true"></span>
            <article class="day-card" aria-labelledby="day-title-${entry.id}-${n}">
                ${lecture.type ? `<p class="day-type">${escHTML(lecture.type)}</p>` : ''}
                <h2 class="day-title" id="day-title-${entry.id}-${n}">${escHTML(lecture.title)}</h2>
                ${lecture.subtitle ? `<p class="day-sub">${escHTML(lecture.subtitle)}</p>` : ''}
                ${lecture.summary ? `<p class="day-summary">${escHTML(lecture.summary)}</p>` : ''}
                ${topicsHTML}
                ${lecture.location ? `<p class="day-place">${ICONS.place}<span>${escHTML(lecture.location)}</span></p>` : ''}
            </article>
        `;

        container.appendChild(node);

        const toggleBtn = node.querySelector('.topics-toggle');
        if (toggleBtn) {
            const topicsList = node.querySelector('.topics');
            const label = toggleBtn.querySelector('.topics-toggle-label');
            toggleBtn.addEventListener('click', () => {
                const open = toggleBtn.getAttribute('aria-expanded') !== 'true';
                toggleBtn.setAttribute('aria-expanded', String(open));
                topicsList.classList.toggle('is-open', open);
                label.textContent = open ? 'Hide topics' : `${topics.length} topics covered`;
            });
        }
    });

    if (window.VP && typeof VP.initReveal === 'function') {
        VP.initReveal(container);
    } else {
        container.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('is-visible'));
    }
}

// ---- Utilities ----
function escHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function esc(text) {
    return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
