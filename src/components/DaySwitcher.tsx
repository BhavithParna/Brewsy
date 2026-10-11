import { CalendarDays } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { PressableScale } from './PressableScale';
import { Txt } from './Txt';
import { todayKey, yesterdayKey } from '@/data/editions';
import { formatShortDate } from '@/lib/format';
import { useTheme } from '@/theme/ThemeProvider';
import { capsLabel, radii } from '@/theme/tokens';

type Props = {
  date: string;
  onChange: (date: string) => void;
  /** Opens the list of older editions (the calendar segment at the end). */
  onOlder?: () => void;
};

/**
 * Today / Yesterday / another day: a small frosted pill with a solid segment for the selected day.
 * The last segment is a calendar that opens older editions; while one is showing, it carries its date.
 */
export function DaySwitcher({ date, onChange, onOlder }: Props) {
  const { theme } = useTheme();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const olderShown = date !== today && date !== yesterday;
  const caps = theme.layout.capsButtons;
  const segmentShape = { borderRadius: Math.max(0, theme.shape.control - 3) };
  const options = [
    { date: today, label: 'Today' },
    { date: yesterday, label: 'Yesterday' },
    // Without the calendar, an older day still shows as its own segment.
    ...(olderShown && !onOlder ? [{ date, label: formatShortDate(date) }] : []),
  ];

  return (
    <GlassCard radius={radii.pill} variant="overlay" style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.date === date;
        return (
          <PressableScale
            key={o.date}
            onPress={() => onChange(o.date)}
            scaleTo={0.95}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.label}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[styles.segment, segmentShape, active && { backgroundColor: theme.colors.inverseBg }]}>
            <Txt variant="label" tone={active ? 'inverse' : 'primary'} style={caps && capsLabel}>
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
      {onOlder && (
        <PressableScale
          onPress={onOlder}
          scaleTo={0.95}
          accessibilityRole="button"
          accessibilityState={{ selected: olderShown }}
          accessibilityLabel={olderShown ? `${formatShortDate(date)} edition. Older editions` : 'Older editions'}
          hitSlop={{ top: 4, bottom: 4 }}
          style={[
            styles.segment,
            segmentShape,
            olderShown ? styles.olderOn : styles.olderOff,
            olderShown && { backgroundColor: theme.colors.inverseBg },
          ]}>
          <View>
            <CalendarDays
              size={16}
              color={olderShown ? theme.colors.inverseText : theme.colors.text}
              strokeWidth={1.8}
            />
          </View>
          {olderShown && (
            <Txt variant="label" tone="inverse" style={caps && capsLabel}>
              {formatShortDate(date)}
            </Txt>
          )}
        </PressableScale>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, gap: 2 },
  segment: {
    height: 34,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  olderOff: { width: 44, paddingHorizontal: 0 },
  olderOn: { paddingHorizontal: 14 },
});
