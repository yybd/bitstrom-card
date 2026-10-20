/*
 * Bitstrom card — the Bitstrom app (from the Bitstrom add-on or any
 * Bitstrom server) on a Home Assistant dashboard.
 *
 *   type: custom:bitstrom-card
 *   mode: full                              # full (the app) or player (the player bar alone)
 *   view: radio                             # optional: radio, podcasts or songs
 *   collection: Jazz                        # optional: a collection's name
 *   url: http://homeassistant.local:17770   # optional; default: the add-on, found by itself
 *   height: 640                             # optional, pixels
 *   title: Bitstrom                         # optional
 */
const CARD_VERSION = '0.3.0';
const DEFAULT_PORT = 17770;
const DEFAULT_HEIGHT = { full: 640, player: 150 };
const VIEWS = ['radio', 'podcasts', 'songs'];

function defaultUrl() {
  return `http://${window.location.hostname}:${DEFAULT_PORT}`;
}

function cardMode(config) {
  return config?.mode === 'player' ? 'player' : 'full';
}

// A height that is not a positive number (an empty or mistyped field) falls
// back to the mode's default, everywhere the card uses it.
function cardHeight(config) {
  const h = Number(config?.height);
  return Number.isFinite(h) && h > 0 ? h : DEFAULT_HEIGHT[cardMode(config)];
}

// The page inside Bitstrom the card opens: the player bar alone, or the
// list — on one type and one collection if the card names them.
function appPath(config) {
  if (cardMode(config) === 'player') return '/mini';
  const q = new URLSearchParams();
  if (VIEWS.includes(config?.view)) q.set('type', config.view);
  if (config?.collection) q.set('collection', String(config.collection));
  const s = q.toString();
  return s ? `/?${s}` : '/';
}

// ---------------------------------------------------------------------------
// The Bitstrom add-on through Home Assistant's ingress: found through the
// Supervisor, opened in Home Assistant's own origin — over https and Nabu
// Casa too, behind Home Assistant's sign-in. Needs an administrator (the
// Supervisor answers no one else) and an add-on with ingress (1.0.0 on).
// One ingress session serves every card on the page, kept alive as Home
// Assistant's own add-on panel keeps its own.

const SESSION_KEEPALIVE_MS = 60_000;
let ingressSession = null;
const LOOKING = 'looking';
let keepAlive = null;

function supervisor(hass, endpoint, method = 'get', data) {
  return hass.callWS({ type: 'supervisor/api', endpoint, method, ...(data ? { data } : {}) });
}

function setSessionCookie(session) {
  const secure = window.location.protocol === 'https:' ? ';Secure' : '';
  document.cookie = `ingress_session=${session};path=/api/hassio_ingress/;SameSite=Strict${secure}`;
}

async function openIngressSession(hass) {
  if (!ingressSession) {
    ingressSession = supervisor(hass, '/ingress/session', 'post').then((r) => {
      setSessionCookie(r.session);
      return r.session;
    });
    ingressSession.catch(() => {
      ingressSession = null;
    });
  }
  await ingressSession;
  if (!keepAlive) {
    keepAlive = setInterval(async () => {
      try {
        await supervisor(hass, '/ingress/validate_session', 'post', { session: await ingressSession });
      } catch {
        // Gone (Home Assistant restarted): a new one.
        ingressSession = null;
        await openIngressSession(hass).catch(() => undefined);
      }
    }, SESSION_KEEPALIVE_MS);
  }
}

// { kind: 'ingress', base } | { kind: 'stopped', slug } | null (use the address).
async function findAddon(hass) {
  if (!hass?.user?.is_admin || !hass?.config?.components?.includes('hassio')) return null;
  try {
    const { addons = [] } = (await supervisor(hass, '/addons')) ?? {};
    const addon = addons.find((a) => a.slug === 'bitstrom' || /_bitstrom$/.test(a.slug ?? ''));
    if (!addon) return null;
    const info = await supervisor(hass, `/addons/${addon.slug}/info`);
    if (info.state !== 'started') return { kind: 'stopped', slug: addon.slug };
    if (!info.ingress || !info.ingress_url) return null;
    await openIngressSession(hass);
    return { kind: 'ingress', base: info.ingress_url.replace(/\/+$/, '') };
  } catch {
    return null;
  }
}

class BitstromCard extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._found = undefined;
    this._render();
    this._look();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._look();
  }

  // Without an address, find the add-on (once per configuration).
  _look() {
    if (!this._hass || !this._config || this._config.url || this._found !== undefined) return;
    this._found = LOOKING;
    const config = this._config;
    void findAddon(this._hass).then((found) => {
      if (this._config !== config) return;
      this._found = found;
      this._render();
    });
  }

  getCardSize() {
    return Math.max(cardMode(this._config) === 'player' ? 2 : 3, Math.round(cardHeight(this._config) / 50));
  }

  // Sections dashboards: the full width, and as many rows (56px + 8px gap)
  // as the frame and its title take.
  getGridOptions() {
    const rows = Math.ceil((cardHeight(this._config) + (this._config?.title ? 56 : 0)) / 64);
    return { columns: 'full', rows, min_rows: cardMode(this._config) === 'player' ? 2 : 4 };
  }

  static getConfigElement() {
    return document.createElement('bitstrom-card-editor');
  }

  static getStubConfig() {
    return { mode: 'full' };
  }

  // What the frame shows: { src } or { note } (html).
  _target() {
    const c = this._config;
    const path = appPath(c);
    if (!c.url) {
      // Still asking the Supervisor: nothing yet, rather than a wrong page.
      if (this._found === undefined || this._found === LOOKING) return {};
      if (this._found?.kind === 'ingress') return { src: this._found.base + path };
      if (this._found?.kind === 'stopped') {
        return {
          note: `The Bitstrom add-on is not running.
            <a href="/hassio/addon/${encodeURIComponent(this._found.slug)}/info" target="_top">Start it</a>, then reload this page.`,
        };
      }
    }
    const url = (c.url || defaultUrl()).replace(/\/+$/, '');
    // Only a web address is shown in the frame.
    if (!/^https?:\/\//i.test(url)) {
      return {
        note: `The Bitstrom address must start with <code>http://</code> or <code>https://</code> —
          for example <code>${escapeHtml(defaultUrl())}</code>. Leave it empty to use the add-on.`,
      };
    }
    // An https dashboard cannot show an http page inside it (the browser
    // blocks mixed content): say so instead of an empty frame.
    if (window.location.protocol === 'https:' && /^http:/i.test(url)) {
      return {
        note: `This dashboard is open over <b>https</b>, and the browser does not show the
          Bitstrom app (<code>${escapeHtml(url)}</code>, plain http) inside it.
          <a href="${escapeHtml(url + path)}" target="_blank" rel="noopener">Open Bitstrom in a new tab</a>.
          With the Bitstrom add-on (1.0.0 or later), leave the address empty and the card opens it
          through Home Assistant, over https too.`,
      };
    }
    return { src: url + path };
  }

  _render() {
    if (!this._config) return;
    const height = cardHeight(this._config);
    const title = this._config.title;
    const { src, note } = this._target();
    // The same page is not loaded again (a reload would stop what plays in
    // the browser and lose the place in the app).
    const key = JSON.stringify([src, note, height, title]);
    if (key === this._shown) return;
    this._shown = key;
    this.innerHTML = `
      <ha-card ${title ? `header="${escapeHtml(title)}"` : ''}>
        <style>
          .bitstrom-frame { display: block; width: 100%; border: 0; border-radius: var(--ha-card-border-radius, 12px); background: #0a1f3d; }
          ha-card[header] .bitstrom-frame { border-top-left-radius: 0; border-top-right-radius: 0; }
          .bitstrom-note { padding: 16px; color: var(--secondary-text-color); line-height: 1.5; }
          .bitstrom-note a { color: var(--primary-color); }
          .bitstrom-wait { height: ${height}px; border-radius: var(--ha-card-border-radius, 12px); background: #0a1f3d; }
        </style>
        ${
          note
            ? `<div class="bitstrom-note">${note}</div>`
            : src
              ? `<iframe class="bitstrom-frame" style="height:${height}px" src="${escapeHtml(src)}"
                   allow="autoplay; fullscreen" title="Bitstrom"></iframe>`
              : `<div class="bitstrom-wait"></div>`
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
    this.querySelectorAll('input, select').forEach((field) => {
      if (field === document.activeElement) return;
      const v = c[field.name];
      field.value = v === undefined ? (field.name === 'mode' ? 'full' : '') : String(v);
    });
    this._showFor(cardMode(c));
  }

  // The view and collection are the full app's; the player bar has neither.
  _showFor(mode) {
    this.querySelectorAll('[data-full]').forEach((el) => {
      el.hidden = mode === 'player';
    });
    const height = this.querySelector('input[name=height]');
    if (height) height.placeholder = String(DEFAULT_HEIGHT[mode]);
  }

  _render() {
    this._rendered = true;
    const c = this._config || {};
    const mode = cardMode(c);
    const option = (value, label, current) =>
      `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`;
    this.innerHTML = `
      <style>
        .bitstrom-editor { display: grid; gap: 12px; padding: 4px 0; }
        .bitstrom-editor label { display: grid; gap: 4px; font-size: 14px; color: var(--primary-text-color); }
        .bitstrom-editor label[hidden] { display: none; }
        .bitstrom-editor input, .bitstrom-editor select { padding: 8px; border-radius: 6px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); font: inherit; }
        .bitstrom-editor small { color: var(--secondary-text-color); }
      </style>
      <div class="bitstrom-editor">
        <label>Show
          <select name="mode">
            ${option('full', 'The Bitstrom app', mode)}
            ${option('player', 'The player bar alone', mode)}
          </select>
        </label>
        <label data-full>Open on
          <select name="view">
            ${option('', 'Everything', c.view ?? '')}
            ${option('radio', 'Radio', c.view)}
            ${option('podcasts', 'Podcasts', c.view)}
            ${option('songs', 'Songs', c.view)}
          </select>
        </label>
        <label data-full>Collection (optional)
          <input name="collection" type="text" value="${escapeHtml(c.collection ?? '')}">
          <small>A collection's name, as in the app. Empty: all collections.</small>
        </label>
        <label>Bitstrom address (optional)
          <input name="url" type="url" placeholder="${escapeHtml(defaultUrl())}" value="${escapeHtml(c.url ?? '')}">
          <small>Empty: the Bitstrom add-on, found through Home Assistant (for administrators), else this host, port ${DEFAULT_PORT}. Or any Bitstrom server.</small>
        </label>
        <label>Height (pixels)
          <input name="height" type="number" min="100" step="10" placeholder="${DEFAULT_HEIGHT[mode]}" value="${escapeHtml(c.height === undefined ? '' : String(c.height))}">
        </label>
        <label>Title (optional)
          <input name="title" type="text" value="${escapeHtml(c.title ?? '')}">
        </label>
      </div>`;
    this._showFor(mode);
    this.querySelectorAll('input, select').forEach((field) =>
      field.addEventListener('change', (e) => {
        const { name, value } = e.target;
        const next = { ...this._config };
        if (value === '' || (name === 'mode' && value === 'full')) delete next[name];
        else next[name] = name === 'height' ? Number(value) : value.trim();
        this._config = next;
        if (name === 'mode') this._showFor(cardMode(next));
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
  description: 'Your radio, podcasts and music library and its players — the whole Bitstrom app, or the player bar alone.',
  preview: false,
  documentationURL: 'https://github.com/yybd/bitstrom-card',
});

console.info(`%c BITSTROM-CARD %c ${CARD_VERSION} `, 'color:#0a1f3d;background:#38bdf8;font-weight:700', 'color:#38bdf8;background:#0a1f3d');
