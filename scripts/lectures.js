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
        document.getElementById('lectures-hero-content').innerHTML =
            '<p style="color:rgba(255,255,255,0.7);padding:2rem;">Unable to load lectures.</p>';
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

    // Build year tabs
    renderYearTabs(years);

    // Select the most recent year by default
    selectYear(years[0]);
}

// ---- Year Tabs ----
function renderYearTabs(years) {
    const container = document.getElementById('year-selector');
    container.innerHTML = '';

    years.forEach(year => {
        const btn = document.createElement('button');
        btn.className = 'year-tab';
        btn.dataset.year = year;
        btn.textContent = year;
        btn.addEventListener('click', () => selectYear(year));
        container.appendChild(btn);
    });
}

function selectYear(year) {
    selectedYear = year;
    const entries = seriesByYear[year];
    if (!entries || entries.length === 0) return;

    // Update active year tab
    document.querySelectorAll('.year-tab').forEach(tab => {
        tab.classList.toggle('active', parseInt(tab.dataset.year, 10) === year);
    });

    // Render series selector (shows only when >1 series for the year)
    renderSeriesSelector(entries);

    // Select first series by default
    selectSeries(entries[0]);
}

// ---- Series Selector ----
function renderSeriesSelector(entries) {
    const section = document.getElementById('series-selector-section');
    const container = document.getElementById('series-selector');

    if (entries.length <= 1) {
        container.innerHTML = '';
        section.style.display = 'none';
        return;
    }

    section.style.display = '';
    container.innerHTML = '';

    entries.forEach(entry => {
        const btn = document.createElement('button');
        btn.className = 'series-tab';
        btn.dataset.id = entry.id;
        btn.innerHTML = `
            <span class="series-tab-title">${escHTML(entry.title)}</span>
            <span class="series-tab-meta">${entry.lectureCount} lecture${entry.lectureCount !== 1 ? 's' : ''}</span>
        `;
        btn.addEventListener('click', () => selectSeries(entry));
        container.appendChild(btn);
    });
}

function selectSeries(entry) {
    selectedSeries = entry;

    // Update active series tab
    document.querySelectorAll('.series-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.id === entry.id);
    });

    // Update hero
    renderHero(entry);

    // Load lectures
    loadLectures(entry);
}

// ---- Hero ----
function renderHero(entry) {
    const hero = document.getElementById('lectures-hero-content');

    const pdfButtons = entry.pdf
        ? `<div class="hero-cta">
                <a href="${esc(entry.pdf)}" target="_blank" class="pdf-btn pdf-btn-view">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/>
                    </svg>
                    Read Full Booklet
                </a>
                <a href="${esc(entry.pdf)}" download class="pdf-btn pdf-btn-download">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <polyline points="7,10 12,15 17,10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        <line x1="12" y1="15" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                    Download PDF
                </a>
            </div>`
        : '';

    hero.innerHTML = `
        <p class="hero-eyebrow">${escHTML(entry.subtitle)}</p>
        <h1 class="lectures-hero-title">
            <span class="title-sanskrit">दीक्षा</span>
            <span class="title-english">${escHTML(entry.title)}</span>
        </h1>
        <p class="lectures-hero-sub">Reflections by ${escHTML(entry.speaker)}</p>
        <div class="hero-meta">
            <span class="meta-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/></svg>
                ${escHTML(entry.location)}
            </span>
            <span class="meta-pill">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                ${entry.lectureCount} Lecture${entry.lectureCount !== 1 ? 's' : ''}
            </span>
        </div>
        ${pdfButtons}
    `;
}

// ---- Lectures Timeline ----
async function loadLectures(entry) {
    const container = document.getElementById('lectures-container');
    container.innerHTML = '<div class="lectures-loading"><div class="spinner"></div><p>Loading lectures...</p></div>';

    try {
        const res = await fetch(entry.dataFile);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const lectures = await res.json();
        renderLectures(lectures, container);
    } catch (err) {
        console.error('Error loading lectures:', err);
        container.innerHTML = `
            <div style="text-align:center;padding:3rem;color:var(--text-medium);">
                <p>No lecture details available yet.</p>
            </div>`;
    }
}

function renderLectures(lectures, container) {
    container.innerHTML = '';

    lectures.forEach((lecture, idx) => {
        const node = document.createElement('div');
        node.className = 'lecture-node';

        const dateObj = new Date(lecture.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });

        const topicsHTML = lecture.topics.map(t =>
            `<div class="topic-item">${escHTML(t)}</div>`
        ).join('');

        node.innerHTML = `
            <div class="lecture-date-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                ${dateStr}
            </div>
            <div class="lecture-card">
                <div class="lecture-card-inner">
                    <div class="lecture-card-top">
                        <span class="lecture-type">${escHTML(lecture.type)}</span>
                        <span class="lecture-day-num">Day ${idx + 1}</span>
                    </div>
                    <h2 class="lecture-title">${escHTML(lecture.title)}</h2>
                    <p class="lecture-subtitle">${escHTML(lecture.subtitle)}</p>
                    <p class="lecture-summary">${escHTML(lecture.summary)}</p>
                    <button class="lecture-topics-toggle" aria-expanded="false">
                        <span>View ${lecture.topics.length} topics covered</span>
                        <svg viewBox="0 0 24 24" fill="none">
                            <path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <div class="lecture-topics-list">
                        <div class="lecture-topics-inner">
                            ${topicsHTML}
                        </div>
                    </div>
                    <div class="lecture-location">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/>
                        </svg>
                        ${escHTML(lecture.location)}
                    </div>
                </div>
                <div class="lecture-card-accent"></div>
            </div>
        `;

        container.appendChild(node);

        // Toggle topics accordion
        const toggleBtn = node.querySelector('.lecture-topics-toggle');
        const topicsList = node.querySelector('.lecture-topics-list');
        toggleBtn.addEventListener('click', () => {
            const isExpanded = topicsList.classList.contains('expanded');
            topicsList.classList.toggle('expanded');
            toggleBtn.classList.toggle('expanded');
            toggleBtn.setAttribute('aria-expanded', !isExpanded);
        });
    });
}

// ---- Utilities ----
function escHTML(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function esc(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
