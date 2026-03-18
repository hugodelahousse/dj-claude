# dj-claude — Feature Tracker

## Done

### Phase 0.5: Project Setup
- [x] CLAUDE.md
- [x] TODO.md
- [x] package.json, tsconfig.json, .gitignore
- [x] Install dependencies (bun)

### Phase 1: Auth
- [x] Token store (~/.dj-claude/tokens.json)
- [x] OAuth PKCE helpers + token refresh
- [x] Auth script (scripts/auth.ts)

### Phase 2: Spotify Client + MCP Entry Point
- [x] Spotify API types
- [x] Authenticated fetch client with auto-refresh and rate limiting
- [x] MCP server entry point (index.ts)

### Phase 3: Search Tools
- [x] search — unified track/artist/album search via type param

### Phase 4: Playback + Queue
- [x] player_status — current playback + optional queue view
- [x] play — start/resume with optional URI targeting
- [x] playback_control — pause/next/previous via action param
- [x] add_to_queue — dedup-aware queue additions

### Phase 5: Playlists
- [x] get_playlists — list all or get specific by ID
- [x] create_playlist
- [x] modify_playlist — add/remove tracks via action param

### Phase 6: Tool Consolidation (20 → 8)
- [x] Merged search_tracks/search_artists/search_albums → search
- [x] Merged pause/skip_next/skip_previous → playback_control
- [x] Merged get_current_playback/get_queue → player_status
- [x] Merged list_playlists/get_playlist → get_playlists
- [x] Merged add_to_playlist/remove_from_playlist → modify_playlist
- [x] Removed Spotify-based discovery tools (discover, get_audio_features, get_genre_list, search_by_genre) — Spotify deprecated /recommendations and /audio-features APIs (Nov 2024). Replaced with Last.fm-based discovery (find_similar_songs uses Last.fm BFS + Spotify resolution).

### Phase 7: Distribution & Install
- [x] Remove unused Spotify scopes (4 removed)
- [x] Hardcode Spotify Client ID (no more manual entry)
- [x] Move auth to `src/auth/cli.ts`, add subcommand routing (`auth`, `help`)
- [x] Harden token file permissions (mode 0o600)
- [x] Changesets for versioning
- [x] CI workflow (build + test on push/PR)
- [x] Release workflow (cross-compile 4 binaries on tag push)
- [x] Install script (`install.sh`)
- [x] `dev:install` script for local standalone binary
- [x] README.md, LICENSE (MIT)

## Next Steps

- [ ] Spotify Developer App setup + run auth flow
- [ ] Register MCP in Claude Code
- [ ] End-to-end test: "Add some Skyrim songs and similar around the top of the queue"
- [ ] First release: `bunx @changesets/cli` → tag `v0.1.0` → verify GitHub release

## Future Ideas
- Playlist analysis (fetch tracks, let Claude analyze the vibe)
- "Mood shift" — gradually transition queue energy via curated suggestions
