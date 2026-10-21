import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Txt } from '../Txt';
import type { HeadingProps, HeadingRegistry } from './types';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER } from '@/theme/tokens';

/** A whale's tail as it dives, over a line of small waves. */
function Fluke({ tail, sea }: { tail: string; sea: string }) {
  return (
    <Svg width={28} height={20} viewBox="0 0 28 20">
      <Path
        d="M14 16 C13.5 13 13 11.4 12 10.4 C9.5 9.6 5 9.8 1.8 4.2 C5.5 3.2 10.5 3.8 14 7.4 C17.5 3.8 22.5 3.2 26.2 4.2 C23 9.8 18.5 9.6 16 10.4 C15 11.4 14.5 13 14 16 Z"
        fill={tail}
      />
      <Path
        d="M1 18 q 3.25 -2.2 6.5 0 t 6.5 0 t 6.5 0 t 6.5 0"
        stroke={sea}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/**
 * Whales: a coral tail slipping under the waves and the story count, over the topic in round,
 * friendly type. The title sits on the water itself, like the date on the cover.
 */
function WhalesHeading({ label, count }: HeadingProps) {
  const { theme } = useTheme();
  const countLabel = count != null ? `${count} ${count === 1 ? 'story' : 'stories'}` : null;
  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="header"
      accessibilityLabel={countLabel ? `${label}, ${countLabel}` : label}>
      <View style={styles.row}>
        <Fluke tail={theme.colors.accent} sea={theme.colors.textTertiary} />
        {countLabel && (
          <Txt variant="kicker" tone="secondary">
            {countLabel}
          </Txt>
        )}
      </View>
      <Txt variant="displayL" numberOfLines={2}>
        {label}
      </Txt>
    </View>
  );
}

/** Section headings for the Whales theme (theme/packs/whales.ts). */
export const whalesHeadings: HeadingRegistry = { whales: WhalesHeading };

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER + 2, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
