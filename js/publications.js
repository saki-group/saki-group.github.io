/* Local BibTeX renderer for SAKI Lab.
   Recommended mode: serve the site through http://localhost or GitHub Pages.
   In that mode, the page reads files/publications.bib directly on each load.
   Direct file:// opening cannot reliably read sibling local files in modern browsers,
   so it falls back to embedded BibTeX from js/publications-data.js.

   Supported custom BibTeX fields:
     pubtype   = {Conference | Journal | Workshop | Conference Companion | ...}
     venue     = {ACM SIGSPATIAL | ACM TSAS | ISWC | ...}
     topic     = {Spatial AI; Map and Document Understanding}
     highlight = {true | false}     // controls homepage selected publications only
     note      = {Selected publication | Journal extension | ...}
     award     = {Best Paper Award | ...}
     url       = {https://...}       // makes the publication title clickable

   A publication can belong to multiple topics by separating topic labels with semicolons:
     topic = {Spatial AI; Map and Document Understanding}
*/
(function () {
  const BIB_PATH = 'files/publications.bib';

  function findMatchingBrace(text, openIndex) {
    let depth = 0;
    for (let i = openIndex; i < text.length; i++) {
      if (text[i] === '{') depth++;
      if (text[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  }

  function splitTopLevelFields(body) {
    const fields = [];
    let current = '';
    let depth = 0;
    let quote = false;
    for (let i = 0; i < body.length; i++) {
      const ch = body[i];
      if (ch === '"' && body[i - 1] !== '\\') quote = !quote;
      if (!quote) {
        if (ch === '{') depth++;
        if (ch === '}') depth--;
        if (ch === ',' && depth === 0) {
          if (current.trim()) fields.push(current.trim());
          current = '';
          continue;
        }
      }
      current += ch;
    }
    if (current.trim()) fields.push(current.trim());
    return fields;
  }

  function cleanValue(value) {
    let v = value.trim();
    if ((v.startsWith('{') && v.endsWith('}')) || (v.startsWith('"') && v.endsWith('"'))) {
      v = v.slice(1, -1);
    }
    return v.replace(/\s+/g, ' ').trim();
  }

  function parseBibTeX(text) {
    const entries = [];
    let i = 0;
    while (i < text.length) {
      const at = text.indexOf('@', i);
      if (at === -1) break;
      const match = text.slice(at).match(/^@\s*([A-Za-z]+)\s*\{/);
      if (!match) { i = at + 1; continue; }
      const entryType = match[1].toLowerCase();
      const open = at + match[0].lastIndexOf('{');
      const close = findMatchingBrace(text, open);
      if (close === -1) break;
      const content = text.slice(open + 1, close);
      const comma = content.indexOf(',');
      if (comma === -1) { i = close + 1; continue; }
      const key = content.slice(0, comma).trim();
      const fieldText = content.slice(comma + 1);
      const fields = {};
      splitTopLevelFields(fieldText).forEach(part => {
        const eq = part.indexOf('=');
        if (eq === -1) return;
        const name = part.slice(0, eq).trim().toLowerCase();
        const value = cleanValue(part.slice(eq + 1));
        if (name) fields[name] = value;
      });
      entries.push({ entryType, key, fields });
      i = close + 1;
    }
    return entries;
  }

  function truthy(value) {
    return /^(true|yes|1|y)$/i.test(String(value || '').trim());
  }

  function inferPubType(entry) {
    if (entry.fields.pubtype) return entry.fields.pubtype;
    if (entry.entryType === 'article') return 'Journal';
    if (entry.entryType === 'inproceedings') return 'Conference';
    return entry.entryType ? entry.entryType[0].toUpperCase() + entry.entryType.slice(1) : 'Other';
  }

  function getVenue(entry) {
    return entry.fields.venue || entry.fields.journal || entry.fields.booktitle || 'Other venues';
  }

  function getTopics(entry) {
    const raw = entry.fields.topic || entry.fields.topics || 'Other topics';
    return raw
      .split(/\s*(?:;|\|)\s*/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function getFirstAuthor(entry) {
    const authors = entry.fields.author || '';
    const firstAuthor = authors.split(/\s+and\s+/i)[0] || '';
    return firstAuthor ? formatBibtexAuthorName(firstAuthor) : 'Unknown author';
  }

  function stripBibtexBraces(text) {
    return String(text || '')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function formatBibtexAuthorName(name) {
    if (!name) return '';
    const trimmed = stripBibtexBraces(name);
    if (trimmed.toLowerCase() === 'others') {
      return 'others';
    }
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length === 2) {
        const last = parts[0];
        const first = parts[1];
        return `${first} ${last}`.replace(/\s+/g, ' ').trim();
      }
      if (parts.length >= 3) {
        const last = parts[0];
        const suffix = parts[1];
        const first = parts.slice(2).join(' ');
        return `${first} ${last}, ${suffix}`.replace(/\s+/g, ' ').trim();
      }
    }
    return trimmed;
  }

  function formatAuthors(authors) {
    if (!authors) return '';
    const parts = authors
      .split(/\s+and\s+/i)
      .map(formatBibtexAuthorName)
      .filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return parts.join(' and ');
    return parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
  }

  function formatVenueLine(entry) {
    const f = entry.fields;
    const venue = f.journal || f.booktitle || f.venue || '';
    const year = f.year || '';
    const details = [];
    if (venue) details.push(`<em>${escapeHtml(venue)}</em>`);
    if (year) details.push(escapeHtml(year));
    return details.join(', ') + '.';
  }

  function escapeHtml(text) {
    return String(text || '').replace(/[&<>"']/g, function (m) {
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m];
    });
  }

  function makeDoiUrl(doi) {
    if (!doi) return '';
    if (/^https?:\/\//i.test(doi)) return doi;
    return `https://doi.org/${doi}`;
  }

  function renderEntry(entry, options) {
    const opts = Object.assign({ compact: false }, options || {});
    const f = entry.fields;
    const authors = formatAuthors(f.author);
    const title = f.title || '(Untitled)';
    const topicBadges = getTopics(entry);
    const links = [];
    if (f.doi) links.push(`<a href="${escapeHtml(makeDoiUrl(f.doi))}" target="_blank" rel="noopener">DOI</a>`);
    if (f.pdf) links.push(`<a href="${escapeHtml(f.pdf)}" target="_blank" rel="noopener">PDF</a>`);
    if (f.code) links.push(`<a href="${escapeHtml(f.code)}" target="_blank" rel="noopener">Code</a>`);
    const titleHtml = f.url
      ? `<a class="pub-title-link" href="${escapeHtml(f.url)}" target="_blank" rel="noopener">${escapeHtml(title)}</a>`
      : escapeHtml(title);
    const noteText = (f.note || '').trim();
    const awardText = (f.award || '').trim();
    const labelHtml = (awardText || noteText || topicBadges.length) ? `
        <div class="pub-label-line">
          ${awardText ? `<span class="pub-label pub-award">${escapeHtml(awardText)}</span>` : ''}
          ${noteText ? `<span class="pub-label pub-note">${escapeHtml(noteText)}</span>` : ''}
          ${topicBadges.map(topic => `<span class="pub-label pub-topic">${escapeHtml(topic)}</span>`).join('')}
        </div>` : '';
    const linksHtml = links.length ? `<div class="pub-links">${links.join(' · ')}</div>` : '';
    return `
      <article class="pub-item">
        <div class="pub-title">${titleHtml}</div>
        <div class="pub-authors">${escapeHtml(authors)}</div>
        <div class="pub-meta">${formatVenueLine(entry)}</div>
        ${labelHtml}
        ${linksHtml}
      </article>`;
  }

  function groupKeys(entry, mode) {
    if (mode === 'year') return [entry.fields.year || 'Unknown year'];
    if (mode === 'topic') return getTopics(entry);
    if (mode === 'type') return [inferPubType(entry)];
    if (mode === 'venue') return [getVenue(entry)];
    if (mode === 'author') return [getFirstAuthor(entry)];
    return ['All publications'];
  }

  function sortGroups(keys, mode) {
    if (mode === 'year') return keys.sort((a, b) => Number(b) - Number(a));
    return keys.sort((a, b) => a.localeCompare(b));
  }

  function sortEntries(entries) {
    return entries.slice().sort((a, b) => {
      const ay = Number(a.fields.year || 0), by = Number(b.fields.year || 0);
      if (by !== ay) return by - ay;
      return (a.fields.title || '').localeCompare(b.fields.title || '');
    });
  }

  function renderPublicationPage(entries) {
    const container = document.getElementById('publication-list');
    const count = document.getElementById('publication-count');
    const groupSelect = document.getElementById('publication-group-by');
    const searchInput = document.getElementById('publication-search');
    if (!container) return;

    function doRender() {
      const mode = groupSelect ? groupSelect.value : 'year';
      const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const filtered = sortEntries(entries.filter(entry => {
        const haystack = [entry.key, entry.entryType, ...Object.values(entry.fields)].join(' ').toLowerCase();
        return !query || haystack.includes(query);
      }));

      if (count) count.textContent = `${filtered.length} publication${filtered.length === 1 ? '' : 's'}`;
      if (filtered.length === 0) {
        container.innerHTML = '<p class="section-intro">No publications match the current filter.</p>';
        return;
      }

      const groups = new Map();
      filtered.forEach(entry => {
        groupKeys(entry, mode).forEach(key => {
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(entry);
        });
      });

      const html = sortGroups(Array.from(groups.keys()), mode).map(key => `
        <section class="pub-group">
          <h3>${escapeHtml(key)} <span>(${groups.get(key).length})</span></h3>
          ${groups.get(key).map(entry => renderEntry(entry)).join('')}
        </section>
      `).join('');
      container.innerHTML = html;
    }

    if (groupSelect) groupSelect.addEventListener('change', doRender);
    if (searchInput) searchInput.addEventListener('input', doRender);
    doRender();
  }

  function renderSelectedPublications(entries) {
    const container = document.getElementById('selected-publication-list');
    if (!container) return;
    const limit = Number(container.dataset.limit || 5);
    const selected = sortEntries(entries.filter(entry => truthy(entry.fields.highlight))).slice(0, limit);
    if (!selected.length) {
      container.innerHTML = '<p class="section-intro">Selected publications will appear here after setting <code>highlight = {true}</code> in the BibTeX file.</p>';
      return;
    }
    container.innerHTML = selected.map(entry => renderEntry(entry, { compact: true })).join('');
  }

  function embeddedBibTeX() {
    if (typeof window.SAKI_PUBLICATIONS_BIB === 'string' && window.SAKI_PUBLICATIONS_BIB.trim()) {
      return window.SAKI_PUBLICATIONS_BIB;
    }
    return '';
  }

  function canFetchLocalBib() {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
  }

  function loadBibTeX() {
    /*
      Preferred path for development/deployment:
        - When served over http://localhost or https://<github-pages>, read files/publications.bib
          directly. A cache-busting query is appended so edits show up after refresh.

      Fallback path:
        - When opened as file://, browsers generally block automatic local file reads.
          In that case, use the embedded copy in js/publications-data.js.
    */
    const embedded = embeddedBibTeX();
    if (canFetchLocalBib()) {
      const url = `${BIB_PATH}?v=${Date.now()}`;
      return fetch(url)
        .then(response => {
          if (!response.ok) throw new Error(`Unable to load ${BIB_PATH}`);
          return response.text();
        })
        .catch(error => {
          if (embedded) {
            console.warn(`Falling back to embedded publication data because ${BIB_PATH} could not be fetched.`, error);
            return embedded;
          }
          throw error;
        });
    }
    if (embedded) return Promise.resolve(embedded);
    return Promise.reject(new Error(`No embedded publication data found, and ${BIB_PATH} cannot be fetched from file://.`));
  }

  loadBibTeX()
    .then(text => {
      const entries = parseBibTeX(text);
      renderPublicationPage(entries);
      renderSelectedPublications(entries);
    })
    .catch(error => {
      const container = document.getElementById('publication-list') || document.getElementById('selected-publication-list');
      if (container) {
        container.innerHTML = `<div class="alert alert-warning">Could not load publication data. Add <code>js/publications-data.js</code> before <code>js/publications.js</code>, or run a local server so the page can fetch <code>${BIB_PATH}</code>.</div>`;
      }
      console.error(error);
    });
})();
