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
    submissionEndpoint: '',

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

    limits: {
        nameMax: 120,
        cityMax: 120,
        countryMax: 80,
        emailMax: 200,
        offeringMin: 20,
        offeringMax: 12000
    }
};
