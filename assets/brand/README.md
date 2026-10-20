# Brewsy brand files

The Brewsy mark is a coffee bean: a round bean with an S-shaped cut.
In the app it is drawn in thin line in the theme's ink (`src/components/BrewsyMark.tsx`).
On the launcher it is filled: a roast-brown bean with an amber cut on espresso.

## Files

| File | What it is |
| --- | --- |
| `brewsy-mark.svg` | The line mark in one color (`currentColor`), 32 x 32 box. Same drawing as `BrewsyMark.tsx`. |
| `brewsy-mark-color.svg` | The filled two-color bean, transparent, 32 x 32 box. |
| `brewsy-icon.svg` | Source for the app icon: the filled bean on espresso, 1024 x 1024. |
| `icon.png` | App icon, 1024, opaque, full-bleed (iOS and the Android fallback). |
| `android-icon-foreground.png` | Adaptive icon foreground, 1024, transparent. The bean is 43% of the canvas, well inside the 66dp safe circle. |
| `android-icon-background.png` | Adaptive icon background, 1024, solid espresso. |
| `android-icon-monochrome.png` | Android 13+ themed icon, 1024: white bean with the cut knocked out. |
| `splash-icon.png` | Splash image, 800, transparent. Drawn 76dp wide on the espresso splash. |
| `notification-icon.png` | Status bar icon, 96: white bean with a slightly wider cut, so it reads at 24dp. |
| `favicon.png` | Web favicon, 48, the icon as a rounded tile. |

## Colors

| Name | Hex | Used for |
| --- | --- | --- |
| Espresso | `#1A130E` | Icon ground, adaptive background, splash background |
| Roast | `#7A4A2C` | The bean |
| Amber | `#FFB547` | The cut; also the notification accent in app.json |

## Changing the icon

The PNGs in `assets/images/` (the ones `app.json` points to) are copies of the PNGs here.
Icons are part of the over-the-air fingerprint, so a change only reaches phones with a new EAS build.
