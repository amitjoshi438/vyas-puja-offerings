// ============================================
// Offer page — write and submit an offering
// ============================================
(function () {
    'use strict';

    const VP = window.VP;
    const limits = Object.assign({
        nameMax: 120, cityMax: 120, countryMax: 80, emailMax: 200, offeringMin: 20, offeringMax: 12000
    }, VP.config.limits || {});

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
        cityToggle: $('f-city-toggle'),
        cityRegion: $('f-city-region'),
        cityTyped: $('f-city-typed'),
        cityTypedText: $('f-city-typed-text'),
        cityRelist: $('f-city-relist'),
        country: $('f-country'),
        countryToggle: $('f-country-toggle'),
        placeStatus: $('place-status'),
        email: $('f-email'),
        emailSuggest: $('f-email-suggest'),
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
        doneAgain: $('done-again'),
        confirm: $('confirm'),
        confirmTitle: $('confirm-title'),
        confirmLetter: $('confirm-letter'),
        confirmText: $('confirm-text'),
        confirmName: $('confirm-name'),
        confirmPlace: $('confirm-place'),
        confirmEmail: $('confirm-email'),
        confirmEdit: $('confirm-edit'),
        confirmSend: $('confirm-send'),
        confirmSendText: $('confirm-send-text'),
        confirmStatus: $('confirm-status')
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
            els.closedText.textContent = 'Thank you for your love. Online offerings are no longer being accepted online — but every offering received is waiting to be read.';
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
        data.place = {
            country: place.country ? place.country.code : '',
            cityRegion: place.city ? place.city.region : '',
            cityTyped: place.typed === 'chosen'
        };
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
        if (draft.place && typeof draft.place === 'object') savedPlace = draft.place;
        const when = draft.savedAt ? new Date(draft.savedAt) : null;
        els.draft.innerHTML = '';
        els.draft.append(`Draft restored${when ? ` from ${formatDate(when)}` : ''} · `);
        const discard = document.createElement('button');
        discard.type = 'button';
        discard.className = 'draft-discard';
        discard.textContent = 'Start afresh';
        discard.addEventListener('click', () => {
            if (els.offering.value.trim() && !window.confirm('Discard your saved draft?')) return;
            FIELDS.forEach(f => { els[f].value = ''; setError(f, ''); });
            resetPlace();
            showEmailSuggestion(null);
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

    // ---------- Place: country and town lists ----------
    const P = VP.places;
    const place = {
        data: null,          // the prepared country list, once loaded
        failed: false,       // the country list couldn't load: plain text boxes instead
        country: null,       // the chosen country
        listCountry: null,   // the country whose towns the city box offers
        cities: null,        // towns of listCountry, once loaded
        loadingCities: false,
        city: null,          // the chosen town
        typed: ''            // why the town is hand-written: 'chosen', 'nolist' or 'failed'
    };
    let countryBox = null;
    let cityBox = null;
    let savedPlace = null;   // from a restored draft; applied once the lists load
    let restoreTown = null;

    const TYPED_NOTES = {
        chosen: 'Written as you typed it — the sevaks will check the spelling.',
        nolist: 'We don’t have a list of towns here — please write yours as it should appear.',
        failed: 'The list of towns couldn’t load — please write yours as it should appear.'
    };

    function countryOptions(text, showAll) {
        if (!place.data) return [];
        const list = place.data.list;
        const q = P.key(text);
        if (showAll && (!q || (place.country && q === place.country.k))) {
            return list.map((c, i) => ({
                label: c.name, value: c.name, data: c, mark: null,
                current: c === place.country,
                divider: i > 0 && !c.popular && list[i - 1].popular
            }));
        }
        const sure = P.exact(list, text, { aliases: true });
        return P.search(list, text).map(hit => ({
            label: hit.item.name, value: hit.item.name, data: hit.item,
            note: hit.via ? `also “${hit.via}”` : '', current: hit.item === place.country, sure: hit.item === sure
        }));
    }

    function cityOptions(text, showAll) {
        if (!place.cities) return [];
        const list = place.cities.list;
        const t = oneLine(text);
        const sure = P.key(t) ? P.exact(list, t) : null;
        const option = (c, via) => ({
            label: c.name, value: c.name, detail: c.region, data: c,
            note: via ? `also “${via}”` : '', current: c === place.city, sure: c === sure
        });
        if (!P.key(t)) return showAll ? list.slice(0, P.LIMIT).map(c => option(c, '')) : [];
        const hits = P.search(list, t);
        const options = hits.map(hit => option(hit.item, hit.via));
        if (t.length >= 2 && !hits.some(hit => hit.rank <= 1)) {
            options.push({ label: `Use “${t}”`, value: t, note: 'My town isn’t in the list', kind: 'typed', mark: null });
        }
        return options;
    }

    function chooseCountry(c) {
        place.country = c;
        els.country.value = c.name;
        setError('country', '');
        if (place.listCountry === c) return;
        place.listCountry = c;
        place.cities = null;
        place.city = null;
        showRegion();
        if (place.typed) setTyped('');
        els.city.disabled = false;
        els.city.placeholder = 'Start typing your town';
        loadTowns(c);
    }

    function loadTowns(c) {
        if (!c.cities) {
            place.cities = { list: [] };
            setTyped('nolist');
            return;
        }
        place.loadingCities = true;
        P.loadCities(place.data, c.code).then(towns => {
            if (place.listCountry !== c) return;
            place.loadingCities = false;
            place.cities = towns;
            if (restoreTown) applyRestoredTown();
            else resolveCity();
            cityBox.refresh();
        }).catch(err => {
            if (place.listCountry !== c) return;
            console.warn('[Offerings] Town list unavailable:', err);
            place.loadingCities = false;
            restoreTown = null;
            setTyped('failed');
        });
    }

    function chooseCity(c) {
        place.city = c;
        els.city.value = c.name;
        showRegion();
        setError('city', '');
    }

    function showRegion() {
        els.cityRegion.textContent = place.city && place.city.region ? place.city.region : '';
    }

    function setTyped(reason) {
        place.typed = reason;
        cityBox.setEnabled(!reason && !place.failed);
        els.cityTyped.hidden = !reason;
        els.cityTypedText.textContent = reason ? TYPED_NOTES[reason] : '';
        els.cityRelist.hidden = reason === 'nolist';
        els.cityRelist.textContent = reason === 'failed' ? 'Try the list again' : 'Choose from the list instead';
        if (reason) {
            place.city = null;
            showRegion();
        }
        if (!els.city.disabled) els.city.placeholder = reason ? 'Your town' : 'Start typing your town';
        const describedBy = ['f-city-region', reason && 'f-city-typed-text', 'f-city-error'].filter(Boolean);
        els.city.setAttribute('aria-describedby', describedBy.join(' '));
    }

    // A country typed out in full (or by another name, like "USA") counts as chosen.
    function resolveCountry() {
        if (!place.data || place.country) return;
        const match = P.exact(place.data.list, els.country.value, { aliases: true });
        if (match) chooseCountry(match);
    }

    // A town typed out in full counts as chosen, as long as only one town has that name.
    function resolveCity() {
        if (!place.cities || place.typed || place.city) return;
        const match = P.exact(place.cities.list, els.city.value);
        if (match) chooseCity(match);
    }

    function applyRestoredTown() {
        const saved = restoreTown;
        restoreTown = null;
        const text = oneLine(els.city.value);
        if (!text) return;
        if (saved.typed) {
            setTyped('chosen');
            return;
        }
        const k = P.key(text);
        const match = saved.region && place.cities.list.find(c => c.k === k && c.region === saved.region);
        if (match) chooseCity(match);
        else resolveCity();
    }

    function restorePlace() {
        const saved = savedPlace || {};
        savedPlace = null;
        const c = (saved.country && place.data.byCode.get(saved.country)) ||
            P.exact(place.data.list, els.country.value, { aliases: true });
        if (!c) return;
        restoreTown = { region: saved.cityRegion || '', typed: Boolean(saved.cityTyped) };
        chooseCountry(c);
        if (place.typed) restoreTown = null;
    }

    function resetPlace() {
        place.country = null;
        place.listCountry = null;
        place.cities = null;
        place.city = null;
        restoreTown = null;
        setTyped('');
        showRegion();
        if (!place.failed) {
            els.city.disabled = true;
            els.city.placeholder = 'Choose a country first';
        }
    }

    // Without the lists, both become ordinary text boxes.
    function placesUnavailable(err) {
        console.warn('[Offerings] Country list unavailable:', err);
        place.failed = true;
        countryBox.setEnabled(false);
        setTyped('');
        els.cityTyped.hidden = true;
        els.country.placeholder = '';
        els.country.maxLength = limits.countryMax;
        els.country.setAttribute('autocomplete', 'country-name');
        els.city.disabled = false;
        els.city.placeholder = '';
        els.city.setAttribute('autocomplete', 'address-level2');
    }

    function setupPlaces() {
        countryBox = new P.Combobox({
            input: els.country,
            toggle: els.countryToggle,
            status: els.placeStatus,
            noun: ['country', 'countries'],
            source: countryOptions,
            emptyText: () => (place.data ? '' : 'Loading the list of countries…'),
            onEdit: () => { place.country = null; },
            onPick: opt => {
                chooseCountry(opt.data);
                scheduleDraft();
            }
        });
        cityBox = new P.Combobox({
            input: els.city,
            toggle: els.cityToggle,
            status: els.placeStatus,
            noun: ['town', 'towns'],
            source: cityOptions,
            emptyText: () => (place.loadingCities && place.listCountry ? `Loading towns in ${place.listCountry.name}…` : ''),
            onEdit: () => {
                if (!place.city) return;
                place.city = null;
                showRegion();
            },
            onPick: opt => {
                if (opt.kind === 'typed') {
                    setTyped('chosen');
                    setError('city', '');
                    els.placeStatus.textContent = `“${opt.value}” will be used as you wrote it.`;
                } else {
                    chooseCity(opt.data);
                }
                scheduleDraft();
            }
        });

        els.cityRelist.addEventListener('click', () => {
            const retry = place.typed === 'failed';
            setTyped('');
            els.city.focus();
            if (retry) loadTowns(place.listCountry);
            cityBox.update(true);
            scheduleDraft();
        });

        P.loadCountries().then(data => {
            place.data = data;
            restorePlace();
            countryBox.refresh();
        }).catch(placesUnavailable);
    }

    // ---------- Email ----------
    const MAIL_DOMAINS = [
        'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.in', 'yahoo.in', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
        'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'outlook.in', 'live.com', 'live.in', 'msn.com', 'icloud.com', 'me.com',
        'mac.com', 'aol.com', 'rediffmail.com', 'protonmail.com', 'proton.me', 'zoho.com', 'mail.com', 'gmx.com', 'gmx.de',
        'web.de', 'yandex.com', 'yandex.ru', 'mail.ru', 'comcast.net', 'verizon.net', 'att.net', 'sbcglobal.net',
        'btinternet.com', 'sky.com', 'bigpond.com', 'shaw.ca', 'rogers.com'
    ];
    const TLD_TYPOS = { con: 'com', cmo: 'com', ocm: 'com', comm: 'com', cpm: 'com', xom: 'com', vom: 'com', coom: 'com', cim: 'com', nte: 'net', ogr: 'org' };

    // Same rules as isEmail_ in the Apps Script, with a gentler word for each problem.
    function emailProblem(t) {
        if (/\s/.test(t)) return 'An email address can’t contain spaces.';
        const parts = t.split('@');
        if (parts.length === 1) return 'An email address needs an “@” — like name@example.com.';
        if (parts.length > 2) return 'An email address has only one “@”.';
        const [local, domain] = parts;
        if (!local) return 'Something is missing before the “@”.';
        if (!domain) return 'Something is missing after the “@” — like example.com.';
        if (t.length > limits.emailMax || local.length > 64 || domain.length > 253) return 'This email address is too long.';
        if (!/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || /^\.|\.$|\.\./.test(local)) {
            return 'The part before the “@” has a character email addresses can’t use.';
        }
        const labels = domain.toLowerCase().split('.');
        if (labels.length < 2 || labels.some(l => !l)) return `“${domain}” looks incomplete — like example.com.`;
        if (!labels.every(l => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) {
            return 'The part after the “@” has a character email addresses can’t use.';
        }
        if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/.test(labels[labels.length - 1])) return `“${domain}” looks incomplete — like example.com.`;
        return '';
    }

    function editDistance(a, b) {
        const d = [];
        for (let i = 0; i <= a.length; i++) d[i] = [i];
        for (let j = 1; j <= b.length; j++) d[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
        return d[a.length][b.length];
    }

    // "gmial.com" → "gmail.com", "yahoo.con" → "yahoo.com". Real domains like "outlook.fr" are left alone.
    function suggestDomain(domain) {
        if (MAIL_DOMAINS.includes(domain)) return '';
        const parts = domain.split('.');
        const tld = parts[parts.length - 1];
        if (parts.length > 1 && TLD_TYPOS[tld]) parts[parts.length - 1] = TLD_TYPOS[tld];
        const name = parts[0];
        const suffix = parts.slice(1).join('.');
        let best = '';
        let bestScore = Infinity;
        for (const known of MAIL_DOMAINS) {
            const dot = known.indexOf('.');
            const knownName = known.slice(0, dot);
            const knownSuffix = known.slice(dot + 1);
            let score = Infinity;
            if (knownSuffix === suffix && name.length >= 5) {
                const dist = editDistance(name, knownName);
                if (dist <= (name.length >= 8 ? 2 : 1)) score = dist;
            } else if (knownName === name) {
                const dist = suffix ? editDistance(suffix, knownSuffix) : 1;
                if (dist <= 1) score = dist;
            }
            if (score < bestScore) {
                bestScore = score;
                best = known;
            }
        }
        const fixed = parts.join('.');
        if (!best && fixed !== domain) best = fixed;
        return best === domain ? '' : best;
    }

    function suggestEmail(value) {
        if (/\s/.test(value)) return '';
        const parts = value.split('@');
        if (parts.length !== 2 || !parts[0] || !parts[1]) return '';
        const domain = suggestDomain(parts[1].toLowerCase());
        return domain ? `${parts[0]}@${domain}` : '';
    }

    let emailHint = null;     // { value, suggestion } on show
    let emailKept = '';       // an address the devotee confirmed despite a suggestion
    let emailNudged = '';     // the address a send was paused for, once

    function checkEmail() {
        const v = els.email.value.trim();
        const suggestion = v && v !== emailKept ? suggestEmail(v) : '';
        showEmailSuggestion(suggestion ? { value: v, suggestion } : null);
    }

    function showEmailSuggestion(hint) {
        if (hint && emailHint && hint.value === emailHint.value && hint.suggestion === emailHint.suggestion) return;
        emailHint = hint;
        const box = els.emailSuggest;
        box.classList.remove('is-nudged');
        box.replaceChildren();
        if (!hint) return;
        const text = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = hint.suggestion;
        text.append('Did you mean ', strong, '?');
        const use = document.createElement('button');
        use.type = 'button';
        use.className = 'suggest-use';
        use.textContent = 'Yes, use this';
        use.addEventListener('click', () => {
            els.email.value = hint.suggestion;
            showEmailSuggestion(null);
            validateField('email');
            scheduleDraft();
            els.email.focus();
        });
        const keep = document.createElement('button');
        keep.type = 'button';
        keep.className = 'suggest-keep';
        keep.textContent = 'No, mine is right';
        keep.addEventListener('click', () => {
            emailKept = hint.value;
            showEmailSuggestion(null);
            els.email.focus();
        });
        box.append(text, use, keep);
    }

    function emailSuggestionPending() {
        return Boolean(emailHint && emailHint.value === els.email.value.trim() && emailNudged !== emailHint.value);
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
                if (t.length < 2) msg = 'Please sign with your initiated or official name.';
                else if (t.length > limits.nameMax) msg = `Please keep your name under ${limits.nameMax} characters.`;
                break;
            }
            case 'city': {
                const t = oneLine(v);
                if (!place.failed && !place.listCountry) break; // nothing to check against until a country is chosen
                if (!t) msg = 'Which city or town are you writing from?';
                else if (t.length > limits.cityMax) msg = `Please keep the town under ${limits.cityMax} characters.`;
                else if (!place.failed && !place.typed && !place.city) msg = 'Please choose your town from the list — or choose “My town isn’t in the list”.';
                break;
            }
            case 'country': {
                const t = oneLine(v);
                if (!t) msg = 'Which country are you writing from?';
                else if (place.failed) { if (t.length > limits.countryMax) msg = `Please keep the country under ${limits.countryMax} characters.`; }
                else if (!place.country) msg = 'Please choose your country from the list.';
                break;
            }
            case 'email': {
                const t = v.trim();
                if (t) msg = emailProblem(t);
                break;
            }
            case 'consent':
                if (!v) msg = 'Please confirm so we can publish your offering.';
                break;
        }
        setError(field, msg);
        return !msg;
    }

    const VALIDATE_ORDER = ['offering', 'name', 'country', 'city', 'email', 'consent'];

    function validateAll() {
        resolveCountry();
        resolveCity();
        checkEmail();
        const invalid = VALIDATE_ORDER.filter(f => !validateField(f));
        // Pause the first send once to show a likely email typo; sending again keeps the address as written.
        if (!invalid.includes('email') && emailSuggestionPending()) {
            emailNudged = emailHint.value;
            els.emailSuggest.classList.add('is-nudged');
            invalid.push('email');
            invalid.sort((a, b) => VALIDATE_ORDER.indexOf(a) - VALIDATE_ORDER.indexOf(b));
        }
        return invalid;
    }

    // ---------- Submit ----------
    function setSubmitting(on) {
        submitting = on;
        els.submit.disabled = on || !canSubmit;
        els.submit.classList.toggle('is-busy', on);
        els.submitText.textContent = on ? 'Offering to Gurudev…' : 'Offer to Gurudev';
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
        if (submitting || (els.confirm && els.confirm.open)) return;
        showStatus('');

        const invalid = validateAll();
        if (invalid.length) {
            const nudgeOnly = invalid.length === 1 && invalid[0] === 'email' && !$('f-email-error').textContent;
            showStatus(nudgeOnly
                ? 'Please check your email address above — send again to keep it as it is.'
                : invalid.length === 1 ? 'One detail needs your attention.' : `${invalid.length} details need your attention.`, 'error');
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
            cityListed: Boolean(place.city),
            country: place.country ? place.country.name : oneLine(els.country.value),
            email: els.email.value.trim(),
            offering: multiLine(els.offering.value),
            consent: true,
            website: els.website.value
        };

        if (payload.website) {
            // Honeypot filled: quietly pretend all is well.
            showSuccess(payload, false);
            return;
        }
        askToConfirm(payload);
    }

    // ---------- Confirm ----------
    let pendingPayload = null;

    function askToConfirm(payload) {
        const placeLine = [payload.city, payload.country].filter(Boolean).join(', ');
        if (!els.confirm || typeof els.confirm.showModal !== 'function') {
            if (window.confirm(`Offer to Gurudev now?\n\nIt will be published as:\n${payload.name}, ${placeLine}`)) sendOffering(payload);
            return;
        }
        pendingPayload = payload;
        els.confirmText.textContent = payload.offering;
        els.confirmName.textContent = payload.name;
        els.confirmPlace.textContent = placeLine;
        els.confirmEmail.textContent = payload.email
            ? `Your email, ${payload.email}, stays private with the sevaks.`
            : 'No email given, so the sevaks won’t be able to reach you if something needs a correction.';
        // returnValue survives from the last close, and Esc doesn't reset it.
        els.confirm.returnValue = '';
        document.documentElement.classList.add('confirm-open');
        els.confirm.showModal();
        els.confirmLetter.scrollTop = 0;
        els.confirmTitle.focus();
    }

    function onConfirmClosed() {
        document.documentElement.classList.remove('confirm-open');
        pendingPayload = null;
    }

    // While the offering travels, the dialog stays up with the progress, rather than dropping away
    // and leaving the page looking idle.
    function setConfirmBusy(on) {
        if (!els.confirm) return;
        els.confirm.classList.toggle('is-sending', on);
        els.confirm.setAttribute('aria-busy', String(on));
        els.confirmSend.disabled = on;
        els.confirmEdit.disabled = on;
        if (els.confirmSendText) els.confirmSendText.textContent = on ? 'Offering to Gurudev…' : 'Yes, offer to Gurudev';
        if (els.confirmStatus) els.confirmStatus.textContent = on ? 'Offering to Gurudev. Please wait a moment.' : '';
    }

    function closeConfirm(value) {
        document.documentElement.classList.remove('confirm-open');
        setConfirmBusy(false);
        if (els.confirm && els.confirm.open) els.confirm.close(value);
    }

    function setupConfirm() {
        if (!els.confirm) return;
        els.confirmEdit.addEventListener('click', () => els.confirm.close('edit'));
        els.confirmSend.addEventListener('click', () => {
            if (submitting || !pendingPayload) return;
            sendOffering(pendingPayload);
        });
        // Esc and the backdrop must not abandon an offering that is on its way.
        els.confirm.addEventListener('cancel', e => { if (submitting) e.preventDefault(); });
        // A click on the dimmed backdrop lands on the dialog itself. Ignore drags that began
        // inside the letter (selecting text) and ended on the backdrop.
        let pressedBackdrop = false;
        els.confirm.addEventListener('pointerdown', e => { pressedBackdrop = e.target === els.confirm; });
        els.confirm.addEventListener('click', e => {
            if (pressedBackdrop && e.target === els.confirm && !submitting) els.confirm.close('edit');
            pressedBackdrop = false;
        });
        els.confirm.addEventListener('close', onConfirmClosed);
    }

    async function sendOffering(payload) {
        if (submitting) return;
        payload.elapsedMs = Date.now() - loadedAt;
        if (payload.elapsedMs < MIN_ELAPSED_MS) {
            closeConfirm('edit');
            showStatus(SERVER_MESSAGES.too_fast, 'error');
            return;
        }

        setSubmitting(true);
        setConfirmBusy(true);
        try {
            const data = await postOffering(payload);
            if (data.ok) {
                clearDraft();
                closeConfirm('sent');
                showSuccess(payload, Boolean(data.duplicate));
                if (typeof window.gtag === 'function') window.gtag('event', 'offering_submitted', { year });
                return;
            }
            closeConfirm('failed');
            if (data.code === 'invalid' && data.field && els[data.field]) {
                setError(data.field, data.error || SERVER_MESSAGES.invalid);
                els[data.field].focus();
            }
            showStatus(SERVER_MESSAGES[data.code] || data.error || 'Something went wrong. Please try again.', 'error');
        } catch (err) {
            console.warn('[Offerings] Submission failed:', err);
            closeConfirm('failed');
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

        els.form.hidden = true;
        els.notice.hidden = true;
        els.done.hidden = false;
        els.done.classList.remove('is-offered');
        void els.done.offsetWidth;
        els.done.classList.add('is-offered');
        els.done.scrollIntoView({ behavior: VP.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        els.done.focus({ preventScroll: true });
    }

    function writeAnother() {
        els.offering.value = '';
        els.consent.checked = false;
        els.form.hidden = false;
        els.done.hidden = true;
        els.done.classList.remove('is-offered');
        showStatus('');
        updateCount();
        autosize();
        els.form.scrollIntoView({ behavior: VP.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        els.offering.focus({ preventScroll: true });
    }

    // ---------- Init ----------
    // A message appearing as a field loses focus would push the form down mid-click (on the checkbox or
    // the send button), so the click would miss. Hold such messages until the press is over.
    let pressing = false;
    let pressTimer = 0;
    let afterPress = [];

    function flushPress() {
        clearTimeout(pressTimer);
        const queued = afterPress;
        afterPress = [];
        queued.forEach(fn => fn());
    }

    function whenReleased(fn) {
        if (pressing || afterPress.length) afterPress.push(fn);
        else fn();
    }

    function trackPresses() {
        window.addEventListener('pointerdown', () => { pressing = true; }, true);
        window.addEventListener('pointerup', () => {
            pressing = false;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(flushPress, 400);
        }, true);
        window.addEventListener('pointercancel', () => {
            pressing = false;
            flushPress();
        }, true);
        window.addEventListener('click', () => {
            if (!afterPress.length) return;
            clearTimeout(pressTimer);
            pressTimer = setTimeout(flushPress, 0);
        }, true);
    }

    function init() {
        if (!els.form) return;

        els.date.textContent = formatDate(new Date());
        els.date.dateTime = new Date().toISOString().slice(0, 10);

        els.name.maxLength = limits.nameMax;
        els.city.maxLength = limits.cityMax;
        els.email.maxLength = limits.emailMax;
        els.offering.maxLength = limits.offeringMax;

        setupState();
        if (els.form.hidden) return;

        restoreDraft();
        setupPlaces();
        trackPresses();
        updateCount();
        autosize();

        els.offering.addEventListener('input', () => {
            updateCount();
            autosize();
        });
        FIELDS.forEach(f => {
            els[f].addEventListener('input', () => {
                scheduleDraft();
                if (f === 'email' && emailHint) showEmailSuggestion(null);
                if (els[f].getAttribute('aria-invalid')) validateField(f);
            });
            els[f].addEventListener('blur', () => whenReleased(() => {
                if (f === 'country') resolveCountry();
                if (f === 'city') resolveCity();
                if (els[f].value.trim()) validateField(f);
                if (f === 'email') checkEmail();
            }));
        });
        els.consent.addEventListener('change', () => validateField('consent'));
        window.addEventListener('resize', autosize, { passive: true });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(autosize);

        els.form.addEventListener('submit', onSubmit);
        els.doneAgain.addEventListener('click', writeAnother);
        setupConfirm();

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
