# Security policy

omaFIT keeps people's AI API keys, health notes and posture-check data on their phones. If you find a way that could
be exposed or misused, please tell us privately so it can be fixed before anyone else learns about it.

## Reporting a vulnerability

**Please don't open a public issue, discussion or pull request for security problems.**

Report it privately through GitHub:

1. Go to this repository's **Security** tab.
2. Click **Report a vulnerability**.
3. Fill in the form and submit. Only the maintainer can see it.

It helps if you include:

- what the problem is and what an attacker could do with it
- steps to reproduce, or a small proof of concept
- the app version or commit, and the device and OS you tested on
- any idea for a fix (optional)

Please don't include real API keys, photos or personal data in the report. Use test data.

## What to expect

- You'll get a reply within **7 days** confirming the report was received.
- We'll work with you on the fix and keep you updated. We aim to fix serious issues within **30 days**.
- When the fix is released, we'll publish a GitHub security advisory and credit you, unless you'd rather stay
  anonymous.

Please give us a reasonable chance to fix the problem before sharing it publicly. omaFIT is a free, volunteer-run
project, so there's no bug bounty, but every report is appreciated.

## Supported versions

Fixes go into the latest version on the `main` branch. Please check that the problem still exists there before
reporting.

## In scope

- A user's AI API key being exposed, logged or sent anywhere except their AI provider
- Profile, logs, health notes or posture photos leaving the phone without the user's action, or being stored when
  they shouldn't be
- Code or dependencies in this repository that are malicious, or that load and run remote code
- Ways to bypass the app's safety checks on AI suggestions (for example, unsafe weight jumps or exercises from outside
  the bundled library being applied)
- Weaknesses in this repository's GitHub Actions setup

## Out of scope

- Problems in third-party services or libraries themselves (the Anthropic, OpenAI, Google Gemini or DeepSeek APIs, Expo,
  React Native, GitHub, YouTube).
  Please report those to their owners. Tell us if omaFIT uses them in an unsafe way.
- Attacks that need an already compromised or rooted phone, or physical access to an unlocked phone
- The AI giving a poor training suggestion that the app's safety checks still caught. That's a normal bug, so open a
  regular issue.
- Content of the free exercise demo photos or linked YouTube videos

## Safe testing

Test only with your own device, your own API key and your own data. Don't access other people's data, run
denial-of-service tests, or use social engineering. If you act in good faith and follow this policy, we won't take
action against you.

---

Maintained by [Akeem Akanni-ola](https://www.akanniola.com).
