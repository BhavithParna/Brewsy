import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { GlassCard } from '../GlassCard';
import { Pill } from '../Pill';
import { Txt } from '../Txt';
import { Tap } from '@/components/Tap';
import { useTheme } from '@/theme/ThemeProvider';
import { TAP, capsLabel, radii, shadows } from '@/theme/tokens';

type Props = {
  title: string;
  body: string;
  index: number;
  count: number;
  onBack?: () => void;
  onNext: () => void;
  onSkip: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
  labels?: TourLabels;
};

/** Words on the note's buttons, for tours that aren't the first-run tour. */
export type TourLabels = {
  /** The last step's button (default "Start reading"). */
  finish?: string;
  /** Default "Skip". */
  skip?: string;
  /** Shown in place of the step dots on a one-step tour, e.g. "New". */
  eyebrow?: string;
};

/**
 * The note beside the spotlight: a small card in the theme's own style (its card corners and
 * frame, its display type for the title), with the step dots, Skip, Back and Next.
 */
export function TourCard({ title, body, index, count, onBack, onNext, onSkip, onLayout, labels = {} }: Props) {
  const { theme } = useTheme();
  const caps = theme.layout.capsButtons && capsLabel;
  const center = theme.layout.heroAlign === 'center';
  const last = index === count - 1;
  const textRef = useRef<View>(null);

  // Screen readers move straight to the new tip and read it.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const timer = setTimeout(() => {
      if (textRef.current) AccessibilityInfo.sendAccessibilityEvent(textRef.current, 'focus');
    }, 120);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GlassCard
      radius={radii.lg}
      onLayout={onLayout}
      // Opaque underneath, so the dimmed page never shows through the note.
      style={[styles.card, shadows.float, { backgroundColor: theme.colors.sheet }]}>
      <View style={styles.top}>
        {count === 1 && labels.eyebrow ? (
          <Txt variant="caption" tone="secondary" style={capsLabel}>
            {labels.eyebrow}
          </Txt>
        ) : (
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={`Step ${index + 1} of ${count}`}>
          {Array.from({ length: count }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i === index ? 18 : 6,
                  borderRadius: Math.min(3, theme.shape.control),
                  backgroundColor: i <= index ? theme.colors.text : theme.colors.glassBorder,
                },
              ]}
            />
          ))}
        </View>
        )}
        <Tap
          onPress={onSkip}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={labels.skip ?? 'Skip the tour'}
          style={styles.skip}>
          <Txt variant="label" tone="secondary" style={caps}>
            {labels.skip ?? 'Skip'}
          </Txt>
        </Tap>
      </View>

      <View
        ref={textRef}
        accessible
        accessibilityRole="header"
        accessibilityLabel={count > 1 ? `${title}. ${body} Tip ${index + 1} of ${count}.` : `${title}. ${body}`}
        style={styles.text}>
        <Txt variant="displayM" align={center ? 'center' : 'left'} style={!center && styles.flush}>
          {title}
        </Txt>
        <Txt variant="body" tone="secondary" align={center ? 'center' : 'left'}>
          {body}
        </Txt>
      </View>

      <View style={styles.actions}>
        {onBack ? (
          <Tap onPress={onBack} hitSlop={6} accessibilityRole="button" accessibilityLabel="Previous tip" style={styles.back}>
            <Txt variant="label" tone="secondary" style={caps}>
              Back
            </Txt>
          </Tap>
        ) : (
          <View />
        )}
        <Pill
          label={last ? (labels.finish ?? 'Start reading') : 'Next'}
          size="md"
          variant="solid"
          color={theme.colors.inverseBg}
          onPress={onNext}
          accessibilityLabel={last ? (labels.finish ?? 'Finish the tour and start reading') : 'Next tip'}
        />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: TAP },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { height: 6 },
  skip: { minHeight: TAP, minWidth: TAP, alignItems: 'flex-end', justifyContent: 'center' },
  text: { gap: 8, paddingBottom: 8 },
  // Centered capitals carry a left pad for their tracking; flush-left titles don't need it.
  flush: { paddingLeft: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { minHeight: TAP, minWidth: TAP, justifyContent: 'center' },
});
