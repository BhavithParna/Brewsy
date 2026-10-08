import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NowPlayingBars } from '@/components/listen/NowPlayingBars';
import { PressableScale } from '@/components/PressableScale';
import { ThemeBackground } from '@/components/ThemeBackground';
import { Txt } from '@/components/Txt';
import { next, previous, toggle } from '@/audio/engine';
import { listenToDate } from '@/audio/listen';
import { usePlayer } from '@/audio/store';
import { todayKey } from '@/data/editions';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, fonts, radii } from '@/theme/tokens';

/** Driving mode: huge controls, the story title in big type, nothing else. The screen stays on. */
export default function DrivingScreen() {
  useKeepAwake();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const session = usePlayer((s) => s.session);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const buffering = usePlayer((s) => s.buffering);
  const finished = usePlayer((s) => s.finished);
  const chapter = session?.chapters[index];

  const exit = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 20 }]}>
      <ThemeBackground />
      <View style={styles.top}>
        <PressableScale
          onPress={exit}
          accessibilityRole="button"
          accessibilityLabel="Leave driving mode"
          style={[styles.exit, { borderColor: theme.colors.glassBorder }]}>
          <View>
            <X size={26} color={theme.colors.text} strokeWidth={2.2} />
          </View>
          <Txt variant="label">Exit</Txt>
        </PressableScale>
        {session && (
          <Txt variant="label" tone="tertiary" style={styles.counter}>
            {index + 1} / {session.chapters.length}
          </Txt>
        )}
      </View>

      <View style={styles.middle} accessible accessibilityLiveRegion="polite">
        {session ? (
          <>
            <NowPlayingBars color={theme.colors.text} playing={playing && !buffering} size={26} />
            <Txt style={[styles.title, { color: theme.colors.text }]} numberOfLines={5} adjustsFontSizeToFit minimumFontScale={0.7}>
              {finished ? 'You’re all caught up' : chapter?.title}
            </Txt>
            <Txt variant="body" tone="tertiary" numberOfLines={1}>
              {buffering ? 'Loading…' : session.title}
            </Txt>
          </>
        ) : (
          <Txt style={[styles.title, { color: theme.colors.text }]}>Ready when you are</Txt>
        )}
      </View>

      {session ? (
        <View style={styles.controls}>
          <BigButton label="Previous story" onPress={previous} color={theme.colors.glassFill} border={theme.colors.glassBorder}>
            <SkipBack size={44} color={theme.colors.text} fill={theme.colors.text} strokeWidth={2.4} />
          </BigButton>
          <BigButton label={playing ? 'Pause' : 'Play'} onPress={toggle} color={theme.colors.inverseBg} big>
            {playing ? (
              <Pause size={64} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
            ) : (
              <Play size={64} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
            )}
          </BigButton>
          <BigButton label="Next story" onPress={next} color={theme.colors.glassFill} border={theme.colors.glassBorder}>
            <SkipForward size={44} color={theme.colors.text} fill={theme.colors.text} strokeWidth={2.4} />
          </BigButton>
        </View>
      ) : (
        <PressableScale
          onPress={() => listenToDate(todayKey())}
          accessibilityRole="button"
          accessibilityLabel="Play today's briefing"
          style={[styles.start, { backgroundColor: theme.colors.inverseBg }]}>
          <View>
            <Play size={40} color={theme.colors.inverseText} fill={theme.colors.inverseText} strokeWidth={0} />
          </View>
          <Txt style={[styles.startLabel, { color: theme.colors.inverseText }]}>Play today’s briefing</Txt>
        </PressableScale>
      )}
    </View>
  );
}

function BigButton({
  label,
  onPress,
  color,
  border,
  big,
  children,
}: {
  label: string;
  onPress: () => void;
  color: string;
  border?: string;
  big?: boolean;
  children: ReactNode;
}) {
  const size = big ? 148 : 108;
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.big,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderColor: border ?? 'transparent' },
      ]}>
      <View>{children}</View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: GUTTER },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  exit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 56,
    paddingHorizontal: 18,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  counter: { fontVariant: ['tabular-nums'] },
  middle: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 22, paddingHorizontal: 6 },
  title: { fontFamily: fonts.semibold, fontSize: 36, lineHeight: 44, textAlign: 'center', letterSpacing: -0.8 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 18 },
  big: { alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  start: {
    minHeight: 120,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
  },
  startLabel: { fontFamily: fonts.semibold, fontSize: 24 },
});
