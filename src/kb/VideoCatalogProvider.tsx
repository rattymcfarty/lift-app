/**
 * Published-video catalogue provider.
 *
 * Reads the public GitHub contents listing for the demo folder, keeps the
 * published MP4s (display-name files from the video agent), caches the listing
 * in AsyncStorage, and matches by exercise name on the guide. The bundled
 * KB-id clips stay the offline fallback. Requests are anonymous public GETs;
 * no personal data is sent and no SDK is involved.
 *
 * The E2E build sets EXPO_PUBLIC_LIFT_E2E=1 so Maestro always exercises the
 * bundled fixtures, independent of what is currently published on GitHub.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { bundledDemoFileNames } from './exerciseDemo';
import {
  matchPublishedVideos,
  parsePublishedVideo,
  type PublishedVideo,
} from './videoCatalog';

const REPO = 'rattymcfarty/lift-app';
const FOLDER = 'assets/exercises/demos';
const BRANCH = 'main';
const API_URL = `https://api.github.com/repos/${REPO}/contents/${FOLDER}?ref=${BRANCH}`;
const CACHE_KEY = 'lift.videoCatalog.v1';
const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 12_000;
const RAW_HOST = /^https:\/\/raw\.githubusercontent\.com\/rattymcfarty\/lift-app\//;

interface GitHubFile {
  name?: unknown;
  type?: unknown;
  size?: unknown;
  download_url?: unknown;
}

interface CachedCatalog {
  fetchedAt: number;
  videos: PublishedVideo[];
}

interface VideoCatalogValue {
  videos: readonly PublishedVideo[];
  status: 'loading' | 'ready' | 'error';
}

const EMPTY: VideoCatalogValue = { videos: [], status: 'loading' };
const VideoCatalogContext = createContext<VideoCatalogValue>(EMPTY);

function parseCache(raw: string | null): CachedCatalog | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CachedCatalog>;
    if (!Array.isArray(parsed.videos) || typeof parsed.fetchedAt !== 'number') return null;
    const videos = parsed.videos.filter(
      (v): v is PublishedVideo =>
        !!v &&
        typeof v.file === 'string' &&
        typeof v.url === 'string' &&
        typeof v.key === 'string' &&
        typeof v.version === 'number' &&
        typeof v.size === 'number',
    );
    return { fetchedAt: parsed.fetchedAt, videos };
  } catch {
    return null;
  }
}

function publishedFromListing(json: unknown): PublishedVideo[] {
  if (!Array.isArray(json)) return [];
  const bundled = new Set(bundledDemoFileNames());
  const videos: PublishedVideo[] = [];
  for (const raw of json as GitHubFile[]) {
    if (!raw || raw.type !== 'file' || typeof raw.name !== 'string') continue;
    if (!/\.mp4$/i.test(raw.name) || bundled.has(raw.name)) continue;
    if (typeof raw.download_url !== 'string' || !RAW_HOST.test(raw.download_url)) continue;
    const video = parsePublishedVideo(
      raw.name,
      raw.download_url,
      typeof raw.size === 'number' ? raw.size : 0,
    );
    if (video) videos.push(video);
  }
  return videos;
}

export function VideoCatalogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VideoCatalogValue>(EMPTY);

  useEffect(() => {
    let alive = true;
    const apply = (videos: PublishedVideo[], status: VideoCatalogValue['status']) => {
      if (alive) setState({ videos, status });
    };

    async function load() {
      const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
      const parsed = parseCache(cached);
      if (parsed) apply(parsed.videos, 'ready');
      if (process.env.EXPO_PUBLIC_LIFT_E2E === '1') {
        apply([], 'ready');
        return;
      }
      if (parsed && Date.now() - parsed.fetchedAt < CACHE_TTL_MS) return;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(API_URL, {
          signal: controller.signal,
          headers: { Accept: 'application/vnd.github+json' },
        });
        if (!res.ok) throw new Error(`GitHub contents ${res.status}`);
        const json: unknown = await res.json();
        const videos = publishedFromListing(json);
        await AsyncStorage.setItem(
          CACHE_KEY,
          JSON.stringify({ fetchedAt: Date.now(), videos }),
        ).catch(() => undefined);
        apply(videos, 'ready');
      } catch {
        // Keep the cached list; the guide falls back to bundled clips.
        if (!parsed) apply([], 'error');
      } finally {
        clearTimeout(timer);
      }
    }

    void load();
    return () => {
      alive = false;
    };
  }, []);

  const value = useMemo<VideoCatalogValue>(
    () => ({ videos: state.videos, status: state.status }),
    [state],
  );
  return <VideoCatalogContext.Provider value={value}>{children}</VideoCatalogContext.Provider>;
}

export function useVideoCatalog(): VideoCatalogValue {
  return useContext(VideoCatalogContext);
}

/** Published URLs for one exercise, oldest version first. */
export function usePublishedDemoUrls(
  exerciseName: string,
  exerciseId?: string | null,
): readonly string[] {
  const { videos } = useVideoCatalog();
  return useMemo(
    () => matchPublishedVideos(videos, exerciseName, exerciseId).map((v) => v.url),
    [videos, exerciseName, exerciseId],
  );
}
