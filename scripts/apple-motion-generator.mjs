#!/usr/bin/env node

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const formats = {
  "9:16-4k": { width: 2160, height: 3840, label: "9:16 4K" },
  "16:9-4k": { width: 3840, height: 2160, label: "16:9 4K" },
  "9:16": { width: 1080, height: 1920, label: "9:16 HD" },
  "16:9": { width: 1920, height: 1080, label: "16:9 HD" },
};

const presets = new Set(["kinetic-text", "liquid-cards", "product-reveal"]);

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    args[key] = next && !next.startsWith("--") ? argv[++i] : "true";
  }
  return args;
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assertHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function usage() {
  console.log(`Apple-like HyperFrames generator

Usage:
  npm run generate:apple -- --name launch-hook --format 9:16-4k --preset kinetic-text --title "Create faster" --subtitle "One idea. One premium motion system."

Options:
  --name       Project folder name in video-projects/       default: generated from title
  --format     9:16-4k | 16:9-4k | 9:16 | 16:9             default: 9:16-4k
  --preset     kinetic-text | liquid-cards | product-reveal default: kinetic-text
  --title      Main headline                                default: Make it feel inevitable
  --subtitle   Secondary line                               default: Fast premium motion for creator videos.
  --accent     Accent hex color                             default: #7cf7e8
  --duration   Seconds                                      default: 6
`);
}

function createHyperframesJson() {
  return `${JSON.stringify(
    {
      $schema: "https://hyperframes.heygen.com/schema/hyperframes.json",
      registry: "https://raw.githubusercontent.com/heygen-com/hyperframes/main/registry",
      paths: {
        blocks: "compositions",
        components: "compositions/components",
        assets: "assets",
      },
    },
    null,
    2
  )}\n`;
}

function createMeta({ id, name, width, height }) {
  return `${JSON.stringify(
    {
      id,
      name,
      createdAt: new Date().toISOString(),
      width,
      height,
      fps: 60,
    },
    null,
    2
  )}\n`;
}

function createWords(title) {
  return escapeHtml(title)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `<span class="word">${word}</span>`)
    .join("\n            ");
}

function presetMarkup(preset, title, subtitle) {
  const safeSubtitle = escapeHtml(subtitle);
  if (preset === "liquid-cards") {
    return `
        <section class="hero hero-cards">
          <div class="copy">
            <p class="eyebrow">Motion Generator</p>
            <h1>${createWords(title)}</h1>
            <p class="subtitle">${safeSubtitle}</p>
          </div>
          <div class="card-stack" aria-hidden="true">
            <div class="glass-card card-a"><span>Hook</span><strong>0.4s</strong></div>
            <div class="glass-card card-b"><span>Reveal</span><strong>1.2s</strong></div>
            <div class="glass-card card-c"><span>Hold</span><strong>2.8s</strong></div>
          </div>
        </section>`;
  }

  if (preset === "product-reveal") {
    return `
        <section class="hero hero-product">
          <div class="product-shell" aria-hidden="true">
            <div class="screen">
              <div class="screen-bar"></div>
              <div class="screen-row wide"></div>
              <div class="screen-row"></div>
              <div class="screen-row short"></div>
              <div class="orb-core"></div>
            </div>
          </div>
          <div class="copy product-copy">
            <p class="eyebrow">Creator System</p>
            <h1>${createWords(title)}</h1>
            <p class="subtitle">${safeSubtitle}</p>
          </div>
        </section>`;
  }

  return `
        <section class="hero hero-kinetic">
          <p class="eyebrow">Kinetic Type</p>
          <h1>${createWords(title)}</h1>
          <p class="subtitle">${safeSubtitle}</p>
        </section>`;
}

function createHtml({ id, title, subtitle, preset, width, height, duration, accent }) {
  const landscape = width > height;
  const shortSide = Math.min(width, height);
  const pad = Math.round(shortSide * 0.075);
  const headlineSize = Math.round(shortSide * (landscape ? 0.12 : 0.145));
  const subtitleSize = Math.round(shortSide * (landscape ? 0.032 : 0.044));
  const eyebrowSize = Math.round(shortSide * 0.024);
  const radius = Math.round(shortSide * 0.038);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(title)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=block"
      rel="stylesheet"
    />
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: #020305;
        color: #f8fbff;
        font-family: "Inter", system-ui, sans-serif;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        --accent: ${accent};
        --accent-soft: color-mix(in srgb, var(--accent) 34%, transparent);
      }
      .stage-bg,
      .grid,
      .vignette,
      .light-sweep,
      .grain {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .stage-bg {
        background:
          radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 28%),
          radial-gradient(circle at 82% 72%, rgba(255,255,255,0.10), transparent 24%),
          linear-gradient(180deg, #07090e 0%, #020305 58%, #000 100%);
      }
      .grid {
        top: 47%;
        height: 70%;
        transform: perspective(${Math.round(shortSide * 0.75)}px) rotateX(62deg);
        transform-origin: center top;
        opacity: 0.55;
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.11) 0 2px, transparent 2px ${Math.round(shortSide * 0.07)}px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.09) 0 2px, transparent 2px ${Math.round(shortSide * 0.07)}px);
        mask-image: linear-gradient(180deg, transparent, #000 18%, #000 70%, transparent);
      }
      .vignette {
        background: radial-gradient(ellipse at center, transparent 34%, rgba(0,0,0,0.88) 82%, #000 100%);
      }
      .grain {
        opacity: 0.32;
        background-image:
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0),
          radial-gradient(circle at 3px 4px, rgba(255,255,255,0.045) 1px, transparent 0);
        background-size: 7px 7px, 11px 11px;
        mix-blend-mode: screen;
      }
      .light-sweep {
        width: 24%;
        left: -30%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.82), var(--accent), transparent);
        filter: blur(${Math.round(shortSide * 0.012)}px);
        transform: skewX(-18deg);
        opacity: 0;
      }
      .hero {
        position: absolute;
        inset: 0;
        display: flex;
        gap: ${Math.round(shortSide * 0.055)}px;
        padding: ${pad}px;
        align-items: center;
        justify-content: center;
      }
      .copy {
        position: relative;
        z-index: 2;
        max-width: ${landscape ? "58%" : "100%"};
        text-align: ${landscape ? "left" : "center"};
      }
      .eyebrow {
        margin-bottom: ${Math.round(shortSide * 0.025)}px;
        font-family: "JetBrains Mono", monospace;
        font-size: ${eyebrowSize}px;
        line-height: 1;
        letter-spacing: 0;
        color: var(--accent);
        text-transform: uppercase;
      }
      h1 {
        display: flex;
        flex-wrap: wrap;
        justify-content: ${landscape ? "flex-start" : "center"};
        gap: 0 ${Math.round(shortSide * 0.024)}px;
        font-size: ${headlineSize}px;
        line-height: 0.9;
        font-weight: 900;
      }
      .word {
        display: inline-block;
        background: linear-gradient(180deg, #fff 0%, #e8edf4 42%, #8f9aa8 74%, #fff 100%);
        -webkit-background-clip: text;
        color: transparent;
        text-shadow: 0 0 ${Math.round(shortSide * 0.035)}px rgba(255,255,255,0.16);
      }
      .subtitle {
        max-width: ${Math.round(shortSide * 0.75)}px;
        margin-top: ${Math.round(shortSide * 0.035)}px;
        font-size: ${subtitleSize}px;
        line-height: 1.18;
        color: rgba(248,251,255,0.72);
      }
      .hero-kinetic {
        text-align: center;
      }
      .hero-kinetic .copy,
      .hero-kinetic {
        flex-direction: column;
      }
      .hero-kinetic h1,
      .hero-kinetic .subtitle {
        margin-left: auto;
        margin-right: auto;
      }
      .card-stack {
        position: relative;
        width: ${Math.round(shortSide * 0.55)}px;
        height: ${Math.round(shortSide * 0.72)}px;
        perspective: ${Math.round(shortSide * 1.2)}px;
      }
      .glass-card {
        position: absolute;
        width: ${Math.round(shortSide * 0.44)}px;
        height: ${Math.round(shortSide * 0.56)}px;
        border-radius: ${radius}px;
        padding: ${Math.round(shortSide * 0.045)}px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 2px solid rgba(255,255,255,0.18);
        background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.10));
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.24),
          0 ${Math.round(shortSide * 0.055)}px ${Math.round(shortSide * 0.13)}px rgba(0,0,0,0.45),
          0 0 ${Math.round(shortSide * 0.07)}px var(--accent-soft);
        backdrop-filter: blur(28px) saturate(1.15);
      }
      .glass-card span {
        font-family: "JetBrains Mono", monospace;
        font-size: ${Math.round(shortSide * 0.026)}px;
        color: rgba(255,255,255,0.62);
      }
      .glass-card strong {
        font-size: ${Math.round(shortSide * 0.1)}px;
        line-height: 0.9;
      }
      .card-a { left: 4%; top: 13%; transform: rotateY(-14deg) rotateZ(-8deg); }
      .card-b { left: 24%; top: 3%; transform: translateZ(60px); }
      .card-c { left: 39%; top: 22%; transform: rotateY(13deg) rotateZ(9deg); }
      .product-shell {
        width: ${Math.round(shortSide * 0.62)}px;
        aspect-ratio: 0.72;
        border-radius: ${radius}px;
        padding: ${Math.round(shortSide * 0.035)}px;
        border: 2px solid rgba(255,255,255,0.18);
        background: linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03));
        box-shadow: 0 ${Math.round(shortSide * 0.06)}px ${Math.round(shortSide * 0.16)}px rgba(0,0,0,0.58);
      }
      .screen {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: ${Math.round(radius * 0.72)}px;
        background:
          radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 23%),
          linear-gradient(180deg, #151923, #05070b);
      }
      .screen-bar,
      .screen-row {
        position: absolute;
        left: 10%;
        height: 3.4%;
        border-radius: 999px;
        background: rgba(255,255,255,0.74);
      }
      .screen-bar { top: 9%; width: 36%; background: var(--accent); }
      .screen-row { top: 70%; width: 58%; }
      .screen-row.wide { top: 62%; width: 78%; }
      .screen-row.short { top: 78%; width: 42%; }
      .orb-core {
        position: absolute;
        width: 34%;
        aspect-ratio: 1;
        left: 50%;
        top: 42%;
        border-radius: 50%;
        transform: translate(-50%, -50%);
        background: radial-gradient(circle at 35% 25%, #fff, var(--accent) 42%, #14242a 78%);
        box-shadow: 0 0 ${Math.round(shortSide * 0.12)}px var(--accent);
      }
      .product-copy {
        max-width: ${landscape ? "46%" : "100%"};
      }
      @media (orientation: portrait) {
        .hero-cards,
        .hero-product {
          flex-direction: column;
        }
        .hero-product .product-shell {
          order: 2;
        }
        .hero-product .product-copy {
          order: 1;
        }
        .copy {
          text-align: center;
        }
        h1 {
          justify-content: center;
        }
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${id}"
      data-start="0"
      data-duration="${duration}"
      data-width="${width}"
      data-height="${height}"
    >
      <div class="stage-bg"></div>
      <div class="grid"></div>
      <div class="light-sweep"></div>
      ${presetMarkup(preset, title, subtitle)}
      <div class="vignette"></div>
      <div class="grain"></div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      gsap.set(".word, .subtitle, .eyebrow", { opacity: 0 });
      gsap.set(".glass-card, .product-shell", { opacity: 0 });

      tl.fromTo(".grid",
        { y: ${Math.round(shortSide * 0.04)}, opacity: 0 },
        { y: 0, opacity: 0.55, duration: 1.2, ease: "power3.out" },
        0
      );
      tl.to(".light-sweep",
        { x: ${Math.round(width * 5.2)}, opacity: 0.82, duration: 0.58, ease: "power3.inOut" },
        0.08
      );
      tl.to(".light-sweep", { opacity: 0, duration: 0.24, ease: "power2.out" }, 0.66);
      tl.fromTo(".eyebrow",
        { y: ${Math.round(shortSide * 0.025)}, opacity: 0, filter: "blur(18px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.55, ease: "power3.out" },
        0.22
      );
      tl.fromTo(".word",
        { y: ${Math.round(shortSide * 0.1)}, scale: 0.82, opacity: 0, filter: "blur(30px)" },
        { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.82, ease: "power4.out", stagger: 0.08 },
        0.34
      );
      tl.fromTo(".subtitle",
        { y: ${Math.round(shortSide * 0.04)}, opacity: 0, filter: "blur(16px)" },
        { y: 0, opacity: 1, filter: "blur(0px)", duration: 0.62, ease: "power3.out" },
        1.12
      );
      tl.fromTo(".glass-card",
        { y: ${Math.round(shortSide * 0.09)}, rotateX: 16, scale: 0.92, opacity: 0, filter: "blur(22px)" },
        { y: 0, rotateX: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.9, ease: "power3.out", stagger: 0.11 },
        0.72
      );
      tl.fromTo(".product-shell",
        { y: ${Math.round(shortSide * 0.12)}, scale: 0.88, opacity: 0, filter: "blur(24px)" },
        { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: 0.95, ease: "power3.out" },
        0.62
      );
      tl.to(".orb-core", { rotate: 360, duration: ${duration}, ease: "none" }, 0);
      tl.to(".vignette", { opacity: 0.82, duration: 2.2, repeat: Math.max(0, Math.floor(${duration} / 2.2) - 1), yoyo: true, ease: "sine.inOut" }, 0);
      tl.to(".grid", { backgroundPosition: "0px ${Math.round(shortSide * 0.16)}px", duration: ${duration}, ease: "none" }, 0);
      tl.to(".word", { y: -${Math.round(shortSide * 0.035)}, opacity: 0, filter: "blur(18px)", duration: 0.36, ease: "power2.in", stagger: 0.025 }, ${Math.max(duration - 0.7, 1.5)});
      tl.to(".subtitle, .eyebrow, .glass-card, .product-shell", { opacity: 0, filter: "blur(18px)", duration: 0.34, ease: "power2.in" }, ${Math.max(duration - 0.52, 1.7)});
      tl.to({}, { duration: ${duration} }, 0);

      window.__timelines["${id}"] = tl;
    </script>
  </body>
</html>
`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || args.h) {
  usage();
  process.exit(0);
}

const title = args.title || "Make it feel inevitable";
const subtitle = args.subtitle || "Fast premium motion for creator videos.";
const name = slugify(args.name || title || "apple-motion");
const id = name || "apple-motion";
const formatKey = args.format || "9:16-4k";
const format = formats[formatKey];
const preset = args.preset || "kinetic-text";
const duration = Number(args.duration || 6);
const accent = assertHex(args.accent, "#7cf7e8");

if (!format) {
  console.error(`Unknown format "${formatKey}". Expected one of: ${Object.keys(formats).join(", ")}`);
  process.exit(2);
}
if (!presets.has(preset)) {
  console.error(`Unknown preset "${preset}". Expected one of: ${Array.from(presets).join(", ")}`);
  process.exit(2);
}
if (!Number.isFinite(duration) || duration <= 0) {
  console.error("--duration must be a positive number.");
  process.exit(2);
}

const projectDir = resolve("video-projects", id);
if (existsSync(projectDir)) {
  console.error(`Project already exists: ${projectDir}`);
  process.exit(1);
}

mkdirSync(join(projectDir, "assets"), { recursive: true });
mkdirSync(join(projectDir, "compositions"), { recursive: true });
writeFileSync(join(projectDir, "hyperframes.json"), createHyperframesJson());
writeFileSync(join(projectDir, "meta.json"), createMeta({ id, name: id, ...format }));
writeFileSync(
  join(projectDir, "index.html"),
  createHtml({ id, title, subtitle, preset, ...format, duration, accent })
);

console.log(`Created ${format.label} ${preset} project: ${projectDir}`);
console.log(`Preview: cd ${projectDir} && npx hyperframes preview`);
console.log(`Lint:    cd ${projectDir} && npx hyperframes lint`);
