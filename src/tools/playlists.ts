import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../spotify/client.js";
import { PlaylistSchema, PlaylistsResponseSchema, UserProfileSchema, SavedTracksResponseSchema } from "../spotify/types.js";
import { textResult, registerTool } from "./helpers.js";

const LIKED = "liked";

function uriToId(uri: string): string {
  return uri.startsWith("spotify:track:") ? uri.slice("spotify:track:".length) : uri;
}

export function registerPlaylistTools(server: McpServer, client: SpotifyClient) {
  registerTool(server,
    "get_playlists",
    "List your playlists, or get details/tracks of a specific playlist. Use playlist_id=\"liked\" to get your liked songs.",
    {
      playlist_id: z.string().optional().describe("Spotify playlist ID, or \"liked\" for liked songs. If omitted, lists all playlists."),
      limit: z.number().min(1).max(50).default(20).describe("Number of items to return"),
      offset: z.number().min(0).default(0).describe("Offset for pagination (only used with a specific playlist or liked songs)"),
    },
    async ({ playlist_id, limit, offset }: { playlist_id?: string; limit: number; offset: number }) => {
      if (playlist_id === LIKED) {
        const res = await client.get(`/me/tracks?limit=${limit}&offset=${offset}`, SavedTracksResponseSchema);
        if (!res || res.items.length === 0) {
          return textResult("No liked songs found.");
        }
        const header = `Liked Songs (${res.offset + 1}–${res.offset + res.items.length} of ${res.total})`;
        const tracks = res.items.map((item, i) => {
          const t = item.track;
          return `${res.offset + i + 1}. "${t.name}" by ${t.artists.map((a) => a.name).join(", ")} — ${t.uri}`;
        });
        return textResult(header + "\n" + tracks.join("\n"));
      }

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
    "Add or remove tracks from a playlist. Use playlist_id=\"liked\" to save/unsave tracks in your liked songs.",
    {
      playlist_id: z.string().describe("Spotify playlist ID, or \"liked\" for liked songs"),
      action: z.enum(["add", "remove"]).describe("Whether to add or remove tracks"),
      uris: z.array(z.string()).describe("Array of Spotify track URIs (e.g. spotify:track:xxx)"),
    },
    async ({ playlist_id, action, uris }: { playlist_id: string; action: "add" | "remove"; uris: string[] }) => {
      if (playlist_id === LIKED) {
        const ids = uris.map(uriToId);
        if (action === "add") {
          await client.put("/me/tracks", { ids });
          return textResult(`Saved ${ids.length} track(s) to liked songs.`);
        }
        await client.delete("/me/tracks", { ids });
        return textResult(`Removed ${ids.length} track(s) from liked songs.`);
      }

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
