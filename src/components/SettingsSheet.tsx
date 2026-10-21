import {
  ALargeSmall,
  Bell,
  ChartColumn,
  FileDown,
  Headphones,
  History,
  Inbox,
  LayoutGrid,
  LifeBuoy,
  MessageCircleHeart,
  Newspaper,
  Sunrise,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { REGIONS } from '../../supabase/functions/_shared/sources';
import { FeedbackSettings } from './settings/FeedbackSettings';
import { HelpSettings } from './settings/HelpSettings';
import { ListeningSettings, listeningSummary } from './settings/ListeningSettings';
import { MorningSettings } from './settings/MorningSettings';
import { NotificationSettings, notificationSummary } from './settings/NotificationSettings';
import { FeedbackInbox, UsageView, useIsOwner, useOwnerStats } from './settings/OwnerSettings';
import { ReadingSettings, TEXT_SIZES } from './settings/ReadingSettings';
import { Divider, Group, LinkRow, settingsStyles } from './settings/SettingsParts';
import { SourceSettings, sourceSummary } from './settings/SourceSettings';
import { TopicSettings } from './settings/TopicSettings';
import { Sheet } from './Sheet';
import { toast } from './Toast';
import { ThemePicker } from './ThemePicker';
import { Txt } from './Txt';
import { backendConfigured } from '@/data/api';
import { fetchAndCacheEdition, readCachedEdition, todayKey } from '@/data/editions';
import { formatWakeTime } from '@/lib/format';
import { exportEditionPdf } from '@/lib/pdf';
import { useSettings, type Settings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';
import { GUTTER } from '@/theme/tokens';

/** A page inside Settings. The first screen is the theme picker and a list of these. */
export type SettingsPage =
  | 'feedback'
  | 'topics'
  | 'morning'
  | 'reading'
  | 'sources'
  | 'notifications'
  | 'listening'
  | 'help'
  | 'inbox'
  | 'usage';

const PAGE_TITLE: Record<SettingsPage, string> = {
  feedback: 'Send feedback',
  topics: 'Topics',
  morning: 'Morning edition',
  reading: 'Reading',
  sources: 'Sources',
  notifications: 'Notifications',
  listening: 'Listening',
  help: 'Help',
  inbox: 'Feedback inbox',
  usage: 'Usage',
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onOpenPastEditions: () => void;
  /** Open straight onto a page (the what's-new note opens Send feedback). */
  initialPage?: SettingsPage | null;
};

export function SettingsSheet({ visible, onClose, onOpenPastEditions, initialPage = null }: Props) {
  const [page, setPage] = useState<SettingsPage | null>(initialPage);
  // Each opening starts on the first screen (or the page asked for); closing keeps the current
  // page on screen while the sheet slides away.
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) setPage(initialPage);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={page ? PAGE_TITLE[page] : 'Settings'}
      onBack={page ? () => setPage(null) : undefined}
      backLabel="Back to Settings"
      tall>
      {/* The first screen stays mounted under a page, so Back returns to the same spot. */}
      <ScrollView
        style={page ? styles.hidden : styles.flex}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}>
        <Home active={!page} onOpen={setPage} onOpenPastEditions={onOpenPastEditions} />
      </ScrollView>
      {page && (
        <Animated.View key={page} entering={FadeIn.duration(180)} style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <PageBody page={page} onDone={() => setPage(null)} />
          </ScrollView>
        </Animated.View>
      )}
    </Sheet>
  );
}

function PageBody({ page, onDone }: { page: SettingsPage; onDone: () => void }): ReactNode {
  switch (page) {
    case 'feedback':
      return <FeedbackSettings onDone={onDone} />;
    case 'topics':
      return <TopicSettings />;
    case 'morning':
      return <MorningSettings />;
    case 'reading':
      return <ReadingSettings />;
    case 'sources':
      return <SourceSettings />;
    case 'notifications':
      return <NotificationSettings />;
    case 'listening':
      return <ListeningSettings />;
    case 'help':
      return <HelpSettings />;
    case 'inbox':
      return <FeedbackInbox />;
    case 'usage':
      return <UsageView />;
  }
}

/** The first screen: themes on top, feedback, then one row per page with what's set there. */
type HomeProps = {
  /** On screen (not under a page). */
  active: boolean;
  onOpen: (p: SettingsPage) => void;
  onOpenPastEditions: () => void;
};

function Home({ active, onOpen, onOpenPastEditions }: HomeProps) {
  const { theme } = useTheme();
  const settings = useSettings();
  const owner = useIsOwner();
  // Fetched each time the first screen shows, so the inbox count is fresh after reading it.
  const { stats } = useOwnerStats(owner && active);
  const [exporting, setExporting] = useState(false);
  const icon = (Icon: typeof Bell) => <Icon size={19} color={theme.colors.text} strokeWidth={1.9} />;

  const exportPdf = async () => {
    setExporting(true);
    try {
      const date = todayKey();
      const edition = (await readCachedEdition(date)) ?? (await fetchAndCacheEdition(date));
      if (!edition) toast.show("Today's edition isn't here yet");
      else await exportEditionPdf(edition, settings.topics);
    } catch {
      toast.show("Couldn't make the PDF. Try again.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Group title="Theme">
        <ThemePicker />
      </Group>

      <Group>
        <LinkRow
          title="Send feedback"
          subtitle="Ideas, problems, things you love. It helps a lot."
          icon={<MessageCircleHeart size={19} color={theme.colors.accent} strokeWidth={1.9} />}
          onPress={() => onOpen('feedback')}
        />
      </Group>

      <Group title="Your edition">
        <LinkRow title="Topics" subtitle={topicSummary(settings)} icon={icon(LayoutGrid)} onPress={() => onOpen('topics')} />
        <Divider />
        <LinkRow
          title="Morning edition"
          subtitle={`Ready by ${formatWakeTime(settings.wakeTime)} · ${REGIONS.find((r) => r.id === settings.region)?.label ?? settings.region}`}
          icon={icon(Sunrise)}
          onPress={() => onOpen('morning')}
        />
        <Divider />
        <LinkRow title="Reading" subtitle={readingSummary(settings)} icon={icon(ALargeSmall)} onPress={() => onOpen('reading')} />
        <Divider />
        <LinkRow title="Sources" subtitle={sourceSummary(settings)} icon={icon(Newspaper)} onPress={() => onOpen('sources')} />
      </Group>

      <Group title="Alerts and audio">
        <LinkRow
          title="Notifications"
          subtitle={notificationSummary(settings)}
          icon={icon(Bell)}
          onPress={() => onOpen('notifications')}
        />
        <Divider />
        <LinkRow title="Listening" subtitle={listeningSummary(settings)} icon={icon(Headphones)} onPress={() => onOpen('listening')} />
      </Group>

      <Group title="Editions">
        <LinkRow
          title={exporting ? 'Making PDF…' : "Export today's edition as PDF"}
          icon={icon(FileDown)}
          onPress={exporting ? undefined : exportPdf}
        />
        <Divider />
        <LinkRow title="Past editions" icon={icon(History)} onPress={onOpenPastEditions} />
      </Group>

      <Group>
        <LinkRow
          title="Help"
          subtitle="The tour again, what’s new, and what Brewsy sends"
          icon={icon(LifeBuoy)}
          onPress={() => onOpen('help')}
        />
      </Group>

      {owner && (
        <Group title="Only you can see this" footer="Shown only on your own phone (marked as the owner’s on the server).">
          <LinkRow
            title="Feedback inbox"
            subtitle={stats ? `${stats.feedback_total} ${stats.feedback_total === 1 ? 'note' : 'notes'} so far` : 'Everything readers sent'}
            badge={stats?.feedback_new ? `${stats.feedback_new} new` : undefined}
            icon={icon(Inbox)}
            onPress={() => onOpen('inbox')}
          />
          <Divider />
          <LinkRow
            title="Usage"
            subtitle={stats ? `${stats.active_today} active today · ${stats.installs} installs` : 'Who uses Brewsy, and how'}
            icon={icon(ChartColumn)}
            onPress={() => onOpen('usage')}
          />
        </Group>
      )}

      <Txt variant="caption" tone="tertiary" align="center" style={styles.about}>
        {backendConfigured
          ? 'Connected to your Brewsy backend'
          : 'Showing the sample edition · set up the backend with docs/BACKEND_SETUP.md'}
      </Txt>
    </>
  );
}

function topicSummary(s: Settings): string {
  const n = s.topics.length;
  const starred = s.focusTopics.filter((t) => s.topics.includes(t)).length;
  return `${n} ${n === 1 ? 'topic' : 'topics'}${starred ? ` · ${starred} starred` : ''}`;
}

function readingSummary(s: Settings): string {
  const size = TEXT_SIZES.reduce((best, step) =>
    Math.abs(step.scale - s.textScale) < Math.abs(best.scale - s.textScale) ? step : best,
  ).label;
  const hidden = s.mutedWords.length;
  return `Text size: ${size}${hidden ? ` · ${hidden} hidden ${hidden === 1 ? 'word' : 'words'}` : ''}`;
}

const styles = StyleSheet.create({
  ...settingsStyles,
  hidden: { display: 'none' },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 24, gap: 26 },
  about: { marginTop: 4, letterSpacing: 0.6 },
});
