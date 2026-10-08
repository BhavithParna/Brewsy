import { router } from 'expo-router';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { HowMadeBody } from './HowMadeSheet';
import { ListenChooserBody } from './listen/ListenChooser';
import { PlayerSheetBody } from './listen/PlayerSheet';
import { Pill } from './Pill';
import { PressableScale } from './PressableScale';
import { SettingsSheet } from './SettingsSheet';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { Txt } from './Txt';
import { availableEditionDates, todayKey, yesterdayKey } from '@/data/editions';
import type { Briefing, Story } from '@/data/types';
import { formatShortDate } from '@/lib/format';
import { requestNotificationPermission, syncReminders } from '@/lib/notifications';
import { cachedDeepDive } from '@/state/deepDives';
import { setSelectedEdition, useSelectedEdition } from '@/state/editionNav';
import {
  BUCKETS,
  readingListStore,
  removeSaved,
  restoreSaved,
  saveStory,
  setDone,
  storyKey,
  useReadingList,
  type Bucket,
} from '@/state/readingList';
import { settingsStore } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, fonts, radii } from '@/theme/tokens';

type SaveTarget = { story: Story; editionDate: string };

type SheetsApi = {
  openSave: (target: SaveTarget) => void;
  openSettings: () => void;
  openPastEditions: () => void;
  /** Quick or Full? */
  openListen: (briefing: Briefing) => void;
  /** The expanded player. */
  openPlayer: () => void;
  openHowMade: (briefing: Briefing) => void;
};

const SheetsContext = createContext<SheetsApi | null>(null);

export function useSheets(): SheetsApi {
  const ctx = useContext(SheetsContext);
  if (!ctx) throw new Error('useSheets must be used inside <SheetHost>');
  return ctx;
}

/** Owns the app's bottom sheets so any screen can open them. */
export function SheetHost({ children }: { children: ReactNode }) {
  // The last target stays set while the sheet animates closed, so it doesn't go blank.
  const [save, setSave] = useState<SaveTarget | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveKey, setSaveKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [pastKey, setPastKey] = useState(0);
  const [listenTarget, setListenTarget] = useState<Briefing | null>(null);
  const [listenOpen, setListenOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [howTarget, setHowTarget] = useState<Briefing | null>(null);
  const [howOpen, setHowOpen] = useState(false);

  const openPast = () => {
    setPastKey((k) => k + 1); // fresh list each time
    setPastOpen(true);
  };

  const api: SheetsApi = {
    openSave: (target) => {
      setSave(target);
      setSaveKey((k) => k + 1); // fresh form each time
      setSaveOpen(true);
    },
    openSettings: () => setSettingsOpen(true),
    openPastEditions: openPast,
    openListen: (b) => {
      setListenTarget(b);
      setListenOpen(true);
    },
    openPlayer: () => setPlayerOpen(true),
    openHowMade: (b) => {
      setHowTarget(b);
      setHowOpen(true);
    },
  };

  return (
    <SheetsContext.Provider value={api}>
      {children}
      <Sheet visible={saveOpen} onClose={() => setSaveOpen(false)} title="When do you want to read it?">
        {save && (
          <SaveSheetBody
            key={saveKey}
            target={save}
            onDone={() => setSaveOpen(false)}
          />
        )}
      </Sheet>
      <SettingsSheet
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onOpenPastEditions={() => {
          setSettingsOpen(false);
          openPast();
        }}
      />
      <Sheet visible={pastOpen} onClose={() => setPastOpen(false)} title="Past editions">
        {pastKey > 0 && <PastEditionsBody key={pastKey} onPick={() => setPastOpen(false)} />}
      </Sheet>
      <Sheet visible={listenOpen} onClose={() => setListenOpen(false)} title="Listen to this edition">
        {listenTarget && <ListenChooserBody briefing={listenTarget} onDone={() => setListenOpen(false)} />}
      </Sheet>
      <Sheet visible={playerOpen} onClose={() => setPlayerOpen(false)} tall>
        <PlayerSheetBody onClose={() => setPlayerOpen(false)} />
      </Sheet>
      <Sheet visible={howOpen} onClose={() => setHowOpen(false)} title="How this briefing was made">
        {howTarget && <HowMadeBody briefing={howTarget} />}
      </Sheet>
    </SheetsContext.Provider>
  );
}

function SaveSheetBody({ target, onDone }: { target: SaveTarget; onDone: () => void }) {
  const { theme } = useTheme();
  const items = useReadingList();
  const key = storyKey(target.editionDate, target.story.id);
  const existing = items.find((i) => i.key === key);
  const [bucket, setBucket] = useState<Bucket>(existing?.bucket ?? 'week');
  const [note, setNote] = useState(existing?.note ?? '');

  const submit = () => {
    saveStory({
      story: target.story,
      editionDate: target.editionDate,
      bucket,
      note: note.trim(),
      deepDive: existing?.deepDive ?? cachedDeepDive(key),
    });
    toast.show(BUCKETS.find((b) => b.id === bucket)!.confirm);
    onDone();
    // First "Tonight" or "This weekend" save: ask once so the reminder can arrive.
    const s = settingsStore.get();
    if ((bucket === 'tonight' && s.remindTonight) || (bucket === 'weekend' && s.remindWeekend)) {
      requestNotificationPermission()
        .then((ok) => (ok ? syncReminders(readingListStore.get().items, settingsStore.get()) : undefined))
        .catch(() => {});
    }
  };

  const remove = () => {
    const removed = removeSaved(key);
    onDone();
    if (removed) toast.show('Removed from Reading List', { label: 'Undo', onPress: () => restoreSaved(removed) });
  };

  return (
    <View style={styles.body}>
      <Txt variant="bodySm" tone="secondary" align="center" numberOfLines={2}>
        {target.story.headline}
      </Txt>

      <View style={styles.buckets}>
        {BUCKETS.map((b) => (
          <Pill
            key={b.id}
            label={b.label}
            size="md"
            variant={bucket === b.id ? 'solid' : 'glass'}
            color={theme.colors.inverseBg}
            selected={bucket === b.id}
            onPress={() => setBucket(b.id)}
          />
        ))}
      </View>

      <GlassCard radius={radii.md} style={styles.noteBox}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)"
          placeholderTextColor={theme.colors.textTertiary}
          maxLength={120}
          returnKeyType="done"
          onSubmitEditing={submit}
          accessibilityLabel="Note"
          style={[styles.noteInput, { color: theme.colors.text }]}
        />
      </GlassCard>

      <PressableScale
        onPress={submit}
        accessibilityRole="button"
        accessibilityLabel={existing ? 'Update saved story' : 'Save story'}
        style={[styles.saveButton, { backgroundColor: theme.colors.inverseBg }]}>
        <Txt variant="label" tone="inverse">
          {existing ? 'Update' : 'Save'}
        </Txt>
      </PressableScale>

      {existing && (
        <View style={styles.secondaryRow}>
          <Pressable
            onPress={() => {
              setDone(key, !existing.done);
              toast.show(existing.done ? 'Moved back to your list' : 'Marked as read');
              onDone();
            }}
            accessibilityRole="button"
            style={styles.removeRow}>
            <Txt variant="label" tone="secondary">
              {existing.done ? 'Mark as unread' : 'Mark as read'}
            </Txt>
          </Pressable>
          <Pressable onPress={remove} accessibilityRole="button" style={styles.removeRow}>
            <Txt variant="label" color={theme.colors.down}>
              Remove
            </Txt>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function PastEditionsBody({ onPick }: { onPick: () => void }) {
  const { theme } = useTheme();
  const selected = useSelectedEdition() ?? todayKey();
  const [dates, setDates] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    availableEditionDates().then((d) => {
      if (!cancelled) setDates(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const label = (d: string) =>
    d === todayKey() ? 'Today' : d === yesterdayKey() ? 'Yesterday' : formatShortDate(d);

  return (
    <ScrollView contentContainerStyle={styles.pastList}>
      {dates == null && (
        <Txt variant="body" tone="tertiary" align="center">
          Looking for editions…
        </Txt>
      )}
      {dates?.length === 0 && (
        <Txt variant="body" tone="tertiary" align="center">
          No past editions yet. Each day&apos;s edition is kept here once the backend is running.
        </Txt>
      )}
      {dates?.map((d) => (
        <PressableScale
          key={d}
          onPress={() => {
            setSelectedEdition(d === todayKey() ? null : d);
            router.navigate('/');
            onPick();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Open the edition from ${formatShortDate(d)}`}
          style={[styles.pastRow, { borderColor: theme.colors.hairline }]}>
          <Txt variant="label" style={{ fontFamily: d === selected ? fonts.bold : fonts.semibold }}>
            {label(d)}
          </Txt>
          <Txt variant="caption" tone="tertiary">
            {d === selected ? 'Reading' : formatShortDate(d)}
          </Txt>
        </PressableScale>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: 6, gap: 18 },
  buckets: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  noteBox: { paddingHorizontal: 16 },
  // position: relative keeps the field above the glass layers on web.
  noteInput: { position: 'relative', fontFamily: fonts.regular, fontSize: 16, minHeight: 50 },
  saveButton: { height: 52, borderRadius: radii.pill, alignItems: 'center', justifyContent: 'center' },
  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  removeRow: { minHeight: TAP, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  pastList: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12, gap: 2 },
  pastRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
});
