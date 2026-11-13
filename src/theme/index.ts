import { StyleSheet } from 'react-native';

export const colors = {
  bg: '#0F1115',
  card: '#191C22',
  cardAlt: '#22262E',
  border: '#2C313A',
  text: '#F2F3F5',
  muted: '#9AA1AC',
  accent: '#F5B82E', // jersey gold
  accentText: '#1A1405',
  purple: '#7B5CD6',
  good: '#3CC18A',
  warn: '#F08A4B',
  danger: '#E5484D',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: 48, gap: space.md },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    gap: space.sm,
  },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.text, fontSize: 19, fontWeight: '700' },
  h3: { color: colors.text, fontSize: 16, fontWeight: '700' },
  body: { color: colors.text, fontSize: 15, lineHeight: 21 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 19 },
  small: { color: colors.muted, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
