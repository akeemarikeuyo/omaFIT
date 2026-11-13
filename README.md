<p align="center">
  <img src="assets/icon.png" width="96" alt="omaFIT logo: a figure in motion with a gold spine" />
</p>

<h1 align="center">omaFIT</h1>

<p align="center">
  <b>Get your posture back and build a workout routine that fits a desk-bound life.</b><br />
  A free, open-source mobile app for developers and anyone who spends hours sitting.<br />
  Bring your own AI agent key, and it becomes your personal posture and strength coach.
</p>

---

## Why omaFIT

Long days at a desk lead to forward head posture, rounded shoulders, tight hips and a sore lower back. Most workout apps
assume a gym, a free schedule and no aches. omaFIT starts from the desk:

- A **daily 10-minute posture and back routine** that also works as your warm-up.
- **Strength sessions at home** that favour pulling, glutes and core, with back-friendly exercise choices.
- **Walking and run-walk days** that fit around a working week.
- An **AI coach you control.** Choose Gemini (which has a free tier), Claude, ChatGPT or DeepSeek, add your own API key in
  Settings, and the coach reviews your logs and suggests next
  week's changes based on your profile, any pain you've logged and your progress. Nothing changes until you approve it.

No accounts, no backend, no subscription. Your data stays on your phone.

## Features

| Tab | What it does |
| --- | --- |
| **Today** | Today's session from the weekly schedule, the daily posture routine, walk logging, your streak, and recent history. |
| **Progress** | Day streak, active days this week, and a daily chart of sets done, walk minutes and pain, with where it hurt (2 weeks or 30 days). |
| **Review** | **Build my plan with AI** (see below), and a weekly review where your AI coach reads the last 2 weeks of logs and suggests up to 4 changes. You tap **Apply** to accept them, and **Reset plan** restores the original. |
| **Coach** | Chat with your AI coach. It sees your profile, posture findings, plan and recent logs. |
| **Settings** | AI key, your profile (goals, sitting hours, posture and back notes), your equipment, rest time between sets, program start date. |

During a workout you can tick off sets, log weight and reps (prefilled from last time), use a rest timer you configure
(60 s minimum) and rate effort. On strength days you can also log any pain or discomfort by body area (neck, back,
shoulder, knee and more, 0-10). Sets save as you tick them, so you can continue later the same day. Each exercise has form cues, a start-to-end photo demo and, where no photo
fits, a link to a short YouTube demo.

### Build my plan with AI

1. Fill in **Settings → About you** and tick the equipment you have under **Settings → Your equipment**.
2. Open **Review → Build my plan with AI**. Optionally take or choose posture photos: front and side (both sides if you
   can), standing relaxed, full body in frame.
3. Tap **Analyse and build my plan**. Your AI coach describes what it sees in the photos, then proposes exercises to
   add, swap, remove or adjust in your posture routine and strength days, each with a reason.
4. Review the changes, with a demo photo for every new exercise, and tap **Apply**.

The AI can only pick from the **873-exercise library bundled with the app**
([free-exercise-db](https://github.com/yuhonas/free-exercise-db)), so every exercise it picks has demo photos. It
can't invent exercises.

### Safety built in

The AI suggests changes, and the app checks them before you see them:

- Every new or swapped exercise must be an exact id from the bundled library, doable with your equipment. Bands can
  stand in for cables, and dumbbells for kettlebells.
- It blocks expert-level moves, Olympic lifts, strongman and plyometrics, and heavy barbell squats and deadlifts. The
  posture routine only gets beginner bodyweight, band, stretching or foam-roller moves.
- It won't add pushing work, or remove pulling work, if that would leave upper-body pulling below twice the pushing.
  Sessions keep a sensible minimum and maximum length.
- It rejects exercises that aren't in your plan.
- It blocks weight jumps of more than about 10% + 2.5 kg, and any weight change for an exercise with no logged weight
  yet.
- The coaching rules stay conservative. There are no heavy barbell back squats or deadlifts, pulling volume is at
  least twice pushing volume, load drops on whatever loads a painful area when its pain is 5/10 or higher, and red-flag symptoms send you to a doctor or
  physio.
- The coach is told it can't see your form and must never claim it can.

> omaFIT gives training suggestions, not medical advice. If you have pain spreading down a leg, numbness, weakness,
> night pain, or bladder or bowel changes, stop and see a doctor or physiotherapist.

## Getting started

You need Node 20+ and the **Expo Go** app on your phone.

```bash
git clone <this-repo-url> omafit
cd omafit
npm install
npx expo start
```

Scan the QR code with Expo Go (phone and computer on the same Wi-Fi). If that fails, use `npx expo start --tunnel`. To
clear a stale bundle, use `npx expo start -c`.

> **Windows:** keep the project outside OneDrive or other synced folders. File syncing can stop Metro from seeing your
> changes.

### Connect your AI agent

Pick the AI you want under **Settings → AI coach**:

| AI | Get a key | Cost |
| --- | --- | --- |
| **Gemini** (Google) — *recommended to start* | [aistudio.google.com](https://aistudio.google.com/apikey) | **Free tier** with usage limits. On the free tier Google may use what you send, including posture photos, to improve its products |
| **Claude** (Anthropic) | [console.anthropic.com](https://console.anthropic.com/settings/keys) | Paid API, separate from a Claude Pro subscription |
| **ChatGPT** (OpenAI) | [platform.openai.com](https://platform.openai.com/api-keys) | Paid API, separate from a ChatGPT Plus subscription |
| **DeepSeek** | [platform.deepseek.com](https://platform.deepseek.com/api_keys) | Paid API with low prices. DeepSeek stores what you send in China and may use it to improve its models. Only `deepseek-flash` (the default) reads posture photos |

**No paid AI account? Use Gemini.** App subscriptions such as Claude Pro, ChatGPT Plus or Gemini in the Google app can't
power third-party apps; they need a separate API key. Gemini's API key is free:

1. Open [Google AI Studio](https://aistudio.google.com/apikey) and sign in with any Google account.
2. Tap **Create API key**. If it asks for a project, let it create a new one.
3. Copy the key (a long code starting with `AIza`).
4. In omaFIT, go to **Settings → AI coach → Gemini**, paste it, tap **Save key**, then **Test**.

The app shows these same steps under **How to get a free Gemini key**.

1. Choose the AI and tap **Get a key**, or use the links above.
2. Paste the key and tap **Save key**. It's kept in the phone's encrypted secure storage and sent only to that
   provider.
3. Tap **Test** to check it works. **Choose model** lists the models your key can use. The default is a good balance
   of quality and cost.
4. Optionally, fill in **Settings → About you** so the coach can personalise your plan.

You can save keys for several providers and switch between them at any time. The coaching rules, library-only exercise
picks and safety checks are the same whichever AI you use.

The posture routine, workouts, demos, streaks and charts all work without a key. Only **Build my plan**, **Review**
and **Coach** need one.

Each AI request includes the part of the exercise library that fits your equipment, about 14k tokens with the default
kit. All three providers cache repeated prompts, so repeat requests cost less.

### Install it like a normal app (optional)

To use it without Expo Go, build an Android APK in the cloud with [EAS Build](https://expo.dev/eas). You don't need
Android Studio, just a free Expo account:

```bash
npx eas-cli@latest login
npx eas-cli@latest build -p android --profile preview
```

When the build finishes, open the link it prints on your phone, download the APK and install it. The `preview`
profile in `eas.json` builds an installable APK.

## Privacy

- Logs, settings, profile, reviews and chat are stored on the device in AsyncStorage. AI keys are stored in
  expo-secure-store.
- When you run a review, build a plan or chat, your profile, equipment, posture findings, plan and the last 2 weeks of
  logs are sent to the AI provider you chose, and nowhere else. OpenAI requests are sent with storage turned off, and
  Gemini uses Google's stateless endpoint. Each provider's own data policy still applies, including Gemini's free-tier
  note and DeepSeek's note above.
- **Posture photos** are shrunk on your phone and sent only to your AI provider, only when you tap **Analyse**.
  omaFIT doesn't save them to its data. Only the written findings are kept, and those are cleared when you uninstall.
  If you choose photos from your gallery, the originals stay there.
- There is no analytics, no tracking and no account.

## The default plan and equipment

The built-in plan (`src/data/plan.ts`) assumes this home kit: a barbell and bench with a low rack, a leg
extension/curl attachment, adjustable dumbbells, push-up bars, an ab wheel, light and heavy loop bands, a yoga mat and
a posture strap. There's no pull-up bar, cable or machine.

The weekly schedule is strength on Mon/Wed/Fri (alternating Day A and Day B), walks on Tue/Thu, a long walk on Saturday,
rest on Sunday, and the posture routine every day.

If your kit is different, set it under **Settings → Your equipment** and run **Build my plan**. The AI will swap or
remove exercises you can't do, using library exercises that fit.

## Roadmap

- **More AI providers**, such as Mistral, or local models through an OpenAI-compatible server.
- **Equipment from photos.** Photograph your equipment instead of ticking boxes.
- **Schedule builder.** Pick your training days and session length to fit your work week.
- Strength progress charts per lift, and reminders.

Ideas and pull requests are welcome.

## Project structure

| Path | What |
| --- | --- |
| `App.tsx` | Navigation: tabs (Today, Progress, Review, Coach, Settings) and stack (Session, Exercise, PlanBuilder) |
| `src/data/plan.ts` | The baseline plan: exercises, cues, demo ids, video links, walking plan, schedule |
| `src/data/effective.ts` | Plan with approved changes (overrides, removals, AI-added exercises), plus `planAsText()` for the AI context |
| `src/data/library.ts` | Which library exercises the AI may pick: equipment fit, safety bans, push/pull balance |
| `src/data/exerciseIndex.json` | Bundled exercise library (873 exercises, all with demo photos) |
| `src/data/progress.ts` | Streak and daily stats for the Progress tab |
| `src/api/ai/` | AI provider layer: `askAI()`, the `PROVIDERS` registry (labels, default models, key pages) and one adapter each for Claude, OpenAI, Gemini and DeepSeek |
| `src/api/coach.ts` | Profile prompt, coaching rules, weekly review and its `validateChanges` safety checks, coach chat |
| `src/api/planBuilder.ts` | "Build my plan": photo + profile analysis, `validateProposal` safety checks, apply |
| `src/api/demos.ts` | Free demo lookup and search |
| `src/storage/store.ts` | All on-device persistence |
| `src/components/` | Shared UI, demo player, daily chart, brand mark |
| `src/screens/` | One file per screen |
| `scripts/make-icons.js` | Builds all app icons and the in-app logo from `assets/logo.png` (`npm run icons`) |
| `scripts/build-exercise-index.js` | Rebuilds the exercise library from free-exercise-db's `dist/exercises.json` |

## Contributing

Bug reports, ideas and pull requests are welcome. See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full guide. In
short:

1. Fork the repo and create a branch.
2. Run `npm run check` (lint, including security rules, plus type-check) and fix any errors. Then test it on a phone in
   Expo Go. CI runs the same checks on every pull request. Don't work around the lint rules; see the security rules in
   [`CLAUDE.md`](CLAUDE.md).
3. Keep the safety rules intact. Don't loosen `validateChanges` or the conservative coaching rules, and don't apply
   plan changes without the user tapping Apply.
4. Keep it free. Don't add paid APIs, and never commit API keys or `.env` files with secrets.
5. Open a pull request that explains what changed and why.

Contributor guidance for AI coding agents is in [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md).

**Found a security problem?** Please don't open a public issue. Report it privately as described in
[`SECURITY.md`](SECURITY.md).

## Credits

- Exercise photos and index: [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain). Only the
  name index is bundled, and photos load from GitHub.
- Video demos are links to YouTube Shorts by their original creators. They open in YouTube and are not redistributed.
- Built with [Expo](https://expo.dev) and React Native.

## License

[MIT](LICENSE) © 2026 [Akeem Akanni-ola](https://www.akanniola.com)
