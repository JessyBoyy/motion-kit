# Apple-Like Motion Generator

This generator creates a ready-to-preview HyperFrames project with premium text/card motion and fixed export dimensions.

## Quick Start

```bash
npm run generate:apple -- \
  --name creator-hook \
  --format 9:16-4k \
  --preset kinetic-text \
  --title "Create faster" \
  --subtitle "One idea. One premium motion system." \
  --accent "#7cf7e8"
```

The project is written to `video-projects/<name>/`.

## Formats

- `9:16-4k` -> `2160x3840`
- `16:9-4k` -> `3840x2160`
- `9:16` -> `1080x1920`
- `16:9` -> `1920x1080`

## Presets

- `kinetic-text` -> fast chrome word reveal, premium grid, light sweep.
- `liquid-cards` -> text plus stacked translucent cards.
- `product-reveal` -> product/device-style shell plus headline.

## Useful Commands

```bash
cd video-projects/creator-hook
npx hyperframes lint
npx hyperframes preview
npx hyperframes render --quality standard --output renders/final.mp4
```
