# Bitstrom card

A Home Assistant dashboard card that shows the Bitstrom app — your radio,
podcasts, music library and players — from the
[Bitstrom add-on](https://github.com/yybd/bitstrom-ha-addon) or any Bitstrom
server.

## Install (HACS)

1. HACS → ⋮ → **Custom repositories** → add `https://github.com/yybd/bitstrom-card`,
   type **Dashboard**.
2. Install **Bitstrom card**, then reload the browser.
3. Edit a dashboard → **Add card** → **Bitstrom**.

## Options

```yaml
type: custom:bitstrom-card
url: http://homeassistant.local:17770   # default: this host, port 17770
height: 640                             # pixels
title: Bitstrom                         # optional
```

**https:** a dashboard opened over https (Nabu Casa, a reverse proxy) cannot
show the add-on's plain-http page inside it; the card then offers a link that
opens Bitstrom in a new tab.
