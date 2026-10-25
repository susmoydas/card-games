# Card Games — Audit and Implementation Status

## Confirmed project facts

- The app is a single HTML/CSS/JavaScript file at `www/index.html`.
- It contains 29, Call Bridge, and Hearts; Call Marriage is a placeholder.
- Lexend fonts and the existing inline SVG controls are local. At inspection,
  there were no npm dependencies, automated tests, Android project, or
  project-specific agent instructions.
- The Capacitor web asset directory is `www`.
- Hearts' existing dealing, play, trick, and scoring logic was left unchanged.
- Added Capacitor 8.5.3 and generated `android/`; used Android Studio's bundled
  JDK 21 because Capacitor 8 requires Java 21 to compile.
- Created a local-only RSA release signing key and private Gradle properties
  file after confirming no project keystore existed. Both are excluded from
  Git; permissions are restricted to the local user.
- Built a signed release APK without changing the personal app ID.
- Copied the installable release build to `release/card-games-release.apk`
  (3,237,662 bytes); it is not covered by the Android build-output ignore
  patterns.

## Findings and work completed

### Gameplay and seat display

- Replaced player aliases in game UI and rules copy with compass seats. Seat 0
  (the human) is South; seats 1–3 are West, North, and East, matching the
  existing clockwise seat order and table positions.
- 29 bid history now records each seat's bid or pass and shows the current
  highest bidder and bid. The trump selection screen and score panel identify
  the bidder by seat.
- Call Bridge now tracks a sequential bid for all four seats before starting
  card play. Its phase, current bidder, bid totals, and trick totals are shown.
  The player chooses 1–13; bots choose a bounded estimate. The existing
  individual scoring formula and five-round structure remain in place.
- Guarded card plays, bidding callbacks, trump confirmation, and trick
  collection against stale phases, invalid turns, and repeated modal actions.
- Call Bridge and 29 now display their bid/trump context in the info panel.

### Mobile interface

- Enlarged the player hand cards where viewport height allows.
- Increased icon-only action targets to 40px and the back target to 44px.
- Made bid dialogs centered, viewport bounded, scrollable, and responsive to
  safe-area insets. Bid choices use a compact four-column grid.
- Added a compact layout adjustment for screens up to 360px wide and global
  reduced-motion handling.
- Added Node.js rule tests, a reproducible Android debug build workflow, and
  ignore rules for local/generated build output and signing credentials.

## Rule clarification — intentionally not implemented

The requested special Seven/Joker trump-selection rule is not specified in the
project docs, and the user confirmed it is unknown and should remain unchanged.
The existing 32-card 7–A deck and current trump behavior are preserved; no Joker
or special Seven behavior has been added.

## Remaining issues and verification limits

- The Call Bridge bot strategy is a simple local estimate, not a validated
  competitive strategy. The existing forced-trump/overtrump legality is still
  in place.
- The five-round Call Bridge match, 29 full hand and scoring, 29 round score
  progression, rapid tapping, and long-match game-over are not fully exercised
  by automated tests.
- npm reports three moderate dependency advisories during clean install; they
  were not automatically changed.
- Hugeicons assets were not added. Existing interface controls use bundled
  inline SVG and require no CDN.
- No service worker was added; packaged Capacitor assets are local. Browser
  service-worker/PWA installation is outside this app's current setup.
- The debug build uses the existing placeholder application ID
  `com.yourname.cardgames`; change it before a public release.
- `INTERNET` remains in the manifest: removing it made the Capacitor local
  WebView render a blank screen. It is needed for the local app origin, not an
  online game dependency. The signed release was verified with Wi-Fi and
  mobile data disabled.
- The emulator's API 36 image lacks its kernel. API 34 was used. The signed
  release installed and launched there; all three playable games accepted
  offline gameplay, including a complete 29 hand. Hearts was also played
  through multiple legal human turns offline. No physical device was tested.
- GitHub Actions workflow is present but was not run against a remote repository.

## Status checklist

- [x] Inspect current source, package/configuration, docs, assets, and Android
      project presence.
- [x] Replace player aliases with seat labels and show 29 bid status.
- [x] Make Call Bridge bidding sequential and gate play until bids are placed.
- [x] Add rapid-action/phase guards and responsive modal improvements.
- [x] `npm ci`, seven automated rule/action tests, and inline-JavaScript syntax
      check passed.
- [x] Browser-tested 29 bidding and trump selection at 320px; Call Bridge
      bidding through a full hand, scoring, and starting round 2; and a full
      Hearts hand. Bid dialogs stayed within the 320×640 and 390×844 viewports.
- [x] Built and verified the debug APK. Installed/launched it in an Android 34
      emulator, exercised Call Bridge bidding and play, and confirmed launch and
      local gameplay with Wi-Fi and mobile data disabled.
- [x] Generated and verified a signed release APK with `apksigner`; confirmed
      release package ID and label, non-debuggable build type, and packaged
      local fonts. Installed and launched offline in Android 34 emulator.
- [x] Final APK location: `release/card-games-release.apk`; local signing
      properties and keystore remain private and excluded from Git.
- [ ] Implement a confirmed Seven/Joker variant (blocked pending rule details).
- [ ] Validate the GitHub Actions workflow on the user's remote repository.
- [ ] Run the full five-round Call Bridge match and long-game scoring tests.
- [ ] Replace the placeholder application ID and produce a signed release only
      when the owner supplies their release identity/keystore.
