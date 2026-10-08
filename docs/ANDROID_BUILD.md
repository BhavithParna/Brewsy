# Installing Brewsy on your Android phone (notifications + audio briefing)

Expo Go is perfect for trying Brewsy. These parts need Brewsy installed as a real app:

| Feature | Expo Go | Installed build |
|---|---|---|
| Reading the edition, Reading List, Go deeper, Ask | ✅ | ✅ |
| Listening with the app open (phone voice or studio voice) | ✅ | ✅ |
| Listening with the **screen locked** / app in the background | ❌ stops | ✅ |
| Lock-screen, notification-shade and Bluetooth/car controls | ❌ | ✅ |
| Morning push, "Listen now" button, breaking-news pushes | ❌ (Android Expo Go has no push) | ✅ |
| Long-press the app icon → "Listen to briefing" / "Quick listen" | ❌ | ✅ |
| Reading reminders (tonight / this weekend) | ❌ on Android | ✅ |

Build it with Expo's free build service, EAS. You do this once; after that you only rebuild
when native packages or `app.json` plugins change (JavaScript changes don't need a rebuild
with a development build, see the end of this page).

You type commands in a terminal, in the Brewsy project folder:

```bash
cd ~/Documents/"app Recap"/brewsy
```

## 1. Make an Expo account and link the project

1. Sign up at <https://expo.dev/signup> (free).
2. Log in and register the project:

   ```bash
   npx eas-cli@latest login
   npx eas-cli@latest init
   ```

   `init` adds an `extra.eas.projectId` to `app.json`. The app needs that id to get a push token.

## 2. Set up Firebase (Google's push service for Android)

1. Go to <https://console.firebase.google.com>, click **Create a project**, name it `Brewsy`
   (Google Analytics: off is fine).
2. In the project, click the **Android** icon to add an app.
   - **Package name:** `com.brewsy.app` (must match `android.package` in `app.json`).
   - Skip the other fields, then **Download google-services.json**.
3. Put `google-services.json` in the project folder (next to `package.json`) and add this
   line inside `"android": { ... }` in `app.json`:

   ```json
   "googleServicesFile": "./google-services.json",
   ```

   The GitHub repo is public, so this file isn't committed: it's kept out locally with
   `echo google-services.json >> .git/info/exclude` (not `.gitignore`, which is part of the
   app's update fingerprint). EAS Build skips git-ignored files, so before your next
   `eas build` add an `.easignore` (a copy of `.gitignore`) that doesn't list
   `google-services.json`. Adding it changes the fingerprint, which a new build needs anyway.

4. Give Expo permission to send through Firebase:
   - Firebase console → ⚙️ **Project settings** → **Service accounts** →
     **Generate new private key**. A `.json` file downloads. Keep it private; don't commit it.
   - Upload it to Expo:

     ```bash
     npx eas-cli@latest credentials
     ```

     Choose **Android** → **production** → **Google Service Account** →
     **Manage your Google Service Account Key for Push Notifications (FCM V1)** →
     **Set up a Google Service Account Key for Push Notifications (FCM V1)** → pick the file.

## 3. Tell the build where your backend is

Your `.env` file isn't uploaded to the build service, so add the same two values there
(the publishable key is meant to be public, so `plaintext` is fine):

```bash
npx eas-cli@latest env:create --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_URL --value https://YOUR-PROJECT-REF.supabase.co
npx eas-cli@latest env:create --environment preview --visibility plaintext \
  --name EXPO_PUBLIC_SUPABASE_KEY --value sb_publishable_paste-the-rest
```

## 4. Build and install

```bash
npx eas-cli@latest build --platform android --profile preview
```

It builds in the cloud (often 10–20 minutes on the free plan, longer if there's a queue).
When it's done you get a link and a QR code: open it on your phone, download the `.apk`
and install it (Android will ask you to allow installing from your browser; that's expected).

Open Brewsy, finish onboarding and allow notifications. The app sends its push token,
wake-up time and topics to your backend. Check it arrived in the Supabase dashboard →
**Table Editor** → `devices` (the `push_token` column starts with `ExponentPushToken[`).

## 5. Test the morning push without waiting until tomorrow

Follow "Make your first edition now" in [BACKEND_SETUP.md](BACKEND_SETUP.md), step 9. A
forced run makes the edition and sends the push straight away.

## 6. Test the audio briefing (including with the screen locked)

1. Open Today and tap **▶ Listen · N min** under the date, then pick **Quick listen** or
   **Full briefing**. A mini player appears above the tab bar; the story being read has an
   orange outline and moving bars on Today.
2. Tap the mini player for the full player: chapter list, speed (0.8× to 2×), Quick/Full,
   **Download for offline**, **Driving mode** and **Stop**.
3. **Lock the screen.** Audio keeps playing. On the lock screen (and in the notification
   shade) you'll see the story title with play/pause and two ⟲10 / 10⟳ buttons. In Brewsy
   those two buttons jump to the **previous / next story** (the icon says 10 because that's
   the only skip button Android and iOS give expo-audio).
4. Bluetooth headphones and car stereos: play/pause works. Their next/previous buttons
   don't skip stories (see "Car and Bluetooth" in the README).
5. Close the app from the app switcher and open it again: **Resume listening** picks up
   where you stopped.
6. Turn on airplane mode after **Download for offline**: the edition still plays.
7. Long-press the Brewsy icon on the home screen: **Listen to briefing** and
   **Quick listen** start today's audio straight away.

Android 13+ asks for notification permission the first time you play: allow it, because
the lock-screen controls live in a media notification.

If an edition has no studio-voice audio yet (TTS not set up, or it's still being made),
Brewsy reads it with the phone's own voice (pick the least robotic one in Settings → Phone
voice). That works while the app is open, but the phone voice can pause when the screen
locks and always sounds synthetic, so set up TTS on the backend for natural, lock-screen
listening ([BACKEND_SETUP.md](BACKEND_SETUP.md)).

## Live reloading on the installed app (recommended)

The `development` profile builds a "development client": like Expo Go, but with push,
background audio and the shortcuts. It needs one extra package first:

```bash
npx expo install expo-dev-client
npx eas-cli@latest build --platform android --profile development
```

After installing `expo-dev-client`, `npx expo start` opens the development build by default;
press `s` in the terminal to switch back to Expo Go.
