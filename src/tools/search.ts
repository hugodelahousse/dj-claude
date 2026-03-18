import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../spotify/client.js";
import { SearchResponseSchema, type SpotifyTrack, type SpotifyArtist, type SpotifyAlbum } from "../spotify/types.js";
import { textResult, registerTool } from "./helpers.js";

function formatTrack(t: SpotifyTrack, i: number): string {
  const artists = t.artists.map((a) => a.name).join(", ");
  return `${i + 1}. "${t.name}" by ${artists} — ${t.album.name}\n   ID: ${t.id} | URI: ${t.uri}`;
}

function formatArtist(a: SpotifyArtist, i: number): string {
  const genres = a.genres.length > 0 ? ` (${a.genres.slice(0, 3).join(", ")})` : "";
  return `${i + 1}. ${a.name}${genres}\n   ID: ${a.id} | URI: ${a.uri}`;
}

function formatAlbum(a: SpotifyAlbum, i: number): string {
  const artists = a.artists.map((ar) => ar.name).join(", ");
  return `${i + 1}. "${a.name}" by ${artists} (${a.release_date})\n   ID: ${a.id} | URI: ${a.uri}`;
}

export function registerSearchTools(server: McpServer, client: SpotifyClient) {
  registerTool(server, "search",
    "Search Spotify for tracks, artists, or albums. Returns names, IDs, and URIs for use with other tools.",
    {
      query: z.string().describe("Search query (song name, artist, album, etc.)"),
      type: z.enum(["track", "artist", "album"]).default("track").describe("Type of result to search for"),
      limit: z.number().min(1).max(50).default(10).describe("Number of results"),
    },
    async ({ query, type, limit }: { query: string; type: "track" | "artist" | "album"; limit: number }) => {
      const res = await client.get(
        `/search?type=${type}&limit=${limit}&q=${encodeURIComponent(query)}`,
        SearchResponseSchema,
      );
      if (!res) return textResult("No results from Spotify.");

      if (type === "track") {
        const tracks = res.tracks?.items ?? [];
        if (tracks.length === 0) return textResult(`No tracks found for "${query}"`);
        return textResult(tracks.map(formatTrack).join("\n"));
      }

      if (type === "artist") {
        const artists = res.artists?.items ?? [];
        if (artists.length === 0) return textResult(`No artists found for "${query}"`);
        return textResult(artists.map(formatArtist).join("\n"));
      }

      const albums = res.albums?.items ?? [];
      if (albums.length === 0) return textResult(`No albums found for "${query}"`);
      return textResult(albums.map(formatAlbum).join("\n"));
    },
  );
}

