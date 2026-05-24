#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const formats = {
  "9:16-4k": { width: 2160, height: 3840, label: "9:16 4K" },
  "16:9-4k": { width: 3840, height: 2160, label: "16:9 4K" },
  "9:16": { width: 1080, height: 1920, label: "9:16 HD" },
  "16:9": { width: 1920, height: 1080, label: "16:9 HD" },
};

const presets = new Set(["apple-keynote", "kinetic-text", "liquid-cards", "product-reveal"]);
const transitions = new Set(["light-sweep", "zoom-blur", "card-wipe"]);
const motionLevels = {
  calm: { speed: 0.86, blur: 0.72, travel: 0.7, scale: 0.94 },
  balanced: { speed: 1, blur: 1, travel: 1, scale: 1 },
  punchy: { speed: 1.16, blur: 1.28, travel: 1.24, scale: 1.08 },
};

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
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function assertHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : fallback;
}

function parseList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function usage() {
  console.log(`Motion Kit generator

Usage:
  npm run generate:motion -- --name launch-film --format 9:16-4k --preset apple-keynote --title "Create faster"
  npm run generate:motion -- --config docs/motion-kit.apple-pub.json --name my-variant

Options:
  --config       JSON recipe with brand, scenes, transition, motion level
  --name         Project folder in video-projects/
  --format       9:16-4k | 16:9-4k | 9:16 | 16:9
  --preset       apple-keynote | kinetic-text | liquid-cards | product-reveal
  --motion       calm | balanced | punchy
  --transition   light-sweep | zoom-blur | card-wipe
  --title        Main headline for quick mode
  --subtitle     Secondary line for quick mode
  --eyebrow      Small label above the headline
  --cards        Card labels separated by "|"
  --accent       Accent hex color
  --duration     Per-scene duration in quick mode
  --force        Overwrite an existing generated project
`);
}

function loadConfig(configPath) {
  if (!configPath) return {};
  const fullPath = resolve(configPath);
  const raw = readFileSync(fullPath, "utf8");
  return JSON.parse(raw);
}

function quickConfig(args) {
  const title = args.title || "Make every creation feel cinematic";
  const subtitle = args.subtitle || "Fast Apple-style motion with editable scenes, cards, color, timing, and format.";
  const cards = parseList(args.cards, ["Hook", "Reveal", "Proof"]);
  const duration = Number(args.duration || 2.4);
  return {
    name: args.name || slugify(title),
    format: args.format || "9:16-4k",
    preset: args.preset || "apple-keynote",
    motion: args.motion || "balanced",
    transition: args.transition || "light-sweep",
    brand: {
      accent: args.accent || "#7cf7e8",
      background: "#020305",
      label: args.eyebrow || "Motion Kit",
    },
    scenes: [
      {
        type: args.preset === "kinetic-text" ? "kinetic" : "hero",
        eyebrow: args.eyebrow || "Motion Kit",
        title,
        subtitle,
        duration,
      },
      {
        type: "cards",
        eyebrow: "Personalize",
        title: "Change the rhythm",
        subtitle: "Swap text, cards, colors, and transitions without rebuilding the composition.",
        cards,
        duration,
      },
      {
        type: "product",
        eyebrow: "Render",
        title: "Pick the format",
        subtitle: "9:16 4K for Shorts and Reels. 16:9 4K for YouTube, launch films, and decks.",
        duration,
      },
      {
        type: "cta",
        eyebrow: args.eyebrow || "Motion Kit",
        title: "Ready to export",
        subtitle: "Preview, lint, render, iterate.",
        duration: Math.max(duration + 0.6, 3),
      },
    ],
  };
}

function mergeConfig(fileConfig, args) {
  const quick = quickConfig(args);
  const config = {
    ...quick,
    ...fileConfig,
    brand: { ...quick.brand, ...(fileConfig.brand || {}) },
  };

  if (args.name) config.name = args.name;
  if (args.format) config.format = args.format;
  if (args.preset) config.preset = args.preset;
  if (args.motion) config.motion = args.motion;
  if (args.transition) config.transition = args.transition;
  if (args.accent) config.brand.accent = args.accent;

  config.name = slugify(config.name || config.scenes?.[0]?.title || "motion-kit");
  config.format = config.format || "9:16-4k";
  config.preset = config.preset || "apple-keynote";
  config.motion = config.motion || "balanced";
  config.transition = config.transition || "light-sweep";
  config.brand.accent = assertHex(config.brand.accent, "#7cf7e8");
  config.brand.background = assertHex(config.brand.background, "#020305");
  config.scenes = Array.isArray(config.scenes) && config.scenes.length ? config.scenes : quick.scenes;
  config.scenes = config.scenes.map((scene, index) => ({
    type: scene.type || ["hero", "cards", "product", "cta"][index] || "hero",
    eyebrow: scene.eyebrow || config.brand.label || "Motion Kit",
    title: scene.title || `Scene ${index + 1}`,
    subtitle: scene.subtitle || "",
    cards: Array.isArray(scene.cards) ? scene.cards : ["Hook", "Reveal", "Hold"],
    duration: Number(scene.duration || 2.4),
  }));

  return config;
}

function validateConfig(config) {
  const format = formats[config.format];
  if (!format) {
    throw new Error(`Unknown format "${config.format}". Expected one of: ${Object.keys(formats).join(", ")}`);
  }
  if (!presets.has(config.preset)) {
    throw new Error(`Unknown preset "${config.preset}". Expected one of: ${Array.from(presets).join(", ")}`);
  }
  if (!transitions.has(config.transition)) {
    throw new Error(`Unknown transition "${config.transition}". Expected one of: ${Array.from(transitions).join(", ")}`);
  }
  if (!motionLevels[config.motion]) {
    throw new Error(`Unknown motion "${config.motion}". Expected one of: ${Object.keys(motionLevels).join(", ")}`);
  }
  for (const [index, scene] of config.scenes.entries()) {
    if (!Number.isFinite(scene.duration) || scene.duration <= 0) {
      throw new Error(`Scene ${index + 1} has an invalid duration.`);
    }
  }
  return format;
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

function createProjectConfig(config) {
  return `${JSON.stringify(config, null, 2)}\n`;
}

function createWords(title) {
  return escapeHtml(title)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `<span class="word">${word}</span>`)
    .join("");
}

function sceneMarkup(scene, index, start, width, height) {
  const sceneId = `scene-${index + 1}`;
  const cards = scene.cards.slice(0, 4);
  const commonAttrs = `id="${sceneId}" class="clip scene scene-${scene.type}" data-start="${start.toFixed(2)}" data-duration="${scene.duration}" data-track-index="${10 + index}"`;

  if (scene.type === "cards") {
    return `
      <section ${commonAttrs}>
        <div class="scene-content cards-layout">
          <div class="copy">
            <p class="eyebrow">${escapeHtml(scene.eyebrow)}</p>
            <h1>${createWords(scene.title)}</h1>
            <p class="subtitle">${escapeHtml(scene.subtitle)}</p>
          </div>
          <div class="card-stage" aria-hidden="true">
            ${cards
              .map(
                (card, cardIndex) => `
            <div class="glass-card card-${cardIndex + 1}">
              <span>${String(cardIndex + 1).padStart(2, "0")}</span>
              <strong>${escapeHtml(card)}</strong>
            </div>`
              )
              .join("")}
          </div>
        </div>
      </section>`;
  }

  if (scene.type === "product") {
    return `
      <section ${commonAttrs}>
        <div class="scene-content product-layout">
          <div class="product-frame" aria-hidden="true">
            <div class="device">
              <div class="device-glow"></div>
              <div class="device-bar"></div>
              <div class="device-row wide"></div>
              <div class="device-row"></div>
              <div class="device-row short"></div>
              <div class="device-core"></div>
            </div>
          </div>
          <div class="copy">
            <p class="eyebrow">${escapeHtml(scene.eyebrow)}</p>
            <h1>${createWords(scene.title)}</h1>
            <p class="subtitle">${escapeHtml(scene.subtitle)}</p>
          </div>
        </div>
      </section>`;
  }

  if (scene.type === "cta") {
    return `
      <section ${commonAttrs}>
        <div class="scene-content cta-layout">
          <div class="mark" aria-hidden="true">${width > height ? "MK" : "M"}</div>
          <div class="copy">
            <p class="eyebrow">${escapeHtml(scene.eyebrow)}</p>
            <h1>${createWords(scene.title)}</h1>
            <p class="subtitle">${escapeHtml(scene.subtitle)}</p>
          </div>
        </div>
      </section>`;
  }

  return `
      <section ${commonAttrs}>
        <div class="scene-content hero-layout">
          <div class="copy">
            <p class="eyebrow">${escapeHtml(scene.eyebrow)}</p>
            <h1>${createWords(scene.title)}</h1>
            <p class="subtitle">${escapeHtml(scene.subtitle)}</p>
          </div>
        </div>
      </section>`;
}

function createCss({ id, config, width, height, totalDuration }) {
  const landscape = width > height;
  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const pad = Math.round(shortSide * 0.08);
  const headlineSize = Math.round(shortSide * (landscape ? 0.112 : 0.132));
  const subtitleSize = Math.round(shortSide * (landscape ? 0.03 : 0.039));
  const eyebrowSize = Math.round(shortSide * 0.021);
  const radius = Math.round(shortSide * 0.04);
  const brand = config.brand;

  return `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        background: ${brand.background};
        color: #f8fbff;
        font-family: sans-serif;
      }
      #root {
        position: relative;
        width: ${width}px;
        height: ${height}px;
        overflow: hidden;
        isolation: isolate;
        --accent: ${brand.accent};
        --bg: ${brand.background};
        --glass: rgba(255,255,255,0.095);
        --stroke: rgba(255,255,255,0.18);
      }
      .stage-bg,
      .aurora,
      .grid,
      .vignette,
      .grain,
      .transition-light,
      .transition-panel {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .stage-bg {
        background:
          radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--accent) 17%, transparent), transparent 29%),
          radial-gradient(circle at 78% 74%, rgba(255,255,255,0.09), transparent 26%),
          linear-gradient(180deg, #080a10 0%, var(--bg) 54%, #000 100%);
      }
      .aurora {
        opacity: 0.32;
        background: conic-gradient(from 210deg at 50% 50%, transparent, color-mix(in srgb, var(--accent) 42%, transparent), transparent 32%, rgba(255,255,255,0.16), transparent 68%);
        filter: blur(${Math.round(shortSide * 0.075)}px);
      }
      .grid {
        top: 46%;
        height: 76%;
        transform: perspective(${Math.round(shortSide * 0.78)}px) rotateX(63deg);
        transform-origin: center top;
        opacity: 0.52;
        background:
          repeating-linear-gradient(90deg, rgba(255,255,255,0.12) 0 2px, transparent 2px ${Math.round(shortSide * 0.068)}px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.085) 0 2px, transparent 2px ${Math.round(shortSide * 0.068)}px);
        mask-image: linear-gradient(180deg, transparent, #000 16%, #000 68%, transparent);
      }
      .vignette {
        z-index: 80;
        background: radial-gradient(ellipse at center, transparent 34%, rgba(0,0,0,0.86) 82%, #000 100%);
      }
      .grain {
        z-index: 90;
        opacity: 0.24;
        mix-blend-mode: screen;
        background-image:
          radial-gradient(circle at 1px 1px, rgba(255,255,255,0.08) 1px, transparent 0),
          radial-gradient(circle at 4px 3px, rgba(255,255,255,0.045) 1px, transparent 0);
        background-size: 7px 7px, 13px 13px;
      }
      .transition-light {
        z-index: 70;
        width: 22%;
        left: -34%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.94), var(--accent), transparent);
        filter: blur(${Math.round(shortSide * 0.013)}px);
        opacity: 0;
        transform: skewX(-18deg);
      }
      .transition-panel {
        z-index: 68;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
        opacity: 0;
        transform: translateX(-105%) skewX(-8deg);
      }
      .scene {
        position: absolute;
        inset: 0;
        overflow: hidden;
      }
      .scene-content {
        width: 100%;
        height: 100%;
        padding: ${pad}px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${Math.round(shortSide * 0.055)}px;
      }
      .copy {
        position: relative;
        z-index: 4;
        max-width: ${landscape ? "56%" : "100%"};
        text-align: ${landscape ? "left" : "center"};
      }
      .eyebrow {
        margin-bottom: ${Math.round(shortSide * 0.025)}px;
        font-family: monospace;
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
        gap: 0 ${Math.round(shortSide * 0.02)}px;
        font-size: ${headlineSize}px;
        line-height: 0.88;
        font-weight: 900;
      }
      .word {
        display: inline-block;
        background: linear-gradient(180deg, #fff 0%, #f0f4f9 42%, #8f99a7 73%, #fff 100%);
        -webkit-background-clip: text;
        color: transparent;
        text-shadow: 0 0 ${Math.round(shortSide * 0.035)}px rgba(255,255,255,0.16);
      }
      .subtitle {
        max-width: ${Math.round(shortSide * 0.78)}px;
        margin-top: ${Math.round(shortSide * 0.036)}px;
        font-size: ${subtitleSize}px;
        line-height: 1.16;
        color: rgba(248,251,255,0.72);
      }
      .hero-layout,
      .cta-layout {
        text-align: center;
      }
      .hero-layout .copy,
      .cta-layout .copy {
        max-width: ${Math.round(shortSide * 0.86)}px;
        text-align: center;
      }
      .hero-layout h1,
      .cta-layout h1 {
        justify-content: center;
      }
      .cards-layout {
        flex-direction: ${landscape ? "row" : "column"};
      }
      .card-stage {
        position: relative;
        z-index: 3;
        width: ${Math.round(shortSide * (landscape ? 0.5 : 0.62))}px;
        height: ${Math.round(shortSide * (landscape ? 0.54 : 0.68))}px;
        perspective: ${Math.round(shortSide * 1.15)}px;
      }
      .glass-card {
        position: absolute;
        width: ${Math.round(shortSide * 0.38)}px;
        min-height: ${Math.round(shortSide * 0.44)}px;
        border-radius: ${radius}px;
        padding: ${Math.round(shortSide * 0.038)}px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        border: 2px solid var(--stroke);
        background: linear-gradient(135deg, rgba(255,255,255,0.18), rgba(255,255,255,0.04) 42%, rgba(255,255,255,0.10));
        box-shadow:
          inset 0 2px 0 rgba(255,255,255,0.24),
          0 ${Math.round(shortSide * 0.055)}px ${Math.round(shortSide * 0.13)}px rgba(0,0,0,0.45),
          0 0 ${Math.round(shortSide * 0.075)}px color-mix(in srgb, var(--accent) 34%, transparent);
        backdrop-filter: blur(32px) saturate(1.16);
      }
      .glass-card span {
        font-family: monospace;
        font-size: ${Math.round(shortSide * 0.023)}px;
        color: rgba(255,255,255,0.55);
      }
      .glass-card strong {
        font-size: ${Math.round(shortSide * 0.056)}px;
        line-height: 0.95;
      }
      .card-1 { left: 4%; top: 18%; transform: rotateY(-15deg) rotateZ(-8deg); }
      .card-2 { left: 30%; top: 3%; transform: translateZ(70px); }
      .card-3 { left: 52%; top: 24%; transform: rotateY(14deg) rotateZ(8deg); }
      .card-4 { left: 18%; top: 48%; transform: rotateY(-8deg) rotateZ(4deg); }
      .product-layout {
        flex-direction: ${landscape ? "row" : "column-reverse"};
      }
      .product-frame {
        position: relative;
        z-index: 3;
        width: ${Math.round(shortSide * (landscape ? 0.48 : 0.64))}px;
        aspect-ratio: 0.72;
        border-radius: ${radius}px;
        padding: ${Math.round(shortSide * 0.032)}px;
        border: 2px solid rgba(255,255,255,0.18);
        background: linear-gradient(145deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03));
        box-shadow: 0 ${Math.round(shortSide * 0.06)}px ${Math.round(shortSide * 0.16)}px rgba(0,0,0,0.58);
      }
      .device {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        border-radius: ${Math.round(radius * 0.72)}px;
        background:
          radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--accent) 45%, transparent), transparent 23%),
          linear-gradient(180deg, #151923, #05070b);
      }
      .device-glow {
        position: absolute;
        inset: 18%;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255,255,255,0.94), var(--accent) 42%, transparent 70%);
        filter: blur(${Math.round(shortSide * 0.018)}px);
      }
      .device-bar,
      .device-row {
        position: absolute;
        left: 10%;
        height: 3.4%;
        border-radius: 999px;
        background: rgba(255,255,255,0.74);
      }
      .device-bar { top: 9%; width: 36%; background: var(--accent); }
      .device-row { top: 70%; width: 58%; }
      .device-row.wide { top: 62%; width: 78%; }
      .device-row.short { top: 78%; width: 42%; }
      .device-core {
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
      .mark {
        width: ${Math.round(shortSide * 0.22)}px;
        aspect-ratio: 1;
        margin-bottom: ${Math.round(shortSide * 0.045)}px;
        display: grid;
        place-items: center;
        border-radius: ${Math.round(shortSide * 0.055)}px;
        color: #05070b;
        background: linear-gradient(135deg, #fff, var(--accent));
        font-size: ${Math.round(shortSide * 0.075)}px;
        font-weight: 900;
        box-shadow: 0 0 ${Math.round(shortSide * 0.12)}px color-mix(in srgb, var(--accent) 45%, transparent);
      }
      .cta-layout {
        flex-direction: column;
      }
      .timeline-chip {
        position: absolute;
        z-index: 6;
        left: ${pad}px;
        bottom: ${pad}px;
        font-family: monospace;
        font-size: ${Math.round(shortSide * 0.018)}px;
        color: rgba(255,255,255,0.48);
      }
`;
}

function transitionTween(config, width, start) {
  if (config.transition === "zoom-blur") {
    return `
      tl.fromTo("#root", { scale: 1.012, filter: "brightness(1.18) blur(10px)" }, { scale: 1, filter: "brightness(1) blur(0px)", duration: 0.5, ease: "power3.out" }, ${start.toFixed(2)});`;
  }
  if (config.transition === "card-wipe") {
    return `
      tl.fromTo(".transition-panel", { xPercent: -110, opacity: 0 }, { xPercent: 110, opacity: 1, duration: 0.56, ease: "power3.inOut" }, ${start.toFixed(2)});
      tl.to(".transition-panel", { opacity: 0, duration: 0.18, ease: "power2.out" }, ${(start + 0.44).toFixed(2)});`;
  }
  return `
      tl.fromTo(".transition-light", { x: 0, opacity: 0 }, { x: ${Math.round(width * 5.2)}, opacity: 0.86, duration: 0.54, ease: "power3.inOut" }, ${start.toFixed(2)});
      tl.to(".transition-light", { opacity: 0, duration: 0.2, ease: "power2.out" }, ${(start + 0.56).toFixed(2)});`;
}

function sceneTimeline(scene, index, start, config, width, shortSide) {
  const sceneSelector = `#scene-${index + 1}`;
  const duration = scene.duration;
  const motion = motionLevels[config.motion];
  const enterTravel = Math.round(shortSide * 0.08 * motion.travel);
  const exitTravel = Math.round(shortSide * 0.04 * motion.travel);
  const blur = Math.round(24 * motion.blur);
  const enterDuration = Number((0.72 / motion.speed).toFixed(2));
  const exitStart = Math.max(start + duration - 0.46, start + 0.9);

  return `
      tl.fromTo("${sceneSelector} .eyebrow", { y: ${Math.round(enterTravel * 0.35)}, opacity: 0, filter: "blur(${Math.round(blur * 0.55)}px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: ${Number((0.46 / motion.speed).toFixed(2))}, ease: "power3.out" }, ${(start + 0.16).toFixed(2)});
      tl.fromTo("${sceneSelector} .word", { y: ${enterTravel}, scale: ${motion.scale - 0.16}, opacity: 0, filter: "blur(${blur}px)" }, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: ${enterDuration}, ease: "power4.out", stagger: ${Number((0.075 / motion.speed).toFixed(3))} }, ${(start + 0.28).toFixed(2)});
      tl.fromTo("${sceneSelector} .subtitle", { y: ${Math.round(enterTravel * 0.42)}, opacity: 0, filter: "blur(${Math.round(blur * 0.55)}px)" }, { y: 0, opacity: 1, filter: "blur(0px)", duration: ${Number((0.56 / motion.speed).toFixed(2))}, ease: "power3.out" }, ${(start + 0.92).toFixed(2)});
      tl.fromTo("${sceneSelector} .glass-card", { y: ${Math.round(enterTravel * 1.1)}, rotateX: 16, scale: 0.9, opacity: 0, filter: "blur(${blur}px)" }, { y: 0, rotateX: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: ${Number((0.88 / motion.speed).toFixed(2))}, ease: "power3.out", stagger: ${Number((0.1 / motion.speed).toFixed(2))} }, ${(start + 0.54).toFixed(2)});
      tl.fromTo("${sceneSelector} .product-frame", { y: ${Math.round(enterTravel * 1.2)}, scale: 0.88, opacity: 0, filter: "blur(${blur}px)" }, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: ${Number((0.9 / motion.speed).toFixed(2))}, ease: "power3.out" }, ${(start + 0.44).toFixed(2)});
      tl.fromTo("${sceneSelector} .mark", { y: ${Math.round(enterTravel * 0.7)}, scale: 0.72, opacity: 0, filter: "blur(${blur}px)" }, { y: 0, scale: 1, opacity: 1, filter: "blur(0px)", duration: ${Number((0.72 / motion.speed).toFixed(2))}, ease: "back.out(1.55)" }, ${(start + 0.2).toFixed(2)});
      tl.to("${sceneSelector} .device-core, ${sceneSelector} .device-glow", { rotate: 180, duration: ${duration}, ease: "none" }, ${start.toFixed(2)});
      tl.to("${sceneSelector} .word", { y: -${exitTravel}, opacity: 0, filter: "blur(${Math.round(blur * 0.7)}px)", duration: 0.34, ease: "power2.in", stagger: 0.018 }, ${exitStart.toFixed(2)});
      tl.to("${sceneSelector} .subtitle, ${sceneSelector} .eyebrow, ${sceneSelector} .glass-card, ${sceneSelector} .product-frame, ${sceneSelector} .mark", { y: -${Math.round(exitTravel * 0.6)}, opacity: 0, filter: "blur(${Math.round(blur * 0.65)}px)", duration: 0.3, ease: "power2.in" }, ${(exitStart + 0.06).toFixed(2)});`;
}

function createHtml({ id, config, width, height }) {
  const shortSide = Math.min(width, height);
  let cursor = 0;
  const scenes = config.scenes.map((scene, index) => {
    const markup = sceneMarkup(scene, index, cursor, width, height);
    cursor += scene.duration;
    return markup;
  });
  const totalDuration = Number(cursor.toFixed(2));
  let timeline = "";
  cursor = 0;
  config.scenes.forEach((scene, index) => {
    if (index > 0) timeline += transitionTween(config, width, Math.max(cursor - 0.18, 0));
    timeline += sceneTimeline(scene, index, cursor, config, width, shortSide);
    cursor += scene.duration;
  });

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${width}, height=${height}" />
    <title>${escapeHtml(config.scenes[0]?.title || id)}</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>${createCss({ id, config, width, height, totalDuration })}
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="${id}"
      data-start="0"
      data-duration="${totalDuration}"
      data-width="${width}"
      data-height="${height}"
    >
      <div class="stage-bg"></div>
      <div class="aurora"></div>
      <div class="grid"></div>
      <div class="transition-panel"></div>
      <div class="transition-light"></div>
      ${scenes.join("\n")}
      <div class="timeline-chip">${escapeHtml(config.format)} / ${escapeHtml(config.motion)} / ${escapeHtml(config.transition)}</div>
      <div class="vignette"></div>
      <div class="grain"></div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      gsap.set(".eyebrow, .word, .subtitle, .glass-card, .product-frame, .mark", { opacity: 0 });
      tl.fromTo(".grid", { y: ${Math.round(shortSide * 0.035)}, opacity: 0 }, { y: 0, opacity: 0.52, duration: 1.1, ease: "power3.out" }, 0);
      tl.to(".grid", { backgroundPosition: "0px ${Math.round(shortSide * 0.18)}px", duration: ${totalDuration}, ease: "none" }, 0);
      tl.fromTo(".aurora", { rotate: 0, scale: 1.25 }, { rotate: 18, scale: 1.38, duration: ${totalDuration}, ease: "sine.inOut" }, 0);
      tl.to(".vignette", { opacity: 0.84, duration: 2.2, repeat: Math.max(0, Math.floor(${totalDuration} / 2.2) - 1), yoyo: true, ease: "sine.inOut" }, 0);
      ${timeline}
      tl.to({}, { duration: ${totalDuration} }, 0);

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

try {
  const fileConfig = loadConfig(args.config);
  const config = mergeConfig(fileConfig, args);
  const format = validateConfig(config);
  const id = config.name || "motion-kit";
  const projectDir = resolve("video-projects", id);

  if (existsSync(projectDir)) {
    if (args.force === "true") {
      rmSync(projectDir, { recursive: true, force: true });
    } else {
      throw new Error(`Project already exists: ${projectDir}. Use --force to overwrite it.`);
    }
  }

  mkdirSync(join(projectDir, "assets"), { recursive: true });
  mkdirSync(join(projectDir, "compositions"), { recursive: true });
  writeFileSync(join(projectDir, "hyperframes.json"), createHyperframesJson());
  writeFileSync(join(projectDir, "meta.json"), createMeta({ id, name: id, ...format }));
  writeFileSync(join(projectDir, "motion-kit.config.json"), createProjectConfig(config));
  writeFileSync(join(projectDir, "index.html"), createHtml({ id, config, ...format }));

  console.log(`Created ${format.label} ${config.preset} project: ${projectDir}`);
  console.log(`Edit:    ${join(projectDir, "motion-kit.config.json")}`);
  console.log(`Preview: cd ${projectDir} && npm exec -- hyperframes preview`);
  console.log(`Lint:    cd ${projectDir} && npm exec -- hyperframes lint`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
