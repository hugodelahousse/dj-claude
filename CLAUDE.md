# dj-claude

Spotify MCP server giving Claude hands for search, playback, playlist management, and music discovery (via Last.fm).

## Build & Run

```bash
bun run build          # Compile TypeScript → build/
bun run auth           # One-time OAuth setup (opens browser)
bun run dev            # Run server in dev mode
bun run dev:install    # Compile standalone binary to ~/.local/bin/dj-claude
```

## Register as MCP

```bash
# Dev (uses bun, no recompile needed)
claude mcp add dj-claude -- bun run /Users/hugo/projects/dj-claude/src/index.ts
# Prod (standalone binary)
claude mcp add dj-claude -- dj-claude
```

## Code Style

- ESM (`"type": "module"`) — use `import`/`export`, not `require`
- Strict TypeScript, 2-space indent
- Zod for all tool input schemas
- Tool modules export arrays of `{ name, description, schema, handler }`
- All console output to `stderr` (stdout is MCP JSON-RPC)

## Architecture

```
src/
  index.ts           — MCP server entry, tool registration
  auth/              — OAuth PKCE flow, token storage (~/.dj-claude/tokens.json)
  spotify/           — API client (auto-refresh, rate limiting), types
  lastfm/           — Last.fm API client + config (~/.dj-claude/lastfm.json)
  tools/
    discovery.ts     — find_similar_songs (Last.fm BFS + Spotify resolution)
    search.ts        — search (tracks/artists/albums via type param)
    playback.ts      — player_status, play, playback_control, add_to_queue
    playlists.ts     — get_playlists, create_playlist, modify_playlist
```

## Testing

- Use `npx @modelcontextprotocol/inspector` for interactive MCP tool testing
- Smoke test: search → find_similar_songs → add_to_queue

## Changesets

Every PR must include a changeset. Run `bunx @changesets/cli` or create `.changeset/<name>.md`:

```
---
"dj-claude": patch   # or minor/major
---

Description of the change.
```

## Distribution

- `bun build --compile` creates standalone binaries (no runtime needed)
- GitHub Actions cross-compile for macOS/Linux on tag push (`v*`)
- Install script: `curl -fsSL https://raw.githubusercontent.com/hugodelahousse/dj-claude/main/install.sh | sh`
- Subcommands: `dj-claude auth`, `dj-claude help`

## Feature Tracking

Maintain `TODO.md` as a living feature tracker. Update it whenever features are added, completed, or planned.
