import { StyleSheet } from 'react-native';

export const colors = {
  background: '#eef8f7', paper: '#ffffff', white: '#ffffff', ink: '#1b2735',
  teal: '#087f75', turquoise: '#12b5a6', field: '#f1f5f7', forest: '#123e3a', mint: '#d8f5ef', lime: '#afeade',
  muted: '#748391', line: '#e2eaee', danger: '#b13f4f', dangerBg: '#fff0f1', amber: '#927039',
};
export const serif = 'JakartaRegular';
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, gap: 18, width: '100%', maxWidth: 660, alignSelf: 'center', paddingBottom: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 29, fontWeight: '700', color: colors.ink, letterSpacing: -1, lineHeight: 35 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.ink, letterSpacing: -.4 },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  caption: { fontSize: 11, lineHeight: 17, color: colors.muted },
  kicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: '700', color: colors.teal },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 19, gap: 13 },
  separator: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
