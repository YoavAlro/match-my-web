# Tweaksy brand system

## Identity

- **Product:** Tweaksy
- **Mascot:** Tweak
- **Tagline:** The web, shaped for you.
- **Promise:** Private, reversible website adaptations shaped around the person using them.

Tweak keeps one rounded, asymmetric silhouette in every state. Expressions and status symbols change with color so meaning never depends on color alone.

## Mascot states

| State | Color | Expression and symbol | Use |
| --- | --- | --- | --- |
| Ready | Blue `#1769E0` | Open eyes and smile | Idle and ready for a request |
| Thinking | Violet `#7756E8` | Thoughtful face and orbiting dots | Inspecting or generating |
| Preview | Amber `#F6B81A` | Curious face and eye badge | A proposal is ready or previewed |
| Saved | Green `#39B85A` | Delighted face and check badge | A profile was approved and saved |
| Error | Coral `#ED6A5A` | Concerned face and exclamation badge | An action needs attention |

Near-black `#0B1F33` is used for outlines and facial features. White is reserved for highlights and state badges.

## Usage rules

- Keep the silhouette, face placement, outline, and proportions consistent.
- Do not communicate state through color alone.
- Use the blue ready mark for Chrome toolbar and store icons.
- Prefer the local SVG state assets in extension UI; rasterize from the source mark only for required Chrome icon sizes.
- Keep the mascot decorative when adjacent live status text already announces the state.
- Avoid gradients, shadows, 3D treatments, and detailed backgrounds at icon sizes.

## Source assets

- `assets/tweaksy-mark.svg`: canonical ready mark and Chrome icon source.
- `public/mascot/*.svg`: ready, thinking, preview, saved, and error UI states.
- `dist/icons/`: generated 16px, 32px, 48px, and 128px PNG icons.
