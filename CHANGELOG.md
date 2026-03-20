# dj-claude

## 0.1.3

### Patch Changes

- e7a725f: Guard top-level runAuth() with import.meta.main to prevent double execution in binary
- 8a9cb5e: Force-close auth callback server to prevent EADDRINUSE on subsequent runs

## 0.1.2

### Patch Changes

- b2e7ffc: Change OAuth callback port from 8888 to 45981 to avoid conflicts

## 0.1.1

### Patch Changes

- b533e76: Bump GitHub Actions to v5 to fix Node.js 20 deprecation warnings
- be76c8a: Automate releases via changesets instead of manual tag pushes
- 70fa89b: Update Spotify client ID and make auth CLI directly executable

## 0.1.0

### Minor Changes

- Initial release of dj-claude — a Spotify MCP server for Claude
- Search for tracks, artists, and albums
- Playback control (play, pause, skip, seek, volume, shuffle, repeat)
- Queue management
- Playlist browsing, creation, and modification
- Music discovery via Last.fm similar tracks (BFS + Spotify resolution)
- OAuth PKCE authentication flow with automatic token refresh
- Standalone binary distribution via `bun build --compile`
- Cross-platform install script
