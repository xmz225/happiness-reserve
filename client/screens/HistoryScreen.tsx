import React, { useState, useCallback, useLayoutEffect } from "react";
import {
  View,
  StyleSheet,
  SectionList,
  Pressable,
  Image,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  ScrollView,
  Modal,
  FlatList,
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
import { Memory, formatDate, EMOTION_PRESETS } from "@/lib/storage";
import { getApiUrl, apiRequest } from "@/lib/query-client";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface MemorySection {
  title: string;
  data: Memory[];
}

interface Stats {
  totalDeposits: number;
  activeDeposits: number;
  cooldownDeposits: number;
  totalRainyDays: number;
  connections: number;
}

function StatusBadge({ status }: { status: number }) {
  if (status === 0) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: "#22C55E20" }]}>
        <ThemedText style={[styles.statusText, { color: "#22C55E" }]}>Ready</ThemedText>
      </View>
    );
  }
  if (status === -1) {
    return (
      <View style={[styles.statusBadge, { backgroundColor: "#EF444420" }]}>
        <ThemedText style={[styles.statusText, { color: "#EF4444" }]}>Inactive</ThemedText>
      </View>
    );
  }
  return (
    <View style={[styles.statusBadge, { backgroundColor: "#F59E0B20" }]}>
      <ThemedText style={[styles.statusText, { color: "#F59E0B" }]}>{status}d</ThemedText>
    </View>
  );
}

function StatusModal({
  visible,
  onClose,
  memory,
  onUpdateStatus,
}: {
  visible: boolean;
  onClose: () => void;
  memory: Memory | null;
  onUpdateStatus: (id: string, status: number) => void;
}) {
  const { theme } = useTheme();
  const [cooldownDays, setCooldownDays] = useState("");

  const handleSetCooldown = () => {
    if (!memory) return;
    const days = parseInt(cooldownDays, 10);
    if (isNaN(days) || days < 1) {
      Alert.alert("Invalid", "Please enter a valid number of days (1 or more)");
      return;
    }
    onUpdateStatus(memory.id, days);
    setCooldownDays("");
    onClose();
  };

  const handleMakeActive = () => {
    if (!memory) return;
    onUpdateStatus(memory.id, 0);
    onClose();
  };

  const handleMakeInactive = () => {
    if (!memory) return;
    if (Platform.OS === "web") {
      if (window.confirm("Make this moment inactive? It won't appear in withdrawals.")) {
        onUpdateStatus(memory.id, -1);
        onClose();
      }
    } else {
      Alert.alert(
        "Make Inactive",
        "This moment won't appear in withdrawals. You can reactivate it later.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Make Inactive",
            style: "destructive",
            onPress: () => {
              onUpdateStatus(memory.id, -1);
              onClose();
            },
          },
        ]
      );
    }
  };

  if (!memory) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_700Bold" }]}>
            Update Status
          </ThemedText>

          <View style={styles.currentStatus}>
            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              Current Status:
            </ThemedText>
            <StatusBadge status={memory.status ?? 0} />
          </View>

          <View style={styles.modalActions}>
            <Pressable
              onPress={handleMakeActive}
              style={[styles.actionButton, { backgroundColor: "#22C55E15" }]}
            >
              <Feather name="check-circle" size={20} color="#22C55E" />
              <ThemedText style={[styles.actionText, { color: "#22C55E" }]}>
                Make Active (Ready)
              </ThemedText>
            </Pressable>

            <View style={styles.cooldownRow}>
              <Pressable
                onPress={handleSetCooldown}
                style={[styles.cooldownButton, { backgroundColor: "#F59E0B15" }]}
              >
                <Feather name="clock" size={16} color="#F59E0B" />
                <ThemedText style={[styles.cooldownButtonText, { color: "#F59E0B" }]}>
                  Cooldown
                </ThemedText>
              </Pressable>
              <TextInput
                value={cooldownDays}
                onChangeText={setCooldownDays}
                placeholder="# Days"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                style={[
                  styles.cooldownInput,
                  { backgroundColor: theme.backgroundRoot, color: theme.text },
                ]}
              />
            </View>

            <Pressable
              onPress={handleMakeInactive}
              style={[styles.actionButton, { backgroundColor: "#EF444415" }]}
            >
              <Feather name="x-circle" size={20} color="#EF4444" />
              <ThemedText style={[styles.actionText, { color: "#EF4444" }]}>
                Make Inactive
              </ThemedText>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.cancelButton}>
            <ThemedText style={[styles.cancelText, { color: theme.textSecondary }]}>
              Cancel
            </ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function EditModal({
  visible,
  onClose,
  memory,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  memory: Memory | null;
  onSave: (id: string, content: string, emotion: string | undefined, tags: string[]) => void;
}) {
  const { theme } = useTheme();
  const [content, setContent] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");

  React.useEffect(() => {
    if (memory) {
      setContent(memory.content || "");
      setSelectedTags(memory.tags || (memory.emotion ? [memory.emotion] : []));
      setCustomTag("");
    }
  }, [memory]);

  const handleSave = () => {
    if (!memory) return;
    const allTags = [...selectedTags];
    const custom = customTag.trim();
    if (custom && !allTags.includes(custom)) {
      allTags.push(custom);
    }
    onSave(memory.id, content, allTags[0] || undefined, allTags);
    onClose();
  };

  const handlePresetToggle = (label: string) => {
    setSelectedTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]
    );
  };

  const handleAddCustomTag = () => {
    const custom = customTag.trim();
    if (custom && !selectedTags.includes(custom)) {
      setSelectedTags((prev) => [...prev, custom]);
      setCustomTag("");
    }
  };

  if (!memory) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable 
          style={[styles.editModalContent, { backgroundColor: theme.backgroundDefault }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_700Bold" }]}>
            Edit Moment
          </ThemedText>

          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            Description
          </ThemedText>
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder="What made you happy?"
            placeholderTextColor={theme.textSecondary}
            multiline
            style={[
              styles.editInput,
              { backgroundColor: theme.backgroundRoot, color: theme.text },
            ]}
          />

          <ThemedText style={[styles.fieldLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
            Tags (select multiple)
          </ThemedText>
          <View style={styles.editTagsWrap}>
            {EMOTION_PRESETS.map((preset) => {
              const isSelected = selectedTags.includes(preset.label);
              return (
                <Pressable
                  key={preset.id}
                  onPress={() => handlePresetToggle(preset.label)}
                  style={[
                    styles.emotionChip,
                    {
                      backgroundColor: isSelected
                        ? Colors.light.primary
                        : theme.backgroundRoot,
                    },
                  ]}
                >
                  <Feather
                    name={preset.icon as any}
                    size={14}
                    color={isSelected ? "#FFFFFF" : theme.text}
                  />
                  <ThemedText
                    style={[
                      styles.emotionChipText,
                      { color: isSelected ? "#FFFFFF" : theme.text },
                    ]}
                  >
                    {preset.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.customTagRow}>
            <TextInput
              value={customTag}
              onChangeText={setCustomTag}
              placeholder="Add your own tag..."
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleAddCustomTag}
              returnKeyType="done"
              style={[
                styles.customTagInput,
                { backgroundColor: theme.backgroundRoot, color: theme.text, flex: 1 },
              ]}
            />
            {customTag.trim().length > 0 ? (
              <Pressable
                onPress={handleAddCustomTag}
                style={[styles.addTagButton, { backgroundColor: Colors.light.primary }]}
              >
                <Feather name="plus" size={16} color="#FFFFFF" />
              </Pressable>
            ) : null}
          </View>

          {selectedTags.filter((t) => !EMOTION_PRESETS.some((p) => p.label === t)).length > 0 ? (
            <View style={styles.editTagsWrap}>
              {selectedTags
                .filter((t) => !EMOTION_PRESETS.some((p) => p.label === t))
                .map((tag) => (
                  <Pressable
                    key={tag}
                    onPress={() => setSelectedTags((prev) => prev.filter((t) => t !== tag))}
                    style={[styles.emotionChip, { backgroundColor: Colors.light.primary }]}
                  >
                    <ThemedText style={[styles.emotionChipText, { color: "#FFFFFF" }]}>
                      {tag}
                    </ThemedText>
                    <Feather name="x" size={12} color="#FFFFFF" />
                  </Pressable>
                ))}
            </View>
          ) : null}

          <View style={styles.editActions}>
            <Pressable onPress={onClose} style={[styles.editButton, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.editButtonText, { color: theme.text }]}>Cancel</ThemedText>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.editButton, { backgroundColor: Colors.light.primary }]}>
              <ThemedText style={[styles.editButtonText, { color: "#FFFFFF" }]}>Save</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DepositRow({
  memory,
  onPress,
  onStatusPress,
  onEditPress,
}: {
  memory: Memory;
  onPress: () => void;
  onStatusPress: () => void;
  onEditPress: () => void;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getMediaIcon = (type?: string) => {
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
    <AnimatedPressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onEditPress();
      }}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 150 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 150 });
      }}
      style={[
        styles.depositRow,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
    >
      {memory.mediaUri && memory.mediaType === "photo" ? (
        <Image
          source={{ uri: memory.mediaUri }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.iconContainer, { backgroundColor: Colors.light.primary + "15" }]}>
          <Feather
            name={getMediaIcon(memory.mediaType)}
            size={20}
            color={Colors.light.primary}
          />
        </View>
      )}
      <View style={styles.depositContent}>
        <ThemedText style={styles.depositText} numberOfLines={2}>
          {memory.content || "No description"}
        </ThemedText>
        <View style={styles.depositMeta}>
          <ThemedText style={[styles.depositDate, { color: theme.textSecondary }]}>
            {formatDate(memory.createdAt)}
          </ThemedText>
          {memory.emotion ? (
            <View style={[styles.emotionBadge, { backgroundColor: Colors.light.primary + "15" }]}>
              <ThemedText style={[styles.emotionBadgeText, { color: Colors.light.primary }]}>
                {memory.emotion}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEditPress();
          }}
          style={styles.editIconButton}
        >
          <Feather name="edit-2" size={16} color={theme.textSecondary} />
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onStatusPress();
          }}
          style={styles.statusButton}
        >
          <StatusBadge status={memory.status ?? 0} />
        </Pressable>
      </View>
    </AnimatedPressable>
  );
}

function EmptyState() {
  const { theme } = useTheme();

  return (
    <Animated.View style={styles.emptyState} entering={FadeIn.duration(400)}>
      <View style={[styles.emptyIcon, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name="inbox" size={40} color={Colors.light.primary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { fontFamily: "Nunito_600SemiBold" }]}>
        No deposits yet
      </ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Start saving happy moments to build your reserve
      </ThemedText>
    </Animated.View>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: string;
  value: number | string;
  label: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.statIconContainer, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name={icon as any} size={24} color={Colors.light.primary} />
      </View>
      <ThemedText style={[styles.statValue, { fontFamily: "Nunito_700Bold" }]}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
    </View>
  );
}

function StatsView({ stats, memories }: { stats: Stats | null; memories: Memory[] }) {
  const { theme } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const activeMemories = memories.filter((m) => m.status === 0);
  const cooldownMemories = memories.filter((m) => (m.status ?? 0) > 0);

  const emotionCounts: { [key: string]: number } = {};
  memories.forEach((m) => {
    if (m.emotion) {
      emotionCounts[m.emotion] = (emotionCounts[m.emotion] || 0) + 1;
    }
  });

  const topEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.statsContainer}
      contentContainerStyle={[
        styles.statsContent,
        { paddingBottom: tabBarHeight + Spacing.xl },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsGrid}>
        <StatCard
          icon="check-circle"
          value={stats?.activeDeposits ?? activeMemories.length}
          label="Ready"
        />
        <StatCard
          icon="clock"
          value={stats?.cooldownDeposits ?? cooldownMemories.length}
          label="Cooldown"
        />
        <StatCard
          icon="database"
          value={stats?.totalDeposits || memories.length}
          label="Total Moments"
        />
        <StatCard
          icon="cloud-rain"
          value={stats?.totalRainyDays || 0}
          label="Rainy Days"
        />
      </View>

      {topEmotions.length > 0 ? (
        <Animated.View entering={FadeIn.delay(200).duration(300)}>
          <ThemedText style={[styles.sectionLabel, { fontFamily: "Nunito_600SemiBold" }]}>
            Top Emotions
          </ThemedText>
          <View style={[styles.emotionsCard, { backgroundColor: theme.backgroundDefault }]}>
            {topEmotions.map(([emotion, count], index) => (
              <View key={emotion} style={styles.emotionRow}>
                <View style={styles.emotionInfo}>
                  <View
                    style={[
                      styles.emotionRank,
                      { backgroundColor: Colors.light.primary + "15" },
                    ]}
                  >
                    <ThemedText
                      style={[styles.emotionRankText, { color: Colors.light.primary }]}
                    >
                      {index + 1}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.emotionName}>{emotion}</ThemedText>
                </View>
                <ThemedText style={[styles.emotionCount, { color: theme.textSecondary }]}>
                  {count} {count === 1 ? "moment" : "moments"}
                </ThemedText>
              </View>
            ))}
          </View>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
}

function groupMemoriesByMonth(memories: Memory[]): MemorySection[] {
  const groups: { [key: string]: Memory[] } = {};

  memories.forEach((memory) => {
    const date = new Date(memory.createdAt);
    const key = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(memory);
  });

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function groupMemoriesByTag(memories: Memory[]): MemorySection[] {
  const groups: { [key: string]: Memory[] } = {};

  memories.forEach((memory) => {
    const tag = memory.emotion || "Untagged";
    if (!groups[tag]) {
      groups[tag] = [];
    }
    groups[tag].push(memory);
  });

  const entries = Object.entries(groups);
  entries.sort((a, b) => b[1].length - a[1].length);

  return entries.map(([title, data]) => ({ title, data }));
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [memories, setMemories] = useState<Memory[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"moments" | "stats">("moments");
  const [viewMode, setViewMode] = useState<"chronological" | "tag">("chronological");
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const loadMemories = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const [depositsRes, statsRes] = await Promise.all([
        fetch(new URL("/api/deposits?includeInactive=true", baseUrl).toString()),
        fetch(new URL("/api/stats", baseUrl).toString()),
      ]);

      if (depositsRes.ok) {
        const data = await depositsRes.json();
        setMemories(data);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
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

  const handleUpdateStatus = async (id: string, status: number) => {
    try {
      await apiRequest("PATCH", `/api/deposits/${id}/status`, { status });
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, status } : m))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error updating status:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleUpdateMemory = async (id: string, content: string, emotion: string | undefined, tags: string[]) => {
    try {
      await apiRequest("PATCH", `/api/deposits/${id}`, { content, emotion, tags });
      setMemories((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content, emotion, tags } : m))
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error updating memory:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const filteredMemories = memories.filter((m) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      m.content?.toLowerCase().includes(query) ||
      m.emotion?.toLowerCase().includes(query)
    );
  });

  const sections = viewMode === "chronological" 
    ? groupMemoriesByMonth(filteredMemories)
    : groupMemoriesByTag(filteredMemories);

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 48 }]}>
        <ThemedText style={[styles.title, { fontFamily: "Nunito_700Bold" }]}>
          History
        </ThemedText>

        <View style={styles.tabContainer}>
          <Pressable
            onPress={() => setActiveTab("moments")}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "moments" ? Colors.light.primary : theme.backgroundDefault,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === "moments" ? "#FFFFFF" : theme.text },
              ]}
            >
              Moments
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab("stats")}
            style={[
              styles.tab,
              {
                backgroundColor:
                  activeTab === "stats" ? Colors.light.primary : theme.backgroundDefault,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.tabText,
                { color: activeTab === "stats" ? "#FFFFFF" : theme.text },
              ]}
            >
              Stats
            </ThemedText>
          </Pressable>
        </View>

        {activeTab === "moments" ? (
          <>
            <View style={styles.viewModeContainer}>
              <Pressable
                onPress={() => setViewMode("chronological")}
                style={[
                  styles.viewModeButton,
                  {
                    backgroundColor:
                      viewMode === "chronological" ? Colors.light.primary + "20" : "transparent",
                  },
                ]}
              >
                <Feather
                  name="calendar"
                  size={16}
                  color={viewMode === "chronological" ? Colors.light.primary : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.viewModeText,
                    { color: viewMode === "chronological" ? Colors.light.primary : theme.textSecondary },
                  ]}
                >
                  By Date
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setViewMode("tag")}
                style={[
                  styles.viewModeButton,
                  {
                    backgroundColor:
                      viewMode === "tag" ? Colors.light.primary + "20" : "transparent",
                  },
                ]}
              >
                <Feather
                  name="tag"
                  size={16}
                  color={viewMode === "tag" ? Colors.light.primary : theme.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.viewModeText,
                    { color: viewMode === "tag" ? Colors.light.primary : theme.textSecondary },
                  ]}
                >
                  By Tag
                </ThemedText>
              </Pressable>
            </View>
            <View
              style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault }]}
            >
              <Feather name="search" size={18} color={theme.textSecondary} />
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search moments..."
                placeholderTextColor={theme.textSecondary}
                style={[styles.searchInput, { color: theme.text }]}
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery("")}>
                  <Feather name="x" size={18} color={theme.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {activeTab === "moments" ? (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DepositRow
              memory={item}
              onPress={() => navigation.navigate("MemoryDetail", { memory: item })}
              onStatusPress={() => {
                setSelectedMemory(item);
                setStatusModalVisible(true);
              }}
              onEditPress={() => {
                setSelectedMemory(item);
                setEditModalVisible(true);
              }}
            />
          )}
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={[styles.sectionTitle, { fontFamily: "Nunito_600SemiBold" }]}>
                {title}
              </ThemedText>
              <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
                {data.length}
              </ThemedText>
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingBottom: tabBarHeight + Spacing.xl,
            },
            filteredMemories.length === 0 && styles.emptyContent,
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
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={loading ? null : <EmptyState />}
        />
      ) : (
        <StatsView stats={stats} memories={memories} />
      )}

      <StatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        memory={selectedMemory}
        onUpdateStatus={handleUpdateStatus}
      />

      <EditModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        memory={selectedMemory}
        onSave={handleUpdateMemory}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 24,
    textAlign: "center" as const,
    marginBottom: Spacing.lg,
  },
  tabContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  tabText: {
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
  },
  viewModeContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  viewModeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  viewModeText: {
    fontSize: 13,
    fontFamily: "Nunito_500Medium",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContent: {
    flex: 1,
    justifyContent: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 15,
    letterSpacing: 0.3,
  },
  sectionCount: {
    fontSize: 13,
  },
  depositRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  depositContent: {
    flex: 1,
    marginHorizontal: Spacing.md,
  },
  depositText: {
    fontSize: 15,
    marginBottom: Spacing.xs,
    fontFamily: "Nunito_400Regular",
    lineHeight: 21,
  },
  depositMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  depositDate: {
    fontSize: 12,
  },
  emotionBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  emotionBadgeText: {
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  editIconButton: {
    padding: Spacing.sm,
  },
  statusButton: {
    padding: Spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Nunito_600SemiBold",
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontSize: 18,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    maxWidth: 240,
  },
  statsContainer: {
    flex: 1,
  },
  statsContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: "47%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  statValue: {
    fontSize: 28,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  emotionsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  emotionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  emotionInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  emotionRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emotionRankText: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
  },
  emotionName: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
  },
  emotionCount: {
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  editModalContent: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  currentStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  modalLabel: {
    fontSize: 14,
  },
  modalActions: {
    gap: Spacing.md,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  actionText: {
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
  },
  cooldownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  cooldownInput: {
    width: 72,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 14,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
  },
  cooldownButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  cooldownButtonText: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
  },
  cancelButton: {
    marginTop: Spacing.lg,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 15,
    fontFamily: "Nunito_500Medium",
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: Spacing.sm,
    fontFamily: "Nunito_500Medium",
  },
  editInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
    minHeight: 100,
    textAlignVertical: "top",
  },
  emotionScroll: {
    marginTop: Spacing.xs,
  },
  emotionScrollContent: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  emotionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  emotionChipText: {
    fontSize: 13,
    fontFamily: "Nunito_500Medium",
  },
  editTagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  customTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  addTagButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  customTagInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    fontSize: 15,
    fontFamily: "Nunito_400Regular",
  },
  editActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.xl,
  },
  editButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  editButtonText: {
    fontSize: 15,
    fontFamily: "Nunito_600SemiBold",
  },
});
