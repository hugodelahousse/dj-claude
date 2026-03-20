# dj-claude

> [!NOTE]
> This entire repo was vibe coded as a side project — the code has never seen a design doc, a sprint planning, or a sober second thought. If you find something questionable in there, just know I was having fun and Claude was my enabler.
Spotify MCP server for music discovery and playback control through Claude Code.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/hugodelahousse/dj-claude/main/install.sh | sh
dj-claude auth                      # Log in with Spotify
claude mcp add dj-claude -- dj-claude  # Register as MCP server
```

## Examples

Once set up, just talk to Claude:

- "I'm really into Khruangbin lately, find me similar artists and queue up a mix"
- "Play some Bon Iver, then find similar songs and build me a playlist for a rainy afternoon"
- "I love the vibe of Talking Heads - Psycho Killer. Find me 20 songs with that same energy and add them to my queue"
- "Make me a playlist called 'Late Night Coding' starting from Tycho and Boards of Canada, and expand from there with similar tracks"
- "What's playing right now? Find me more stuff like this"

Discovery uses Last.fm's similarity data under the hood — it does a BFS expansion from seed tracks to find music beyond the obvious recommendations.

## Requirements

- macOS (arm64/x64) or Linux (x64/arm64)
- Spotify Premium (for playback control)

## Development

```bash
bun install
bun run dev:install     # Compile and install to ~/.local/bin/dj-claude
dj-claude auth          # Authenticate

# Or for iterative dev without recompiling:
claude mcp add dj-claude -- bun run /path/to/dj-claude/src/index.ts
```

## License

MIT
