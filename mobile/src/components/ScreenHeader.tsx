import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme/useTheme';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface HeaderAction {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}

interface ScreenHeaderProps {
  /** Freccia + label, torna indietro (router.back() di default). Pattern più comune. */
  back?: HeaderAction;
  /** Testo semplice a sinistra senza freccia, per header stile "Annulla / Titolo / Salva". */
  left?: HeaderAction;
  /** Titolo centrato, opzionale insieme a `back` o `left`. */
  title?: string;
  /** Azione secondaria a destra (es. "Modifica", "Salva"). */
  right?: HeaderAction;
}

/**
 * Header di navigazione condiviso: prima ogni schermata (add-plant, edit-plant,
 * plant/[id], vase/[id], vase/pair, change-email, change-password, reset-password,
 * plant-history) ricostruiva la stessa barra a mano, con piccole differenze non
 * volute in padding/tap target. Copre i 3 pattern realmente in uso in app:
 * solo back, back + azione a destra, "Annulla / Titolo / Salva".
 */
export function ScreenHeader({ back, left, title, right }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.nav}>
      <View style={styles.side}>
        {back && (
          <Pressable
            onPress={back.onPress ?? (() => router.back())}
            style={styles.backBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={back.label}
          >
            <Svg width={9} height={15} viewBox="0 0 9 15" fill="none">
              <Path d="M8 1L1.5 7.5L8 14" stroke={theme.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={[styles.backText, { color: theme.primary }]}>{back.label}</Text>
          </Pressable>
        )}
        {left && (
          <Pressable
            onPress={left.onPress ?? (() => router.back())}
            style={styles.plainBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={left.label}
          >
            <Text style={[styles.plainText, { color: theme.onSurfaceVariant }]}>{left.label}</Text>
          </Pressable>
        )}
      </View>

      {title && (
        <Text style={[styles.title, { color: theme.onSurface }]} numberOfLines={1}>
          {title}
        </Text>
      )}

      <View style={[styles.side, styles.sideRight]}>
        {right && (
          <Pressable
            onPress={right.onPress}
            disabled={right.disabled}
            style={styles.plainBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={right.label}
            accessibilityState={{ disabled: right.disabled }}
          >
            <Text style={[styles.plainText, { color: right.disabled ? theme.onSurfaceVariant : theme.primary }]}>
              {right.label}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md16,
    paddingTop: spacing.sm12 + 2,
    paddingBottom: spacing.xs8,
  },
  side: { minWidth: 60, justifyContent: 'center' },
  sideRight: { alignItems: 'flex-end' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs4 - 1, alignSelf: 'flex-start', minHeight: 44 },
  backText: { ...typography.bodyLarge },
  plainBtn: { minHeight: 44, justifyContent: 'center' },
  plainText: { ...typography.bodyLarge },
  title: { ...typography.titleMedium, flex: 1, textAlign: 'center' },
});
