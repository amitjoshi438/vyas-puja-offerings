// ============================================
// Books page: the books of earlier years, read online or downloaded.
// The list comes from VYASA_CONFIG.books (scripts/config.js).
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    if (!VP) return;

    const ICONS = {
        book: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5v11c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5v-11zM10 5v11" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
        download: '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M10 3v10M5.5 8.5L10 13l4.5-4.5M4 16.5h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        const list = document.getElementById('book-list');
        if (!list) return;
        const books = ((VP.config && VP.config.books) || []).slice().sort((a, b) => b.year - a.year);

        if (!books.length) {
            list.innerHTML = '<li class="books-empty">The books will be shared here soon.</li>';
            return;
        }

        const esc = VP.escapeHtml;
        list.innerHTML = books.map((b, i) => `
            <li class="book" id="book-${b.year}" data-reveal style="--reveal-delay:${(i * 0.08).toFixed(2)}s">
                <a class="book-cover" href="${esc(b.file)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">
                    <img src="${esc(b.cover)}" alt="" width="600" height="800" loading="lazy" decoding="async">
                    <span class="book-frame"></span>
                    <span class="book-ribbon"></span>
                </a>
                <div class="book-body">
                    <p class="book-eyebrow">Words of gratitude</p>
                    <h2 class="book-year"><span class="sr-only">Offerings of </span>${b.year}</h2>
                    <p class="book-meta">${VP.formatNumber(b.pages)} pages · PDF · ${esc(b.size)}</p>
                    <div class="book-actions">
                        <a class="btn" href="${esc(b.file)}" target="_blank" rel="noopener">
                            ${ICONS.book}
                            <span>Read online<span class="sr-only"> the ${b.year} book (opens in a new tab)</span></span>
                        </a>
                        <a class="btn btn-ghost" href="${esc(b.file)}" download>
                            ${ICONS.download}
                            <span>Download<span class="sr-only"> the ${b.year} book</span></span>
                        </a>
                    </div>
                </div>
            </li>`).join('');

        VP.initReveal(list);
        goToHash();
        window.addEventListener('hashchange', goToHash);
    }

    // The list is drawn after the page loads, so a link such as books.html#book-2024 has to be followed by hand
    function goToHash() {
        const match = /^#book-(\d{4})$/.exec(location.hash);
        document.querySelectorAll('.book.is-target').forEach(el => el.classList.remove('is-target'));
        if (!match) return;
        const el = document.getElementById(`book-${match[1]}`);
        if (!el) return;
        el.classList.add('is-visible', 'is-target');
        el.scrollIntoView({ behavior: VP.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }
})();
