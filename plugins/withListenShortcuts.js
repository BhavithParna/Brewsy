// Android app shortcuts: long-press the Brewsy icon for "Listen to briefing" /
// "Quick listen" (and drag either onto the home screen). Each opens
// brewsy://listen?mode=…, which starts today's audio briefing.
//
// Static shortcuts live in res/xml/shortcuts.xml and are declared on the main
// activity. Applied at build time (development or production build), not in Expo Go.

const fs = require('fs');
const path = require('path');
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require('expo/config-plugins');

const SHORTCUTS = [
  { id: 'listen_full', short: 'Listen', long: 'Listen to briefing', mode: 'full' },
  { id: 'listen_quick', short: 'Quick listen', long: 'Quick listen (3 min)', mode: 'quick' },
];

function shortcutsXml(packageName, scheme) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:icon="@mipmap/ic_launcher"
    android:shortcutShortLabel="@string/shortcut_${s.id}_short"
    android:shortcutLongLabel="@string/shortcut_${s.id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${packageName}"
      android:targetClass="${packageName}.MainActivity"
      android:data="${scheme}://listen?mode=${s.mode}" />
  </shortcut>`,
  );
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items.join('\n')}
</shortcuts>
`;
}

module.exports = function withListenShortcuts(config) {
  const packageName = config.android?.package;
  const scheme = Array.isArray(config.scheme) ? config.scheme[0] : config.scheme;
  if (!packageName || !scheme) throw new Error('withListenShortcuts needs android.package and scheme in app.json');

  config = withStringsXml(config, (c) => {
    const items = SHORTCUTS.flatMap((s) => [
      { $: { name: `shortcut_${s.id}_short` }, _: s.short },
      { $: { name: `shortcut_${s.id}_long` }, _: s.long },
    ]);
    c.modResults = AndroidConfig.Strings.setStringItem(items, c.modResults);
    return c;
  });

  config = withAndroidManifest(config, (c) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(c.modResults);
    const meta = (activity['meta-data'] ?? []).filter((m) => m.$['android:name'] !== 'android.app.shortcuts');
    meta.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/shortcuts' } });
    activity['meta-data'] = meta;
    return c;
  });

  return withDangerousMod(config, [
    'android',
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'xml');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'shortcuts.xml'), shortcutsXml(packageName, scheme));
      return c;
    },
  ]);
};
