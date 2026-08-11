repo: Learned-x/fiora
branch: main

## Last sync
date: 2026-08-05T09:08:32Z
### Updated in this project
- Read functional/technical specs, roadmap, MEV, and environment docs (uploads/) to scope the design system's screens.
- Read `mobile/src/theme/colors.ts`, `Button.tsx`, `TextInput.tsx`, `TabBar.tsx`, `SocialButton.tsx`, `plantUi.ts` to ground the new system in the existing iOS-style palette (System Green #34C759/#32D74B) and component conventions.
- Read `fiora-wireframe/project/Fiora.dc.html` (via search) for established visual patterns (rounded 13-16px cards, soft shadows, plant emoji iconography).
- Built `Fiora Design System.dc.html`: an MD3 tonal palette (OKLCH-derived from the existing brand green) layered with iOS HIG interaction/hierarchy, applied to 6 real app screens (Onboarding, Oggi, Collezione, Dettaglio pianta, Aggiungi pianta, Pairing BLE).

## Screen map
| Project screen | Repo source |
|---|---|
| Color tokens / Primary accent | `mobile/src/theme/colors.ts` |
| Button styles | `mobile/src/components/Button.tsx` |
| Input styles | `mobile/src/components/TextInput.tsx` |
| Tab bar / navigation icons | `mobile/src/components/TabBar.tsx` |
| Plant emoji iconography | `mobile/src/lib/plantUi.ts` |
| Screen content (Oggi, Collezione, Dettaglio pianta, Aggiungi pianta, Onboarding, Pairing BLE) | `uploads/fiora-specifiche-funzionali.md`, `uploads/fiora-specifiche-tecniche.md` |
