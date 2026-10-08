import { ArrowDown, Pause, Play } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSheets } from './SheetHost';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { listenMinutes } from '@/audio/sessions';
import { usePlayer } from '@/audio/store';
import type { Briefing } from '@/data/types';
import { useSettings } from '@/state/settings';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii, withAlpha } from '@/theme/tokens';

type Props = {
  briefing: Briefing;
  storyCount: number;
  readMinutes: number;
  /** Jumps to the first story. */
  onRead: () => void;
};

/** Two big tiles under the cover: how much there is to read, and the Listen button. */
export function EditionTiles({ briefing, storyCount, readMinutes, onRead }: Props) {
  const { theme } = useTheme();
  const { openListen, openPlayer } = useSheets();
  const { listenMode, topics } = useSettings();
  const loaded = usePlayer((s) => s.session?.editionDate === briefing.date && s.session.kind === 'edition');
  const playing = usePlayer((s) => s.playing);
  const listenMin = listenMinutes(briefing, listenMode, topics);
  const active = loaded && playing;
  const { accent, accentInk, card, cardBorder, text } = theme.colors;

  return (
    <View style={styles.row}>
      <Tile
        bg={accent}
        border={accent}
        ink={accentInk}
        label={storyCount === 1 ? 'Story\ntoday' : 'Stories\ntoday'}
        value={String(storyCount)}
        unit={`about ${readMinutes} min read`}
        icon={<ArrowDown size={18} color={accentInk} strokeWidth={1.8} />}
        onPress={onRead}
        accessibilityLabel={`${storyCount} stories, about ${readMinutes} minutes to read. Start reading`}
      />
      <Tile
        bg={card}
        border={cardBorder}
        ink={text}
        glass={theme.surface === 'glass'}
        label={active ? 'Playing\nnow' : loaded ? 'Resume\nlistening' : 'Listen\nto it'}
        value={String(listenMin)}
        unit="min briefing"
        icon={
          active ? (
            <Pause size={16} color={text} fill={text} strokeWidth={0} />
          ) : (
            <Play size={16} color={text} fill={text} strokeWidth={0} />
          )
        }
        onPress={() => (loaded ? openPlayer() : openListen(briefing))}
        accessibilityLabel={loaded ? 'Open the player' : `Listen to this edition, about ${listenMin} minutes`}
      />
    </View>
  );
}

function Tile({
  bg,
  border,
  ink,
  glass,
  label,
  value,
  unit,
  icon,
  onPress,
  accessibilityLabel,
}: {
  bg: string;
  border: string;
  ink: string;
  glass?: boolean;
  label: string;
  value: string;
  unit: string;
  icon: ReactNode;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const { theme } = useTheme();
  const radius = useRadius();
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.flex}>
      <View
        style={[
          styles.tile,
          { backgroundColor: bg, borderColor: border, borderRadius: radius(radii.lg) },
          glass && { backgroundColor: withAlpha(theme.colors.text.slice(0, 7), 0.08) },
        ]}>
        <View style={styles.top}>
          <Txt variant="label" color={ink} style={styles.label}>
            {label}
          </Txt>
          <View style={[styles.icon, { borderColor: withAlpha(ink.slice(0, 7), 0.28), borderRadius: radius(radii.pill) }]}>
            {icon}
          </View>
        </View>
        <View>
          <Txt variant="stat" color={ink}>
            {value}
          </Txt>
          <Txt variant="caption" color={withAlpha(ink.slice(0, 7), 0.72)}>
            {unit}
          </Txt>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12, paddingHorizontal: GUTTER },
  tile: { height: 168, padding: 16, justifyContent: 'space-between', borderWidth: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { flexShrink: 1 },
  icon: { width: 38, height: 38, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
