import { describe, test, expect } from "bun:test";
import { registerDiscoveryTools } from "../tools/discovery.js";
import { createMockClient, createMockLastFmClient, createMockServer, makeTrack, makeLastFmTrack, makeSearchResponse, getText } from "./fixtures.js";
import type { SpotifyClient } from "../spotify/client.js";
import type { z } from "zod";

// Creates a Spotify mock that returns a unique track for each search query
function createSmartSpotifyMock(extraRoutes: Parameters<typeof createMockClient>[0] = []) {
  const calls: { method: string; endpoint: string; body?: unknown }[] = [];
  let searchCount = 0;

  const base = createMockClient(extraRoutes);
  return {
    calls,
    get: async <T>(endpoint: string, _schema?: any): Promise<T | undefined> => {
      calls.push({ method: "get", endpoint });
      if (endpoint.startsWith("/search")) {
        searchCount++;
        const match = endpoint.match(/track%3A%22(.+?)%22/);
        const name = match ? decodeURIComponent(match[1]) : `Track ${searchCount}`;
        return {
          tracks: {
            items: [makeTrack({ id: `found${searchCount}`, name, uri: `spotify:track:found${searchCount}` })],
            total: 1,
          },
        } as T;
      }
      return base.get<T>(endpoint, _schema);
    },
    post: base.post,
    put: base.put,
    delete: base.delete,
  } as SpotifyClient & { calls: { method: string; endpoint: string; body?: unknown }[] };
}

function setup(
  spotifyRoutes: Parameters<typeof createMockClient>[0],
  lastfmRoutes: Parameters<typeof createMockLastFmClient>[0],
  { smartSpotify = false } = {},
) {
  const spotify = smartSpotify ? createSmartSpotifyMock(spotifyRoutes) : createMockClient(spotifyRoutes);
  const lastfm = createMockLastFmClient(lastfmRoutes);
  const server = createMockServer();
  registerDiscoveryTools(server as any, spotify, lastfm);
  return { spotify, lastfm, handler: server.getHandler("find_similar_songs") };
}

describe("find_similar_songs", () => {
  test("finds similar songs by track name + artist", async () => {
    const { handler, lastfm } = setup(
      [{ method: "get", pattern: "/search", response: makeSearchResponse({ tracks: { items: [makeTrack({ name: "Similar Song", artists: [{ name: "Similar Artist" }] })], total: 1 } }) }],
      [{ artist: "Paris Paloma", track: "labour", response: [makeLastFmTrack({ name: "Similar Song", artist: { name: "Similar Artist" }, match: 0.9 })] }],
    );

    const result = await handler({ track: "labour", artist: "Paris Paloma", limit: 10, expand: false });
    const text = getText(result);

    expect(text).toContain("Similar Song");
    expect(text).toContain("Similar Artist");
    expect(text).toContain("90%");
    expect(text).toContain("Powered by Last.fm");
    expect(lastfm.calls[0]).toEqual({ artist: "Paris Paloma", track: "labour", limit: 50 });
  });

  test("resolves Spotify track ID to name + artist", async () => {
    const spotifyId = "4nHJcUtNSUVjXRnjdP29Bk"; // 22-char ID
    const seedTrack = makeTrack({ id: spotifyId, name: "labour", artists: [{ name: "Paris Paloma" }] });
    const { handler, spotify, lastfm } = setup(
      [
        { method: "get", pattern: `/tracks/${spotifyId}`, response: seedTrack },
        { method: "get", pattern: "/search", response: makeSearchResponse() },
      ],
      [{ artist: "Paris Paloma", track: "labour", response: [makeLastFmTrack()] }],
    );

    await handler({ track: spotifyId, limit: 10, expand: false });

    expect(spotify.calls[0].endpoint).toContain(`/tracks/${spotifyId}`);
    expect(lastfm.calls[0].artist).toBe("Paris Paloma");
    expect(lastfm.calls[0].track).toBe("labour");
  });

  test("requires artist when track is a name", async () => {
    const { handler } = setup([], []);
    const result = await handler({ track: "labour", limit: 10, expand: false });
    expect(getText(result)).toContain("Artist name is required");
  });

  test("BFS expands tracks in 0.50-0.75 match range", async () => {
    const { handler, lastfm } = setup(
      [],
      [
        {
          artist: "Seed Artist", track: "Seed Song",
          response: [
            makeLastFmTrack({ name: "High Match", artist: { name: "A1" }, match: 0.90 }),
            makeLastFmTrack({ name: "Mid Match", artist: { name: "A2" }, match: 0.60 }),
            makeLastFmTrack({ name: "Low Match", artist: { name: "A3" }, match: 0.10 }),
          ],
        },
        {
          artist: "A2", track: "Mid Match",
          response: [
            makeLastFmTrack({ name: "Deep Find", artist: { name: "A4" }, match: 0.70 }),
          ],
        },
      ],
      { smartSpotify: true },
    );

    const result = await handler({ track: "Seed Song", artist: "Seed Artist", limit: 20, expand: true });
    const text = getText(result);

    // Should have expanded from "Mid Match" (0.60 is in 0.50-0.75 range)
    expect(lastfm.calls).toHaveLength(2);
    expect(lastfm.calls[1]).toEqual({ artist: "A2", track: "Mid Match", limit: 30 });
    expect(text).toContain("Deep Find");
  });

  test("does not expand when expand=false", async () => {
    const { handler, lastfm } = setup(
      [{ method: "get", pattern: "/search", response: makeSearchResponse() }],
      [{
        artist: "Seed Artist", track: "Seed Song",
        response: [makeLastFmTrack({ name: "Match", artist: { name: "A1" }, match: 0.60 })],
      }],
    );

    await handler({ track: "Seed Song", artist: "Seed Artist", limit: 10, expand: false });
    expect(lastfm.calls).toHaveLength(1);
  });

  test("deduplicates across hops", async () => {
    const { handler } = setup(
      [],
      [
        {
          artist: "Seed Artist", track: "Seed Song",
          response: [
            makeLastFmTrack({ name: "Dupe Song", artist: { name: "Dupe Artist" }, match: 0.90 }),
            makeLastFmTrack({ name: "Expander", artist: { name: "Exp" }, match: 0.60 }),
          ],
        },
        {
          artist: "Exp", track: "Expander",
          response: [
            makeLastFmTrack({ name: "Dupe Song", artist: { name: "Dupe Artist" }, match: 0.80 }),
            makeLastFmTrack({ name: "New Song", artist: { name: "New Artist" }, match: 0.50 }),
          ],
        },
      ],
      { smartSpotify: true },
    );

    const result = await handler({ track: "Seed Song", artist: "Seed Artist", limit: 20, expand: true });
    const text = getText(result);

    // "Dupe Song" should appear only once
    const dupeCount = (text.match(/Dupe Song/g) || []).length;
    expect(dupeCount).toBe(1);
    expect(text).toContain("New Song");
  });

  test("handles empty Last.fm results", async () => {
    const { handler } = setup(
      [],
      [{ artist: "Unknown", track: "Nothing", response: [] }],
    );

    const result = await handler({ track: "Nothing", artist: "Unknown", limit: 10, expand: false });
    expect(getText(result)).toContain("No similar tracks found");
  });

  test("handles Spotify search misses gracefully", async () => {
    const { handler } = setup(
      [{ method: "get", pattern: "/search", response: makeSearchResponse({ tracks: { items: [], total: 0 } }) }],
      [{ artist: "A", track: "B", response: [makeLastFmTrack({ name: "Ghost Track", artist: { name: "Ghost" }, match: 0.9 })] }],
    );

    const result = await handler({ track: "B", artist: "A", limit: 10, expand: false });
    expect(getText(result)).toContain("none could be found on Spotify");
  });

  test("caps BFS expansion at 4 candidates", async () => {
    const { handler, lastfm } = setup(
      [{ method: "get", pattern: "/search", response: makeSearchResponse() }],
      [
        {
          artist: "Seed", track: "Song",
          response: [
            makeLastFmTrack({ name: "C1", artist: { name: "A" }, match: 0.74 }),
            makeLastFmTrack({ name: "C2", artist: { name: "A" }, match: 0.70 }),
            makeLastFmTrack({ name: "C3", artist: { name: "A" }, match: 0.65 }),
            makeLastFmTrack({ name: "C4", artist: { name: "A" }, match: 0.60 }),
            makeLastFmTrack({ name: "C5", artist: { name: "A" }, match: 0.55 }),
            makeLastFmTrack({ name: "C6", artist: { name: "A" }, match: 0.50 }),
          ],
        },
        { artist: "A", track: "C1", response: [] },
        { artist: "A", track: "C2", response: [] },
        { artist: "A", track: "C3", response: [] },
        { artist: "A", track: "C4", response: [] },
      ],
    );

    await handler({ track: "Song", artist: "Seed", limit: 20, expand: true });
    // 1 seed + 4 expansions = 5 total
    expect(lastfm.calls).toHaveLength(5);
  });
});
