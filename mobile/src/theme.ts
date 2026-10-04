import { Platform, StyleSheet } from 'react-native';

export const colors = {
  background: '#f5f8f3', paper: '#fcfdfb', white: '#ffffff', ink: '#173d3b',
  teal: '#087f70', forest: '#173f38', mint: '#eaf3e7', lime: '#c5dda9',
  muted: '#75867a', line: '#dce6da', danger: '#b13f4f', dangerBg: '#fff0f1', amber: '#927039',
};
export const serif = Platform.OS === 'ios' ? 'Georgia' : 'serif';
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, gap: 18, width: '100%', maxWidth: 660, alignSelf: 'center', paddingBottom: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontSize: 29, fontWeight: '600', color: colors.ink, letterSpacing: -1, lineHeight: 35 },
  heading: { fontSize: 20, fontWeight: '600', color: colors.ink, letterSpacing: -.4 },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  caption: { fontSize: 11, lineHeight: 17, color: colors.muted },
  kicker: { fontSize: 10, letterSpacing: 1.4, fontWeight: '600', color: colors.teal },
  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 19, gap: 13 },
  separator: { height: 1, backgroundColor: colors.line, marginVertical: 4 },
});
