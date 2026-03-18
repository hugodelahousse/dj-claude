export interface LastFmSimilarTrack {
  name: string;
  artist: { name: string };
  match: number;
}

export interface LastFmClient {
  getSimilarTracks(artist: string, track: string, limit?: number): Promise<LastFmSimilarTrack[]>;
}

const LASTFM_API_KEY = "bc8bf1725db2eea7c456ea952e99e1c1";

export class LastFmHttpClient implements LastFmClient {
  private apiKey: string;
  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? LASTFM_API_KEY;
  }

  async getSimilarTracks(artist: string, track: string, limit = 50): Promise<LastFmSimilarTrack[]> {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "track.getSimilar");
    url.searchParams.set("artist", artist);
    url.searchParams.set("track", track);
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", String(limit));

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Last.fm API error (${res.status}): ${await res.text()}`);
    const data = await res.json();
    return data?.similartracks?.track ?? [];
  }
}
