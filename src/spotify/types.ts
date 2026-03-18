import { z } from "zod";

// --- Core entities (only fields we actually read) ---

export const SpotifyTrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  duration_ms: z.number(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({ name: z.string() }),
});
export type SpotifyTrack = z.infer<typeof SpotifyTrackSchema>;

export const SpotifyArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  genres: z.array(z.string()),
});
export type SpotifyArtist = z.infer<typeof SpotifyArtistSchema>;

export const SpotifyAlbumSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  artists: z.array(z.object({ name: z.string() })),
  release_date: z.string(),
});
export type SpotifyAlbum = z.infer<typeof SpotifyAlbumSchema>;

// --- API responses ---

export const SearchResponseSchema = z.object({
  tracks: z.object({ items: z.array(SpotifyTrackSchema), total: z.number() }).optional(),
  artists: z.object({ items: z.array(SpotifyArtistSchema), total: z.number() }).optional(),
  albums: z.object({ items: z.array(SpotifyAlbumSchema), total: z.number() }).optional(),
});
export type SearchResponse = z.infer<typeof SearchResponseSchema>;

export const PlaybackStateSchema = z.object({
  is_playing: z.boolean(),
  progress_ms: z.number().nullable(),
  item: SpotifyTrackSchema.nullable(),
  device: z.object({
    name: z.string(),
    type: z.string(),
    volume_percent: z.number(),
  }).nullable(),
  shuffle_state: z.boolean(),
  repeat_state: z.string(),
});
export type PlaybackState = z.infer<typeof PlaybackStateSchema>;

export const QueueResponseSchema = z.object({
  currently_playing: SpotifyTrackSchema.nullable(),
  queue: z.array(SpotifyTrackSchema),
});
export type QueueResponse = z.infer<typeof QueueResponseSchema>;

export const PlaylistSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  uri: z.string(),
  public: z.boolean().nullable(),
  tracks: z.object({
    total: z.number(),
    items: z.array(z.object({ track: SpotifyTrackSchema })).optional(),
  }),
  owner: z.object({ display_name: z.string() }),
});
export type Playlist = z.infer<typeof PlaylistSchema>;

export const PlaylistsResponseSchema = z.object({
  items: z.array(PlaylistSchema),
  total: z.number(),
});
export type PlaylistsResponse = z.infer<typeof PlaylistsResponseSchema>;

export const UserProfileSchema = z.object({
  id: z.string(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;
