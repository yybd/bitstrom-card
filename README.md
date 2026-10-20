# Bitstrom card

[![HACS](https://img.shields.io/badge/HACS-Dashboard-41BDF5.svg)](https://hacs.xyz)
[![Validate](https://github.com/yybd/bitstrom-card/actions/workflows/validate.yml/badge.svg)](https://github.com/yybd/bitstrom-card/actions/workflows/validate.yml)

Bitstrom on your Home Assistant dashboard: your internet radio, podcasts and
music library, and the player bar for the players in your home — MPD (moOde,
Volumio…), LMS / Squeezelite, DLNA renderers, Sonos, BluOS, WiiM / LinkPlay,
HEOS, Chromecast and Home Assistant media players. Music plays **bit-perfect**:
each player gets it exactly as it is, never converted.

The card shows the full Bitstrom app from the
[Bitstrom add-on](https://github.com/yybd/bitstrom-ha-addon), or from any
Bitstrom server on your network (the desktop app, the Docker image).

![The Bitstrom card on a dashboard](images/card.png)

## What you need

A running Bitstrom server. On Home Assistant OS or Supervised, install the
add-on:

[![Add the Bitstrom add-on repository to your Home Assistant.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fyybd%2Fbitstrom-ha-addon)

On Home Assistant Container or Core, run the Bitstrom desktop app or Docker
image on any machine on the network, and give the card its address.

## Install

### HACS

[![Open the Bitstrom card in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=yybd&repository=bitstrom-card&category=plugin)

1. In HACS, search for **Bitstrom card** and open it (or use the button above).
2. Press **Download**, then reload the browser.
3. Edit a dashboard → **Add card** → **Bitstrom**.

### Manual

1. Copy `bitstrom-card.js` into `<config>/www/`.
2. **Settings → Dashboards → ⋮ → Resources → Add resource**:
   `/local/bitstrom-card.js`, type **JavaScript module**.
3. Reload the browser and add the card as above.

## Options

Everything can be set in the card's visual editor.

```yaml
type: custom:bitstrom-card
url: http://homeassistant.local:17770   # default: this host, port 17770
height: 640                             # pixels; default 640
title: Bitstrom                         # optional
```

| Option | Default | |
| --- | --- | --- |
| `url` | `http://<this host>:17770` | The Bitstrom add-on or server. With the add-on, the default is right. |
| `height` | `640` | The card's height in pixels. |
| `title` | none | A heading above the app. |

In a **sections** dashboard the card takes the full width and as many rows as
its height needs.

## Over https (Nabu Casa, a reverse proxy)

A dashboard opened over **https** cannot show a plain-http page inside it —
the browser blocks it. The card then says so and offers a link that opens
Bitstrom in a new tab. To have the app inside the card there too, serve
Bitstrom over https as well (for example behind the same reverse proxy) and
set `url` to that address.

## Support

Issues and questions: https://github.com/yybd/bitstrom-card/issues
