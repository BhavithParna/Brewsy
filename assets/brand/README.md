# Brewsy brand files

The Brewsy mark is a pour-over: a paper filter with a line of type in it, over a cup.
The news goes in at the top and comes out brewed by morning.
The filter is drawn in line (the paper) and the cup is solid (the coffee), so it holds up at 22px.

## Files

| File | What it is |
| --- | --- |
| `brewsy-mark.svg` | The mark in one color (`currentColor`), 42 x 42 box. Same drawing as `src/components/BrewsyMark.tsx`. |
| `brewsy-mark-color.svg` | The two-color mark for large sizes (headline and a shorter line in the filter), transparent. |
| `brewsy-icon.svg` | Source for the app icon: the color mark on the espresso ground, 1024 x 1024. |
| `icon.png` | App icon, 1024, opaque, full-bleed (iOS and the Android fallback). |
| `android-icon-foreground.png` | Adaptive icon foreground, 1024, transparent. The mark sits inside the 66dp safe circle. |
| `android-icon-background.png` | Adaptive icon background, 1024, solid espresso. |
| `android-icon-monochrome.png` | Android 13+ themed icon, 1024, white on transparent. |
| `splash-icon.png` | Splash image, 800, transparent. Drawn 76dp wide on the splash background. |
| `notification-icon.png` | Status bar icon, 96, white silhouette on transparent (single rule, it shows at 24dp). |
| `favicon.png` | Web favicon, 48, the icon as a rounded tile. |

## Colors

| Name | Hex | Used for |
| --- | --- | --- |
| Espresso | `#1A130E` | Icon ground, adaptive background, favicon tile |
| Newsprint | `#F2E7D5` | The paper filter on the icon and splash |
| Amber | `#FFB547` | The cup; also the notification accent in app.json |

In the app the mark is always one color: the theme's text color, or `onCover` on a cover photo.
From 40px up it shows two lines of type in the filter instead of one.

## Using these in the next native build

The icon files are part of the over-the-air fingerprint, so they only change with a new build.
When it's time to build:

1. Copy the PNGs over the files with the same names in `assets/images/`.
   The names match what `app.json` already points to, so nothing else has to change.
2. Optional, for a seamless launch: set `android.adaptiveIcon.backgroundColor` and the
   `expo-splash-screen` `backgroundColor` in `app.json` to `#1A130E`. The splash image is
   transparent, so it also looks right on the current `#0B0B0D`.
3. Run `npx expo-doctor`, then build.
