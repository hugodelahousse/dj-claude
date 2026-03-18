import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SpotifyClient } from "../spotify/client.js";
import { SearchResponseSchema, SpotifyTrackSchema, type SpotifyTrack } from "../spotify/types.js";
import type { LastFmClient, LastFmSimilarTrack } from "../lastfm/client.js";
import { textResult, registerTool } from "./helpers.js";

interface CollectedTrack {
  name: string;
  artist: string;
  match: number;
}

function dedupeKey(name: string, artist: string): string {
  return `${name.toLowerCase()}|${artist.toLowerCase()}`;
}

async function bfsDiscover(
  lastfm: LastFmClient,
  seedArtist: string,
  seedTrack: string,
  expand: boolean,
): Promise<CollectedTrack[]> {
  const seen = new Set<string>();
  const results: CollectedTrack[] = [];

  // Exclude the seed itself
  seen.add(dedupeKey(seedTrack, seedArtist));

  function collect(tracks: LastFmSimilarTrack[]) {
    for (const t of tracks) {
      const key = dedupeKey(t.name, t.artist.name);
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({ name: t.name, artist: t.artist.name, match: t.match });
    }
  }

  // Hop 0: seed track
  const hop0 = await lastfm.getSimilarTracks(seedArtist, seedTrack, 50);
  collect(hop0);

  // Hop 1: BFS expansion from tracks in the 0.50-0.75 match range
  if (expand) {
    const candidates = hop0
      .filter((t) => t.match >= 0.50 && t.match <= 0.75)
      .slice(0, 4);

    if (candidates.length > 0) {
      const expansions = await Promise.all(
        candidates.map((c) => lastfm.getSimilarTracks(c.artist.name, c.name, 30))
      );
      for (const tracks of expansions) {
        collect(tracks);
      }
    }
  }

  // Sort by match descending
  results.sort((a, b) => b.match - a.match);
  return results;
}

async function resolveToSpotify(
  spotify: SpotifyClient,
  tracks: CollectedTrack[],
  limit: number,
): Promise<{ track: SpotifyTrack; match: number }[]> {
  // Request more than limit to account for search misses
  const candidates = tracks.slice(0, Math.min(tracks.length, limit + 10));

  // Resolve in parallel, batches of 5
  const resolved: { track: SpotifyTrack; match: number }[] = [];
  for (let i = 0; i < candidates.length && resolved.length < limit; i += 5) {
    const batch = candidates.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (c) => {
        try {
          const q = `track:"${c.name}" artist:"${c.artist}"`;
          const res = await spotify.get(
            `/search?type=track&limit=1&q=${encodeURIComponent(q)}`,
            SearchResponseSchema,
          );
          const found = res?.tracks?.items[0];
          if (found) return { track: found, match: c.match };
        } catch {
          // Search miss — skip
        }
        return null;
      })
    );
    for (const r of results) {
      if (r && resolved.length < limit) resolved.push(r);
    }
  }
  return resolved;
}

export function registerDiscoveryTools(server: McpServer, spotify: SpotifyClient, lastfm: LastFmClient) {
  registerTool(server, "find_similar_songs",
    "Find songs similar to a given track using Last.fm listening data. " +
      "Accepts a track name + artist, or a Spotify track ID. " +
      "Uses BFS expansion to discover tracks beyond the obvious matches.",
    {
      track: z.string().describe("Track name (e.g. 'labour') or Spotify track ID"),
      artist: z.string().optional().describe("Artist name (required if track is a name, ignored if track is a Spotify ID)"),
      limit: z.number().min(1).max(50).default(15).describe("Number of results"),
      expand: z.boolean().default(true).describe("BFS expansion for deeper discovery (uses up to 5 Last.fm API calls)"),
    },
    async ({ track, artist, limit, expand }: { track: string; artist?: string; limit: number; expand: boolean }) => {
      // Resolve seed: Spotify ID or name+artist
      let seedTrack: string;
      let seedArtist: string;

      const isSpotifyId = /^[A-Za-z0-9]{22}$/.test(track) || track.startsWith("spotify:track:");
      if (isSpotifyId) {
        const id = track.replace("spotify:track:", "");
        const t = await spotify.get(`/tracks/${id}`, SpotifyTrackSchema);
        if (!t) return textResult(`Could not find track with ID ${id} on Spotify.`);
        seedTrack = t.name;
        seedArtist = t.artists.map((a) => a.name).join(", ");
      } else {
        if (!artist) {
          return textResult("Artist name is required when searching by track name.");
        }
        seedTrack = track;
        seedArtist = artist;
      }

      // BFS discover via Last.fm
      const discovered = await bfsDiscover(lastfm, seedArtist, seedTrack, expand);
      if (discovered.length === 0) {
        return textResult(
          `No similar tracks found for "${seedTrack}" by ${seedArtist}. Last.fm may not have enough data for this track.`
        );
      }

      // Resolve to Spotify
      const resolved = await resolveToSpotify(spotify, discovered, limit);
      if (resolved.length === 0) {
        return textResult(
          `Found ${discovered.length} similar tracks on Last.fm but none could be found on Spotify.`
        );
      }

      const lines = [`Similar to "${seedTrack}" by ${seedArtist}:\n`];
      lines.push(
        ...resolved.map((r, i) => {
          const artists = r.track.artists.map((a) => a.name).join(", ");
          return `${i + 1}. "${r.track.name}" by ${artists} — ${r.track.album.name}\n   Match: ${Math.round(r.match * 100)}% | URI: ${r.track.uri}`;
        })
      );
      lines.push("\nPowered by Last.fm");
      return textResult(lines.join("\n"));
    },
  );
}
