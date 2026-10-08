import { router } from 'expo-router';
import { CarFront, CircleCheck, Download, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GlassCard } from '../GlassCard';
import { Pill } from '../Pill';
import { PressableScale } from '../PressableScale';
import { toast } from '../Toast';
import { Txt } from '../Txt';
import { NowPlayingBars } from './NowPlayingBars';
import { downloadAudio, useDownloadStatus } from '@/audio/downloads';
import { close, jumpTo, next, previous, setRate, toggle } from '@/audio/engine';
import { listenToEdition } from '@/audio/listen';
import { usePlayer } from '@/audio/store';
import { RATES, type Session } from '@/audio/types';
import { phoneVoiceNote } from '@/audio/voice';
import { readCachedEdition } from '@/data/editions';
import type { ListenMode } from '@/data/types';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, TAP, fonts, radii } from '@/theme/tokens';

/** "1:05" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function rateLabel(r: number) {
  return `${r}×`;
}

/** The expanded player: controls, speed, Quick/Full, driving mode and the chapter list. */
export function PlayerSheetBody({ onClose }: { onClose: () => void }) {
  const { theme } = useTheme();
  const session = usePlayer((s) => s.session);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const position = usePlayer((s) => s.position);
  const rate = usePlayer((s) => s.rate);
  const finished = usePlayer((s) => s.finished);
  const error = usePlayer((s) => s.error);

  if (!session) {
    return (
      <Txt variant="body" tone="tertiary" align="center" style={styles.empty}>
        Nothing is playing. Tap Listen on Today to start.
      </Txt>
    );
  }
  const chapter = session.chapters[index];
  const progress = chapter && chapter.duration > 0 ? Math.min(1, position / chapter.duration) : 0;

  const switchMode = async (mode: ListenMode) => {
    if (!session.editionDate || mode === session.mode) return;
    const b = await readCachedEdition(session.editionDate);
    if (b) listenToEdition(b, { mode });
  };

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.now}>
        <Txt variant="kicker" tone="secondary" align="center">
          {finished ? 'Finished' : buffering ? 'Loading…' : `${session.title} · ${index + 1} of ${session.chapters.length}`}
        </Txt>
        <Txt variant="displayM" align="center" numberOfLines={3} accessibilityRole="header">
          {finished ? 'You’re all caught up' : chapter?.title}
        </Txt>
        <View style={[styles.track, { backgroundColor: theme.colors.hairline }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: theme.colors.accent }]} />
        </View>
        <View style={styles.times}>
          <Txt variant="caption" tone="tertiary" style={styles.tabular}>
            {clock(position)}
          </Txt>
          <Txt variant="caption" tone="tertiary" style={styles.tabular}>
            {clock(chapter?.duration ?? 0)}
          </Txt>
        </View>
        {error && (
          <Txt variant="caption" color={theme.colors.down} align="center" accessibilityLiveRegion="polite">
            {error}
          </Txt>
        )}
      </View>

      <View style={styles.controls}>
        <ControlButton label="Previous story" onPress={previous}>
          <SkipBack size={26} color={theme.colors.text} fill={theme.colors.text} strokeWidth={2.4} />
        </ControlButton>
        <PressableScale
          onPress={toggle}
          scaleTo={0.92}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play'}
          style={[styles.playButton, { backgroundColor: theme.colors.inverseBg }]}>
          <View>
            {playing ? (
              <Pause size={30} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
            ) : (
              <Play size={30} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
            )}
          </View>
        </PressableScale>
        <ControlButton label="Next story" onPress={next}>
          <SkipForward size={26} color={theme.colors.text} fill={theme.colors.text} strokeWidth={2.4} />
        </ControlButton>
      </View>

      <View style={styles.group}>
        <Txt variant="kicker" tone="tertiary" style={styles.groupTitle}>
          Speed
        </Txt>
        <View style={styles.pills}>
          {RATES.map((r) => (
            <Pill
              key={r}
              label={rateLabel(r)}
              size="md"
              variant={rate === r ? 'solid' : 'glass'}
              color={theme.colors.inverseBg}
              selected={rate === r}
              onPress={() => setRate(r)}
              accessibilityLabel={`Speed ${r} times`}
            />
          ))}
        </View>
      </View>

      {session.kind === 'edition' && (
        <View style={styles.group}>
          <Txt variant="kicker" tone="tertiary" style={styles.groupTitle}>
            Version
          </Txt>
          <View style={styles.pills}>
            {(['quick', 'full'] as const).map((m) => (
              <Pill
                key={m}
                label={m === 'quick' ? 'Quick listen' : 'Full briefing'}
                size="md"
                variant={session.mode === m ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={session.mode === m}
                onPress={() => switchMode(m)}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.actions}>
        <Pill
          label="Driving mode"
          size="md"
          variant="glass"
          icon={<CarFront size={16} color={theme.colors.text} strokeWidth={2} />}
          onPress={() => {
            onClose();
            router.push('/driving');
          }}
          accessibilityLabel="Open driving mode: big buttons, screen stays on"
        />
        <Pill
          label="Stop"
          size="md"
          variant="outline"
          icon={<X size={16} color={theme.colors.textSecondary} strokeWidth={2} />}
          onPress={() => {
            onClose();
            close();
          }}
          accessibilityLabel="Stop and close the player"
        />
      </View>

      <View style={styles.group}>
        <Txt variant="kicker" tone="tertiary" style={styles.groupTitle}>
          Stories
        </Txt>
        <GlassCard radius={radii.lg} style={styles.list}>
          {session.chapters.map((c, i) => {
            const current = i === index && !finished;
            return (
              <Pressable
                key={`${i}-${c.title}`}
                onPress={() => jumpTo(i)}
                accessibilityRole="button"
                accessibilityState={{ selected: current }}
                accessibilityLabel={`${c.title}, ${clock(c.duration)}`}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
                <View style={styles.rowIcon}>
                  {current ? (
                    <NowPlayingBars color={theme.colors.accent} playing={playing} size={13} />
                  ) : (
                    <Txt variant="caption" tone="tertiary" style={styles.tabular}>
                      {String(i + 1).padStart(2, '0')}
                    </Txt>
                  )}
                </View>
                <Txt
                  variant="body"
                  numberOfLines={2}
                  style={[styles.flex, current && { fontFamily: fonts.semibold }]}
                  color={current ? theme.colors.text : theme.colors.textSecondary}>
                  {c.title}
                </Txt>
                <Txt variant="caption" tone="tertiary" style={styles.tabular}>
                  {clock(c.duration)}
                </Txt>
              </Pressable>
            );
          })}
        </GlassCard>
      </View>

      <VoiceNote session={session} />
    </ScrollView>
  );
}

function ControlButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <PressableScale onPress={onPress} scaleTo={0.88} accessibilityRole="button" accessibilityLabel={label} style={styles.control}>
      <View>{children}</View>
    </PressableScale>
  );
}

/** Which voice is reading, and whether it's saved for offline. */
function VoiceNote({ session }: { session: Session }) {
  const { theme } = useTheme();
  const uri = session.chapters.find((c) => c.uri)?.uri ?? null;
  const remote = uri?.startsWith('http') ? uri : null;
  const status = useDownloadStatus(remote);
  const local = uri != null && !remote;

  if (!session.hasServerAudio) {
    return (
      <Txt variant="caption" tone="tertiary" align="center" style={styles.note}>
        {phoneVoiceNote(session.phoneVoice)}
      </Txt>
    );
  }
  if (local || status === 'downloaded') {
    return (
      <View style={styles.noteRow}>
        <View>
          <CircleCheck size={14} color={theme.colors.up} strokeWidth={2.2} />
        </View>
        <Txt variant="caption" tone="tertiary">
          Saved on this phone · plays offline
        </Txt>
      </View>
    );
  }
  return (
    <View style={styles.noteRow}>
      <Pill
        label={status === 'downloading' ? 'Downloading…' : 'Download for offline'}
        variant="outline"
        size="md"
        icon={<Download size={15} color={theme.colors.textSecondary} strokeWidth={2} />}
        onPress={
          remote && status === 'none'
            ? () =>
                downloadAudio(remote).then((ok) =>
                  toast.show(ok ? 'Saved for offline listening' : "Couldn't download. Try again on Wi-Fi."),
                )
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 6, paddingBottom: 12, gap: 26 },
  empty: { paddingHorizontal: GUTTER, paddingVertical: 30 },
  now: { gap: 12, alignItems: 'stretch' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 8 },
  fill: { height: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  tabular: { fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 34 },
  control: { width: TAP + 12, height: TAP + 12, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 10 },
  groupTitle: { paddingLeft: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  list: { paddingHorizontal: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8 },
  rowIcon: { width: 22, alignItems: 'center' },
  note: { paddingHorizontal: 12 },
  noteRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

