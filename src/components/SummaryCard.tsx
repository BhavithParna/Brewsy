import { StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { Txt } from './Txt';
import { useTheme } from '@/theme/ThemeProvider';
import { radii } from '@/theme/tokens';

/** "The 60-second version": the day's takeaways on one frosted panel. */
export function SummaryCard({ takeaways }: { takeaways: string[] }) {
  const { theme } = useTheme();
  return (
    <GlassCard radius={radii.xl} style={styles.card}>
      <View style={styles.header}>
        <Txt variant="kicker" tone="secondary">
          {takeaways.length} things to know
        </Txt>
        <Txt variant="displayM" accessibilityRole="header">
          The 60-second version
        </Txt>
      </View>

      {takeaways.map((t, i) => (
        <View
          key={i}
          style={[styles.item, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}
          accessible
          accessibilityLabel={`${i + 1}. ${t}`}>
          <Txt variant="displayS" tone="tertiary" style={styles.num}>
            {String(i + 1).padStart(2, '0')}
          </Txt>
          <Txt variant="reading" style={styles.text}>
            {t}
          </Txt>
        </View>
      ))}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, paddingBottom: 6 },
  header: { gap: 6, marginBottom: 8 },
  item: { flexDirection: 'row', gap: 14, paddingVertical: 14 },
  num: { width: 32 },
  text: { flex: 1 },
});
