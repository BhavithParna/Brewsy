import { CloudOff, Coffee, RotateCw } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassCard } from './GlassCard';
import { Pill } from './Pill';
import { Txt } from './Txt';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER, radii } from '@/theme/tokens';

function StateCard({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.wrap}>
      <GlassCard radius={radii.xl} style={styles.card}>
        <View style={[styles.icon, { borderColor: theme.colors.glassBorder }]}>{icon}</View>
        <Txt variant="displayM" align="center" accessibilityRole="header">
          {title}
        </Txt>
        <Txt variant="body" tone="secondary" align="center" style={styles.body}>
          {body}
        </Txt>
        {action}
      </GlassCard>
    </View>
  );
}

/** Shown when an edition hasn't been made (yet) for the chosen day. */
export function EmptyState({ wakeTime, isToday, dateLabel }: { wakeTime: string; isToday: boolean; dateLabel: string }) {
  const { theme } = useTheme();
  return (
    <StateCard
      icon={<Coffee size={24} color={theme.colors.text} strokeWidth={1.5} />}
      title={isToday ? 'Still brewing' : 'No edition'}
      body={
        isToday
          ? `Your briefing arrives at ${wakeTime}. We'll send a notification the moment it's ready.`
          : `There's no edition saved for ${dateLabel}. Editions are kept once the daily backend is running.`
      }
    />
  );
}

/** Shown when loading failed, with a retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { theme } = useTheme();
  return (
    <StateCard
      icon={<CloudOff size={24} color={theme.colors.text} strokeWidth={1.5} />}
      title="Couldn't load the edition"
      body={message}
      action={
        <Pill
          label="Try again"
          variant="solid"
          color={theme.colors.inverseBg}
          size="md"
          icon={<RotateCw size={15} color={theme.colors.inverseText} strokeWidth={2.2} />}
          onPress={onRetry}
          accessibilityLabel="Try loading the edition again"
          style={styles.action}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: GUTTER, paddingTop: 12 },
  card: { alignItems: 'center', paddingHorizontal: 28, paddingVertical: 36, gap: 14 },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  body: { maxWidth: 300 },
  action: { marginTop: 8 },
});
