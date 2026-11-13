# AGENTS.md — omaFIT

Guidance for AI coding agents (Claude Code, Codex, Cursor, etc.) working on this repo.

**omaFIT** is a free, open-source Expo/React Native app that helps developers and other people who sit all day get
their posture back and follow a home workout routine that fits their schedule. Users bring their own AI agent API key,
entered in Settings, to personalise their plan. No backend and no accounts: data stays on the device and goes only to
the user's own AI provider.

**Read [`CLAUDE.md`](CLAUDE.md) first.** It has the project layout, conventions and the safety and privacy rules every
change must keep:
- the `validateChanges` and `validateProposal` safety checks
- the AI only picks exercises from the bundled library (`rejectReason` in `src/data/library.ts`)
- posture photos are never stored by the app
- plan changes apply only after the user taps Apply
- conservative coaching rules
- no personal data in code
- keys only in secure storage
- free services only

Prioritise mobile-first patterns, performance and cross-platform (iOS + Android) compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing
any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json` (currently SDK 58).
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM
   misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn add — resolves SDK-compatible versions
npx expo start              # start the dev server (-c to clear cache, --tunnel if the phone can't connect)
npm run check               # lint (incl. security rules) + typecheck — run before declaring any task done
npm run lint                # expo lint with eslint.config.js; don't work around its security rules
npm run icons               # regenerate app icons
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

## Navigation

This app uses **React Navigation 7** (native stack + bottom tabs), configured in `App.tsx`, with types in
`src/navigation.ts`. It does **not** use Expo Router, so don't add a `src/app/` routes folder. To add a screen, create it
in `src/screens/`, register it in `App.tsx` and add its params to `src/navigation.ts`.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates
(`eas update`). No local Xcode or Android Studio is required. Run EAS CLI as `npx eas-cli@latest <command>`.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or
  edit them by hand. Configure native behaviour in `app.json` and config plugins.
- The app must keep running in **Expo Go**. Expo Go only includes its bundled native modules, so prefer bundled Expo
  modules and ask the maintainer before adding a library that needs a development build.
- Don't add paid services, analytics or a backend without asking.
- Develop outside OneDrive or other synced folders. Syncing breaks Metro's file watcher.
