import { ExternalLink } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { Txt } from './Txt';
import { Tap } from '@/components/Tap';
import type { SourceRef } from '@/data/types';
import { visibleSources } from '@/lib/curation';
import { openLink } from '@/lib/links';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** Sources minus the outlets the reader turned off in Settings → Sources. */
export function useVisibleSources(sources: SourceRef[]): SourceRef[] {
  return visibleSources(sources, useSettings().disabledOutlets);
}

/** Small inline source links under a story: "CNBC · Financial Times". */
export function SourceLinks({ sources: all }: { sources: SourceRef[] }) {
  const { theme } = useTheme();
  const sources = useVisibleSources(all);
  if (sources.length === 0) return null;
  return (
    <View style={styles.row}>
      <Txt variant="caption" tone="tertiary">
        Sources
      </Txt>
      {sources.map((s, i) => (
        <Tap
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
            <ExternalLink size={12} color={theme.colors.textTertiary} />
          </View>
        </Tap>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 12, rowGap: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  underline: { textDecorationLine: 'underline' },
});
