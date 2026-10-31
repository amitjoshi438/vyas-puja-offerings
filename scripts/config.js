// ============================================
// Site configuration — the only file you normally need to edit
// ============================================
// To open a new year:
//   1. Add an entry at the top of `years` and set `currentYear` to it.
//   2. Set the same year as CONFIG.CURRENT_YEAR in the Apps Script (backend/google-apps-script/Code.gs).
// To archive a finished year:
//   1. Export its approved offerings to data/<year>/offerings.json (see backend/google-apps-script/README.md).
//   2. Set `dataFile` for that year and set `live: false`, `submissionsOpen: false`.
// ============================================

window.VYASA_CONFIG = {
    // Google Apps Script web-app URL (ends in /exec). Leave empty to disable online submissions.
    submissionEndpoint: 'https://script.google.com/macros/s/AKfycbwyo-Ok-5nY-bULwOkj5p9JGWkIXj2gHRgmU2w3QsDHWTb9CK9jw3sZL0NEddQ6xsR0/exec',

    currentYear: 2026,

    years: [
        {
            year: 2026,
            edition: 76,
            dataFile: null,          // static JSON (optional) — e.g. 'data/2026/offerings.json' once archived
            live: true,              // also fetch approved offerings from the submission endpoint
            submissionsOpen: true,
            closesOn: null           // optional 'YYYY-MM-DD'; form closes automatically after this date
        },
        {
            year: 2025,
            edition: 75,
            dataFile: 'data/2025/offerings.json',
            live: false,
            submissionsOpen: false,
            closesOn: null
        }
    ],

    // Books of earlier years, newest first (shown on books.html and on the home page).
    // To add one: put the PDF in assets/pdfs/, a 3:4 portrait in assets/images/books/, then add an entry here.
    books: [
        { year: 2024, pages: 746, size: '12.4 MB', file: 'assets/pdfs/offerings-2024.pdf', cover: 'assets/images/books/2024.webp' },
        { year: 2023, pages: 664, size: '7.9 MB',  file: 'assets/pdfs/offerings-2023.pdf', cover: 'assets/images/books/2023.webp' },
        { year: 2021, pages: 501, size: '14 MB',   file: 'assets/pdfs/offerings-2021.pdf', cover: 'assets/images/books/2021.webp' }
    ],

    limits: {
        nameMax: 120,
        cityMax: 120,
        countryMax: 80,
        emailMax: 200,
        offeringMin: 20,
        offeringMax: 12000
    }
};
