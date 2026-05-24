# Motion Kit Generator

Motion Kit creates editable HyperFrames projects for Apple-style presentation ads: cinematic text, liquid cards, product/device reveals, CTA holds, and 4K vertical or landscape formats.

## Quick Mode

```bash
npm run generate:motion -- \
  --name creator-launch \
  --format 9:16-4k \
  --preset apple-keynote \
  --motion punchy \
  --transition light-sweep \
  --title "Create faster" \
  --subtitle "Personalized motion scenes for every short." \
  --cards "Hook|Cards|Format|Export" \
  --accent "#7cf7e8"
```

## Recipe Mode

For real personalization, edit a JSON recipe and regenerate:

```bash
npm run generate:motion -- \
  --config docs/motion-kit.apple-pub.json \
  --name my-motion-kit-film \
  --force
```

Each generated project also includes `motion-kit.config.json`, so you can change text, cards, motion, transition, color, format, and scene durations after generation.

## Formats

- `9:16-4k` -> `2160x3840`
- `16:9-4k` -> `3840x2160`
- `9:16` -> `1080x1920`
- `16:9` -> `1920x1080`

## Controls

- `preset`: `apple-keynote`, `kinetic-text`, `liquid-cards`, `product-reveal`
- `motion`: `calm`, `balanced`, `punchy`
- `transition`: `light-sweep`, `zoom-blur`, `card-wipe`
- `brand.accent`: hex color used for glow, labels, device core, and light sweep
- `scenes[]`: ordered beats with `type`, `eyebrow`, `title`, `subtitle`, `cards`, and `duration`

## Preview And Render

```bash
cd video-projects/my-motion-kit-film
npm exec -- hyperframes lint
npm exec -- hyperframes preview
npm exec -- hyperframes render --quality standard --output renders/final.mp4
```
