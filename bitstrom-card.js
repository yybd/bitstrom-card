/*
 * Bitstrom card — the Bitstrom app (from the Bitstrom add-on or any
 * Bitstrom server) on a Home Assistant dashboard.
 *
 *   type: custom:bitstrom-card
 *   url: http://homeassistant.local:17770   # optional; default: this host, port 17770
 *   height: 640                             # optional, pixels
 *   title: Bitstrom                         # optional
 */
const CARD_VERSION = '0.2.0';
const DEFAULT_PORT = 17770;
const DEFAULT_HEIGHT = 640;

function defaultUrl() {
  return `http://${window.location.hostname}:${DEFAULT_PORT}`;
}

// A height that is not a positive number (an empty or mistyped field) falls
// back to the default, everywhere the card uses it.
function cardHeight(config) {
  const h = Number(config?.height);
  return Number.isFinite(h) && h > 0 ? h : DEFAULT_HEIGHT;
}

class BitstromCard extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(_hass) {
    // The card shows the Bitstrom app itself; Home Assistant state is not needed.
  }

  getCardSize() {
    return Math.max(3, Math.round(cardHeight(this._config) / 50));
  }

  // Sections dashboards: the full width, and as many rows (56px + 8px gap)
  // as the frame and its title take.
  getGridOptions() {
    const rows = Math.ceil((cardHeight(this._config) + (this._config?.title ? 56 : 0)) / 64);
    return { columns: 'full', rows, min_rows: 4 };
  }

  static getConfigElement() {
    return document.createElement('bitstrom-card-editor');
  }

  static getStubConfig() {
    return { url: defaultUrl(), height: DEFAULT_HEIGHT };
  }

  _render() {
    if (!this._config) return;
    const url = (this._config.url || defaultUrl()).replace(/\/+$/, '');
    const height = cardHeight(this._config);
    const title = this._config.title;
    // Only a web address is shown in the frame.
    const valid = /^https?:\/\//i.test(url);
    // An https dashboard cannot show an http page inside it (the browser
    // blocks mixed content): say so instead of an empty frame.
    const blocked = valid && window.location.protocol === 'https:' && /^http:/i.test(url);
    this.innerHTML = `
      <ha-card ${title ? `header="${escapeHtml(title)}"` : ''}>
        <style>
          .bitstrom-frame { display: block; width: 100%; border: 0; border-radius: 0 0 var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px); background: #0a1f3d; }
          .bitstrom-note { padding: 16px; color: var(--secondary-text-color); line-height: 1.5; }
          .bitstrom-note a { color: var(--primary-color); }
        </style>
        ${
          !valid
            ? `<div class="bitstrom-note">The Bitstrom address must start with <code>http://</code> or
               <code>https://</code> — for example <code>${escapeHtml(defaultUrl())}</code>.</div>`
            : blocked
            ? `<div class="bitstrom-note">This dashboard is open over <b>https</b>, and the browser does not show the
               Bitstrom app (<code>${escapeHtml(url)}</code>, plain http) inside it.
               <a href="${escapeHtml(url)}" target="_blank" rel="noopener">Open Bitstrom in a new tab</a>,
               or open the dashboard over http on your home network.</div>`
            : `<iframe class="bitstrom-frame" style="height:${height}px" src="${escapeHtml(url)}"
                 allow="autoplay; fullscreen" title="Bitstrom"></iframe>`
        }
      </ha-card>`;
  }
}

class BitstromCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    if (this._rendered) this._sync();
    else this._render();
  }

  set hass(_hass) {}

  // Home Assistant hands every change back through setConfig: refresh the
  // fields the user is not typing in, instead of rebuilding them (a rebuild
  // drops the focus on every edit).
  _sync() {
    const c = this._config;
    this.querySelectorAll('input').forEach((input) => {
      if (input === document.activeElement) return;
      const v = c[input.name];
      input.value = v === undefined ? '' : String(v);
    });
  }

  _render() {
    this._rendered = true;
    const c = this._config || {};
    this.innerHTML = `
      <style>
        .bitstrom-editor { display: grid; gap: 12px; padding: 4px 0; }
        .bitstrom-editor label { display: grid; gap: 4px; font-size: 14px; color: var(--primary-text-color); }
        .bitstrom-editor input { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
        .bitstrom-editor small { color: var(--secondary-text-color); }
      </style>
      <div class="bitstrom-editor">
        <label>Bitstrom address
          <input name="url" type="url" placeholder="${escapeHtml(defaultUrl())}" value="${escapeHtml(c.url ?? '')}">
          <small>The add-on, or any Bitstrom server. Empty: this host, port ${DEFAULT_PORT}.</small>
        </label>
        <label>Height (pixels)
          <input name="height" type="number" min="200" step="20" placeholder="${DEFAULT_HEIGHT}" value="${escapeHtml(c.height === undefined ? '' : String(c.height))}">
        </label>
        <label>Title (optional)
          <input name="title" type="text" value="${escapeHtml(c.title ?? '')}">
        </label>
      </div>`;
    this.querySelectorAll('input').forEach((input) =>
      input.addEventListener('change', (e) => {
        const { name, value } = e.target;
        const next = { ...this._config };
        if (value === '') delete next[name];
        else next[name] = name === 'height' ? Number(value) : value.trim();
        this._config = next;
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next }, bubbles: true, composed: true }));
      }),
    );
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

customElements.define('bitstrom-card', BitstromCard);
customElements.define('bitstrom-card-editor', BitstromCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'bitstrom-card',
  name: 'Bitstrom',
  description: 'Your radio, podcasts and music library and its players — the Bitstrom app on the dashboard.',
  preview: false,
  documentationURL: 'https://github.com/yybd/bitstrom-card',
});

console.info(`%c BITSTROM-CARD %c ${CARD_VERSION} `, 'color:#0a1f3d;background:#38bdf8;font-weight:700', 'color:#38bdf8;background:#0a1f3d');
