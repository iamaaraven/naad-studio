# Naad Studio

**Naad** (नाद) — a browser music-studio MVP by [Aaraven Sharma](https://github.com/iamaaraven).

Make a song sketch from scratch (AI-assisted arrangement + global synth instruments), apply a demo tune/autotune effect, preview a lyric video, and prepare a publishing / monetization pack — all client-side.

## Try it

- **GitHub Pages:** https://iamaaraven.github.io/naad-studio/
- **jsDelivr mirror:** https://cdn.jsdelivr.net/gh/iamaaraven/naad-studio@gh-pages/index.html

Add to Home Screen supported (`manifest.webmanifest` + `icon.svg`).

## Features (MVP)

1. **Create** — title, genre (Bollywood / Pop / Hip-hop / EDM / Folk / Lo-fi), mood, BPM, lyrics. **Generate arrangement** builds a rule-based chord/melody structure (intro / verse / chorus). Not a paid Suno API.
2. **Instruments** — toggleable Web Audio layers: piano, guitar-ish, bass, drums, sitar-ish, flute-ish, synth pad, synth lead, djembe-ish. Play/stop loop preview.
3. **Tune / Autotune** — optional voice upload or mic; demo pitch/tune effect via playbackRate scale quantization + wet/dry; master song-tune slider for the instrumental.
4. **Video** — canvas lyric video (mood gradients, title card, BPM-synced lyrics). WebM via `MediaRecorder` when available; else cover PNG + lyrics + CapCut/screen-record tip.
5. **Publish & monetize** — checklist for YouTube, Instagram/Reels, Spotify for Artists, DistroKid/TuneCore. Downloadable release pack (JSON/TXT). **Naad does not upload or pay you.**

## Technical

- Vanilla JS + Web Audio + Canvas — **no React/Vite bundle**
- Deploy surface: `pages-lite/` (each file ≪ 100KB) → **gh-pages root**
- PWA-lite: `manifest.webmanifest`, `icon.svg`, `.nojekyll`

```
pages-lite/
  index.html
  styles.css
  arrange.js
  audio-engine.js
  video.js
  app.js
  manifest.webmanifest
  icon.svg
  .nojekyll
```

## Honest limits

- Arrangement is **rule-based**, not a cloud generative model.
- Autotune is a **simplified browser demo**, not Melodyne/Antares.
- No DistroKid / Spotify / YouTube upload or payouts — prep + guidance only.
- Instrument sounds are oscillators/noise, not licensed sample packs.

## Disclaimer

Demo studio. Not affiliated with Spotify, YouTube, Apple, DistroKid, or TuneCore. Monetization requires your own platform accounts and compliance with their rules.

## License

MIT — use freely; keep the disclaimer when redistributing the demo.
