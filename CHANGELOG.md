# Changelog

All notable changes to EditionAPI are documented here.

## [0.1.0] - 2026-11-10

### Added
- `Store` for world- and entity-scoped dynamic-property storage, including chunking, corruption checks, and version migrations.
- `Stats` for tracking mob kills, deaths, kill streaks, and broken blocks, with support for custom statistics.
- `MobRules` for applying configured changes to nearby mobs when player conditions are met.
- Build script to bundle the API source into a behavior pack's `scripts/` directory.
- Example behavior pack demonstrating API usage.
- Node-based test suite with a simulated Minecraft server environment.
