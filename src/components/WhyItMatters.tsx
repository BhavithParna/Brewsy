import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Txt } from './Txt';
import { useRadius, useTheme } from '@/theme/ThemeProvider';
import { radii, withAlpha } from '@/theme/tokens';

/**
 * The "Why it matters" paragraph, set apart on a faint wash of the accent with a rule down its left
 * edge, so it's easy to find when skimming a long page of stories.
 */
export function WhyItMatters({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  const radius = useRadius();
  const corner = radius(radii.sm);
  return (
    <View
      style={[
        styles.block,
        {
          backgroundColor: withAlpha(theme.colors.accent, theme.isDark ? 0.1 : 0.07),
          borderLeftColor: withAlpha(theme.colors.accent, 0.7),
          borderTopRightRadius: corner,
          borderBottomRightRadius: corner,
        },
      ]}>
      <Txt variant="kicker" tone="secondary">
        Why it matters
      </Txt>
      <Txt variant="reading">{children}</Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 8, borderLeftWidth: 3, paddingLeft: 12, paddingRight: 10, paddingTop: 12, paddingBottom: 14 },
});
