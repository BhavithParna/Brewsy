import { Pause, Play } from 'lucide-react-native';

import { Pill } from '../Pill';
import { useSheets } from '../SheetHost';
import { listenMinutes } from '@/audio/sessions';
import { usePlayer } from '@/audio/store';
import type { Briefing } from '@/data/types';
import { useSettings } from '@/state/settings';
import { useTheme } from '@/theme/ThemeProvider';

/** "▶ Listen · 8 min" under the date. Opens the Quick / Full choice, or the player if it's already playing. */
export function ListenPill({ briefing }: { briefing: Briefing }) {
  const { theme } = useTheme();
  const { openListen, openPlayer } = useSheets();
  const { listenMode, topics } = useSettings();
  const loaded = usePlayer((s) => s.session?.editionDate === briefing.date && s.session.kind === 'edition');
  const playing = usePlayer((s) => s.playing);
  const minutes = listenMinutes(briefing, listenMode, topics);
  const active = loaded && playing;
  const ink = theme.colors.inverseText;

  return (
    <Pill
      label={active ? 'Playing · open player' : loaded ? 'Resume listening' : `Listen · ${minutes} min`}
      size="md"
      variant="solid"
      color={theme.colors.inverseBg}
      icon={
        active ? (
          <Pause size={14} color={ink} fill={ink} strokeWidth={0} />
        ) : (
          <Play size={14} color={ink} fill={ink} strokeWidth={0} />
        )
      }
      onPress={() => (loaded ? openPlayer() : openListen(briefing))}
      accessibilityLabel={loaded ? 'Open the player' : `Listen to this edition, about ${minutes} minutes`}
    />
  );
}
