// Companion video registry for narration playback.
//
// The avatar raises one hand and shows the clip bound here while a POI is being
// narrated. No clips are bundled yet, so the screen stays a blank placeholder;
// replace this registry with a RAG query or an external media service later
// without touching the avatar module.
export interface TourVideo {
  src: string;
  mime?: string;
  caption?: string;
  poster?: string;
  creator?: string | null;
  license?: string | null;
  sourceUrl?: string | null;
}

const VIDEOS: Record<string, TourVideo> = {
  // Example:
  // 'weijinlu-newton-tree': { src: '/assets/campus/videos/weijinlu-newton-tree-1.mp4', caption: '牛顿苹果树' },
};

export function tourVideoFor(poiId: string | null | undefined): TourVideo | null {
  if (!poiId) return null;
  return VIDEOS[poiId] ?? null;
}

export function registeredVideos(): TourVideo[] {
  return Object.values(VIDEOS);
}
