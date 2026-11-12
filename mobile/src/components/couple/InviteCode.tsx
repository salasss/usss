import { StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { colors, fonts, radii, spacing } from '@/theme';

export const CODE_LENGTH = 8;

/** Keeps letters and digits, uppercase, at most 8 characters. */
export function cleanCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, CODE_LENGTH);
}

export function formatCode(code: string): string {
  return code.length > 4 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** The code shared with the partner, as two groups of four tiles. */
export function CodeDisplay({ code }: { code: string }) {
  const groups = [code.slice(0, 4), code.slice(4, 8)];
  return (
    <View style={styles.display} accessibilityLabel={`Code ${code.split('').join(' ')}`}>
      {groups.map((group, index) => (
        <View key={index} style={styles.group}>
          {group.split('').map((char, i) => (
            <View key={i} style={styles.tile}>
              <AppText variant="subtitle" color={colors.textOnCream} style={styles.char}>
                {char}
              </AppText>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

type CodeInputProps = {
  value: string;
  onChange: (code: string) => void;
  onSubmit?: () => void;
};

/** Input formatting the code as XXXX-XXXX while typing. */
export function CodeInput({ value, onChange, onSubmit }: CodeInputProps) {
  return (
    <TextInput
      value={formatCode(value)}
      onChangeText={(text) => onChange(cleanCode(text))}
      onSubmitEditing={onSubmit}
      placeholder="XXXX-XXXX"
      placeholderTextColor={colors.textMuted}
      autoCapitalize="characters"
      autoCorrect={false}
      autoComplete="off"
      maxLength={CODE_LENGTH + 1}
      returnKeyType="go"
      style={styles.input}
      accessibilityLabel="Code d'invitation"
    />
  );
}

/** Characters the codes never use, so they cannot be confused. */
export function hasLookAlikes(code: string): boolean {
  return /[01IO]/.test(code);
}

const styles = StyleSheet.create({
  display: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
  },
  group: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  tile: {
    width: 34,
    height: 44,
    borderRadius: radii.sm,
    backgroundColor: colors.creamDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: {
    fontSize: 22,
  },
  input: {
    height: 58,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.cream,
    fontFamily: fonts.display,
    fontWeight: '700',
    fontSize: 24,
    letterSpacing: 4,
    textAlign: 'center',
  },
});
