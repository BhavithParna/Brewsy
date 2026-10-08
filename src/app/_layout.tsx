import { Barlow_500Medium } from '@expo-google-fonts/barlow/500Medium';
import { Barlow_600SemiBold } from '@expo-google-fonts/barlow/600SemiBold';
import { Barlow_600SemiBold_Italic } from '@expo-google-fonts/barlow/600SemiBold_Italic';
import { Barlow_700Bold_Italic } from '@expo-google-fonts/barlow/700Bold_Italic';
import { Barlow_800ExtraBold_Italic } from '@expo-google-fonts/barlow/800ExtraBold_Italic';
import { CormorantGaramond_500Medium } from '@expo-google-fonts/cormorant-garamond/500Medium';
import { CormorantGaramond_500Medium_Italic } from '@expo-google-fonts/cormorant-garamond/500Medium_Italic';
import { CormorantGaramond_600SemiBold } from '@expo-google-fonts/cormorant-garamond/600SemiBold';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { Inter_300Light } from '@expo-google-fonts/inter/300Light';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Jost_300Light } from '@expo-google-fonts/jost/300Light';
import { Jost_400Regular } from '@expo-google-fonts/jost/400Regular';
import { Jost_500Medium } from '@expo-google-fonts/jost/500Medium';
import { Jost_600SemiBold } from '@expo-google-fonts/jost/600SemiBold';
import { Orbitron_500Medium } from '@expo-google-fonts/orbitron/500Medium';
import { Orbitron_600SemiBold } from '@expo-google-fonts/orbitron/600SemiBold';
import { Orbitron_700Bold } from '@expo-google-fonts/orbitron/700Bold';
import { Orbitron_800ExtraBold } from '@expo-google-fonts/orbitron/800ExtraBold';
import { Oxanium_300Light } from '@expo-google-fonts/oxanium/300Light';
import { Oxanium_400Regular } from '@expo-google-fonts/oxanium/400Regular';
import { Oxanium_500Medium } from '@expo-google-fonts/oxanium/500Medium';
import { Oxanium_600SemiBold } from '@expo-google-fonts/oxanium/600SemiBold';
import { Oxanium_700Bold } from '@expo-google-fonts/oxanium/700Bold';
import { PlayfairDisplay_500Medium } from '@expo-google-fonts/playfair-display/500Medium';
import { PlayfairDisplay_500Medium_Italic } from '@expo-google-fonts/playfair-display/500Medium_Italic';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display/600SemiBold';
import { PlayfairDisplay_700Bold_Italic } from '@expo-google-fonts/playfair-display/700Bold_Italic';
import { Rajdhani_500Medium } from '@expo-google-fonts/rajdhani/500Medium';
import { Rajdhani_600SemiBold } from '@expo-google-fonts/rajdhani/600SemiBold';
import { Rajdhani_700Bold } from '@expo-google-fonts/rajdhani/700Bold';
import { ShareTechMono_400Regular } from '@expo-google-fonts/share-tech-mono/400Regular';
import { SpaceGrotesk_300Light } from '@expo-google-fonts/space-grotesk/300Light';
import { SpaceGrotesk_500Medium } from '@expo-google-fonts/space-grotesk/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono/400Regular';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { hydrateDownloads } from '@/audio/downloads';
import { progressStore } from '@/audio/progress';
import { SheetHost } from '@/components/SheetHost';
import { ToastHost } from '@/components/Toast';
import { applyDevUrlFlags } from '@/dev/previewState';
import { useAppSync } from '@/hooks/useAppSync';
import { useAppUpdates } from '@/hooks/useAppUpdates';
import { configureNotifications } from '@/lib/notifications';
import { deepDiveStore } from '@/state/deepDives';
import { readingListStore } from '@/state/readingList';
import { hydrateSeen } from '@/state/seen';
import { settingsStore, useSettings } from '@/state/settings';
import { AppThemeProvider, useTheme } from '@/theme/ThemeProvider';

SplashScreen.preventAutoHideAsync();
configureNotifications();

// Load saved settings, the Reading List, cached explainers and listening progress before the first screen.
const hydrated = Promise.all([
  settingsStore.hydrate(),
  readingListStore.hydrate(),
  deepDiveStore.hydrate(),
  progressStore.hydrate(),
  hydrateDownloads(),
  hydrateSeen(),
]).then(applyDevUrlFlags);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    // Theme typefaces (see themes.ts).
    Jost_300Light,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
    SpaceGrotesk_300Light,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    CormorantGaramond_500Medium,
    CormorantGaramond_500Medium_Italic,
    CormorantGaramond_600SemiBold,
    Barlow_500Medium,
    Barlow_600SemiBold,
    Barlow_600SemiBold_Italic,
    Barlow_700Bold_Italic,
    Barlow_800ExtraBold_Italic,
    ShareTechMono_400Regular,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    Orbitron_500Medium,
    Orbitron_600SemiBold,
    Orbitron_700Bold,
    Orbitron_800ExtraBold,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    Oxanium_300Light,
    Oxanium_400Regular,
    Oxanium_500Medium,
    Oxanium_600SemiBold,
    Oxanium_700Bold,
    PlayfairDisplay_500Medium,
    PlayfairDisplay_500Medium_Italic,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold_Italic,
  });
  const [storesReady, setStoresReady] = useState(false);

  useEffect(() => {
    hydrated.then(() => setStoresReady(true));
  }, []);

  const ready = (fontsLoaded || !!fontError) && storesReady;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <AppThemeProvider>
        <SheetHost>
          <AppStack />
          <ToastHost />
        </SheetHost>
      </AppThemeProvider>
    </GestureHandlerRootView>
  );
}

function AppStack() {
  const { theme } = useTheme();
  const { onboarded } = useSettings();
  useAppSync();
  useAppUpdates();

  const base = theme.isDark ? DarkTheme : DefaultTheme;
  // Navigation backgrounds match the app theme so transitions never flash white.
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: theme.colors.bg, card: theme.colors.bg },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, animation: 'fade', contentStyle: { backgroundColor: theme.colors.bg } }}>
        {/* Until onboarding is finished, only the onboarding screen exists. */}
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="driving" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="listen" options={{ animation: 'none' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1E140E' },
});
