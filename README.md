# Card Games (29, Call Bridge, Hearts)

Offline Android card game app. The whole game is one file: `www/index.html`
(HTML + CSS + JavaScript). Fonts are in `www/fonts`.

## Files
- `www/index.html`  the game. Edit this file (VS Code, OpenCode AI).
- `www/fonts/`      Lexend font files, so it works offline.
- `capacitor.config.json`  app name and package id (change `com.yourname.cardgames`).
- `package.json`    scripts and Capacitor dependencies.
- `android/`        generated Capacitor Android project.
- `.github/workflows/android.yml`  builds and uploads a debug APK on GitHub.

## Try it in the browser
    npx serve www
Open the address it prints. Use Chrome DevTools, device toolbar, to see a phone size.

Run the local game-rule checks with:

    npm test

## Build the Android app
Install Node.js, Android Studio, the Android SDK, and JDK 21 first. Capacitor
and the generated Android project are included in this checkout.

1. Install locked dependencies:
       npm ci
2. If `android/` is absent, add the Android project once:
       npx cap add android
3. After every change to the web app:
       npx cap sync android
       npx cap open android
4. Build a debug APK from Android Studio or with
       cd android && ./gradlew assembleDebug
   It is for development/testing, not a release.
5. A local release keystore and private Gradle properties file are configured
   in this checkout. The credentials file at `android/keystore.properties` is
   ignored by Git and restricted to the local user; the keystore is
   `release/card-games-release.jks`. Keep both files private and backed up.
   Losing the key prevents future updates from using the same signing identity.
   To build another signed release APK, run:
       cd android && ./gradlew assembleRelease

The debug APK output path is `android/app/build/outputs/apk/debug/app-debug.apk`.
The distributable release APK is `release/card-games-release.apk`; Gradle's
intermediate APK is written to `android/app/build/outputs/apk/release/`.
Verify that the APK was generated and signed before sharing it. GitHub Actions
builds only a debug APK and does not publish the app or create a signed release.

The app has no online features or external runtime assets. The INTERNET
permission remains because Capacitor's local HTTPS WebView origin requires it;
gameplay and fonts are packaged locally and work with network connectivity off.

## Where the code is (in www/index.html)
- Game logic: functions `deal`, `bid29`, `legal`, `legalB`, `bot`, `playC`, `endT`, `endR`.
- Screen drawing: `board` and `draw`.
- Avatars: `AVS`. Sounds: `sfx`. Game intro texts: `RU`.
- Styles: the single `<style>` block at the top.

## Rules implemented
- 29: bid 16 to 29, hidden trump, ask to show trump when you cannot follow suit. Bid 29 means win all 8 tricks. Per-seat bids stay visible during the hand. The seventh-card/Joker variant is not implemented because its deal, eligibility, ranking, and scoring rules have not been specified.
- Call Bridge: 13 cards, each seat bids 1 to 13 in sequence, spades are trump, must follow suit, must trump and overtrump, 5 rounds.
- Hearts: pass three cards left, right, across, then hold on each fourth hand; avoid hearts and Q of spades; game ends at 50.
- Call Marriage: not built yet.

The back arrow is a locally bundled Hugeicons `ArrowLeft01Icon` asset. Its MIT
license is included in `www/icons/LICENSE.md`. Hearts passing shows its
direction, animates the selected outgoing cards and incoming cards in separate
stages, and identifies the sender of the three received cards; the incoming
cards stay identified until the player's first play. Hold hands
show that no cards were exchanged. Bridge and 29 bids are displayed alongside
their seats; Bridge trick counts remain a separately labelled seat indicator.
