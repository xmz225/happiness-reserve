import React, { useState, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Platform,
  Alert,
  Modal,
  FlatList,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";
import { useQuery } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { MainTabParamList } from "@/navigation/MainTabNavigator";
import { MemoryType, Memory, EMOTION_PRESETS } from "@/lib/storage";
import { apiRequest } from "@/lib/query-client";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const MOCK_CONNECTIONS = [
  { id: "1", name: "Sarah Johnson" },
  { id: "2", name: "Mike Chen" },
  { id: "3", name: "Emily Davis" },
];

function EmotionChip({
  emotion,
  selected,
  onPress,
}: {
  emotion: typeof EMOTION_PRESETS[0];
  selected: boolean;
  onPress: () => void;
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
        styles.emotionChip,
        {
          backgroundColor: selected
            ? Colors.light.primary
            : theme.backgroundDefault,
          borderColor: selected ? Colors.light.primary : theme.border,
        },
        animatedStyle,
      ]}
    >
      <Feather
        name={emotion.icon as any}
        size={16}
        color={selected ? "#FFFFFF" : theme.textSecondary}
      />
      <ThemedText
        style={[
          styles.emotionChipText,
          { color: selected ? "#FFFFFF" : theme.text },
        ]}
      >
        {emotion.label}
      </ThemedText>
    </AnimatedPressable>
  );
}

function MediaOptionButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.mediaActionButton,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Feather name={icon as any} size={22} color={Colors.light.primary} />
      <ThemedText style={styles.mediaActionLabel}>{label}</ThemedText>
    </Pressable>
  );
}

export default function DepositScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();

  const [content, setContent] = useState("");
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [customEmotion, setCustomEmotion] = useState("");
  const [mediaUri, setMediaUri] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<MemoryType | undefined>();
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedConnections, setSelectedConnections] = useState<string[]>([]);

  const { data: deposits = [] } = useQuery<Memory[]>({
    queryKey: ["/api/deposits"],
  });

  const allKnownTags = useMemo(() => {
    const tagSet = new Set<string>();
    deposits.forEach((d) => {
      (d.tags || []).forEach((tag) => tagSet.add(tag));
      if (d.emotion) tagSet.add(d.emotion);
    });
    EMOTION_PRESETS.forEach((p) => tagSet.add(p.id));
    return Array.from(tagSet);
  }, [deposits]);

  const topTags = useMemo(() => {
    const tagCounts: Record<string, number> = {};
    deposits.forEach((d) => {
      (d.tags || []).forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
      if (d.emotion) {
        tagCounts[d.emotion] = (tagCounts[d.emotion] || 0) + 1;
      }
    });
    if (Object.keys(tagCounts).length === 0) {
      return EMOTION_PRESETS.slice(0, 10).map((p) => p.id);
    }
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);
  }, [deposits]);

  const searchSuggestions = useMemo(() => {
    const query = customEmotion.trim().toLowerCase();
    if (!query) return [];
    return allKnownTags
      .filter((tag) => tag.toLowerCase().includes(query) && !selectedEmotions.includes(tag))
      .slice(0, 5);
  }, [customEmotion, allKnownTags, selectedEmotions]);

  const addTagsFromInput = useCallback(() => {
    const parts = customEmotion.split(",").map((s) => s.trim()).filter(Boolean);
    const newTags = parts.filter((t) => !selectedEmotions.includes(t));
    if (newTags.length > 0) {
      setSelectedEmotions((prev) => [...prev, ...newTags]);
    }
    setCustomEmotion("");
  }, [customEmotion, selectedEmotions]);

  const canSave = content.trim().length > 0;
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startVoiceInput = useCallback(() => {
    if (Platform.OS !== "web") {
      Alert.alert(
        "Voice Input",
        "Tap the microphone icon on your keyboard to use voice dictation."
      );
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("Not Supported", "Voice input is not supported in this browser.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setContent((prev) => (prev ? prev + " " + transcript : transcript));
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [isListening]);

  const resetForm = () => {
    setContent("");
    setSelectedEmotions([]);
    setCustomEmotion("");
    setMediaUri(undefined);
    setMediaType(undefined);
    setSelectedConnections([]);
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const handleTakePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required to take photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType("photo");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType("photo");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRecordVideo = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Camera permission is required to record video.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType("video");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePickVideo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.8,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType("video");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handleRecordAudio = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMediaType("audio");
    Alert.alert("Audio Recording", "Audio recording will be available soon. For now, this marks the deposit as an audio memory.");
  };

  const handleRemoveMedia = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMediaUri(undefined);
    setMediaType(undefined);
  };

  const handleCancel = () => {
    resetForm();
    navigation.navigate("HomeTab");
  };

  const handleSave = async () => {
    if (!canSave || saving) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const allTags = [...selectedEmotions];
      const custom = customEmotion.trim();
      if (custom && !allTags.includes(custom)) {
        allTags.push(custom);
      }
      await apiRequest("POST", "/api/deposits", {
        content: content.trim(),
        emotion: allTags[0] || undefined,
        mediaUri,
        mediaType,
        tags: allTags,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      resetForm();
      navigation.navigate("HomeTab");
    } catch (error) {
      console.error("Error saving deposit:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleShareAndSave = async () => {
    if (!canSave || saving || selectedConnections.length === 0) return;

    setSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const allTags = [...selectedEmotions];
      const custom = customEmotion.trim();
      if (custom && !allTags.includes(custom)) {
        allTags.push(custom);
      }
      await apiRequest("POST", "/api/deposits", {
        content: content.trim(),
        emotion: allTags[0] || undefined,
        mediaUri,
        mediaType,
        tags: allTags,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowShareModal(false);
      resetForm();
      navigation.navigate("HomeTab");
    } catch (error) {
      console.error("Error saving and sharing deposit:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const toggleConnection = (id: string) => {
    setSelectedConnections((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : [...prev, id]
    );
  };

  const isWeb = Platform.OS === "web";

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.customHeader, { paddingTop: insets.top + Spacing["2xl"] + Spacing.md }]}>
        <View style={styles.headerActionsRow}>
          <Pressable onPress={handleCancel} style={styles.headerButton}>
            <ThemedText style={[styles.headerButtonText, { color: theme.text }]}>
              Cancel
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={!canSave || saving}
            style={[styles.headerButton, { opacity: canSave && !saving ? 1 : 0.4 }]}
            testID="button-save-deposit"
          >
            <ThemedText
              style={[
                styles.headerButtonText,
                styles.headerButtonCenter,
                {
                  color: canSave ? Colors.light.primary : theme.textSecondary,
                },
              ]}
            >
              Save
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              if (canSave) {
                setShowShareModal(true);
              }
            }}
            disabled={!canSave || saving}
            style={[styles.headerButton, { opacity: canSave && !saving ? 1 : 0.4 }]}
          >
            <ThemedText
              style={[
                styles.headerButtonText,
                {
                  color: canSave ? Colors.light.primary : theme.textSecondary,
                },
              ]}
            >
              Share
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText style={[styles.headerTitle, { fontFamily: "Nunito_700Bold" }]}>
          Add a Moment
        </ThemedText>
      </View>

      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: tabBarHeight + Spacing.xl,
          },
        ]}
      >
        <Animated.View entering={FadeIn.duration(300)}>
          <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
            What made you smile?
          </ThemedText>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="Describe this moment..."
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.textInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                fontFamily: "Nunito_400Regular",
              },
            ]}
            textAlignVertical="top"
            testID="input-deposit-content"
          />
          <View style={styles.inputToolbar}>
            <Pressable
              onPress={startVoiceInput}
              style={[
                styles.toolbarButton,
                {
                  backgroundColor: isListening ? Colors.light.primary + "20" : theme.backgroundDefault,
                },
              ]}
              testID="button-voice-input"
            >
              <Feather
                name="mic"
                size={20}
                color={isListening ? Colors.light.primary : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.toolbarButtonText,
                  { color: isListening ? Colors.light.primary : theme.textSecondary },
                ]}
              >
                {isListening ? "Listening..." : "Voice"}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={[styles.toolbarButton, { backgroundColor: theme.backgroundDefault }]}
              testID="button-dismiss-keyboard"
            >
              <Feather name="chevron-down" size={20} color={theme.textSecondary} />
              <ThemedText style={[styles.toolbarButtonText, { color: theme.textSecondary }]}>
                Done
              </ThemedText>
            </Pressable>
          </View>
        </Animated.View>

        {mediaUri ? (
          <Animated.View style={styles.mediaPreview} entering={FadeIn.duration(300)}>
            <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
              Attached Media
            </ThemedText>
            <View style={styles.mediaContainer}>
              {mediaType === "photo" ? (
                <Image
                  source={{ uri: mediaUri }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              ) : mediaType === "video" ? (
                <Video
                  source={{ uri: mediaUri }}
                  style={styles.mediaImage}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={false}
                  isMuted
                />
              ) : null}
              <Pressable
                onPress={handleRemoveMedia}
                style={[styles.removeButton, { backgroundColor: Colors.light.secondary }]}
              >
                <Feather name="x" size={16} color="#FFFFFF" />
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.delay(100).duration(300)}>
            <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
              Add Media (Optional)
            </ThemedText>
            <View style={styles.mediaActionsContainer}>
              {isWeb ? null : (
                <MediaOptionButton
                  icon="camera"
                  label="Take Photo"
                  onPress={handleTakePhoto}
                />
              )}
              <MediaOptionButton
                icon="image"
                label="Choose Photo"
                onPress={handlePickPhoto}
              />
              {isWeb ? null : (
                <MediaOptionButton
                  icon="video"
                  label="Record Video"
                  onPress={handleRecordVideo}
                />
              )}
              <MediaOptionButton
                icon="film"
                label="Choose Video"
                onPress={handlePickVideo}
              />
              <MediaOptionButton
                icon="mic"
                label="Audio"
                onPress={handleRecordAudio}
              />
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(200).duration(300)}>
          <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
            How does this make you feel?
          </ThemedText>

          <View style={styles.emotionChipsContainer}>
            {topTags.map((tagId) => {
              const preset = EMOTION_PRESETS.find((p) => p.id === tagId);
              const label = preset ? preset.label : tagId;
              const icon = preset ? preset.icon : "tag";
              const isSelected = selectedEmotions.includes(tagId);
              return (
                <AnimatedPressable
                  key={tagId}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedEmotions((prev) =>
                      prev.includes(tagId)
                        ? prev.filter((e) => e !== tagId)
                        : [...prev, tagId]
                    );
                  }}
                  style={[
                    styles.emotionChip,
                    {
                      backgroundColor: isSelected
                        ? Colors.light.primary
                        : theme.backgroundDefault,
                      borderColor: isSelected
                        ? Colors.light.primary
                        : theme.border,
                    },
                  ]}
                >
                  <Feather
                    name={icon as any}
                    size={16}
                    color={isSelected ? "#FFFFFF" : theme.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.emotionChipText,
                      { color: isSelected ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {label}
                  </ThemedText>
                </AnimatedPressable>
              );
            })}
          </View>

          <View style={{ position: "relative" }}>
            <View style={styles.customTagRow}>
              <TextInput
                value={customEmotion}
                onChangeText={setCustomEmotion}
                placeholder="Search or add your own tag..."
                placeholderTextColor={theme.textSecondary}
                onSubmitEditing={addTagsFromInput}
                returnKeyType="done"
                style={[
                  styles.customEmotionInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    fontFamily: "Nunito_400Regular",
                    flex: 1,
                  },
                ]}
              />
              {customEmotion.trim().length > 0 ? (
                <Pressable
                  onPress={addTagsFromInput}
                  style={[styles.addTagButton, { backgroundColor: Colors.light.primary }]}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>

            {searchSuggestions.length > 0 ? (
              <View style={[styles.suggestionsContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                {searchSuggestions.map((suggestion) => {
                  const preset = EMOTION_PRESETS.find((p) => p.id === suggestion);
                  const label = preset ? preset.label : suggestion;
                  return (
                    <Pressable
                      key={suggestion}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedEmotions((prev) => [...prev, suggestion]);
                        setCustomEmotion("");
                      }}
                      style={[styles.suggestionItem, { borderBottomColor: theme.border }]}
                    >
                      <Feather name="tag" size={14} color={theme.textSecondary} />
                      <ThemedText style={[styles.suggestionText]}>{label}</ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </Animated.View>
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={showShareModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_700Bold" }]}>
                Share with Connections
              </ThemedText>
              <Pressable onPress={() => setShowShareModal(false)}>
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              Select people to share this moment with
            </ThemedText>

            <FlatList
              data={MOCK_CONNECTIONS}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => toggleConnection(item.id)}
                  style={[
                    styles.connectionRow,
                    { backgroundColor: theme.backgroundDefault },
                  ]}
                >
                  <View style={[styles.connectionAvatar, { backgroundColor: Colors.light.primary + "20" }]}>
                    <ThemedText style={{ color: Colors.light.primary, fontFamily: "Nunito_600SemiBold" }}>
                      {item.name.charAt(0)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.connectionName}>{item.name}</ThemedText>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        backgroundColor: selectedConnections.includes(item.id)
                          ? Colors.light.primary
                          : "transparent",
                        borderColor: selectedConnections.includes(item.id)
                          ? Colors.light.primary
                          : theme.border,
                      },
                    ]}
                  >
                    {selectedConnections.includes(item.id) ? (
                      <Feather name="check" size={14} color="#FFFFFF" />
                    ) : null}
                  </View>
                </Pressable>
              )}
              contentContainerStyle={styles.connectionsList}
            />

            <Pressable
              onPress={handleShareAndSave}
              disabled={selectedConnections.length === 0 || saving}
              style={[
                styles.shareButton,
                {
                  backgroundColor:
                    selectedConnections.length > 0
                      ? Colors.light.primary
                      : theme.backgroundDefault,
                  opacity: saving ? 0.6 : 1,
                },
              ]}
            >
              <Feather
                name="send"
                size={18}
                color={selectedConnections.length > 0 ? "#FFFFFF" : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.shareButtonText,
                  {
                    color:
                      selectedConnections.length > 0 ? "#FFFFFF" : theme.textSecondary,
                  },
                ]}
              >
                {saving ? "Sharing..." : `Share with ${selectedConnections.length} ${selectedConnections.length === 1 ? "person" : "people"}`}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerButton: {
    paddingVertical: Spacing.xs,
    minWidth: 60,
  },
  headerButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  headerButtonCenter: {
    textAlign: "center",
  },
  headerTitle: {
    fontSize: 24,
    textAlign: "center" as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  label: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  textInput: {
    fontSize: 16,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    minHeight: 120,
    marginBottom: Spacing.sm,
  },
  inputToolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  toolbarButtonText: {
    fontSize: 13,
    fontFamily: "Nunito_500Medium",
  },
  mediaActionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  mediaActionButton: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    minWidth: 90,
    gap: Spacing.xs,
  },
  mediaActionLabel: {
    fontSize: 12,
    fontFamily: "Nunito_500Medium",
    textAlign: "center",
  },
  mediaPreview: {
    marginBottom: Spacing.xl,
  },
  mediaContainer: {
    position: "relative",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  mediaImage: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removeButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emotionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  emotionChipText: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
  },
  subLabel: {
    fontSize: 12,
    fontFamily: "Nunito_500Medium",
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
  },
  customTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  addTagButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  customEmotionInput: {
    fontSize: 15,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  connectionsList: {
    gap: Spacing.sm,
  },
  connectionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  connectionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  connectionName: {
    flex: 1,
    fontSize: 16,
    fontFamily: "Nunito_500Medium",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  suggestionsContainer: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginTop: Spacing.xs,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: {
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
  },
});
