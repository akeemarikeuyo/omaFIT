// ESLint config for omaFIT. Run: npm run lint
//
// Besides normal code quality, these rules guard users' safety and privacy in an open-source app:
// network calls, storage, external links and camera/photo access are only allowed in the files that own them,
// and code can't contain secrets, eval, tracking SDKs or web addresses outside the allowlist.
// Changing these rules needs the maintainer's approval in the pull request.
const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// ---------- what each rule protects ----------

/** The only places the app may talk to or link to. */
const ALLOWED_URLS = [
  // AI providers the user can choose (API + "get a key" pages). Add new providers here deliberately.
  'https://api.anthropic.com/',
  'https://console.anthropic.com/',
  'https://api.openai.com/',
  'https://platform.openai.com/',
  'https://generativelanguage.googleapis.com/',
  'https://aistudio.google.com/',
  'https://api.deepseek.com/',
  'https://platform.deepseek.com/',
  // Free exercise demos
  'https://raw.githubusercontent.com/yuhonas/free-exercise-db/',
  'https://github.com/yuhonas/free-exercise-db',
  'https://www.youtube.com/',
  'https://docs.expo.dev/',
  'https://expo.dev',
  'https://www.akanniola.com',
];
// Regex source for the selector engine: escape dots and slashes
const ALLOWED_URL = `^(${ALLOWED_URLS.map(u => u.replace(/[.]/g, '\\.').replace(/\//g, '\\/')).join('|')})`;

const SECRET_PATTERNS = [
  'sk-ant-[A-Za-z0-9_-]{10,}', // Anthropic keys
  'sk-[A-Za-z0-9]{32,}', // OpenAI-style keys
  'AKIA[0-9A-Z]{16}', // AWS access keys
  'AIza[0-9A-Za-z_-]{35}', // Google API keys
  'gh[pousr]_[A-Za-z0-9]{30,}', // GitHub tokens
  'xox[abpr]-[A-Za-z0-9-]{10,}', // Slack tokens
  '-----BEGIN [A-Z ]*PRIVATE KEY-----',
];

const restrictedSyntax = [
  ...SECRET_PATTERNS.flatMap(p => [
    { selector: `Literal[value=/${p}/]`, message: 'Looks like a secret or API key. Keys belong only in secure storage via Settings.' },
    { selector: `TemplateElement[value.raw=/${p}/]`, message: 'Looks like a secret or API key. Keys belong only in secure storage via Settings.' },
  ]),
  {
    selector: `Literal[value=/^(https?|wss?|ftp):\\/\\//]:not([value=/${ALLOWED_URL}/])`,
    message: 'Web address not on the allowlist in eslint.config.js. New hosts need the maintainer’s approval in the pull request.',
  },
  {
    selector: `TemplateElement[value.raw=/^(https?|wss?|ftp):\\/\\//]:not([value.raw=/${ALLOWED_URL}/])`,
    message: 'Web address not on the allowlist in eslint.config.js. New hosts need the maintainer’s approval in the pull request.',
  },
  { selector: "CallExpression[callee.name='atob']", message: 'No decoding hidden strings. Write code in plain text.' },
  {
    selector: "CallExpression[callee.object.name='String'][callee.property.name='fromCharCode']",
    message: 'No building strings from character codes. Write code in plain text.',
  },
  { selector: "ImportExpression", message: 'No dynamic import(). Import modules statically at the top of the file.' },
];

// Packages nobody may add without the maintainer: tracking, remote code, extra device access, other HTTP clients.
const BANNED_PACKAGES = [
  { name: 'axios', message: 'Use fetch in src/api/ only.' },
  { name: 'node-fetch', message: 'Use fetch in src/api/ only.' },
  { name: 'react-native-webview', message: 'Web views can load remote code. Ask the maintainer first.' },
  { name: 'expo-web-browser', message: 'Opening web pages needs the maintainer’s approval.' },
  { name: 'expo-updates', message: 'Over-the-air updates need the maintainer’s approval.' },
  { name: 'expo-file-system', message: 'File access needs the maintainer’s approval.' },
  { name: 'expo-media-library', message: 'Photo library write access is not allowed. Use expo-image-picker.' },
  { name: 'expo-camera', message: 'Use expo-image-picker in PlanBuilderScreen.' },
  { name: 'expo-location', message: 'Location access is not part of omaFIT.' },
  { name: 'expo-contacts', message: 'Contacts access is not part of omaFIT.' },
  { name: 'expo-clipboard', message: 'Clipboard access needs the maintainer’s approval.' },
  { name: 'expo-sensors', message: 'Sensor access needs the maintainer’s approval.' },
  { name: 'expo-device', message: 'Device fingerprinting is not allowed.' },
  { name: 'expo-application', message: 'Device/app identifiers are not allowed.' },
  { name: 'expo-tracking-transparency', message: 'No tracking in omaFIT.' },
];
const BANNED_PATTERNS = [
  { group: ['*analytics*', '@segment/*', 'mixpanel*', 'amplitude*', '@amplitude/*', 'posthog*'], message: 'No analytics or tracking in omaFIT.' },
  { group: ['@sentry/*', 'sentry-*', 'bugsnag*', '@bugsnag/*', 'firebase', 'firebase/*', '@react-native-firebase/*'], message: 'No third-party data collection in omaFIT.' },
  { group: ['react-native-google-mobile-ads', '*admob*', '@react-native-admob/*'], message: 'No ads in omaFIT.' },
];

// Packages allowed only in the file that owns them.
const OWNED = {
  storage: {
    files: ['src/storage/store.ts'],
    paths: [
      { name: '@react-native-async-storage/async-storage', message: 'All storage goes through src/storage/store.ts.' },
      { name: 'expo-secure-store', message: 'Keys are read and written only in src/storage/store.ts.' },
    ],
  },
  photos: {
    files: ['src/screens/PlanBuilderScreen.tsx'],
    paths: [
      { name: 'expo-image-picker', message: 'Photo access is only for the posture check in PlanBuilderScreen.' },
      { name: 'expo-image-manipulator', message: 'Photo processing is only for the posture check in PlanBuilderScreen.' },
    ],
  },
  // Approved by the maintainer for one use: a local "rest over" alert during a workout. No push notifications.
  restAlert: {
    files: ['src/session/restAlert.ts'],
    paths: [
      { name: 'expo-notifications', message: 'Notifications are only for the local rest-timer alert in src/session/restAlert.ts.' },
    ],
  },
};

const restrictedImports = (except = []) => [
  'error',
  {
    paths: [
      ...BANNED_PACKAGES,
      ...Object.entries(OWNED)
        .filter(([k]) => !except.includes(k))
        .flatMap(([, v]) => v.paths),
    ],
    patterns: BANNED_PATTERNS,
  },
];

const NETWORK_GLOBALS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map(name => ({
  name,
  message: 'Network calls live only in src/api/. See CLAUDE.md.',
}));

// ExerciseScreen opens YouTube demos; AISettings opens the provider's "get an API key" page (fixed URLs).
const LINK_FILES = ['src/screens/ExerciseScreen.tsx', 'src/components/AISettings.tsx'];
const OPEN_URL = {
  object: 'Linking',
  property: 'openURL',
  message: 'Opening links is only allowed in ExerciseScreen (YouTube demos) and AISettings (API key pages).',
};

// ---------- config ----------

module.exports = defineConfig([
  globalIgnores(['dist/*', '.expo/*', 'node_modules/*', 'android/*', 'ios/*', 'src/data/exerciseIndex.json']),
  expoConfig,
  {
    // No `eslint-disable` comments: exceptions go in this file, where review sees them.
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    rules: {
      // Code that runs strings as code
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      // Logs can leak keys and health data
      'no-console': ['error', { allow: ['warn', 'error'] }],
      // Web-only rule: React Native renders apostrophes in text as-is
      'react/no-unescaped-entities': 'off',
      'no-restricted-syntax': ['error', ...restrictedSyntax],
      'no-restricted-globals': ['error', ...NETWORK_GLOBALS],
      'no-restricted-imports': restrictedImports(),
      'no-restricted-properties': ['error', OPEN_URL],
    },
  },
  // Owners: each exception is as narrow as possible.
  { files: ['src/api/**'], rules: { 'no-restricted-globals': 'off' } },
  { files: OWNED.storage.files, rules: { 'no-restricted-imports': restrictedImports(['storage']) } },
  { files: OWNED.photos.files, rules: { 'no-restricted-imports': restrictedImports(['photos']) } },
  { files: OWNED.restAlert.files, rules: { 'no-restricted-imports': restrictedImports(['restAlert']) } },
  { files: LINK_FILES, rules: { 'no-restricted-properties': 'off' } },
  // Build scripts run on the maintainer's machine: plain Node, no network.
  {
    files: ['scripts/**/*.js', 'eslint.config.js'],
    languageOptions: { sourceType: 'commonjs', globals: { require: 'readonly', module: 'writable', process: 'readonly', __dirname: 'readonly', console: 'readonly', Buffer: 'readonly' } },
    rules: { 'no-console': ['error', { allow: ['warn', 'error'] }] },
  },
]);
