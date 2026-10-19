/**
 * Vyasa Puja Offerings — submission backend (Google Apps Script + Google Sheet)
 *
 *   POST  <exec URL>                        → save a devotee's offering (unapproved)
 *   GET   <exec URL>?action=list&year=2026  → approved offerings for that year (no emails)
 *
 * Moderation: an offering appears on the website only after a moderator ticks
 * its "Approved" checkbox in the sheet. Unticking hides it again.
 *
 * Setup and deployment: see README.md in this folder.
 */

// ============================================
// Settings — edit these, then Deploy → Manage deployments → Edit → New version
// ============================================
const CONFIG = {
  CURRENT_YEAR: 2026,        // must match `currentYear` in scripts/config.js
  SUBMISSIONS_OPEN: true,    // set to false to stop accepting new offerings
  CLOSES_ON: '',             // optional 'YYYY-MM-DD' — last day offerings are accepted (script time zone)
  NOTIFY_EMAIL: '',          // optional — comma-separated addresses to email on every new offering
  SHEET_NAME: 'Offerings',
  CACHE_SECONDS: 900,        // how long the published list is cached (changes in the sheet clear it)
  MIN_ELAPSED_MS: 3000,      // offerings sent sooner than this after opening the page are treated as bots
  RATE_LIMIT: { MAX: 5, WINDOW_SECONDS: 600 },  // per name + city
  LIMITS: {                  // keep in sync with `limits` in scripts/config.js
    nameMax: 120,
    cityMax: 120,
    countryMax: 80,
    emailMax: 200,
    offeringMin: 20,
    offeringMax: 12000
  }
};

// Column order is fixed. Add your own columns only AFTER "Notes".
const HEADERS = ['Timestamp', 'Year', 'Name', 'City', 'Country', 'Email', 'Offering', 'Approved', 'Id', 'Fingerprint', 'Notes'];
const COL = HEADERS.reduce((map, h, i) => { map[h.toLowerCase()] = i + 1; return map; }, {});

const CACHE_CHUNK_CHARS = 25000;   // CacheService values are capped at 100 KB (UTF-8)
const MAX_BODY_CHARS = 100000;

// ============================================
// Web app entry points
// ============================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === 'list') {
      const year = p.year ? Number(p.year) : CONFIG.CURRENT_YEAR;
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return json_({ ok: false, code: 'invalid', error: 'Unknown year.' });
      }
      const offerings = cachedList_(year);
      return json_({ ok: true, year, count: offerings.length, offerings });
    }
    return json_({
      ok: true,
      service: 'vyasa-puja-offerings',
      currentYear: CONFIG.CURRENT_YEAR,
      submissionsOpen: isOpen_()
    });
  } catch (err) {
    console.error('doGet failed', err);
    return json_({ ok: false, code: 'error', error: 'Could not load offerings right now.' });
  }
}

function doPost(e) {
  try {
    return json_(handleSubmit_(parseBody_(e)));
  } catch (err) {
    console.error('doPost failed', err);
    return json_({ ok: false, code: 'error', error: 'Something went wrong on our side. Please try again in a moment.' });
  }
}

// ============================================
// Submission
// ============================================
function handleSubmit_(p) {
  if (!p || typeof p !== 'object' || p.action !== 'submit') {
    return { ok: false, code: 'invalid', error: 'Unrecognised request.' };
  }
  // Honeypot: real people never see this field. Pretend all is well.
  if (p.website) return { ok: true, id: newId_() };
  if (!(Number(p.elapsedMs) >= CONFIG.MIN_ELAPSED_MS)) return { ok: false, code: 'too_fast' };
  if (Number(p.year) !== CONFIG.CURRENT_YEAR || !isOpen_()) {
    return { ok: false, code: 'closed', error: 'Offerings for this year are closed.' };
  }

  const checked = validate_(p);
  if (checked.error) return { ok: false, code: 'invalid', field: checked.field, error: checked.error };
  const o = checked.value;

  const fingerprint = sha256_([CONFIG.CURRENT_YEAR, o.name.toLowerCase(), o.offering.replace(/\s+/g, ' ').toLowerCase()].join('|'));
  const rateKey = 'rl:' + sha256_([o.name.toLowerCase(), o.city.toLowerCase()].join('|')).slice(0, 40);
  const cache = CacheService.getScriptCache();

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, code: 'busy' };
  let id;
  try {
    const sheet = getSheet_();
    const existing = findByFingerprint_(sheet, fingerprint);
    if (existing) return { ok: true, duplicate: true, id: existing };

    const sent = Number(cache.get(rateKey)) || 0;
    if (sent >= CONFIG.RATE_LIMIT.MAX) return { ok: false, code: 'rate_limited' };

    id = newId_();
    appendOffering_(sheet, o, id, fingerprint);
    cache.put(rateKey, String(sent + 1), CONFIG.RATE_LIMIT.WINDOW_SECONDS);
  } finally {
    lock.releaseLock();
  }

  notify_(o, id);
  return { ok: true, id };
}

function validate_(p) {
  const L = CONFIG.LIMITS;
  const v = {
    name: oneLine_(p.name),
    city: oneLine_(p.city),
    country: oneLine_(p.country),
    email: oneLine_(p.email),
    offering: multiLine_(p.offering)
  };
  const fail = (field, error) => ({ field, error });

  if (!v.offering) return fail('offering', 'Please write your offering.');
  if (v.offering.length < L.offeringMin) return fail('offering', `A few more words, please — at least ${L.offeringMin} characters.`);
  if (v.offering.length > L.offeringMax) return fail('offering', `Please keep your offering under ${L.offeringMax} characters.`);
  if (v.name.length < 2) return fail('name', 'Please sign with your name.');
  if (v.name.length > L.nameMax) return fail('name', `Please keep your name under ${L.nameMax} characters.`);
  if (!v.city) return fail('city', 'Which city are you writing from?');
  if (v.city.length > L.cityMax) return fail('city', `Please keep the city under ${L.cityMax} characters.`);
  if (!v.country) return fail('country', 'Which country are you writing from?');
  if (v.country.length > L.countryMax) return fail('country', `Please keep the country under ${L.countryMax} characters.`);
  if (v.email && (!isEmail_(v.email) || v.email.length > L.emailMax)) return fail('email', 'This email doesn’t look quite right — or leave it empty.');
  if (p.consent !== true && p.consent !== 'true') return fail('consent', 'Please confirm so we can publish your offering.');
  return { value: v };
}

function appendOffering_(sheet, o, id, fingerprint) {
  const row = sheet.getLastRow() + 1;
  if (row > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), 100);

  // Plain-text format first, so Sheets never turns "1-2" into a date or "=…" into a formula.
  sheet.getRange(row, COL.name, 1, COL.offering - COL.name + 1).setNumberFormat('@');
  sheet.getRange(row, COL.id, 1, COL.notes - COL.id + 1).setNumberFormat('@');
  sheet.getRange(row, COL.timestamp).setNumberFormat('yyyy-mm-dd hh:mm');

  sheet.getRange(row, 1, 1, HEADERS.length).setValues([[
    new Date(),
    CONFIG.CURRENT_YEAR,
    safeCell_(o.name),
    safeCell_(o.city),
    safeCell_(o.country),
    safeCell_(o.email),
    safeCell_(o.offering),
    false,
    id,
    fingerprint,
    ''
  ]]);
  sheet.getRange(row, COL.approved).insertCheckboxes();
}

function findByFingerprint_(sheet, fingerprint) {
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const rows = sheet.getRange(2, COL.id, last - 1, 2).getValues();   // [Id, Fingerprint]
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1]) === fingerprint) return String(rows[i][0] || '') || 'existing';
  }
  return null;
}

function notify_(o, id) {
  if (!CONFIG.NOTIFY_EMAIL) return;
  try {
    const excerpt = o.offering.length > 600 ? o.offering.slice(0, 600) + '…' : o.offering;
    const options = {
      to: CONFIG.NOTIFY_EMAIL,
      subject: `New Vyasa Puja offering — ${o.name}, ${o.city}`,
      name: 'Vyasa Puja Offerings',
      body: [
        `${o.name} (${o.city}, ${o.country}) has placed an offering. It is waiting for approval.`,
        '',
        excerpt,
        '',
        `Id: ${id}`,
        `Review and tick "Approved" to publish: ${getSpreadsheet_().getUrl()}`
      ].join('\n')
    };
    if (o.email) options.replyTo = o.email;
    MailApp.sendEmail(options);
  } catch (err) {
    console.warn('Notification email failed', err);
  }
}

// ============================================
// Published list (approved only, cached)
// ============================================
function listApproved_(year) {
  const sheet = getSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  const out = [];
  rows.forEach(r => {
    if (!isApproved_(r[COL.approved - 1])) return;
    if ((Number(r[COL.year - 1]) || CONFIG.CURRENT_YEAR) !== year) return;
    const name = oneLine_(unsafeCell_(r[COL.name - 1]));
    const offering = multiLine_(unsafeCell_(r[COL.offering - 1]));
    if (!name && !offering) return;
    const ts = r[COL.timestamp - 1];
    out.push({
      id: String(r[COL.id - 1] || '').trim() || 'h' + sha256_(name + '|' + offering).slice(0, 12),
      name,
      city: oneLine_(unsafeCell_(r[COL.city - 1])),
      country: oneLine_(unsafeCell_(r[COL.country - 1])),
      offering,
      submittedAt: isDate_(ts) ? ts.toISOString() : null
    });
  });
  return out;
}

function cachedList_(year) {
  const cache = CacheService.getScriptCache();
  const base = `list:${listGeneration_()}:${year}`;

  const meta = Number(cache.get(base));
  if (meta > 0) {
    const keys = [];
    for (let i = 0; i < meta; i++) keys.push(`${base}:${i}`);
    const parts = cache.getAll(keys);
    if (keys.every(k => typeof parts[k] === 'string')) {
      try { return JSON.parse(keys.map(k => parts[k]).join('')); } catch (_) { /* rebuild below */ }
    }
  }

  const list = listApproved_(year);
  try {
    const chunks = chunk_(JSON.stringify(list), CACHE_CHUNK_CHARS);
    const entries = {};
    chunks.forEach((c, i) => { entries[`${base}:${i}`] = c; });
    cache.putAll(entries, CONFIG.CACHE_SECONDS);
    cache.put(base, String(chunks.length), CONFIG.CACHE_SECONDS);
  } catch (err) {
    console.warn('Could not cache list', err);
  }
  return list;
}

function chunk_(text, size) {
  const out = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + size, text.length);
    // Never split a surrogate pair (emoji, some scripts) across two cache values.
    const code = text.charCodeAt(end - 1);
    if (end < text.length && code >= 0xD800 && code <= 0xDBFF) end--;
    out.push(text.slice(i, end));
    i = end;
  }
  return out.length ? out : [''];
}

function listGeneration_() {
  return PropertiesService.getScriptProperties().getProperty('LIST_GEN') || '0';
}

function bumpListGeneration_() {
  PropertiesService.getScriptProperties().setProperty('LIST_GEN', Utilities.getUuid().slice(0, 13));
}

// ============================================
// Sheet helpers, triggers and menu
// ============================================

/** Run once from the Apps Script editor (opened via the Sheet: Extensions → Apps Script). */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('Open the Google Sheet, choose Extensions → Apps Script, and run setup() from there.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ensureSheet_(ss);

  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onSheetEdit')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create();

  bumpListGeneration_();
  console.log(`Ready. Sheet "${CONFIG.SHEET_NAME}" is set up. Now deploy as a web app (see README.md).`);
}

/** Installable trigger (created by setup): publishes approval changes immediately. */
function onSheetEdit(e) {
  if (e && e.range && e.range.getSheet().getName() !== CONFIG.SHEET_NAME) return;
  bumpListGeneration_();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Vyasa Puja')
    .addItem('Publish changes to the website now', 'publishNow')
    .addItem('Set up / repair this sheet', 'setup')
    .addToUi();
}

function publishNow() {
  bumpListGeneration_();
  SpreadsheetApp.getActiveSpreadsheet().toast('The website will show the latest approved offerings on its next load.', 'Vyasa Puja', 5);
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No spreadsheet linked. Run setup() first.');
  return ss;
}

function getSheet_() {
  return ensureSheet_(getSpreadsheet_());
}

function ensureSheet_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  const header = sheet.getRange(1, 1, 1, HEADERS.length);
  const current = header.getValues()[0].map(v => String(v).trim());

  if (current.every(v => v === '')) {
    header.setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(COL.offering, 520);
    sheet.getRange(1, COL.approved).setNote('Tick to publish this offering on the website. Untick to hide it.');
    sheet.getRange(1, COL.email).setNote('Private — never shown on the website.');
    return sheet;
  }
  // Refuse to work with shifted columns: writing by position could publish private emails.
  if (!HEADERS.every((h, i) => current[i] === h)) {
    throw new Error(`Row 1 of "${CONFIG.SHEET_NAME}" must start with: ${HEADERS.join(', ')}. Add extra columns only after "Notes".`);
  }
  return sheet;
}

// ============================================
// Small utilities
// ============================================
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseBody_(e) {
  const raw = e && e.postData && e.postData.contents;
  if (raw && raw.length > MAX_BODY_CHARS) return null;
  if (raw) {
    try { return JSON.parse(raw); } catch (_) { /* maybe form-encoded */ }
  }
  return (e && e.parameter) || null;
}

function isOpen_() {
  if (!CONFIG.SUBMISSIONS_OPEN) return false;
  if (CONFIG.CLOSES_ON) {
    const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    if (today > CONFIG.CLOSES_ON) return false;
  }
  return true;
}

function isApproved_(v) {
  return v === true || /^(true|yes|y|1|✓|✔)$/i.test(String(v).trim());
}

function isDate_(v) {
  return Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v.getTime());
}

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

// Same normalisation as scripts/offer.js, so client and server agree on lengths.
function oneLine_(v) {
  return String(v == null ? '' : v).replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim();
}

function multiLine_(v) {
  return String(v == null ? '' : v)
    .replace(CONTROL_CHARS, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function isEmail_(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
}

// Guard against spreadsheet formula injection.
function safeCell_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function unsafeCell_(v) {
  const s = String(v == null ? '' : v);
  return /^'[=+\-@]/.test(s) ? s.slice(1) : s;
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(b => ('0' + (b & 0xff).toString(16)).slice(-2))
    .join('');
}

function newId_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 12);
}
