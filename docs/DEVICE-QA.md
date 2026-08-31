# Device QA on a real iPhone

`BGContinuedProcessingTask` does not work in the Simulator — `BGTaskScheduler`
returns `.unavailable` there — and it cannot run in CI. A physical iPhone on
**iOS 26 or newer** is the only place this library's iOS half is ever verified.

The example app is a QA instrument for exactly this. It records results to disk,
so the checks that require backgrounding or force-quitting the app survive the
thing they are testing, and it can hand you a markdown report at the end.

Budget about 20 minutes, most of it waiting for one timeout.

---

## 1. Prerequisites

- An iPhone running iOS 26+, plugged in and trusted.
- Xcode 26.x (the iOS 26 SDK is what declares `BGContinuedProcessingTask`).
- An Apple ID added to Xcode under **Settings → Accounts**. A free personal
  team is enough for everything except the GPU check.

```sh
git clone <this repo> && cd react-native-continued-task
yarn install
```

## 2. Set your bundle identifier

Open `example/app.json`. You need a bundle identifier nobody else has claimed:

```json
"ios": { "bundleIdentifier": "com.yourname.continuedtaskqa" }
```

> **This is the step people get wrong.** iOS requires every continued-processing
> identifier to start with the app's bundle identifier. If you change
> `bundleIdentifier` you **must** change `identifierPrefixes` in the same file to
> match, or every submission fails with `not-permitted` and the whole run is red
> for a reason that has nothing to do with the library:

```json
"plugins": [
  ["react-native-continued-task", {
    "identifierPrefixes": [
      "com.yourname.continuedtaskqa.export",
      "com.yourname.continuedtaskqa.render"
    ],
    "enableGPU": false
  }]
]
```

The QA app submits under `<bundleId>.export` and `<bundleId>.render`, so keep
those two suffixes.

## 3. Optional: the GPU check

`enableGPU` is **off by default on purpose**. The
`com.apple.developer.background-tasks.continued-processing.gpu` entitlement is
only valid for a paid **Apple Developer Program** or **Enterprise** team —
Xcode's own capability database lists no free-team support. On a free Apple ID,
turning it on makes code signing fail and you will not get the app onto the
device at all.

If you have a paid account, set `"enableGPU": true` and re-run prebuild. If you
do not, leave it off: check 7 still passes, verifying that a GPU request is
correctly refused with `not-permitted`.

## 4. Build to the device

```sh
cd example
npx expo prebuild --clean
open ios/*.xcworkspace
```

In Xcode: select the app target → **Signing & Capabilities** → tick _Automatically
manage signing_ and pick your team. Choose your iPhone as the destination and
press Run.

On first launch the device will refuse to open the app until you trust the
certificate: **Settings → General → VPN & Device Management → Developer App →
Trust**.

> Free-team builds expire after 7 days. If the app stops launching a week later,
> that is why — rebuild from Xcode.

## 5. Run the checks

The app opens on the QA screen. The header shows `supported`, `gpu` and
`reattach` for the device you are on; if `supported` is false, stop — you are on
the wrong OS or the Simulator, and nothing below will mean anything.

**First, tap "Run automatic checks."** Eight checks run and grade themselves in
about ten seconds. Each card shows what was actually observed.

Then work down the remaining cards. Each one tells you _why_ it exists, _what to
do_, and _what counts as a pass_.

### Checks 9 and 10 — the Live Activity (interactive)

Arm check 11 first so a task is running, then swipe up to the Home Screen and
look at the Dynamic Island or Lock Screen. You should see a system-provided
activity titled **QA export** with a subtitle counting up and a progress bar
moving. The library does not build this UI — iOS does — so if it is missing or
frozen, the task's title and progress are not wired to the real
`BGContinuedProcessingTask`.

Tap **I saw it** or **It did not happen**.

### Checks 11–13 — the ones that need the app to go away

These are armed, not run. Tap **Arm this check**, do the thing, then come back to
the app; the result resolves itself from the persisted records the moment the app
becomes active again.

| Check                     | What to do                                                  | Expect           |
| ------------------------- | ----------------------------------------------------------- | ---------------- |
| 11 · Live Activity cancel | Background the app, cancel from the Live Activity, return   | `expired`        |
| 12 · Stalled task expires | Background the app and leave it a few minutes, then return  | `expired`        |
| 13 · App-switcher swipe   | Swipe the app out of the app switcher, then launch it again | `app-terminated` |

Check 11 reporting `expired` rather than `user-cancelled` is **correct**. iOS
routes Live Activity cancellation through the same `expirationHandler` as a
system expiry and gives the app nothing to tell them apart. Android can
distinguish the two; iOS cannot.

Check 12 is the slowest thing here — the system decides when a stalled task has
stalled long enough. Leave the phone alone and come back.

Check 13 is the important one. It is the only evidence that work lost to a swipe
is recoverable at all, and it is the one thing no test suite anywhere can
automate: iOS gives the app no callback, so a next-launch record is the only
trace that the work ever existed.

## 6. Share the report

Tap **Share report** for a markdown summary — counts, per-check status, and the
observed detail for each. Paste it into the PR or an issue.

A clean run on a free team looks like **12 passed, 0 failed**, with the GPU check
passing by correctly refusing.

## What to do when something fails

| Symptom                                             | Likely cause                                                                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Everything fails with `not-permitted`               | `identifierPrefixes` does not match your `bundleIdentifier` — see step 2                                                                                                                   |
| Header shows `supported false`                      | iOS older than 26, or you are on the Simulator                                                                                                                                             |
| Build fails on signing with a GPU entitlement error | Free team; set `enableGPU: false`                                                                                                                                                          |
| Check 1 crashes the app                             | The double-registration guard is broken. This is the most serious possible failure — Apple kills the app on a second registration of the same identifier. File it with the report attached |
| Check 12 never resolves                             | Give it longer; the system chooses the moment. If it eventually reports `app-terminated` instead, the app was force-quit rather than backgrounded                                          |

Every failure is worth reporting with the shared markdown attached — it carries
the device OS version and capability flags, which is usually the first question.

## Android

Android needs none of this: the emulator runs the real foreground service, and
`yarn example android` plus the same QA screen works there. The automated
instrumented tests already cover the store and the notification. The one thing
the QA screen shows on Android that CI does not is the ongoing notification and
its cancel action, which reports `user-cancelled` — the case iOS cannot express.
