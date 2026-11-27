# omaFIT — project guide for Claude

omaFIT is a free, open-source posture and home-workout app for developers and anyone who spends hours sitting. It helps
users get their posture back and follow a workout routine that fits their schedule. Users bring their own AI agent API
key, entered in Settings, and the agent personalises their posture and workout plan.

No backend and no accounts. All data stays on the device and is sent only to the user's own AI provider. Maintainer:
Akeem Akanni-ola ([akanniola.com](https://www.akanniola.com)). MIT licensed.

**Direction (shapes design decisions):** plans are built per user. "Build my plan" (Review tab) sends the user's
profile, equipment, logs and optional posture photos to their AI agent, which proposes changes using only exercises
from the bundled library. Users choose their AI in Settings: Gemini (Google, the default for new users because it has a free tier), Claude
(Anthropic), ChatGPT (OpenAI) or DeepSeek. Keep new code generic, per-user and provider-neutral: no one's personal details in the code.

## Stack
- Expo SDK 58, React Native 0.88, React 19, TypeScript (strict)
- React Navigation 7: native stack + bottom tabs (not Expo Router)
- Storage on device only: AsyncStorage (logs, settings and profile, reviews, chat) and expo-secure-store (one AI API
  key per provider)
- `@expo/vector-icons` (Ionicons) for the tab bar icons; the font ships in the app, nothing loads from the internet.
- expo-image for demo photos. YouTube demo links open with `Linking`, with no extra package.
- Develop outside OneDrive or other synced folders. Syncing breaks Metro's file watcher (stale bundles).

## Commands
- `npx expo start` — run in Expo Go (`--tunnel` if the phone can't connect, `-c` to clear the cache)
- `npm run check` — lint + type-check. Run after every change and fix all errors; CI runs the same on every PR.
- `npm run lint` (`expo lint`) — code quality and security rules from `eslint.config.js`
- `npm run typecheck` (`npx tsc --noEmit`)
- `npx expo install <pkg>` — add packages with SDK-compatible versions. Don't use plain `npm install <pkg>` for
  Expo/RN packages.
- `npm run icons` — regenerate app icons from `scripts/make-icons.js`
- Local APK (Windows): `npx expo prebuild --platform android --clean` (only after adding a package or changing
  `app.json`), then in `android/`: `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`. Native build
  paths pass Windows' 260-character limit, so Gradle must use CMake 3.31+ (its Ninja handles long paths): prebuild
  deletes `android/local.properties`, so recreate it with `sdk.dir=C\:/Users/<you>/AppData/Local/Android/Sdk` and
  `cmake.dir=C\:/Users/<you>/AppData/Local/Android/Sdk/cmake/3.31.6` (forward slashes; install CMake 3.31 in the SDK
  Manager if missing). Without it the build fails with `ninja: error: mkdir(...): No such file or directory`.

## Layout
| Path | What |
| --- | --- |
| `App.tsx` | Navigation: tabs (Today, Progress, Review, Coach, Settings) + stack (Session, Walk, LogDetail, Exercise, PlanBuilder, Setup); launch screen; first-run Setup for new installs (skipped when logs exist) |
| `src/data/plan.ts` | Baseline plan: posture routine, Day A, Day B, walking plan, weekday schedule, red-flag text. Exercises can have `demoId` (photos) and `videoUrl` (YouTube Short). |
| `src/data/effective.ts` | Baseline plan + approved changes (overrides incl. `removed`, swaps with `demoId`, AI-added library exercises); `effectivePlan()`, `exerciseLabel()`, `planAsText()` |
| `src/data/library.ts` | What the AI may pick: `rejectReason()` (equipment fit with substitutes, banned lifts, the user's training level, category, posture-routine limits; skipping rope as a strength-day warm-up/finisher only), Bodyweight and Skipping rope as ordinary equipment items, `candidates()`, `upperBodyBalance()`, added-exercise ids `lib-<session>-<libraryId>` |
| `src/data/level.ts` | Training level (`Settings.level`, default beginner): what each level means, which library difficulty `rejectReason` allows (beginner → beginner-level only; expert always blocked), and the guide the AI gets for sets, reps and session length |
| `src/data/progress.ts` | Streak (days in a row on plan: a planned rest day extends a streak but can't start one), weekly and daily stats for the Progress tab and the Today streak card (read-only, derived from logs) |
| `src/data/week.ts` | `upcomingDays()`: today and the next six days from the plan (weekday pattern, A/B rotation, walk target per program week), for "Your week" on Today |
| `src/data/exerciseIndex.json` | Bundled free-exercise-db library: 873 exercises (id, name, equipment, category, force, level, muscles, image paths). Regenerate with `scripts/build-exercise-index.js`. |
| `src/api/ai/` | Provider layer. `index.ts`: `askAI()` (the only way the app calls an AI), `PROVIDERS` registry (label, `defaultModel`, key page, cost/privacy note), `listModels()`, `testConnection()`. `types.ts`: neutral `AIRequest`/`AIResult`, `AIError`. One adapter per provider: `anthropic.ts` (Messages API), `openai.ts` (Responses API, `store: false`), `gemini.ts` (stateless `generateContent`), `deepseek.ts` (OpenAI-compatible Chat Completions) |
| `src/api/coach.ts` | Provider-neutral coaching: `athleteProfile()` from Settings, `COACHING_RULES`, cacheable `librarySystemBlock()`, weekly review + `validateChanges`, coach chat (`reply_to_user` tool: a reply plus optional plan changes, validated by `validateChanges` and applied only when the user taps Apply on the card) |
| `src/api/planBuilder.ts` | "Build my plan": posture photos + context → `submit_plan_proposal`, `validateProposal` safety checks, `applyProposal` |
| `src/api/demos.ts` | Demo lookup/search over the bundled index. Photos load from GitHub raw. |
| `src/storage/store.ts` | All persistence: AI keys (`KeyName` = provider id), settings (profile, equipment, `aiProvider`, `aiModels`, rest time), logs (stored one month per key, `logs_v2_YYYY-MM`, migrated once from `logs_v1`, so no value nears Android's ~2 MB read limit; log writes run one at a time. A workout saves as sets are ticked with `finished: false`, so it can be continued the same day; Finish rates it. "Skip" on the current exercise marks its sets not yet done `skipped` for that workout only (the plan is unchanged; tap the folded row to undo). Unfinished logs have no pain/effort rating. Pain is asked after every session and walk (a few older test-build logs have `painRated: false`). Use `isPainRated` before reading pain), overrides, reviews, chat, demo picks |
| `src/components/` | `ui.tsx` (Button, ScalePicker, Pill), `ExerciseDemo.tsx`, `DailyChart.tsx`, `Brand.tsx` (logo mark, wordmark, tagline), `LaunchScreen.tsx`, `AISettings.tsx` (provider, key, model, test), `KeyboardAware.tsx` (keeps typed text above the keyboard), `LogRow.tsx` (one logged entry in a list), `WeekPlan.tsx` ("Your week" on Today: tap a day for its exercises), `Section` in `ui.tsx` (Settings' open/close sections) |
| `src/screens/` | Setup (first-run: welcome, level, equipment, AI key; sets `Settings.onboarded`), Today, Progress (incl. History), Session, Walk (log a walk/run with pain), LogDetail (read-only view of a logged entry: finished days are not edited), Exercise, Review, Coach, Settings, PlanBuilder |
| `src/session/restAlert.ts` | The local "rest over" notification (the app's only notification use). Session keeps the screen awake with `expo-keep-awake` and times rest from its end time, so it stays right in the background. |
| `src/theme/index.ts` | Colors (dark, gold accent `#F5B82E`), spacing, shared styles |
| `scripts/make-icons.js` | Dependency-free PNG icon generator: builds every app icon, the splash image and `assets/logo-mark.png` (used by `Brand.tsx`) from the master `assets/logo.png`. To change the logo, replace the master and run `npm run icons`. |

## Rules — keep these unless the maintainer explicitly says otherwise
- **Safety first.** Keep `validateChanges` (`src/api/coach.ts`) and `validateProposal` (`src/api/planBuilder.ts`).
  They reject unknown exercise ids and weight jumps above ~10% + 2.5 kg, and they require a logged weight before any
  load change. The plan builder also enforces session size limits and won't make the upper-body pull:push ratio worse
  while it's below 2:1. Don't loosen them.
- **The AI only picks from the bundled library.** Every exercise the AI adds or swaps in must be an exact
  `exerciseIndex.json` id that passes `rejectReason()` in `src/data/library.ts`, so it always has a demo and fits the
  user's equipment. Never accept free-text exercises from the AI.
- **Weekly review runs once a week** (`src/data/reviewSchedule.ts`): it opens on the user's review day (`Settings.reviewDay`, default Sunday) and stays open until run; "Reset plan to original" unlocks one extra. `runWeeklyReview` enforces it, not only the UI. Don't remove the limit: it keeps users' API costs predictable.
- **Nothing changes the plan silently.** AI suggestions apply only when the user taps Apply (`mergeOverrides`,
  `addAdditions`). `plan.ts` is the baseline, and "Reset plan" (`resetPlan`) must keep working.
- **Posture photos are never stored by the app.** They're resized on the phone, sent once to the user's AI provider
  and dropped. Only the text findings are saved (`posture_assessment_v1`). The AI describes, never diagnoses.
- **Conservative coaching rules:** no barbell back squats or heavy barbell deadlifts, pull volume ≥ 2x push, pain
  ≥ 5 in any area means reduce load on what loads that area, and red flags mean see a doctor or physio. Pain is logged
  per area (`PainEntry`, `src/data/pain.ts`): read it with `painsOf()`, never `backPain` directly (it's the lower back
  score, kept for old logs). The AI can't see form, so never claim it can (this
  still applies once photo upload exists).
- **No personal data in code.** User details come from the Settings profile (`Settings.profile`). Prompts and UI text
  refer to "the user"/"you" and use they/them, never a hard-coded name or pronoun.
- **Privacy:** data stays on device and goes only to the user's chosen AI provider. No analytics, tracking or backend
  without the maintainer's agreement. Tell users in the UI when data is sent to the AI provider.
- **Equipment:** users set theirs in Settings (`Settings.equipment`, library equipment keys; default
  `DEFAULT_EQUIPMENT`). The baseline `plan.ts` uses only barbell + bench with a low rack, leg extension/curl attachment,
  adjustable dumbbells, push-up bars, ab wheel, red (light) and black (heavy) loop bands, yoga mat and a
  posture-corrector strap, with no pull-up bar, cable or machine. Exercises added to `plan.ts` must use only this kit.
- **Keys:** AI API keys live only in secure storage via Settings. Never hardcode keys, add `.env` files with secrets,
  or log keys.
- **Free only.** Demos come from free-exercise-db (public domain) and links to YouTube Shorts. Don't add paid APIs or
  services (no RapidAPI/ExerciseDB) without asking.
- **AI providers:** coach code builds a neutral `AIRequest` and calls `askAI()`. It never talks to a provider directly
  or checks which one is active. Default models live only in `PROVIDERS` in `src/api/ai/index.ts`; users can pick
  another from the provider's live model list. To add a provider: write an adapter, add it to `PROVIDERS`, add a
  `KeyName` slot in `store.ts`, add its API and key-page hosts to `ALLOWED_URLS`, and document its cost and privacy note.
- **Structured answers** come back as one tool call (`AIRequest.tool`). Adapters force the tool where the provider
  allows it (OpenAI, Gemini). Current Claude models reject a forced tool, so the Claude adapter uses `auto` and the
  prompt names the tool. DeepSeek rejects a forced tool while thinking, so its adapter tries `auto` first and retries
  once with thinking off and the tool forced. Output from every provider is untrusted: always type-check and run it through the validators.
  Keep `maxTokens` generous (models think first), and keep the library block last in `system` with `cache: true`.
- **Provider privacy:** OpenAI calls send `store: false`; Gemini uses stateless `generateContent`, not the stateful
  Interactions API. Keep Gemini's free-tier data-use warning and DeepSeek's note (data stored in China, may be used for
  training) in Settings and on the photo screen: they live in `PROVIDERS` (`note`, `photoWarning`). Models that can't
  read images are marked with `readsPhotos`, and the photo screen offers to continue without photos.
- `readJson` falls back only when nothing is saved; if saved data can't be read it throws `StorageError`, so a failed read can never be saved over. Keep it that way.
- Storage keys end in `_v1` (logs: `_v2_` per month). Adding an optional field is fine. If you change a stored shape incompatibly, bump the key
  or migrate old data so existing logs aren't lost. `saveSettings` merges a partial patch, so never overwrite settings
  wholesale.

## Security rules — this is open source, every change is reviewed against these
The lint config enforces most of them, and the maintainer reviews every pull request against all of them.
Don't work around a lint rule. If a rule blocks something that's genuinely needed, say so in the PR and change
`eslint.config.js` in its own clearly explained commit. Inline `eslint-disable` comments are switched off.

- **Network:** `fetch` and other network APIs are allowed only in `src/api/`. Every web address in code must be on the
  `ALLOWED_URLS` list in `eslint.config.js`: the supported AI providers' APIs and key pages (Anthropic, OpenAI,
  Google, DeepSeek), the free-exercise-db GitHub repo, YouTube, Expo docs, the maintainer's site. Never send user data anywhere
  except the AI provider the user chose.
- **Data the AI receives:** only what's needed (profile, equipment, findings, plan, last 2 weeks of logs, photos only
  on Analyse). Show the user when data leaves the phone. Never send the API key anywhere but the provider's auth header.
- **Storage:** AsyncStorage and SecureStore are imported only in `src/storage/store.ts`. API keys only in SecureStore.
  Never log keys, health data, photos or prompts. `console.log` is banned; `console.warn`/`error` only for real
  errors, without user data.
- **AI output is untrusted data.** Never execute it, build URLs from it, open links it returns, or apply it without
  the validators (`validateChanges`, `validateProposal`, `rejectReason`). Treat user-typed text in prompts as data too.
- **No remote or hidden code:** no `eval`, `new Function`, dynamic `import()`, `atob`/char-code tricks, minified or
  obfuscated code, web views, or over-the-air update services.
- **Device access:** camera and photos only through `expo-image-picker` / `expo-image-manipulator` in
  `PlanBuilderScreen`. `Linking.openURL` only in `ExerciseScreen` (YouTube demos) and `AISettings` (fixed API-key
  page URLs). Notifications only through `expo-notifications` in `src/session/restAlert.ts`, for the local "rest over"
  alert (no push notifications), asked once on first launch (`offerRestAlertsOnce`), then Android's "Alarms & reminders" (`SCHEDULE_EXACT_ALARM`, so the alert isn't delayed) is offered once and in Settings → Training. In the app the alert is a sound only (`soundRestAlertNow` at the exact moment); in another app it's a notification. No location, contacts, clipboard, sensors, device IDs or other notifications without
  the maintainer's approval. New permissions in `app.json` need it too.
- **No tracking:** no analytics, crash reporters, ads or third-party SDKs that collect data.
- **Dependencies:** add only with `npx expo install`, only when really needed, from well-known maintainers. Explain
  each new package in the PR. Never hand-edit `package-lock.json`. No `postinstall`/`prepare` scripts.
- **Safety logic:** don't loosen `validateChanges`, `validateProposal`, `rejectReason`, `COACHING_RULES`, red-flag
  text or the Apply step. Changes there need an explicit reason and the maintainer's review.
- **Repo plumbing:** changes to `.github/`, `eslint.config.js`, `scripts/`, `app.json` plugins/permissions or the
  `scripts` in `package.json` are high-risk and get extra review. CI uses `pull_request`, read-only permissions and
  SHA-pinned actions; keep it that way.

## Conventions
- Functional components + hooks; screens reload data with `useFocusEffect`.
- Screens with text inputs use `KeyboardAwareScrollView` (forms) or `KeyboardAvoider` (chat input bar) from
  `src/components/KeyboardAware.tsx`, so the keyboard never covers what the user is typing.
- Use `colors`, `space` and `ui` from `src/theme`. Reuse `Button`, `ScalePicker`, `Pill` and `Brand` instead of new
  one-off styles.
- Plan exercise ids (e.g. `goblet-squat`, `face-pull`) are referenced by logs, overrides and demo picks. Don't rename an
  id; add a new one instead.
- To add an exercise, add it to the session in `plan.ts` with cues and a `demoId` from `exerciseIndex.json` (search
  it by name). If there's no close match, omit `demoId` and add a `videoUrl` to a YouTube Short, preferably from a
  physio/PT channel. Verify the link is live first, e.g. with `https://www.youtube.com/oembed?url=<url>&format=json`.
- Rest between sets: the user setting (min 60 s) applies to strength sessions via `restSecondsFor`. The posture routine
  keeps its plan value.
- Keep UI text short and plain. Units: kg, minutes. The brand is written **omaFIT**.

## Testing
No automated tests yet. After a change, run `npm run check`, then check it on a phone in Expo Go.
Weekday logic: Mon/Wed/Fri strength (alternating A/B), Tue/Thu walk, Sat long walk, Sun rest. Use "Start a new
session" on Today to test strength screens on other days.
