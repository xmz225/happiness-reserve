import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { Memory } from "@/lib/storage";
import { getApiUrl } from "@/lib/query-client";
import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type NavigationProp = CompositeNavigationProp<
  NativeStackNavigationProp<RootStackParamList>,
  BottomTabNavigationProp<MainTabParamList>
>;

function QuickActionButton({
  icon,
  label,
  onPress,
  index,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      }}
      style={[
        styles.quickAction,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
      entering={FadeIn.delay(index * 100).duration(300)}
    >
      <Feather name={icon as any} size={18} color={theme.text} />
      <ThemedText style={styles.quickActionLabel}>{label}</ThemedText>
    </AnimatedPressable>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadMemories = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(new URL("/api/deposits", baseUrl).toString());
      if (response.ok) {
        const data = await response.json();
        setMemories(data);
      }
    } catch (error) {
      console.error("Error loading memories:", error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMemories();
    }, [loadMemories])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadMemories();
    setRefreshing(false);
  }, [loadMemories]);

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
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.light.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeIn.duration(400)}>
          <ThemedText style={[styles.title, { fontFamily: "Nunito_700Bold" }]}>
            Happiness Reserve
          </ThemedText>
        </Animated.View>

        <Animated.View
          style={[styles.balanceCard, { backgroundColor: theme.backgroundDefault }]}
          entering={FadeIn.delay(100).duration(400)}
        >
          <ThemedText style={[styles.balanceNumber, { fontFamily: "Nunito_700Bold" }]}>
            {memories.filter((m: any) => m.status === 0).length}
          </ThemedText>
          <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
            Reserve Balance
          </ThemedText>
        </Animated.View>

        <View style={styles.quickActionsContainer}>
          <QuickActionButton
            icon="plus"
            label="Deposit"
            onPress={() => navigation.navigate("DepositTab")}
            index={0}
          />
          <QuickActionButton
            icon="cloud-rain"
            label="Rainy Day"
            onPress={() => navigation.navigate("RainyTab")}
            index={1}
          />
          <QuickActionButton
            icon="clock"
            label="History"
            onPress={() => navigation.navigate("HistoryTab")}
            index={2}
          />
        </View>
      </ScrollView>
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
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  balanceCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  balanceNumber: {
    fontSize: 64,
    lineHeight: 72,
  },
  balanceLabel: {
    fontSize: 15,
    marginTop: Spacing.xs,
  },
  quickActionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  quickAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  quickActionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
  },
});
