import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { Video, ResizeMode } from "expo-av";

import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { deleteMemory, formatDate, getDaysSince } from "@/lib/storage";

export default function MemoryDetailScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "MemoryDetail">>();
  const { memory } = route.params;

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: formatDate(memory.createdAt),
    });
  }, [navigation, memory]);

  const handleDelete = async () => {
    setDeleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await deleteMemory(memory.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error("Error deleting memory:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const getMemoryIcon = (type: string) => {
    switch (type) {
      case "photo":
        return "image";
      case "video":
        return "video";
      case "audio":
        return "mic";
      default:
        return "file-text";
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {memory.mediaUri && memory.mediaType === "photo" ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <Image
              source={{ uri: memory.mediaUri }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          </Animated.View>
        ) : memory.mediaUri && memory.mediaType === "video" ? (
          <Animated.View entering={FadeIn.duration(400)}>
            <Video
              source={{ uri: memory.mediaUri }}
              style={styles.mediaImage}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isLooping={false}
            />
          </Animated.View>
        ) : (
          <Animated.View
            style={[styles.iconPlaceholder, { backgroundColor: Colors.light.primary + "20" }]}
            entering={FadeIn.duration(400)}
          >
            <Feather
              name={getMemoryIcon(memory.mediaType)}
              size={48}
              color={Colors.light.primary}
            />
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(100).duration(400)}>
          <ThemedText style={[styles.content, { fontFamily: "Nunito_400Regular" }]}>
            {memory.content}
          </ThemedText>
        </Animated.View>

        {memory.tags.length > 0 ? (
          <Animated.View style={styles.tagsContainer} entering={FadeIn.delay(200).duration(400)}>
            {memory.tags.map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: Colors.light.primary + "20" }]}
              >
                <ThemedText style={[styles.tagText, { color: Colors.light.primary }]}>
                  {tag}
                </ThemedText>
              </View>
            ))}
          </Animated.View>
        ) : null}

        <Animated.View
          style={[styles.metaSection, { backgroundColor: theme.backgroundDefault }]}
          entering={FadeIn.delay(300).duration(400)}
        >
          <View style={styles.metaRow}>
            <Feather name="calendar" size={16} color={theme.textSecondary} />
            <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
              Saved on {formatDate(memory.createdAt)}
            </ThemedText>
          </View>
          {memory.lastSurfacedAt ? (
            <View style={styles.metaRow}>
              <Feather name="sun" size={16} color={theme.textSecondary} />
              <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                Last remembered: {getDaysSince(memory.lastSurfacedAt)} days ago
              </ThemedText>
            </View>
          ) : null}
        </Animated.View>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowDeleteModal(true);
          }}
          style={[styles.deleteButton, { backgroundColor: Colors.light.secondary + "15" }]}
        >
          <Feather name="trash-2" size={18} color={Colors.light.secondary} />
          <ThemedText style={[styles.deleteText, { color: Colors.light.secondary }]}>
            Delete Deposit
          </ThemedText>
        </Pressable>
      </ScrollView>

      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_700Bold" }]}>
              Delete Deposit?
            </ThemedText>
            <ThemedText style={[styles.modalMessage, { color: theme.textSecondary }]}>
              This happy moment will be permanently removed from your Happiness Reserve.
            </ThemedText>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                style={[styles.modalButton, { backgroundColor: theme.backgroundSecondary }]}
              >
                <ThemedText style={styles.modalButtonText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={[
                  styles.modalButton,
                  { backgroundColor: Colors.light.secondary, opacity: deleting ? 0.5 : 1 },
                ]}
              >
                <ThemedText style={[styles.modalButtonText, { color: "#FFFFFF" }]}>
                  Delete
                </ThemedText>
              </Pressable>
            </View>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  mediaImage: {
    width: "100%",
    height: 300,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  iconPlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  content: {
    fontSize: 18,
    lineHeight: 28,
    marginBottom: Spacing.xl,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  tag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
  },
  metaSection: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  metaText: {
    fontSize: 14,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
  },
  deleteText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  modalMessage: {
    fontSize: 15,
    textAlign: "center",
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
});
