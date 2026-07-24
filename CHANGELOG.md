# Changelog

Tutte le modifiche rilevanti al progetto sono documentate qui.
Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.0.0/), versioning [SemVer](https://semver.org/lang/it/).

## [Unreleased]

## [0.1.0] - 2026-07-24
### Aggiunto
- Fase 0-4: infrastruttura Docker, backend core, auth (email + Google OAuth), CRUD piante/task, catalogo specie, reminder engine BullMQ, UI mobile principale
- Fase 4.5: consolidamento backend (clima su reminder, bouquet stato automatico, grace period login) + mobile
- Fase 8: notifiche push Expo (reminder calendario)
- Onboarding invertito (auth prima del clima) + pagina intro mobile
- Rinomina `trefle_species_raw` → `species_import_raw` (catalogo import generico)

[Unreleased]: https://github.com/Learned-x/fiora/compare/v0.1.0...develop
[0.1.0]: https://github.com/Learned-x/fiora/releases/tag/v0.1.0
