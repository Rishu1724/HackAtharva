import React, { useContext, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Chip, IconButton, Menu, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { LanguageContext } from '../contexts/LanguageContext';

const LANGUAGE_OPTIONS = [
  { code: 'en', labelKey: 'language.english' },
  { code: 'hi', labelKey: 'language.hindi' },
  { code: 'kn', labelKey: 'language.kannada' },
];

export default function LanguageSwitcher({ compact = false }) {
  const { language, setLanguage } = useContext(LanguageContext);
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);

  const updateLanguage = (code) => {
    setLanguage(code);
    setMenuVisible(false);
  };

  if (compact) {
    return (
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <IconButton
            icon="translate"
            size={22}
            accessibilityHint={t('language.label')}
            onPress={() => setMenuVisible(true)}
          />
        }
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <Menu.Item
            key={option.code}
            onPress={() => updateLanguage(option.code)}
            title={`${t(option.labelKey)}${language === option.code ? ' ✓' : ''}`}
          />
        ))}
      </Menu>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{t('language.label')}</Text>
      {LANGUAGE_OPTIONS.map((option) => (
        <Chip
          key={option.code}
          selected={language === option.code}
          onPress={() => updateLanguage(option.code)}
          style={styles.chip}
        >
          {t(option.labelKey)}
        </Chip>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginRight: 8,
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
  },
});
