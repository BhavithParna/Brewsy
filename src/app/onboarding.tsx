import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Check, ChevronLeft } from 'lucide-react-native';
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
} from 'react-native';
import Animated, { FadeIn, FadeInRight, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrewsyLogo } from '@/components/BrewsyLogo';
import { Cover } from '@/components/Cover';
import { GlassCard } from '@/components/GlassCard';
import { GlassIconButton } from '@/components/GlassIconButton';
import { Pill } from '@/components/Pill';
import { PressableScale } from '@/components/PressableScale';
import { TopicChoice, useTopicChoices } from '@/components/settings/TopicSettings';
import { ThemeBackground } from '@/components/ThemeBackground';
import { GroupSwitch } from '@/components/ThemePicker';
import { Txt } from '@/components/Txt';
import { WakeTimePicker } from '@/components/WakeTimePicker';
import { TOPICS } from '@/data/types';
import { rememberPushToken } from '@/lib/device';
import { formatWakeTime } from '@/lib/format';
import { REGIONS, type Region } from '@/lib/region';
import { isExpoGoAndroid, registerForPush, requestNotificationPermission } from '@/lib/notifications';
import { updateSettings, useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import {
  THEME_ORDER,
  backgroundAt,
  themeRadius,
  themes,
  usePackFonts,
  type Theme,
  type ThemeGroup,
  type ThemeName,
} from '@/theme/themes';
import { GUTTER, capsLabel, fonts, radii, withAlpha } from '@/theme/tokens';

/** Steps after the welcome: look, region, topics, wake-up time, notifications. */
const STEPS = 5;
/** Side margin of the step screens. */
const PAD = 24;
const TILE_GAP = 12;
/** The look grid stops growing past this width (tablets, desktop web). */
const MAX_GRID = 560;

/** First launch: a welcome, then the look, where the news comes from, topics, wake-up time and notifications. */
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
      {step === 1 && <LookStep onNext={next} />}
      {step === 2 && <RegionStep onNext={next} />}
      {step === 3 && <TopicsStep onNext={next} />}
      {step === 4 && <WakeStep onNext={next} />}
      {step === 5 && <NotifyStep />}
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
        <BrewsyLogo color={theme.colors.onCover} />
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
                  borderRadius: Math.min(4, theme.shape.control),
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

function StepHeading({ step, title, body }: { step: number; title: string; body: string }) {
  return (
    <View style={styles.heading}>
      <Txt variant="spaced" tone="secondary">
        {`Step ${step} of ${STEPS}`}
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

/**
 * A step's scrolling content with its button pinned underneath. The content fades out just above
 * the button instead of being cut off by it (not over a wallpaper, which has no one color to fade to).
 */
function StepBody({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  const { theme } = useTheme();
  // A wallpaper has no one color to fade to.
  const edge = theme.backdrop ? null : backgroundAt(theme, FOOTER_AT);
  return (
    <View style={styles.flex}>
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.stepScroll} showsVerticalScrollIndicator={false}>
          {children}
        </ScrollView>
        {edge && <LinearGradient pointerEvents="none" colors={[withAlpha(edge, 0), edge]} style={styles.edge} />}
      </View>
      <View style={styles.footer}>{footer}</View>
    </View>
  );
}

/** Roughly where the top of the button sits, as a share of the screen height. */
const FOOTER_AT = 0.87;

// ─── Look ─────────────────────────────────────────────────────────────────────

const APPEARANCES: { id: Settings['glassAppearance']; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

/**
 * Themes are a whole look, so the first choice is the look itself: Classic, Films and Horror,
 * each a grid of tiles drawn in that theme's own cover, type and colors. Choosing one restyles
 * the rest of onboarding straight away.
 */
function LookStep({ onNext }: { onNext: () => void }) {
  const { theme, setThemeName } = useTheme();
  usePackFonts(); // tiles show each theme's own type
  const { width } = useWindowDimensions();
  const [group, setGroup] = useState<ThemeGroup>(theme.group);
  const names = THEME_ORDER.filter((n) => themes[n].group === group);
  const tileW = Math.floor((Math.min(width, MAX_GRID + PAD * 2) - PAD * 2 - TILE_GAP) / 2);
  const rows: ThemeName[][] = [];
  for (let i = 0; i < names.length; i += 2) rows.push(names.slice(i, i + 2));

  const choose = (name: ThemeName) => {
    if (name === theme.name) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    setThemeName(name);
  };

  return (
    <StepBody footer={<PrimaryButton label="Continue" onPress={onNext} />}>
      <StepHeading
        step={1}
        title={'Pick your\nlook'}
        body="Each theme brings its own type, shapes and colors. You can change it any time in Settings."
      />
      <View style={styles.look}>
        <GroupSwitch value={group} onChange={setGroup} />
        <View style={styles.grid} accessibilityRole="radiogroup">
          {rows.map((row) => (
            <Fragment key={row.join()}>
              <View style={styles.tileRow}>
                {row.map((name) => (
                  <LookTile
                    key={name}
                    // Glass has one tile for both looks: it shows the one in use.
                    t={theme.name === name ? theme : themes[name]}
                    width={tileW}
                    selected={theme.name === name}
                    onPress={() => choose(name)}
                  />
                ))}
              </View>
              {theme.name === 'glass' && row.includes('glass') && <GlassAppearance />}
            </Fragment>
          ))}
        </View>
      </View>
    </StepBody>
  );
}

/**
 * One theme in miniature: its cover dissolving into its own background, its name in its own
 * display type, and its tagline in its own text face. The page around it is in the current theme.
 */
function LookTile({ t, width, selected, onPress }: { t: Theme; width: number; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const height = Math.round(width * 1.34);
  const r = themeRadius(t, radii.md);
  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.97}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${t.label}. ${t.tagline}`}>
      <View
        style={[
          styles.tile,
          {
            width,
            height,
            borderRadius: r,
            backgroundColor: t.background[0],
            borderColor: selected ? theme.colors.text : theme.colors.glassBorder,
            borderWidth: selected ? 2 : 1,
          },
        ]}>
        {t.backdrop ? (
          // A wallpaper is soft all the way down, so it fills the tile as it is.
          <Image source={t.cover} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
        ) : (
          <>
            <Image source={t.cover} style={styles.tilePhoto} contentFit="cover" accessible={false} />
            {/* Fully dissolved before the name, so the text never sits on the picture. */}
            <LinearGradient
              colors={[withAlpha(t.background[0], 0), t.background[0]]}
              locations={[0.3, 1]}
              style={styles.tilePhoto}
            />
          </>
        )}
        {selected && (
          <View style={[styles.check, { backgroundColor: t.colors.inverseBg, borderRadius: Math.min(12, t.shape.control) }]}>
            <Check size={14} color={t.colors.inverseText} strokeWidth={3} />
          </View>
        )}
        <View style={styles.tileText}>
          <View style={[styles.tileAccent, { backgroundColor: t.colors.accent, borderRadius: Math.min(2, t.shape.control) }]} />
          <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={[tileName(t), { color: t.colors.text }]}>
            {t.label}
          </Text>
          <Text numberOfLines={2} maxFontSizeMultiplier={1.2} style={[tileTagline(t), { color: t.colors.textSecondary }]}>
            {t.tagline}
          </Text>
        </View>
      </View>
    </PressableScale>
  );
}

/** The theme's display face, brought down to tile size (wide capitals smaller, long names a touch smaller). */
function tileName(t: Theme): TextStyle {
  const d = t.type.displayL ?? {};
  const designed = d.fontSize ?? 40;
  const caps = d.textTransform === 'uppercase';
  let size = caps ? Math.min(20, Math.max(14, designed * 0.6)) : 22;
  if (t.label.length > 9) size *= 0.88;
  const tracking = (d.letterSpacing ?? 0) * (size / designed);
  return {
    fontFamily: d.fontFamily ?? fonts.light,
    fontStyle: d.fontStyle,
    textTransform: d.textTransform,
    fontSize: size,
    lineHeight: Math.round(size * 1.32),
    letterSpacing: caps ? Math.min(3, tracking) : tracking,
    includeFontPadding: false,
  };
}

/** The tagline in the theme's own text face. */
function tileTagline(t: Theme): TextStyle {
  const face = t.type.bodySm?.fontFamily ?? t.type.body?.fontFamily ?? t.type.reading?.fontFamily ?? fonts.regular;
  return { fontFamily: face, fontSize: 12, lineHeight: 16, includeFontPadding: false };
}

/** Glass only: always light, always dark, or light by day and dark at night. Shown right under its tile. */
function GlassAppearance() {
  const { theme } = useTheme();
  const { glassAppearance } = useSettings();
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <GlassCard radius={radii.lg} style={styles.appearance}>
        <Txt variant="label">Appearance</Txt>
        <View style={styles.pills} accessibilityRole="radiogroup">
          {APPEARANCES.map((o) => {
            const on = glassAppearance === o.id;
            return (
              <Pill
                key={o.id}
                label={o.label}
                size="md"
                variant={on ? 'solid' : 'glass'}
                color={theme.colors.inverseBg}
                selected={on}
                onPress={() => updateSettings({ glassAppearance: o.id })}
                accessibilityLabel={`${o.label} appearance`}
              />
            );
          })}
        </View>
        <Txt variant="bodySm" tone="tertiary">
          Auto is light from 7 am to 7 pm and dark at night.
        </Txt>
      </GlassCard>
    </Animated.View>
  );
}

// ─── Region ───────────────────────────────────────────────────────────────────

/**
 * Where the local section comes from. Starts on the phone's own region (its timezone, then its
 * language settings; see lib/region.ts), so most people just tap Continue.
 */
function RegionStep({ onNext }: { onNext: () => void }) {
  const { region } = useSettings();
  const choose = (id: Region) => {
    if (id === region) return;
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    updateSettings({ region: id });
  };
  return (
    <StepBody footer={<PrimaryButton label="Continue" onPress={onNext} />}>
      <StepHeading
        step={2}
        title={'Where should your\nnews come from?'}
        body="Your edition has the world’s news, plus a short section of local news. You can change this any time."
      />
      <View style={styles.topicList} accessibilityRole="radiogroup">
        {REGIONS.map((r) => (
          <RegionChoice key={r.id} label={r.label} selected={region === r.id} onPress={() => choose(r.id)} />
        ))}
      </View>
    </StepBody>
  );
}

/**
 * One region as its own panel. The marker stays round in every theme (not the theme's corner
 * shape, as the topic checks are), so it reads as "pick one".
 */
function RegionChoice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <GlassCard radius={radii.lg} style={selected && { borderColor: theme.colors.textSecondary }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
        style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
        <View style={[styles.radio, { borderColor: selected ? theme.colors.text : theme.colors.textTertiary }]}>
          {selected && <View style={[styles.radioDot, { backgroundColor: theme.colors.text }]} />}
        </View>
        <Txt variant="title" style={styles.flex}>
          {label}
        </Txt>
      </Pressable>
    </GlassCard>
  );
}

// ─── Topics, wake-up time, notifications ─────────────────────────────────────

function TopicsStep({ onNext }: { onNext: () => void }) {
  const { topics, focusTopics, toggleFollow, toggleFocus } = useTopicChoices();

  return (
    <StepBody footer={<PrimaryButton label="Continue" onPress={onNext} />}>
      <StepHeading
        step={3}
        title={'What should\nwe brew?'}
        body="Pick the topics for your morning edition, and star any you want more of. You can change this any time."
      />
      <View style={styles.topicList}>
        {TOPICS.map((t) => (
          <TopicChoice
            key={t}
            layout="card"
            topic={t}
            followed={topics.includes(t)}
            starred={focusTopics.includes(t)}
            onFollow={() => toggleFollow(t)}
            onStar={() => toggleFocus(t)}
          />
        ))}
      </View>
    </StepBody>
  );
}

function WakeStep({ onNext }: { onNext: () => void }) {
  const { wakeTime } = useSettings();
  return (
    <StepBody footer={<PrimaryButton label="Continue" onPress={onNext} />}>
      <StepHeading
        step={4}
        title={'When do you\nwake up?'}
        body="Brewsy reads the news overnight. Your edition is ready by this time each morning."
      />
      <View style={styles.wakeShow}>
        <Txt variant="displayXL" align="center">
          {formatWakeTime(wakeTime)}
        </Txt>
      </View>
      <WakeTimePicker value={wakeTime} onChange={(t) => updateSettings({ wakeTime: t })} center />
    </StepBody>
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
  const footer = web ? (
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
        <Txt variant="label" tone="secondary" style={theme.layout.capsButtons && capsLabel}>
          Not now
        </Txt>
      </Pressable>
    </>
  );

  return (
    <StepBody footer={footer}>
      <View
        style={[
          styles.bell,
          // Round in soft themes, square-cornered in sharp ones.
          { borderColor: theme.colors.glassBorder, borderRadius: Math.min(28, themeRadius(theme, radii.pill)) },
        ]}>
        <Bell size={24} color={theme.colors.text} strokeWidth={1.5} />
      </View>
      <StepHeading
        step={5}
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
    </StepBody>
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
  dot: { height: 7 },
  stepScroll: { paddingHorizontal: PAD, paddingTop: 24, paddingBottom: 24, gap: 28 },
  heading: { gap: 14 },
  look: { gap: 6, width: '100%', maxWidth: MAX_GRID, alignSelf: 'center' },
  grid: { gap: TILE_GAP },
  tileRow: { flexDirection: 'row', gap: TILE_GAP },
  tile: { overflow: 'hidden', justifyContent: 'flex-end' },
  tilePhoto: { position: 'absolute', left: 0, right: 0, top: 0, height: '64%' },
  tileText: { paddingHorizontal: 12, paddingBottom: 14, gap: 4 },
  tileAccent: { width: 18, height: 3, marginBottom: 6 },
  check: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appearance: { padding: 16, gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicList: { gap: 12 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 58, paddingVertical: 15, paddingHorizontal: 18 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  pressed: { opacity: 0.6 },
  wakeShow: { paddingVertical: 8 },
  bell: { width: 56, height: 56, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: PAD, paddingTop: 12, gap: 6 },
  edge: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 28 },
  primary: { height: 56, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  centerRow: { justifyContent: 'center' },
  centerItems: { alignItems: 'center' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
