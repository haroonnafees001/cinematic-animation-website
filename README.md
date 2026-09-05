# Cinematic Animation Website

A scroll-driven cinematic landing page inspired by premium energy / industrial brand sites (Vectrus-style). As the user scrolls, a full-bleed background video scrubs frame-by-frame while overlay copy fades through three narrative sections.

---

## Overview

This is a single-page React experience where **scroll position controls video time**. The hero never autoplays; every frame is tied to how far the user has scrolled through a tall sticky container (`500vh`). Overlay typography and navigation color shift with progress, creating a continuous “film + copy” composition.

---

## Tech Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | **React 18** + **TypeScript** | Component structure, typed hooks, predictable state |
| Bundler | **Vite 5** | Fast HMR and simple production builds |
| Styling | **Tailwind CSS 3** + PostCSS / Autoprefixer | Utility layout, responsive breakpoints, minimal custom CSS |
| Icons | **lucide-react** | Lightweight SVG icons for nav / CTAs |
| Video parsing | **mp4box.js** | Demux MP4 tracks/samples in the browser |
| Frame decode | **WebCodecs API** (`VideoDecoder`) | Hardware-accelerated decode into a frame bank |
| Hosting video | **CloudFront** MP4 URL | CDN-delivered cinematic asset (CORS-enabled) |

**Dev tooling:** `@vitejs/plugin-react`, path alias `@` → `src/`.

---

## Core Approach

### 1. Scroll ↔ video mapping

- Outer container is **`h-[500vh]`**; inner stage is **`sticky top-0 h-screen`**.
- Scroll progress `p` is `scrollY / (containerHeight - viewportHeight)`, clamped to `0…1`.
- Target video time = `p × duration`.
- A `requestAnimationFrame` loop **lerps** current time toward the target (`LERP_TAU`) so scrubbing feels smooth instead of jumpy. `prefers-reduced-motion` snaps instantly (no lerp).

### 2. Dual rendering path (canvas first, video fallback)

**Primary path — decoded frame bank**

1. Fetch the MP4 as an `ArrayBuffer`.
2. Parse with **MP4Box** (codec, description, samples).
3. Decode samples with **`VideoDecoder`** (try hardware, then software).
4. Convert each `VideoFrame` to a **WebP blob** (via `OffscreenCanvas` when available).
5. Store `{ timestamp, blob }` in a sorted **frame bank**.
6. On each frame, binary-search the nearest timestamp, warm an **LRU of `ImageBitmap`s**, and paint to a full-screen **`<canvas>`**.

Once the bank is live, the canvas fades in over the `<video>` element.

**Fallback path — HTML5 video seek**

If WebCodecs is missing, reduced-motion is on, decode fails, or a **60s watchdog** expires, the hook reverts to seeking `video.currentTime` from the same lerped clock. The page still works; scrubbing may be less precise on some browsers.

### 3. Narrative sections driven by progress

Section opacities are piecewise functions of `p`:

| Section | Role | Approx. progress window |
| --- | --- | --- |
| 1 | Hero headline + tagline | Early scroll (`~0–0.28`) |
| 2 | Center partnership statement | Mid scroll (`~0.32–0.63`) |
| 3 | Closing CTA (light type) | Late scroll (`~0.67–1`) |

`Stagger` components animate opacity + `translateY` when a section becomes visible. Nav ink switches from dark (`#1D3045`) to white after mid-scroll so it stays readable on the footage.

### 4. Motion & UX details

- Custom easing: `cubic-bezier(0.16, 1, 0.3, 1)` for entrance staggers.
- Desktop nav with staggered fade-in; mobile full-screen menu overlay.
- Video is **muted**, **playsInline**, **never autoplayed** — position is scroll-only.
- Resize / orientation listeners keep the scroll span accurate.

---

## Project Structure

```
├── index.html              # Root HTML, Helvetica Neue ME font
├── package.json
├── vite.config.ts          # React plugin + `@` alias
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
└── src/
    ├── main.tsx            # React mount
    ├── App.tsx             # Layout, sections, nav, mobile menu
    ├── useVideoScrub.ts    # Scroll scrub + WebCodecs frame bank
    ├── index.css           # Tailwind + base body styles
    └── mp4box.d.ts         # Type shims for mp4box
```

---

## Getting Started

### Prerequisites

- Node.js 18+ recommended
- npm (or compatible package manager)

### Install & run

```bash
npm install
npm run dev
```

Open the local URL Vite prints (usually `http://localhost:5173`).

### Production build

```bash
npm run build
npm run preview
```

---

## Key Files

- **`src/useVideoScrub.ts`** — scroll progress, lerp, WebCodecs bank, LRU paint, video fallback.
- **`src/App.tsx`** — sticky cinematic stage, three copy sections, nav, mobile menu.

---

## Browser Notes

- Best experience in Chromium-based browsers with **WebCodecs** support.
- Safari / Firefox may fall back to video seeking depending on codec / API support.
- The MP4 host must allow **CORS** for the fetch + decode path.

---

## Brand / Design Notes

- Brand color: `#1D3045`
- Typography: Helvetica Neue ME (with Helvetica Neue / Arial fallbacks)
- Full-bleed video + canvas as the visual plane; overlays are typography-led, not card-heavy
- Content is placeholder marketing copy for an energy / resources narrative (Vectrus-inspired labels)

---

## License

Private project — all rights reserved unless otherwise stated by the repository owner.
