import * as Updates from 'expo-updates';

/**
 * Which version of Brewsy is running, short enough to read in a list: the first 8 characters of
 * the over-the-air update id (as the EAS dashboard shows it), 'build' when the phone runs what the
 * APK shipped with, or 'dev' in development.
 */
export function appVersion(): string {
  if (Updates.updateId) return Updates.updateId.slice(0, 8);
  return __DEV__ ? 'dev' : 'build';
}
