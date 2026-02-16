import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { useTheme } from "@/hooks/useTheme";
import { useUser } from "@/contexts/UserContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const EMOTION_TAGS = [
  "Happy", "Grateful", "Excited", "Peaceful", "Loved", "Proud",
  "Hopeful", "Inspired", "Content", "Joyful"
];

export default function SendDepositScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "SendDeposit">>();
  const { connection } = route.params;
  const { user } = useUser();

  const [content, setContent] = useState("");
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video" | null>(null);
  const [sending, setSending] = useState(false);

  const canSend = content.trim().length > 0 || mediaUri;

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setMediaUri(result.assets[0].uri);
      setMediaType(result.assets[0].type === "video" ? "video" : "photo");
    }
  };

  const handleRemoveMedia = () => {
    setMediaUri(null);
    setMediaType(null);
  };

  const handleSend = async () => {
    if (!canSend || !user || sending) return;

    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await apiRequest("POST", "/api/circle/shared-deposits", {
        senderId: user.id,
        receiverId: connection.connectedUserId,
        content: content.trim() || "A moment of joy for you",
        emotion: selectedEmotion,
        mediaUri,
        mediaType,
        tags: selectedEmotion ? [selectedEmotion] : [],
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      if (Platform.OS === "web") {
        alert("Your moment of joy has been sent!");
      } else {
        Alert.alert(
          "Sent!",
          `Your moment of joy has been sent to ${connection.connectedUser.displayName || "your friend"}.`,
          [{ text: "OK" }]
        );
      }
      
      navigation.goBack();
    } catch (error) {
      console.error("Error sending deposit:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      if (Platform.OS === "web") {
        alert("Failed to send. Please try again.");
      } else {
        Alert.alert("Error", "Failed to send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.recipientCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.recipientAvatar, { backgroundColor: Colors.light.primary + "20" }]}>
            <Feather name="user" size={24} color={Colors.light.primary} />
          </View>
          <View>
            <ThemedText style={[styles.sendingTo, { color: theme.textSecondary }]}>
              Sending to
            </ThemedText>
            <ThemedText style={[styles.recipientName, { fontFamily: "Nunito_600SemiBold" }]}>
              {connection.connectedUser.displayName || "Friend"}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
          Add a message
        </ThemedText>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Share a moment of joy, encouragement, or a happy memory..."
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[
            styles.contentInput,
            { backgroundColor: theme.backgroundDefault, color: theme.text },
          ]}
        />

        <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
          Add a photo or video (optional)
        </ThemedText>
        {mediaUri ? (
          <View style={styles.mediaPreviewContainer}>
            <Image source={{ uri: mediaUri }} style={styles.mediaPreview} />
            <Pressable
              onPress={handleRemoveMedia}
              style={[styles.removeMediaButton, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="x" size={18} color={theme.text} />
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={handlePickImage}
            style={[styles.mediaButton, { backgroundColor: theme.backgroundDefault }]}
          >
            <Feather name="image" size={24} color={theme.textSecondary} />
            <ThemedText style={[styles.mediaButtonText, { color: theme.textSecondary }]}>
              Choose from library
            </ThemedText>
          </Pressable>
        )}

        <ThemedText style={[styles.label, { fontFamily: "Nunito_600SemiBold" }]}>
          Tag with an emotion (optional)
        </ThemedText>
        <View style={styles.emotionGrid}>
          {EMOTION_TAGS.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedEmotion(selectedEmotion === tag ? null : tag);
              }}
              style={[
                styles.emotionTag,
                {
                  backgroundColor:
                    selectedEmotion === tag
                      ? Colors.light.primary
                      : theme.backgroundDefault,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.emotionTagText,
                  { color: selectedEmotion === tag ? "#FFFFFF" : theme.text },
                ]}
              >
                {tag}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <View style={styles.privacyNote}>
          <Feather name="shield" size={16} color={theme.textSecondary} />
          <ThemedText style={[styles.privacyText, { color: theme.textSecondary }]}>
            They won't know when you sent this. You'll only know if it helped.
          </ThemedText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          onPress={handleSend}
          disabled={!canSend || sending}
          style={[
            styles.sendButton,
            {
              backgroundColor: canSend ? Colors.light.primary : theme.backgroundDefault,
            },
          ]}
        >
          <Feather name="send" size={20} color={canSend ? "#FFFFFF" : theme.textSecondary} />
          <ThemedText
            style={[
              styles.sendButtonText,
              { color: canSend ? "#FFFFFF" : theme.textSecondary },
            ]}
          >
            {sending ? "Sending..." : "Send Joy"}
          </ThemedText>
        </Pressable>
      </View>
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
    padding: Spacing.lg,
  },
  recipientCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  recipientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  sendingTo: {
    fontSize: 13,
  },
  recipientName: {
    fontSize: 17,
  },
  label: {
    fontSize: 15,
    marginBottom: Spacing.sm,
  },
  contentInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    marginBottom: Spacing.xl,
    fontFamily: "Nunito_400Regular",
  },
  mediaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  mediaButtonText: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
  },
  mediaPreviewContainer: {
    position: "relative",
    marginBottom: Spacing.xl,
  },
  mediaPreview: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
  },
  removeMediaButton: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  emotionTag: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emotionTagText: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
  },
  privacyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  sendButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  sendButtonText: {
    fontSize: 17,
    fontFamily: "Nunito_600SemiBold",
  },
});
