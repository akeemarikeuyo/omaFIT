# Contributing to omaFIT

Thanks for helping. omaFIT is a free, open-source posture and home-workout app for people who sit for long hours.
It has no backend and no accounts. Data stays on the phone and goes only to the AI provider the user chooses.

## Reporting bugs and ideas

- **Bugs:** open an issue with the **Bug report** form.
- **Ideas:** open an issue with the **Feature request** form. For anything big, please ask first before you start
  building it.
- **Security problems:** don't open an issue. Report them privately, as described in [SECURITY.md](SECURITY.md).

Issues are public. Don't paste API keys, posture photos, health notes or other personal data.

## Getting set up

You need Node.js 22 and the Expo Go app on your phone.

```sh
npm ci
npx expo start        # add --tunnel if your phone can't connect, -c to clear the cache
```

Scan the QR code with Expo Go. To try the AI features, add your own API key in Settings. Gemini has a free tier.

Keep the project outside OneDrive or other synced folders, because syncing breaks Metro's file watcher.

## Making a change

1. Fork the repo and create a branch from `main`.
2. Make your change. [CLAUDE.md](CLAUDE.md) explains the code layout, conventions and rules in detail.
3. Run `npm run check` (lint, including the security rules, plus type-check) and fix every error.
4. Test it on a phone in Expo Go. There are no automated tests yet. To test strength screens on any day, use
   **Start a new session** on the Today tab.
5. Open a pull request and fill in the template.

CI runs the same checks on every pull request, and the maintainer reviews each one.

## Rules that every change must keep

These are what reviews check first. The full list is in [CLAUDE.md](CLAUDE.md).

- **Safety:** don't loosen `validateChanges`, `validateProposal`, `rejectReason`, `COACHING_RULES` or the red-flag
  text. AI suggestions change the plan only when the user taps Apply, and "Reset plan" must keep working.
- **The AI picks only from the bundled exercise library.** Never accept free-text exercises from the AI.
- **AI output is untrusted.** Never run it, build URLs from it, or apply it without the validators.
- **Privacy:** no analytics, tracking, ads, crash reporters or backend. Send data only to the user's chosen AI
  provider, and tell the user in the UI when you do. Posture photos are never stored.
- **Keys:** API keys live only in secure storage. Never commit keys or `.env` files, and never log keys, health data,
  photos or prompts.
- **Network and storage:** `fetch` only in `src/api/`; storage only in `src/storage/store.ts`. Every web address must
  be on the allowed list in `eslint.config.js`.
- **No remote or hidden code:** no `eval`, dynamic `import()`, web views, obfuscated code or over-the-air updates.
- **Free only:** no paid APIs or services.
- **No personal data in code.** Refer to "the user" or "you", and use they/them.

Don't work around a lint rule, and don't add `eslint-disable` comments (they're switched off). If a rule blocks
something that's really needed, explain it in the pull request and change `eslint.config.js` in its own commit.

## Dependencies

Add a package only when it's really needed, from a well-known maintainer, using `npx expo install <package>`. Explain
it in the pull request. Don't hand-edit `package-lock.json`, and don't add `postinstall` or `prepare` scripts.

## Extra review

Changes to `.github/`, `eslint.config.js`, `scripts/`, `app.json` permissions or plugins, and `package.json` scripts
get extra review. So do changes to the safety checks, the AI provider layer and storage. Please explain why they're
needed.

## Style

- Functional components and hooks. Use `colors`, `space` and `ui` from `src/theme`, and reuse `Button`, `ScalePicker`,
  `Pill` and `Brand`.
- Don't rename plan exercise ids, because logs refer to them. Add a new id instead.
- Keep UI text short and plain. Units are kg and minutes. The name is written **omaFIT**.

## License

By contributing, you agree that your work is released under the [MIT License](LICENSE).
