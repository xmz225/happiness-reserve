import React, { useState, useCallback, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { getSettings, saveSettings, UserSettings } from "@/lib/storage";

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.settingRow,
        { backgroundColor: theme.backgroundDefault, opacity: pressed && onPress ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.settingIcon, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name={icon as any} size={20} color={Colors.light.primary} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
        {value ? (
          <ThemedText style={[styles.settingValue, { color: theme.textSecondary }]}>
            {value}
          </ThemedText>
        ) : null}
      </View>
      {onPress ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

function SettingToggle({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: string;
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.settingRow, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.settingIcon, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name={icon as any} size={20} color={Colors.light.primary} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{label}</ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={(val) => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onValueChange(val);
        }}
        trackColor={{ false: theme.border, true: Colors.light.primary }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  const [showMomentCountPicker, setShowMomentCountPicker] = useState(false);

  const MOMENT_COUNT_OPTIONS = [
    { count: 1, label: "1 moment" },
    { count: 2, label: "2 moments" },
    { count: 3, label: "3 moments" },
    { count: 5, label: "5 moments" },
  ];

  const FREQUENCY_OPTIONS = [
    { weeks: 1, label: "Weekly" },
    { weeks: 2, label: "Every 2 weeks" },
    { weeks: 4, label: "Monthly" },
    { weeks: 8, label: "Every 2 months" },
    { weeks: 13, label: "Quarterly" },
  ];

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadSettings = useCallback(async () => {
    const data = await getSettings();
    setSettings(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
    }, [loadSettings])
  );

  const handleUpdateSetting = async (key: keyof UserSettings, value: any) => {
    if (!settings) return;
    const updated = await saveSettings({ [key]: value });
    setSettings(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (!settings) return null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 48,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <ThemedText style={[styles.title, { fontFamily: "Nunito_700Bold" }]}>
            Settings
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { fontFamily: "Nunito_600SemiBold" }]}>
            Preferences
          </ThemedText>
          <View style={styles.section}>
            <SettingRow
              icon="clock"
              label="Resurface Interval"
              value={`${settings.resurfaceIntervalDays} days`}
            />
            <SettingToggle
              icon="bell"
              label="Daily Reminder"
              value={settings.dailyBoostReminder}
              onValueChange={(val) => handleUpdateSetting("dailyBoostReminder", val)}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { fontFamily: "Nunito_600SemiBold" }]}>
            Rainy Day
          </ThemedText>
          <View style={styles.section}>
            <SettingRow
              icon="cloud-rain"
              label="Moments to Surface"
              value={MOMENT_COUNT_OPTIONS.find(o => o.count === settings.rainyDayMomentCount)?.label || `${settings.rainyDayMomentCount} moment${settings.rainyDayMomentCount === 1 ? "" : "s"}`}
              onPress={() => setShowMomentCountPicker(true)}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(250).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { fontFamily: "Nunito_600SemiBold" }]}>
            Circle
          </ThemedText>
          <View style={styles.section}>
            <SettingRow
              icon="users"
              label="Joy Summary Frequency"
              value={FREQUENCY_OPTIONS.find(o => o.weeks === settings.summaryFrequencyWeeks)?.label || "Every 2 weeks"}
              onPress={() => setShowFrequencyPicker(true)}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { fontFamily: "Nunito_600SemiBold" }]}>
            About
          </ThemedText>
          <View style={styles.section}>
            <SettingRow
              icon="info"
              label="Version"
              value="1.0.0"
            />
            <SettingRow
              icon="heart"
              label="Made with love"
              value="Happiness Reserve"
            />
          </View>
        </Animated.View>
      </ScrollView>

      <Modal
        visible={showFrequencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFrequencyPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFrequencyPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_600SemiBold" }]}>
              Joy Summary Frequency
            </ThemedText>
            <ThemedText style={[styles.modalDescription, { color: theme.textSecondary }]}>
              How often would you like to receive summaries about how your shared moments helped your Circle?
            </ThemedText>
            {FREQUENCY_OPTIONS.map((option) => (
              <Pressable
                key={option.weeks}
                onPress={() => {
                  handleUpdateSetting("summaryFrequencyWeeks", option.weeks);
                  setShowFrequencyPicker(false);
                }}
                style={[
                  styles.frequencyOption,
                  {
                    backgroundColor:
                      settings.summaryFrequencyWeeks === option.weeks
                        ? Colors.light.primary + "15"
                        : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.frequencyLabel,
                    {
                      color:
                        settings.summaryFrequencyWeeks === option.weeks
                          ? Colors.light.primary
                          : theme.text,
                    },
                  ]}
                >
                  {option.label}
                </ThemedText>
                {settings.summaryFrequencyWeeks === option.weeks ? (
                  <Feather name="check" size={20} color={Colors.light.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <Modal
        visible={showMomentCountPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMomentCountPicker(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowMomentCountPicker(false)}
        >
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_600SemiBold" }]}>
              Moments to Surface
            </ThemedText>
            <ThemedText style={[styles.modalDescription, { color: theme.textSecondary }]}>
              How many moments would you like to see on a rainy day? The app will keep going until at least one feels helpful.
            </ThemedText>
            {MOMENT_COUNT_OPTIONS.map((option) => (
              <Pressable
                key={option.count}
                onPress={() => {
                  handleUpdateSetting("rainyDayMomentCount", option.count);
                  setShowMomentCountPicker(false);
                }}
                style={[
                  styles.frequencyOption,
                  {
                    backgroundColor:
                      settings.rainyDayMomentCount === option.count
                        ? Colors.light.primary + "15"
                        : theme.backgroundDefault,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.frequencyLabel,
                    {
                      color:
                        settings.rainyDayMomentCount === option.count
                          ? Colors.light.primary
                          : theme.text,
                    },
                  ]}
                >
                  {option.label}
                </ThemedText>
                {settings.rainyDayMomentCount === option.count ? (
                  <Feather name="check" size={20} color={Colors.light.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  title: {
    fontSize: 24,
    textAlign: "center" as const,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: 15,
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  section: {
    gap: Spacing.sm,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
  },
  settingValue: {
    fontSize: 14,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  frequencyOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  frequencyLabel: {
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
  },
});
