// ============================================
// Offer page — write and submit an offering
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    const limits = Object.assign({
        nameMax: 120, cityMax: 120, countryMax: 80, emailMax: 200, offeringMin: 20, offeringMax: 12000
    }, VP.config.limits || {});

    const COUNTRIES = ('Afghanistan|Albania|Algeria|Andorra|Angola|Antigua and Barbuda|Argentina|Armenia|Australia|Austria|' +
        'Azerbaijan|Bahamas|Bahrain|Bangladesh|Barbados|Belarus|Belgium|Belize|Benin|Bhutan|Bolivia|Bosnia and Herzegovina|' +
        'Botswana|Brazil|Brunei|Bulgaria|Burkina Faso|Burundi|Cambodia|Cameroon|Canada|Cape Verde|Central African Republic|' +
        'Chad|Chile|China|Colombia|Comoros|Congo|Costa Rica|Croatia|Cuba|Cyprus|Czech Republic|Denmark|Djibouti|Dominica|' +
        'Dominican Republic|DR Congo|Ecuador|Egypt|El Salvador|Equatorial Guinea|Eritrea|Estonia|Eswatini|Ethiopia|Fiji|' +
        'Finland|France|Gabon|Gambia|Georgia|Germany|Ghana|Greece|Grenada|Guatemala|Guinea|Guinea-Bissau|Guyana|Haiti|' +
        'Honduras|Hong Kong|Hungary|Iceland|India|Indonesia|Iran|Iraq|Ireland|Israel|Italy|Ivory Coast|Jamaica|Japan|Jordan|' +
        'Kazakhstan|Kenya|Kiribati|Kosovo|Kuwait|Kyrgyzstan|Laos|Latvia|Lebanon|Lesotho|Liberia|Libya|Liechtenstein|' +
        'Lithuania|Luxembourg|Madagascar|Malawi|Malaysia|Maldives|Mali|Malta|Marshall Islands|Mauritania|Mauritius|Mexico|' +
        'Micronesia|Moldova|Monaco|Mongolia|Montenegro|Morocco|Mozambique|Myanmar|Namibia|Nauru|Nepal|Netherlands|' +
        'New Zealand|Nicaragua|Niger|Nigeria|North Korea|North Macedonia|Norway|Oman|Pakistan|Palau|Palestine|Panama|' +
        'Papua New Guinea|Paraguay|Peru|Philippines|Poland|Portugal|Qatar|Romania|Russia|Rwanda|Saint Kitts and Nevis|' +
        'Saint Lucia|Saint Vincent and the Grenadines|Samoa|San Marino|Sao Tome and Principe|Saudi Arabia|Senegal|Serbia|' +
        'Seychelles|Sierra Leone|Singapore|Slovakia|Slovenia|Solomon Islands|Somalia|South Africa|South Korea|South Sudan|' +
        'Spain|Sri Lanka|Sudan|Suriname|Sweden|Switzerland|Syria|Taiwan|Tajikistan|Tanzania|Thailand|Timor-Leste|Togo|' +
        'Tonga|Trinidad and Tobago|Tunisia|Turkey|Turkmenistan|Tuvalu|Uganda|Ukraine|United Arab Emirates|United Kingdom|' +
        'United States|Uruguay|Uzbekistan|Vanuatu|Vatican City|Venezuela|Vietnam|Yemen|Zambia|Zimbabwe').split('|');

    const MIN_ELAPSED_MS = 3000;
    const SUBMIT_TIMEOUT_MS = 30000;
    const loadedAt = Date.now();

    const $ = id => document.getElementById(id);
    const els = {
        status: $('offer-status'),
        notice: $('offer-notice'),
        closed: $('offer-closed'),
        closedTitle: $('closed-title'),
        closedText: $('closed-text'),
        form: $('offer-form'),
        date: $('sheet-date'),
        offering: $('f-offering'),
        count: $('f-offering-count'),
        draft: $('draft-status'),
        name: $('f-name'),
        city: $('f-city'),
        country: $('f-country'),
        countryList: $('country-list'),
        email: $('f-email'),
        website: $('f-website'),
        consent: $('f-consent'),
        submit: $('submit-btn'),
        submitText: document.querySelector('#submit-btn .btn-text'),
        formStatus: $('form-status'),
        done: $('offer-done'),
        doneText: $('done-text'),
        doneExcerpt: $('done-excerpt'),
        doneName: $('done-name'),
        donePlace: $('done-place'),
        doneRead: $('done-read'),
        doneAgain: $('done-again')
    };

    const yearConfig = VP.currentYear();
    const year = yearConfig ? yearConfig.year : new Date().getFullYear();
    const DRAFT_KEY = `vp-offering-draft-${year}`;
    const FIELDS = ['offering', 'name', 'city', 'country', 'email'];

    let submitting = false;
    let canSubmit = false;

    // ---------- Helpers ----------
    const oneLine = v => String(v || '').replace(/\s+/g, ' ').trim();
    const multiLine = v => String(v || '').replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
    const wordCount = v => (String(v).trim().match(/\S+/g) || []).length;
    const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

    function formatDate(d) {
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function formatTime(d) {
        return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }

    // ---------- State ----------
    function closesOnDate() {
        if (!yearConfig || !yearConfig.closesOn) return null;
        const d = new Date(yearConfig.closesOn + 'T23:59:59');
        return isNaN(d) ? null : d;
    }

    function setupState() {
        const open = VP.isSubmissionOpen(yearConfig);
        const closes = closesOnDate();

        if (!open) {
            els.form.hidden = true;
            els.closed.hidden = false;
            els.closedTitle.textContent = `Offerings for ${year} are closed`;
            els.closedText.textContent = 'Thank you for your love. Online offerings are no longer being accepted for this Vyāsa Pūjā — but every offering received is waiting to be read.';
            els.status.hidden = false;
            els.status.innerHTML = '<span class="status-dot is-closed" aria-hidden="true"></span>Offerings closed';
            return;
        }

        els.status.hidden = false;
        if (!VP.hasEndpoint()) {
            els.status.innerHTML = '<span class="status-dot is-soon" aria-hidden="true"></span>Online offerings open soon';
            els.notice.hidden = false;
            els.notice.innerHTML = '<p><strong>Online offerings will open soon.</strong></p>' +
                '<p>You can begin writing now — your words are saved on this device, so you can come back and send them once offerings open.</p>';
            els.submit.disabled = true;
            els.submitText.textContent = 'Opening soon';
            canSubmit = false;
        } else {
            const until = closes ? ` until ${formatDate(closes)}` : '';
            els.status.innerHTML = `<span class="status-dot" aria-hidden="true"></span>Open for offerings${until}`;
            canSubmit = true;
        }
    }

    // ---------- Draft ----------
    let draftTimer = 0;

    function readDraft() {
        try {
            const raw = localStorage.getItem(DRAFT_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function saveDraft() {
        const data = {};
        FIELDS.forEach(f => { data[f] = els[f].value; });
        const hasContent = FIELDS.some(f => data[f].trim());
        try {
            if (hasContent) {
                data.savedAt = Date.now();
                localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
                els.draft.textContent = `Draft saved on this device · ${formatTime(new Date())}`;
            } else {
                localStorage.removeItem(DRAFT_KEY);
                els.draft.textContent = '';
            }
        } catch (_) {
            // Storage may be unavailable (private mode); drafting still works.
        }
    }

    function scheduleDraft() {
        clearTimeout(draftTimer);
        draftTimer = setTimeout(() => { draftTimer = 0; saveDraft(); }, 500);
    }

    function clearDraft() {
        clearTimeout(draftTimer);
        draftTimer = 0;
        try { localStorage.removeItem(DRAFT_KEY); } catch (_) { /* ignore */ }
        els.draft.textContent = '';
    }

    function restoreDraft() {
        const draft = readDraft();
        if (!draft) return;
        let restored = false;
        FIELDS.forEach(f => {
            if (typeof draft[f] === 'string' && draft[f]) {
                els[f].value = draft[f];
                restored = true;
            }
        });
        if (!restored) return;
        const when = draft.savedAt ? new Date(draft.savedAt) : null;
        els.draft.innerHTML = '';
        els.draft.append(`Draft restored${when ? ` from ${formatDate(when)}` : ''} · `);
        const discard = document.createElement('button');
        discard.type = 'button';
        discard.className = 'draft-discard';
        discard.textContent = 'Start afresh';
        discard.addEventListener('click', () => {
            if (els.offering.value.trim() && !window.confirm('Discard your saved draft?')) return;
            FIELDS.forEach(f => { els[f].value = ''; });
            clearDraft();
            updateCount();
            autosize();
            els.offering.focus();
        });
        els.draft.append(discard);
    }

    // ---------- Textarea ----------
    function autosize() {
        const ta = els.offering;
        ta.style.height = 'auto';
        ta.style.height = `${ta.scrollHeight + 2}px`;
    }

    function updateCount() {
        const text = els.offering.value;
        const words = wordCount(text);
        const chars = text.length;
        let label = `${VP.formatNumber(words)} ${words === 1 ? 'word' : 'words'}`;
        const near = chars > limits.offeringMax * 0.9;
        if (near) label += ` · ${VP.formatNumber(limits.offeringMax - chars)} characters left`;
        els.count.textContent = label;
        els.count.classList.toggle('is-near', near);
    }

    // ---------- Validation ----------
    function setError(field, message) {
        const input = els[field];
        const err = $(`f-${field}-error`);
        if (!input || !err) return;
        err.textContent = message || '';
        if (message) input.setAttribute('aria-invalid', 'true');
        else input.removeAttribute('aria-invalid');
        const wrap = input.closest('.field');
        if (wrap) wrap.classList.toggle('has-error', Boolean(message));
    }

    function validateField(field) {
        const v = field === 'consent' ? els.consent.checked : els[field].value;
        let msg = '';
        switch (field) {
            case 'offering': {
                const text = multiLine(v);
                if (!text) msg = 'Please write your offering.';
                else if (text.length < limits.offeringMin) msg = `A few more words, please — at least ${limits.offeringMin} characters.`;
                else if (text.length > limits.offeringMax) msg = `Please keep your offering under ${VP.formatNumber(limits.offeringMax)} characters.`;
                break;
            }
            case 'name': {
                const t = oneLine(v);
                if (t.length < 2) msg = 'Please sign with your name.';
                else if (t.length > limits.nameMax) msg = `Please keep your name under ${limits.nameMax} characters.`;
                break;
            }
            case 'city': {
                const t = oneLine(v);
                if (!t) msg = 'Which city are you writing from?';
                else if (t.length > limits.cityMax) msg = `Please keep the city under ${limits.cityMax} characters.`;
                break;
            }
            case 'country': {
                const t = oneLine(v);
                if (!t) msg = 'Which country are you writing from?';
                else if (t.length > limits.countryMax) msg = `Please keep the country under ${limits.countryMax} characters.`;
                break;
            }
            case 'email': {
                const t = v.trim();
                if (t && (!isEmail(t) || t.length > limits.emailMax)) msg = 'This email doesn’t look quite right — or leave it empty.';
                break;
            }
            case 'consent':
                if (!v) msg = 'Please confirm so we can publish your offering.';
                break;
        }
        setError(field, msg);
        return !msg;
    }

    const VALIDATE_ORDER = ['offering', 'name', 'city', 'country', 'email', 'consent'];

    function validateAll() {
        const invalid = VALIDATE_ORDER.filter(f => !validateField(f));
        return invalid;
    }

    // ---------- Submit ----------
    function setSubmitting(on) {
        submitting = on;
        els.submit.disabled = on || !canSubmit;
        els.submit.classList.toggle('is-busy', on);
        els.submitText.textContent = on ? 'Placing your offering…' : 'Place my offering';
        els.form.setAttribute('aria-busy', String(on));
    }

    function showStatus(message, kind) {
        els.formStatus.textContent = message || '';
        els.formStatus.dataset.kind = kind || '';
    }

    async function postOffering(payload) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
        try {
            // text/plain keeps this a "simple" request, so Apps Script needs no CORS preflight.
            const res = await fetch(VP.config.submissionEndpoint.trim(), {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload),
                signal: controller.signal,
                redirect: 'follow'
            });
            let data = null;
            try { data = await res.json(); } catch (_) { /* not JSON */ }
            if (!res.ok || !data) {
                const err = new Error(`Unexpected response (${res.status})`);
                err.code = 'network';
                throw err;
            }
            return data;
        } catch (e) {
            if (e.name === 'AbortError') {
                const err = new Error('The request timed out');
                err.code = 'timeout';
                throw err;
            }
            if (!e.code) e.code = 'network';
            throw e;
        } finally {
            clearTimeout(timer);
        }
    }

    const SERVER_MESSAGES = {
        closed: 'Offerings for this year have just closed. Thank you for your love.',
        invalid: 'Some details need another look. Please check the form and try again.',
        too_fast: 'That was very quick! Please take a moment and send again.',
        rate_limited: 'We’ve received several offerings from you just now. Please wait a few minutes and try again.',
        busy: 'Many devotees are offering right now. Please try again in a moment.'
    };

    async function onSubmit(e) {
        e.preventDefault();
        if (submitting) return;
        showStatus('');

        const invalid = validateAll();
        if (invalid.length) {
            showStatus(invalid.length === 1 ? 'One detail needs your attention.' : `${invalid.length} details need your attention.`, 'error');
            const first = els[invalid[0]];
            if (first) first.focus();
            return;
        }
        if (!canSubmit) return;

        const payload = {
            action: 'submit',
            year,
            name: oneLine(els.name.value),
            city: oneLine(els.city.value),
            country: oneLine(els.country.value),
            email: els.email.value.trim(),
            offering: multiLine(els.offering.value),
            consent: true,
            website: els.website.value,
            elapsedMs: Date.now() - loadedAt
        };

        if (payload.website) {
            // Honeypot filled: quietly pretend all is well.
            showSuccess(payload, false);
            return;
        }
        if (payload.elapsedMs < MIN_ELAPSED_MS) {
            showStatus(SERVER_MESSAGES.too_fast, 'error');
            return;
        }

        setSubmitting(true);
        try {
            const data = await postOffering(payload);
            if (data.ok) {
                clearDraft();
                showSuccess(payload, Boolean(data.duplicate));
                if (typeof window.gtag === 'function') window.gtag('event', 'offering_submitted', { year });
                return;
            }
            if (data.code === 'invalid' && data.field && els[data.field]) {
                setError(data.field, data.error || SERVER_MESSAGES.invalid);
                els[data.field].focus();
            }
            showStatus(SERVER_MESSAGES[data.code] || data.error || 'Something went wrong. Please try again.', 'error');
        } catch (err) {
            console.warn('[Vyasa Puja] Submission failed:', err);
            showStatus(err.code === 'timeout'
                ? 'This is taking longer than expected. Your draft is saved — please try again.'
                : 'We couldn’t reach the server. Your draft is saved on this device — please check your connection and try again.', 'error');
        } finally {
            setSubmitting(false);
        }
    }

    function showSuccess(payload, duplicate) {
        const excerpt = payload.offering.length > 260 ? `${payload.offering.slice(0, 260).trim()}…` : payload.offering;
        els.doneExcerpt.textContent = excerpt;
        els.doneName.textContent = payload.name;
        els.donePlace.textContent = [payload.city, payload.country].filter(Boolean).join(', ');
        els.doneText.textContent = duplicate
            ? `Thank you, ${payload.name}. This offering had already reached us, so it is waiting with the sevaks to be read.`
            : `Thank you, ${payload.name}. Your offering will join the garland as soon as the sevaks have read it.`;
        els.doneRead.href = `offerings.html?year=${year}`;

        const reveal = () => {
            els.form.hidden = true;
            els.notice.hidden = true;
            els.done.hidden = false;
            els.done.classList.remove('is-lit');
            void els.done.offsetWidth;
            els.done.classList.add('is-lit');
            els.done.scrollIntoView({ behavior: VP.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
            els.done.focus({ preventScroll: true });
        };

        if (VP.prefersReducedMotion()) {
            reveal();
        } else {
            els.form.classList.add('is-sending');
            setTimeout(reveal, 520);
        }
    }

    function writeAnother() {
        els.offering.value = '';
        els.consent.checked = false;
        els.form.classList.remove('is-sending');
        els.form.hidden = false;
        els.done.hidden = true;
        els.done.classList.remove('is-lit');
        showStatus('');
        updateCount();
        autosize();
        els.form.scrollIntoView({ behavior: VP.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        els.offering.focus({ preventScroll: true });
    }

    // ---------- Init ----------
    function init() {
        if (!els.form) return;

        els.date.textContent = formatDate(new Date());
        els.date.dateTime = new Date().toISOString().slice(0, 10);

        els.name.maxLength = limits.nameMax;
        els.city.maxLength = limits.cityMax;
        els.country.maxLength = limits.countryMax;
        els.email.maxLength = limits.emailMax;
        els.offering.maxLength = limits.offeringMax;

        const frag = document.createDocumentFragment();
        COUNTRIES.forEach(c => {
            const o = document.createElement('option');
            o.value = c;
            frag.appendChild(o);
        });
        els.countryList.appendChild(frag);

        setupState();
        if (els.form.hidden) return;

        restoreDraft();
        updateCount();
        autosize();

        els.offering.addEventListener('input', () => {
            updateCount();
            autosize();
        });
        FIELDS.forEach(f => {
            els[f].addEventListener('input', () => {
                scheduleDraft();
                if (els[f].getAttribute('aria-invalid')) validateField(f);
            });
            els[f].addEventListener('blur', () => {
                if (els[f].value.trim()) validateField(f);
            });
        });
        els.consent.addEventListener('change', () => validateField('consent'));
        window.addEventListener('resize', autosize, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(autosize);

        els.form.addEventListener('submit', onSubmit);
        els.doneAgain.addEventListener('click', writeAnother);

        window.addEventListener('beforeunload', () => {
            if (draftTimer) {
                clearTimeout(draftTimer);
                draftTimer = 0;
                saveDraft();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();
