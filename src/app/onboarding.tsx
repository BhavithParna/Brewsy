import * as Haptics from 'expo-haptics';
import { Bell, Check, ChevronLeft } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrewsyMark } from '@/components/BrewsyMark';
import { GlassCard } from '@/components/GlassCard';
import { GlassIconButton } from '@/components/GlassIconButton';
import { PressableScale } from '@/components/PressableScale';
import { Cover } from '@/components/Cover';
import { ThemeBackground } from '@/components/ThemeBackground';
import { toast } from '@/components/Toast';
import { Txt } from '@/components/Txt';
import { WakeTimePicker } from '@/components/WakeTimePicker';
import { TOPICS, type Topic } from '@/data/types';
import { rememberPushToken } from '@/lib/device';
import { formatWakeTime } from '@/lib/format';
import { isExpoGoAndroid, registerForPush, requestNotificationPermission } from '@/lib/notifications';
import { updateSettings, useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { TOPIC_BLURB, TOPIC_LABEL } from '@/data/topics';
import { GUTTER, capsLabel, radii } from '@/theme/tokens';

const STEPS = 3;

/** First launch: a welcome, then topics, wake-up time and notifications. */
export default function Onboarding() {
  const [step, setStep] = useState(0);

  // Android back button goes to the previous step instead of closing the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step]);

  const next = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setStep((s) => s + 1);
  };

  if (step === 0) return <Welcome onStart={next} />;

  return (
    <StepFrame step={step} onBack={() => setStep((s) => s - 1)}>
      {step === 1 && <TopicsStep onNext={next} />}
      {step === 2 && <WakeStep onNext={next} />}
      {step === 3 && <NotifyStep />}
    </StepFrame>
  );
}

function Welcome({ onStart }: { onStart: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const center = theme.layout.heroAlign === 'center';
  const align = center ? 'center' : 'left';
  return (
    <View style={styles.flex}>
      <ThemeBackground />
      {/* The photo fills the screen and dissolves into the background where the text starts. */}
      <Cover height={height} style={StyleSheet.absoluteFill} />
      <View style={[styles.welcomeTop, { paddingTop: insets.top + 14 }, center && styles.centerRow]}>
        <BrewsyMark size={22} color={theme.colors.onCover} />
        <Txt variant="spaced" color={theme.colors.onCover}>
          Brewsy
        </Txt>
      </View>

      <Animated.View
        entering={FadeIn.duration(900)}
        style={[styles.welcomeBottom, { paddingBottom: insets.bottom + 28 }, center && styles.centerItems]}>
        <Txt variant="displayXL" align={align} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
          {'Wake up\ninformed'}
        </Txt>
        <Txt variant="spaced" tone="secondary" align={align}>
          Brewed overnight
        </Txt>
        <Txt variant="reading" tone="secondary" align={align} style={styles.welcomeBody}>
          One calm edition every morning. The stories that matter to you, explained simply.
        </Txt>
        <PrimaryButton label="Get started" onPress={onStart} />
      </Animated.View>
    </View>
  );
}

function StepFrame({ step, onBack, children }: { step: number; onBack: () => void; children: ReactNode }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.flex}>
      <ThemeBackground />
      <View style={[styles.frameTop, { paddingTop: insets.top + 6 }]}>
        <GlassIconButton
          icon={<ChevronLeft size={20} color={theme.colors.text} strokeWidth={2} />}
          onPress={onBack}
          accessibilityLabel="Back"
        />
        <View style={styles.dots} accessible accessibilityLabel={`Step ${step} of ${STEPS}`}>
          {Array.from({ length: STEPS }, (_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: i + 1 === step ? 22 : 7,
                  backgroundColor: i + 1 <= step ? theme.colors.text : theme.colors.glassBorder,
                  transitionProperty: ['width', 'backgroundColor'],
                  transitionDuration: 260,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.topSpacer} />
      </View>
      <Animated.View
        key={step}
        entering={FadeInRight.duration(320)}
        exiting={FadeOut.duration(120)}
        style={[styles.flex, { paddingBottom: insets.bottom + 20 }]}>
        {children}
      </Animated.View>
    </View>
  );
}

function StepHeading({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <View style={styles.heading}>
      <Txt variant="spaced" tone="secondary">
        {kicker}
      </Txt>
      <Txt variant="displayL" accessibilityRole="header">
        {title}
      </Txt>
      <Txt variant="reading" tone="secondary">
        {body}
      </Txt>
    </View>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.primary, { backgroundColor: theme.colors.inverseBg, borderRadius: theme.shape.control }]}>
      <Txt variant="label" tone="inverse" style={[styles.buttonText, theme.layout.capsButtons && capsLabel]}>
        {label}
      </Txt>
    </PressableScale>
  );
}

function TopicsStep({ onNext }: { onNext: () => void }) {
  const { theme } = useTheme();
  const { topics } = useSettings();

  const toggle = (t: Topic) => {
    const on = topics.includes(t);
    if (on && topics.length === 1) {
      toast.show('Pick at least one topic');
      return;
    }
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateSettings({ topics: on ? topics.filter((x) => x !== t) : TOPICS.filter((x) => x === t || topics.includes(x)) });
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
        <StepHeading
          kicker="Step 1 of 3"
          title={'What should\nwe brew?'}
          body="Pick the topics for your morning edition. You can change this any time."
        />
        <View style={styles.topicList}>
          {TOPICS.map((t) => {
            const on = topics.includes(t);
            return (
              <PressableScale
                key={t}
                onPress={() => toggle(t)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${TOPIC_LABEL[t]}. ${TOPIC_BLURB[t]}`}>
                <GlassCard radius={radii.lg} style={[styles.topicCard, on && { borderColor: theme.colors.textSecondary }]}>
                  <View style={styles.flex}>
                    <Txt variant="title">{TOPIC_LABEL[t]}</Txt>
                    <Txt variant="bodySm" tone="tertiary">
                      {TOPIC_BLURB[t]}
                    </Txt>
                  </View>
                  <View
                    style={[
                      styles.check,
                      {
                        borderColor: on ? theme.colors.inverseBg : theme.colors.textTertiary,
                        backgroundColor: on ? theme.colors.inverseBg : 'transparent',
                      },
                    ]}>
                    {on && <Check size={14} color={theme.colors.inverseText} strokeWidth={3} />}
                  </View>
                </GlassCard>
              </PressableScale>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </View>
    </View>
  );
}

function WakeStep({ onNext }: { onNext: () => void }) {
  const { wakeTime } = useSettings();
  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
        <StepHeading
          kicker="Step 2 of 3"
          title={'When do you\nwake up?'}
          body="Brewsy reads the news overnight. Your edition is ready by this time each morning."
        />
        <View style={styles.wakeShow}>
          <Txt variant="displayXL" align="center">
            {formatWakeTime(wakeTime)}
          </Txt>
        </View>
        <WakeTimePicker value={wakeTime} onChange={(t) => updateSettings({ wakeTime: t })} center />
      </ScrollView>
      <View style={styles.footer}>
        <PrimaryButton label="Continue" onPress={onNext} />
      </View>
    </View>
  );
}

function NotifyStep() {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const finish = () => updateSettings({ onboarded: true });

  const turnOn = async () => {
    setBusy(true);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        const reg = await registerForPush();
        if (reg.token) await rememberPushToken(reg.token);
      } else {
        updateSettings({ morningPush: false });
      }
    } finally {
      setBusy(false);
      finish();
    }
  };

  const web = Platform.OS === 'web';

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.bell, { borderColor: theme.colors.glassBorder }]}>
          <Bell size={24} color={theme.colors.text} strokeWidth={1.5} />
        </View>
        <StepHeading
          kicker="Step 3 of 3"
          title={'Want a\ngentle nudge?'}
          body="One notification when your edition is ready. And if you save stories for tonight or the weekend, a quiet reminder then. Never more than that."
        />
        {isExpoGoAndroid && (
          <Txt variant="bodySm" tone="tertiary">
            Expo Go on Android can’t show notifications. They work in the Brewsy app build.
          </Txt>
        )}
        {web && (
          <Txt variant="bodySm" tone="tertiary">
            Notifications work in the phone app. On the web you can still read every edition.
          </Txt>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {web ? (
          <PrimaryButton label="Start reading" onPress={finish} />
        ) : (
          <>
            <PrimaryButton label={busy ? 'One moment…' : 'Turn on notifications'} onPress={busy ? () => {} : turnOn} />
            <Pressable
              onPress={() => {
                updateSettings({ morningPush: false });
                finish();
              }}
              accessibilityRole="button"
              style={styles.secondary}>
              <Txt variant="label" tone="secondary">
                Not now
              </Txt>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  welcomeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 28,
  },
  welcomeBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 28, gap: 12 },
  welcomeBody: { marginTop: 4, marginBottom: 22, maxWidth: 380 },
  buttonText: { fontSize: 16 },
  frameTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
  },
  topSpacer: { width: 44 },
  dots: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { height: 7, borderRadius: 4 },
  stepScroll: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 28 },
  heading: { gap: 14 },
  topicList: { gap: 12 },
  topicCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 18 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wakeShow: { paddingVertical: 8 },
  bell: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: 24, gap: 6 },
  primary: { height: 56, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  centerRow: { justifyContent: 'center' },
  centerItems: { alignItems: 'center' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
