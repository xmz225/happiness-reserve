import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Platform,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { formatDate } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";

export default function PlaybackScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Playback">>();
  const { memory, emotion, logId, sessionTarget, sessionShown, sessionThumbsUp, excludeIds } = route.params;

  const [rating, setRating] = useState<2 | 1 | -1 | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const currentThumbsUp = sessionThumbsUp + (rating !== null && rating > 0 ? 1 : 0);
  const sessionComplete = sessionShown >= sessionTarget && currentThumbsUp > 0;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const advanceOrExit = async (updatedThumbsUp: number) => {
    const isComplete = sessionShown >= sessionTarget && updatedThumbsUp > 0;
    if (isComplete) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.goBack();
      return;
    }

    setTransitioning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const newExcludeIds = [...excludeIds, memory.id];
      const excludeParam = newExcludeIds.join(",");
      const surfaceResponse = await apiRequest("GET", `/api/deposits/surface?exclude=${excludeParam}`);
      const deposit = await surfaceResponse.json();

      if (!deposit) {
        navigation.goBack();
        return;
      }

      await apiRequest("PATCH", `/api/deposits/${deposit.id}/surface`);

      const logResponse = await apiRequest("POST", "/api/rainy-day-logs", {
        emotion,
        depositId: deposit.id,
      });
      const log = await logResponse.json();

      const nextMemory = {
        id: deposit.id,
        content: deposit.content,
        emotion: deposit.emotion,
        mediaUri: deposit.mediaUri,
        mediaType: deposit.mediaType,
        createdAt: deposit.createdAt,
        tags: deposit.tags || [],
        lastSurfacedAt: deposit.lastSurfacedAt,
      };

      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            { name: "Main" },
            {
              name: "Playback",
              params: {
                memory: nextMemory,
                emotion,
                logId: log.id,
                sessionTarget,
                sessionShown: sessionShown + 1,
                sessionThumbsUp: updatedThumbsUp,
                excludeIds: newExcludeIds,
              },
            },
          ],
        })
      );
    } catch (error) {
      console.error("Error loading next memory:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      navigation.goBack();
    } finally {
      setTransitioning(false);
    }
  };

  const handleRating = async (value: 2 | 1 | -1) => {
    setRating(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (logId) {
      try {
        await apiRequest("PATCH", `/api/rainy-day-logs/${logId}/feedback`, {
          rating: value,
        });
      } catch (error) {
        console.error("Error recording rating:", error);
      }
    }

    if (value > 0) {
      const updatedThumbsUp = sessionThumbsUp + 1;
      setTimeout(() => advanceOrExit(updatedThumbsUp), 600);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!logId || !feedbackNote.trim()) return;

    setSubmittingFeedback(true);
    Keyboard.dismiss();
    try {
      await apiRequest("PATCH", `/api/rainy-day-logs/${logId}/feedback`, {
        feedbackNote: feedbackNote.trim(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSubmittingFeedback(false);
    }
    setTimeout(() => advanceOrExit(sessionThumbsUp), 400);
  };

  const handleSkipFeedback = () => {
    advanceOrExit(sessionThumbsUp);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <ThemedText style={[styles.progressText, { color: theme.textSecondary }]}>
          {sessionShown} of {sessionTarget}
        </ThemedText>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          style={[styles.closeButton, { backgroundColor: theme.backgroundDefault }]}
          testID="button-close-playback"
        >
          <Feather name="x" size={20} color={theme.text} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View
          entering={FadeInUp.delay(200).duration(600)}
          style={styles.memorySection}
        >
          <ThemedText
            style={[styles.memoryText, { fontFamily: "Nunito_700Bold", color: theme.text }]}
            testID="text-memory-content"
          >
            {memory.content}
          </ThemedText>

          <View style={styles.memoryMeta}>
            {memory.emotion ? (
              <View
                style={[
                  styles.emotionBadge,
                  { backgroundColor: Colors.light.primary + "15" },
                ]}
              >
                <ThemedText
                  style={[styles.emotionBadgeText, { color: Colors.light.primary }]}
                >
                  {memory.emotion}
                </ThemedText>
              </View>
            ) : null}
            <ThemedText style={[styles.memoryDate, { color: theme.textSecondary }]}>
              {formatDate(memory.createdAt)}
            </ThemedText>
          </View>
        </Animated.View>

        {memory.mediaUri && memory.mediaType === "photo" ? (
          <Animated.View
            entering={FadeIn.delay(400).duration(500)}
            style={[styles.mediaCard, { backgroundColor: theme.backgroundDefault }]}
          >
            <Image
              source={{ uri: memory.mediaUri }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          </Animated.View>
        ) : memory.mediaUri && memory.mediaType === "video" ? (
          <Animated.View
            entering={FadeIn.delay(400).duration(500)}
            style={[styles.mediaCard, { backgroundColor: theme.backgroundDefault }]}
          >
            <Video
              source={{ uri: memory.mediaUri }}
              style={styles.mediaImage}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              shouldPlay
              isLooping={false}
            />
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeIn.delay(500).duration(400)}>
          <View style={styles.thumbsRow}>
            <Pressable
              onPress={() => handleRating(2)}
              disabled={rating !== null}
              style={[
                styles.thumbButton,
                {
                  backgroundColor: rating === 2 ? "#F59E0B20" : theme.backgroundDefault,
                  opacity: rating !== null && rating !== 2 ? 0.4 : 1,
                },
              ]}
              testID="button-two-thumbs-up"
            >
              <View style={styles.twoThumbsContainer}>
                <Feather
                  name="thumbs-up"
                  size={22}
                  color={rating === 2 ? "#F59E0B" : theme.textSecondary}
                />
                <Feather
                  name="thumbs-up"
                  size={22}
                  color={rating === 2 ? "#F59E0B" : theme.textSecondary}
                  style={{ marginLeft: -6 }}
                />
              </View>
              <ThemedText
                style={[
                  styles.thumbLabel,
                  { color: rating === 2 ? "#F59E0B" : theme.textSecondary },
                ]}
              >
                Loved it
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleRating(1)}
              disabled={rating !== null}
              style={[
                styles.thumbButton,
                {
                  backgroundColor: rating === 1 ? "#22C55E20" : theme.backgroundDefault,
                  opacity: rating !== null && rating !== 1 ? 0.4 : 1,
                },
              ]}
              testID="button-thumbs-up"
            >
              <Feather
                name="thumbs-up"
                size={28}
                color={rating === 1 ? "#22C55E" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.thumbLabel,
                  { color: rating === 1 ? "#22C55E" : theme.textSecondary },
                ]}
              >
                Helpful
              </ThemedText>
            </Pressable>

            <Pressable
              onPress={() => handleRating(-1)}
              disabled={rating !== null}
              style={[
                styles.thumbButton,
                {
                  backgroundColor: rating === -1 ? "#EF444420" : theme.backgroundDefault,
                  opacity: rating !== null && rating !== -1 ? 0.4 : 1,
                },
              ]}
              testID="button-thumbs-down"
            >
              <Feather
                name="thumbs-down"
                size={28}
                color={rating === -1 ? "#EF4444" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.thumbLabel,
                  { color: rating === -1 ? "#EF4444" : theme.textSecondary },
                ]}
              >
                Not really
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {rating !== null && rating > 0 ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.transitionContainer}>
            {transitioning ? (
              <ActivityIndicator size="small" color={Colors.light.primary} />
            ) : null}
          </Animated.View>
        ) : null}

        {rating === -1 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <View style={[styles.feedbackSection, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.feedbackPrompt, { color: theme.textSecondary }]}>
                Want to share what would help?
              </ThemedText>
              <View style={styles.feedbackInputRow}>
                <TextInput
                  value={feedbackNote}
                  onChangeText={setFeedbackNote}
                  placeholder="Any thoughts? (optional)"
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[
                    styles.feedbackInput,
                    { backgroundColor: theme.backgroundRoot, color: theme.text },
                  ]}
                  testID="input-feedback"
                />
                <Pressable
                  onPress={() => Keyboard.dismiss()}
                  style={[styles.keyboardDismiss, { backgroundColor: theme.backgroundRoot }]}
                  testID="button-dismiss-feedback-keyboard"
                >
                  <Feather name="check" size={18} color={theme.textSecondary} />
                  <ThemedText style={[styles.dismissLabel, { color: theme.textSecondary }]}>
                    Done
                  </ThemedText>
                </Pressable>
              </View>
              <View style={styles.feedbackActions}>
                {feedbackNote.trim().length > 0 ? (
                  <Pressable
                    onPress={handleSubmitFeedback}
                    disabled={submittingFeedback}
                    style={[styles.sendFeedbackButton, { backgroundColor: Colors.light.primary }]}
                    testID="button-send-feedback"
                  >
                    <ThemedText style={[styles.sendFeedbackText, { color: "#FFFFFF" }]}>
                      {submittingFeedback ? "Saving..." : "Save & Continue"}
                    </ThemedText>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={handleSkipFeedback}
                  style={styles.skipButton}
                  testID="button-skip-feedback"
                >
                  <ThemedText style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                    Skip
                  </ThemedText>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        ) : null}

        <View style={{ height: insets.bottom + Spacing.xl }} />
      </ScrollView>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  progressText: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  memorySection: {
    marginBottom: Spacing.lg,
  },
  memoryText: {
    fontSize: 24,
    lineHeight: 34,
    marginBottom: Spacing.md,
  },
  memoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  emotionBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  emotionBadgeText: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
  },
  memoryDate: {
    fontSize: 13,
  },
  mediaCard: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  mediaImage: {
    width: "100%",
    height: 240,
  },
  thumbsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  thumbButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  twoThumbsContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbLabel: {
    fontSize: 12,
    fontFamily: "Nunito_500Medium",
  },
  transitionContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
  },
  feedbackSection: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  feedbackPrompt: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
    marginBottom: Spacing.sm,
  },
  feedbackInputRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  feedbackInput: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    minHeight: 60,
    textAlignVertical: "top",
  },
  keyboardDismiss: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
    gap: 2,
  },
  dismissLabel: {
    fontSize: 10,
    fontFamily: "Nunito_500Medium",
  },
  feedbackActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  sendFeedbackButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  sendFeedbackText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
  },
  skipButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
  },
});
