import type {
  SpotifyTrack,
  SpotifyArtist,
  SpotifyAlbum,
  SearchResponse,
  PlaybackState,
  QueueResponse,
  Playlist,
} from "../spotify/types.js";
import type { SpotifyClient } from "../spotify/client.js";
import type { z } from "zod";

// --- Mock SpotifyClient ---

type MockRoute = {
  method: "get" | "post" | "put" | "delete";
  pattern: string | RegExp;
  response: unknown;
};

export function createMockClient(routes: MockRoute[] = []): SpotifyClient & { calls: { method: string; endpoint: string; body?: unknown }[] } {
  const calls: { method: string; endpoint: string; body?: unknown }[] = [];

  function findRoute(method: string, endpoint: string): unknown {
    const route = routes.find(
      (r) => r.method === method && (typeof r.pattern === "string" ? endpoint.startsWith(r.pattern) : r.pattern.test(endpoint))
    );
    if (!route) throw new Error(`No mock route for ${method.toUpperCase()} ${endpoint}`);
    return route.response;
  }

  return {
    calls,
    get: async <T>(endpoint: string, _schema?: z.ZodType<T>): Promise<T | undefined> => {
      calls.push({ method: "get", endpoint });
      const data = findRoute("get", endpoint);
      return (data == null ? undefined : data) as T | undefined;
    },
    post: async <T>(endpoint: string, body?: unknown, _schema?: z.ZodType<T>): Promise<any> => {
      calls.push({ method: "post", endpoint, body });
      const data = findRoute("post", endpoint);
      return data;
    },
    put: async (endpoint: string, body?: unknown): Promise<void> => {
      calls.push({ method: "put", endpoint, body });
      findRoute("put", endpoint);
    },
    delete: async (endpoint: string, body?: unknown): Promise<void> => {
      calls.push({ method: "delete", endpoint, body });
      findRoute("delete", endpoint);
    },
  } as SpotifyClient & { calls: { method: string; endpoint: string; body?: unknown }[] };
}

// --- Fixture Data ---

export function makeTrack(overrides: Partial<SpotifyTrack> = {}): SpotifyTrack {
  return {
    id: "track1",
    name: "Test Song",
    uri: "spotify:track:track1",
    duration_ms: 210000,
    artists: [{ name: "Test Artist" }],
    album: { name: "Test Album" },
    ...overrides,
  };
}

export function makeArtist(overrides: Partial<SpotifyArtist> = {}): SpotifyArtist {
  return {
    id: "artist1",
    name: "Test Artist",
    uri: "spotify:artist:artist1",
    genres: ["rock", "indie"],
    ...overrides,
  };
}

export function makeAlbum(overrides: Partial<SpotifyAlbum> = {}): SpotifyAlbum {
  return {
    id: "album1",
    name: "Test Album",
    uri: "spotify:album:album1",
    artists: [{ name: "Test Artist" }],
    release_date: "2024-01-01",
    ...overrides,
  };
}

export function makePlaylist(overrides: Partial<Playlist> = {}): Playlist {
  return {
    id: "playlist1",
    name: "Test Playlist",
    description: "A test playlist",
    uri: "spotify:playlist:playlist1",
    public: false,
    tracks: { total: 2, items: [{ track: makeTrack() }, { track: makeTrack({ id: "track2", name: "Song Two", uri: "spotify:track:track2" }) }] },
    owner: { display_name: "Test User" },
    ...overrides,
  };
}

export function makePlaybackState(overrides: Partial<PlaybackState> = {}): PlaybackState {
  return {
    is_playing: true,
    progress_ms: 60000,
    item: makeTrack(),
    device: { name: "My Speaker", type: "Speaker", volume_percent: 70 },
    shuffle_state: false,
    repeat_state: "off",
    ...overrides,
  };
}

export function makeQueueResponse(overrides: Partial<QueueResponse> = {}): QueueResponse {
  return {
    currently_playing: makeTrack(),
    queue: [
      makeTrack({ id: "track2", name: "Next Song", uri: "spotify:track:track2" }),
      makeTrack({ id: "track3", name: "After That", uri: "spotify:track:track3" }),
    ],
    ...overrides,
  };
}

export function makeSearchResponse(overrides: Partial<SearchResponse> = {}): SearchResponse {
  return {
    tracks: { items: [makeTrack()], total: 1 },
    artists: { items: [makeArtist()], total: 1 },
    albums: { items: [makeAlbum()], total: 1 },
    ...overrides,
  };
}

// --- Test Helpers ---

export function getText(result: { content: { text: string }[] }): string {
  return result.content[0].text;
}

// --- Mock McpServer ---

type RegisteredTool = {
  name: string;
  description: string;
  schema: unknown;
  handler: (args: any) => Promise<any>;
};

export function createMockServer(): { tools: RegisteredTool[]; getHandler: (name: string) => (args: any) => Promise<any> } {
  const tools: RegisteredTool[] = [];
  return {
    tools,
    tool(name: string, description: string, schema: unknown, handler: (args: any) => Promise<any>) {
      tools.push({ name, description, schema, handler });
    },
    getHandler(name: string) {
      const t = tools.find((t) => t.name === name);
      if (!t) throw new Error(`Tool "${name}" not registered`);
      return t.handler;
    },
  } as any;
}

// --- Mock LastFmClient ---

import type { LastFmSimilarTrack, LastFmClient } from "../lastfm/client.js";

export function makeLastFmTrack(overrides: Partial<LastFmSimilarTrack> = {}): LastFmSimilarTrack {
  return {
    name: "Similar Song",
    artist: { name: "Similar Artist" },
    match: 0.8,
    ...overrides,
  };
}

type LastFmMockRoute = {
  artist: string;
  track: string;
  response: LastFmSimilarTrack[];
};

export function createMockLastFmClient(routes: LastFmMockRoute[] = []): LastFmClient & { calls: { artist: string; track: string; limit: number }[] } {
  const calls: { artist: string; track: string; limit: number }[] = [];
  return {
    calls,
    getSimilarTracks: async (artist: string, track: string, limit = 50) => {
      calls.push({ artist, track, limit });
      const route = routes.find(
        (r) => r.artist.toLowerCase() === artist.toLowerCase() && r.track.toLowerCase() === track.toLowerCase()
      );
      return route?.response ?? [];
    },
  };
}
