## What changed and why

<!-- A short description. Link the issue it fixes, e.g. "Fixes #12". -->

## How you tested it

<!-- e.g. "Ran npm run check, then did a Day A session in Expo Go on Android 16." -->

## Checklist

- [ ] `npm run check` passes (lint + type-check)
- [ ] Tested on a phone in Expo Go
- [ ] No API keys, `.env` files, personal data or real photos in the code, screenshots or this description
- [ ] No lint rules worked around, and no `eslint-disable` comments
- [ ] Safety checks are unchanged (`validateChanges`, `validateProposal`, `rejectReason`, `COACHING_RULES`, the
      Apply step), or the reason for changing them is explained below
- [ ] Data is sent only to the user's chosen AI provider, and the UI says when it is

## Only if relevant

- **New package:** what it is, why it's needed, who maintains it. Added with `npx expo install`.
- **Changes to `.github/`, `eslint.config.js`, `scripts/`, `app.json` permissions or plugins, or `package.json`
  scripts:** explain why. These get extra review.
- **Changed a stored data shape:** how existing users' data is kept or migrated.
- **UI change:** a screenshot or short video.
