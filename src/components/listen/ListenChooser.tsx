import { Headphones, Zap, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from '../GlassCard';
import { PressableScale } from '../PressableScale';
import { Txt } from '../Txt';
import { listenToEdition } from '@/audio/listen';
import { savedProgress } from '@/audio/progress';
import { editionSessionId, listenMinutes, phoneVoiceReason } from '@/audio/sessions';
import { phoneVoiceNote } from '@/audio/voice';
import type { Briefing, ListenMode } from '@/data/types';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii } from '@/theme/tokens';

const OPTIONS: { mode: ListenMode; title: string; body: string; Icon: LucideIcon }[] = [
  {
    mode: 'quick',
    title: 'Quick listen',
    body: 'The 60-second summary, then a line or two on each story.',
    Icon: Zap,
  },
  {
    mode: 'full',
    title: 'Full briefing',
    body: 'Every story: what happened and why it matters.',
    Icon: Headphones,
  },
];

/** Quick or Full? Shown when you tap "Listen" on Today. */
export function ListenChooserBody({ briefing, onDone }: { briefing: Briefing; onDone: () => void }) {
  const { theme } = useTheme();
  const { topics, listenMode } = useSettings();

  return (
    <View style={styles.body}>
      {OPTIONS.map(({ mode, title, body, Icon }) => {
        const minutes = listenMinutes(briefing, mode, topics);
        const saved = savedProgress(editionSessionId(briefing.date, mode));
        const resume = saved && saved.index > 0 ? `Resume from part ${saved.index + 1}` : null;
        const preferred = mode === listenMode;
        return (
          <PressableScale
            key={mode}
            onPress={() => {
              onDone();
              listenToEdition(briefing, { mode });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${title}, about ${minutes} minutes. ${body}${resume ? `. ${resume}` : ''}`}>
            <GlassCard
              radius={radii.lg}
              style={[styles.option, preferred && { borderColor: theme.colors.textTertiary }]}>
              <View style={[styles.icon, { borderColor: theme.colors.glassBorder }]}>
                <Icon size={19} color={theme.colors.text} strokeWidth={1.7} />
              </View>
              <View style={styles.text}>
                <View style={styles.titleRow}>
                  <Txt variant="title">{title}</Txt>
                  <Txt variant="label" tone="secondary">
                    {minutes} min
                  </Txt>
                </View>
                <Txt variant="bodySm" tone="secondary">
                  {body}
                </Txt>
                {resume && (
                  <Txt variant="caption" tone="tertiary">
                    {resume}
                  </Txt>
                )}
              </View>
            </GlassCard>
          </PressableScale>
        );
      })}
      <Txt variant="caption" tone="tertiary" align="center" style={styles.note}>
        {briefing.audio?.full?.url || briefing.audio?.quick?.url
          ? 'Keeps playing with the screen locked. Lock-screen and headphone controls work.'
          : phoneVoiceNote(phoneVoiceReason(briefing))}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: GUTTER, paddingTop: 8, gap: 12 },
  option: { flexDirection: 'row', gap: 14, padding: 16, alignItems: 'flex-start' },
  icon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 4 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  note: { marginTop: 4, paddingHorizontal: 12 },
});
