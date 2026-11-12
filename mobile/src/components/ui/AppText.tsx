import { Text, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

export type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export function AppText({
  variant = 'body',
  color = colors.text,
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[typography[variant], { color }, align ? { textAlign: align } : null, style]}
    />
  );
}
