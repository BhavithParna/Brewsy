import { ExternalLink } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from './Txt';
import type { SourceRef } from '@/data/types';
import { openLink } from '@/lib/links';
import { useTheme } from '@/theme/ThemeProvider';

/** Small inline source links under a story: "CNBC · Financial Times". */
export function SourceLinks({ sources }: { sources: SourceRef[] }) {
  const { theme } = useTheme();
  if (sources.length === 0) return null;
  return (
    <View style={styles.row}>
      <Txt variant="caption" tone="tertiary">
        Sources
      </Txt>
      {sources.map((s, i) => (
        <Pressable
          key={`${s.url}-${i}`}
          onPress={() => openLink(s.url)}
          hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
          accessibilityRole="link"
          accessibilityLabel={`Read the original on ${s.name}`}
          style={styles.link}>
          <Txt variant="caption" tone="secondary" style={[styles.underline, { textDecorationColor: theme.colors.textTertiary }]}>
            {s.name}
          </Txt>
          <View>
            <ExternalLink size={11} color={theme.colors.textTertiary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

/** Full source list for "Learn more": outlet + article title. */
export function SourceList({ sources }: { sources: SourceRef[] }) {
  const { theme } = useTheme();
  return (
    <View style={styles.list}>
      {sources.map((s, i) => (
        <Pressable
          key={`${s.url}-${i}`}
          onPress={() => openLink(s.url)}
          accessibilityRole="link"
          accessibilityLabel={`${s.name}: ${s.title ?? 'read the original'}`}
          style={[styles.listRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.hairline }]}>
          <View style={styles.flex}>
            <Txt variant="kicker" tone="tertiary">
              {s.name}
            </Txt>
            <Txt variant="body" style={styles.title}>
              {s.title ?? 'Read the original'}
            </Txt>
          </View>
          <View>
            <ExternalLink size={16} color={theme.colors.textTertiary} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  underline: { textDecorationLine: 'underline' },
  list: {},
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, minHeight: 56 },
  flex: { flex: 1, gap: 3 },
  title: { lineHeight: 21 },
});
