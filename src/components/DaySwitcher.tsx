import { StyleSheet } from 'react-native';

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
};

/** Today / Yesterday switch: a small frosted pill with a solid segment for the selected day. */
export function DaySwitcher({ date, onChange }: Props) {
  const { theme } = useTheme();
  const today = todayKey();
  const yesterday = yesterdayKey();
  const options = [
    { date: today, label: 'Today' },
    { date: yesterday, label: 'Yesterday' },
    ...(date !== today && date !== yesterday ? [{ date, label: formatShortDate(date) }] : []),
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
            style={[
              styles.segment,
              { borderRadius: Math.max(0, theme.shape.control - 3) },
              active && { backgroundColor: theme.colors.inverseBg },
            ]}>
            <Txt variant="label" tone={active ? 'inverse' : 'primary'} style={theme.layout.capsButtons && capsLabel}>
              {o.label}
            </Txt>
          </PressableScale>
        );
      })}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  segmented: { flexDirection: 'row', alignSelf: 'flex-start', padding: 3, gap: 2 },
  segment: {
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
