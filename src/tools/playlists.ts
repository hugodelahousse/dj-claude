import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../spotify/client.js";
import { PlaylistSchema, PlaylistsResponseSchema, UserProfileSchema } from "../spotify/types.js";
import { textResult, registerTool } from "./helpers.js";

export function registerPlaylistTools(server: McpServer, client: SpotifyClient) {
  registerTool(server,
    "get_playlists",
    "List your playlists, or get details of a specific playlist by ID.",
    {
      playlist_id: z.string().optional().describe("Spotify playlist ID — if provided, returns that playlist's tracks; otherwise lists all your playlists"),
      limit: z.number().min(1).max(50).default(20).describe("Number of playlists to return (when listing all)"),
    },
    async ({ playlist_id, limit }: { playlist_id?: string; limit: number }) => {
      if (playlist_id) {
        const p = await client.get(`/playlists/${playlist_id}`, PlaylistSchema);
        if (!p) return textResult("Playlist not found.");
        const header = `"${p.name}" by ${p.owner.display_name} (${p.tracks.total} tracks)\n${p.description || ""}\nURI: ${p.uri}\n`;
        const tracks = p.tracks.items?.map((item, i) => {
          const t = item.track;
          return `${i + 1}. "${t.name}" by ${t.artists.map((a) => a.name).join(", ")} — ${t.uri}`;
        }) ?? [];
        return textResult(header + "\n" + tracks.join("\n"));
      }

      const res = await client.get(`/me/playlists?limit=${limit}`, PlaylistsResponseSchema);
      if (!res || res.items.length === 0) {
        return textResult("No playlists found.");
      }
      const lines = res.items.map((p, i) =>
        `${i + 1}. "${p.name}" (${p.tracks.total} tracks) — ${p.public ? "Public" : "Private"}\n   ID: ${p.id} | URI: ${p.uri}`
      );
      return textResult(lines.join("\n"));
    },
  );

  registerTool(server,
    "create_playlist",
    "Create a new Spotify playlist.",
    {
      name: z.string().describe("Playlist name"),
      description: z.string().optional().describe("Playlist description"),
      public: z.boolean().default(false).describe("Whether the playlist is public"),
    },
    async (args: { name: string; description?: string; public: boolean }) => {
      const user = await client.get("/me", UserProfileSchema);
      if (!user) throw new Error("Could not fetch user profile");
      const playlist = await client.post(`/users/${user.id}/playlists`, {
        name: args.name,
        description: args.description ?? "",
        public: args.public,
      }, PlaylistSchema);
      return textResult(`Created playlist "${playlist.name}"\nID: ${playlist.id} | URI: ${playlist.uri}`);
    },
  );

  registerTool(server,
    "modify_playlist",
    "Add or remove tracks from a playlist.",
    {
      playlist_id: z.string().describe("Spotify playlist ID"),
      action: z.enum(["add", "remove"]).describe("Whether to add or remove tracks"),
      uris: z.array(z.string()).describe("Array of Spotify track URIs (e.g. spotify:track:xxx)"),
    },
    async ({ playlist_id, action, uris }: { playlist_id: string; action: "add" | "remove"; uris: string[] }) => {
      if (action === "add") {
        await client.post(`/playlists/${playlist_id}/tracks`, { uris });
        return textResult(`Added ${uris.length} track(s) to playlist.`);
      }
      await client.delete(`/playlists/${playlist_id}/tracks`, {
        tracks: uris.map((uri) => ({ uri })),
      });
      return textResult(`Removed ${uris.length} track(s) from playlist.`);
    },
  );
}
