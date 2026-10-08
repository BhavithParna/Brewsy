import type { DeepDive, Story } from '@/data/types';
import { createPersistedStore, useStore } from '@/lib/persisted';

export type Bucket = 'tonight' | 'weekend' | 'week' | 'norush';

export const BUCKETS: { id: Bucket; label: string; confirm: string }[] = [
  { id: 'tonight', label: 'Tonight', confirm: 'Saved for tonight' },
  { id: 'weekend', label: 'This weekend', confirm: 'Saved for this weekend' },
  { id: 'week', label: 'Later this week', confirm: 'Saved for later this week' },
  { id: 'norush', label: 'No rush', confirm: 'Saved, no rush' },
];

export type SavedItem = {
  /** `${editionDate}:${story.id}` */
  key: string;
  /** Date of the edition the story came from (YYYY-MM-DD). */
  editionDate: string;
  /** The full story with every layer, so it works offline and after the edition is old. */
  story: Story;
  bucket: Bucket;
  note: string;
  savedAt: string;
  done: boolean;
  doneAt?: string;
  /** "Go deeper" text, once generated. */
  deepDive?: DeepDive;
};

type ReadingListState = { items: SavedItem[] };

export const readingListStore = createPersistedStore<ReadingListState>('brewsy:reading-list', {
  items: [],
});

export function useReadingList(): SavedItem[] {
  return useStore(readingListStore).items;
}

export function storyKey(editionDate: string, storyId: string): string {
  return `${editionDate}:${storyId}`;
}

export function findSaved(key: string): SavedItem | undefined {
  return readingListStore.get().items.find((i) => i.key === key);
}

function updateItems(fn: (items: SavedItem[]) => SavedItem[]) {
  readingListStore.set((s) => ({ items: fn(s.items) }));
}

/** Saves a story (or updates its bucket and note if it's already saved). */
export function saveStory(input: {
  story: Story;
  editionDate: string;
  bucket: Bucket;
  note?: string;
  deepDive?: DeepDive;
}) {
  const key = storyKey(input.editionDate, input.story.id);
  updateItems((items) => {
    const existing = items.find((i) => i.key === key);
    if (existing) {
      return items.map((i) =>
        i.key === key
          ? { ...i, bucket: input.bucket, note: input.note ?? i.note, done: false, doneAt: undefined }
          : i,
      );
    }
    const item: SavedItem = {
      key,
      editionDate: input.editionDate,
      story: input.story,
      bucket: input.bucket,
      note: input.note ?? '',
      savedAt: new Date().toISOString(),
      done: false,
      deepDive: input.deepDive,
    };
    return [item, ...items];
  });
}

export function removeSaved(key: string): SavedItem | undefined {
  const removed = findSaved(key);
  updateItems((items) => items.filter((i) => i.key !== key));
  return removed;
}

/** Puts a removed item back (for "Undo"). */
export function restoreSaved(item: SavedItem) {
  updateItems((items) => (items.some((i) => i.key === item.key) ? items : [item, ...items]));
}

export function setDone(key: string, done: boolean) {
  updateItems((items) =>
    items.map((i) =>
      i.key === key ? { ...i, done, doneAt: done ? new Date().toISOString() : undefined } : i,
    ),
  );
}

export function attachDeepDive(key: string, deepDive: DeepDive) {
  updateItems((items) => items.map((i) => (i.key === key ? { ...i, deepDive } : i)));
}

export function activeCount(items: SavedItem[], bucket?: Bucket): number {
  return items.filter((i) => !i.done && (bucket ? i.bucket === bucket : true)).length;
}
