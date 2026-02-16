import React, { useState, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { getSettings } from "@/lib/storage";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const RAINY_EMOTIONS = [
  { id: "sad", label: "Sad", icon: "cloud-rain" },
  { id: "anxious", label: "Anxious", icon: "wind" },
  { id: "lonely", label: "Lonely", icon: "user" },
  { id: "stressed", label: "Stressed", icon: "zap" },
  { id: "tired", label: "Tired", icon: "moon" },
  { id: "overwhelmed", label: "Overwhelmed", icon: "layers" },
];

function EmotionButton({
  emotion,
  selected,
  onPress,
  index,
}: {
  emotion: typeof RAINY_EMOTIONS[0];
  selected: boolean;
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
        styles.emotionButton,
        {
          backgroundColor: selected
            ? Colors.light.secondary
            : theme.backgroundDefault,
        },
        animatedStyle,
      ]}
      entering={FadeIn.delay(index * 80).duration(300)}
    >
      <View
        style={[
          styles.emotionIconContainer,
          { backgroundColor: selected ? "#FFFFFF30" : theme.backgroundRoot },
        ]}
      >
        <Feather
          name={emotion.icon as any}
          size={24}
          color={selected ? "#FFFFFF" : theme.textSecondary}
        />
      </View>
      <ThemedText
        style={[
          styles.emotionLabel,
          { color: selected ? "#FFFFFF" : theme.text },
        ]}
      >
        {emotion.label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function RainyDayScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [selectedEmotion, setSelectedEmotion] = useState<string | undefined>();
  const [customEmotion, setCustomEmotion] = useState("");
  const [loading, setLoading] = useState(false);

  const emotion = selectedEmotion || customEmotion.trim();
  const canProceed = emotion.length > 0;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const showNoDepositsAlert = () => {
    if (Platform.OS === "web") {
      window.alert("You currently do not have any happiness reserve. Add a deposit.");
    } else {
      Alert.alert(
        "No Deposits Yet",
        "You currently do not have any happiness reserve. Add a deposit.",
        [
          {
            text: "Add Deposit",
            onPress: () => {
              navigation.dispatch(
                CommonActions.navigate({
                  name: "Main",
                  params: {
                    screen: "DepositTab",
                  },
                })
              );
            },
          },
        ]
      );
    }
  };

  const handleFindJoy = async () => {
    if (!canProceed || loading) return;

    setLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const settings = await getSettings();
      const sessionTarget = settings.rainyDayMomentCount;

      const surfaceResponse = await apiRequest("GET", "/api/deposits/surface");
      const deposit = await surfaceResponse.json();

      if (!deposit) {
        showNoDepositsAlert();
        
        await apiRequest("POST", "/api/rainy-day-logs", {
          emotion,
          depositId: null,
        });
        
        if (Platform.OS === "web") {
          navigation.dispatch(
            CommonActions.navigate({
              name: "Main",
              params: {
                screen: "DepositTab",
              },
            })
          );
        }
        return;
      }

      await apiRequest("PATCH", `/api/deposits/${deposit.id}/surface`);

      const logResponse = await apiRequest("POST", "/api/rainy-day-logs", {
        emotion,
        depositId: deposit.id,
      });
      const log = await logResponse.json();

      const memory = {
        id: deposit.id,
        content: deposit.content,
        emotion: deposit.emotion,
        mediaUri: deposit.mediaUri,
        mediaType: deposit.mediaType,
        createdAt: deposit.createdAt,
        tags: deposit.tags || [],
        lastSurfacedAt: deposit.lastSurfacedAt,
      };

      navigation.navigate("Playback", {
        memory,
        emotion,
        logId: log.id,
        sessionTarget,
        sessionShown: 1,
        sessionThumbsUp: 0,
        excludeIds: [deposit.id],
      });
    } catch (error) {
      console.error("Error finding joy:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

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
            Rainy Day
          </ThemedText>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
            How are you feeling?
          </ThemedText>
          <View style={styles.emotionGrid}>
            {RAINY_EMOTIONS.map((item, index) => (
              <EmotionButton
                key={item.id}
                emotion={item}
                selected={selectedEmotion === item.id}
                onPress={() => {
                  setSelectedEmotion(
                    selectedEmotion === item.id ? undefined : item.id
                  );
                  setCustomEmotion("");
                }}
                index={index}
              />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(200).duration(300)}>
          <TextInput
            value={customEmotion}
            onChangeText={setCustomEmotion}
            placeholder="Or describe how you feel..."
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.customInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
              },
            ]}
          />
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(300)}>
          <Pressable
            onPress={handleFindJoy}
            disabled={!canProceed || loading}
            style={[
              styles.getButton,
              {
                backgroundColor: canProceed
                  ? Colors.light.primary
                  : theme.backgroundDefault,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.getButtonText,
                { color: canProceed ? "#FFFFFF" : theme.textSecondary },
              ]}
            >
              {loading ? "Finding..." : "Find Joy"}
            </ThemedText>
          </Pressable>
        </Animated.View>
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
    textAlign: "center" as const,
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  emotionButton: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  emotionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionLabel: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
    flex: 1,
  },
  customInput: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    marginBottom: Spacing.xl,
  },
  getButton: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  getButtonText: {
    fontSize: 17,
  },
});
