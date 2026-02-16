import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  Modal,
  TextInput,
  Share,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";

import { useTheme } from "@/hooks/useTheme";
import { useUser } from "@/contexts/UserContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

interface Connection {
  id: string;
  connectedUserId: string;
  status: string;
  createdAt: string;
  connectedUser: {
    id: string;
    displayName: string | null;
  };
}

export default function CircleScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, loading: userLoading } = useUser();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteType, setInviteType] = useState<"link" | "phone" | "email">("link");
  const [inviteValue, setInviteValue] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  const fetchConnections = async () => {
    if (!user) return;
    
    try {
      const response = await apiRequest("GET", `/api/circle/connections/${user.id}`);
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchConnections();
      }
    }, [user])
  );

  const handleCreateInvite = async () => {
    if (!user) return;
    
    setCreatingInvite(true);
    try {
      const response = await apiRequest("POST", "/api/circle/invites", {
        senderId: user.id,
        inviteType,
        inviteValue: inviteType !== "link" ? inviteValue : null,
      });
      const invite = await response.json();
      setInviteCode(invite.inviteCode);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error creating invite:", error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleShareInvite = async () => {
    const baseUrl = getApiUrl().replace("/api", "");
    const inviteUrl = `${baseUrl}/invite/${inviteCode}`;
    const message = `Join my Circle on Happiness Reserve! Use this link to connect: ${inviteUrl}`;

    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(message);
        alert("Invite link copied to clipboard!");
      } else {
        await Share.share({ message });
      }
    } catch (error) {
      console.error("Error sharing invite:", error);
    }
  };

  const handleRemoveConnection = async (connectionId: string) => {
    if (!user) return;
    
    try {
      await apiRequest("DELETE", `/api/circle/connections/${connectionId}`, { userId: user.id });
      setConnections(connections.filter(c => c.id !== connectionId));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error("Error removing connection:", error);
    }
  };

  const renderConnection = ({ item, index }: { item: Connection; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable
        style={[styles.connectionCard, { backgroundColor: theme.backgroundDefault }]}
        onPress={() => navigation.navigate("SendDeposit", { connection: item })}
      >
        <View style={[styles.avatar, { backgroundColor: Colors.light.primary + "20" }]}>
          <Feather name="user" size={24} color={Colors.light.primary} />
        </View>
        <View style={styles.connectionInfo}>
          <ThemedText style={[styles.connectionName, { fontFamily: "Nunito_600SemiBold" }]}>
            {item.connectedUser.displayName || "Friend"}
          </ThemedText>
          <ThemedText style={[styles.connectionStatus, { color: theme.textSecondary }]}>
            Connected
          </ThemedText>
        </View>
        <Pressable
          onPress={() => handleRemoveConnection(item.id)}
          style={styles.removeButton}
          hitSlop={8}
        >
          <Feather name="x" size={18} color={theme.textSecondary} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: Colors.light.primary + "15" }]}>
        <Feather name="users" size={48} color={Colors.light.primary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { fontFamily: "Nunito_600SemiBold" }]}>
        Your Circle is Empty
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        Invite friends and family to share moments of joy with each other
      </ThemedText>
      <Pressable
        onPress={() => setShowInviteModal(true)}
        style={[styles.inviteButton, { backgroundColor: Colors.light.primary }]}
      >
        <Feather name="user-plus" size={20} color="#FFFFFF" />
        <ThemedText style={[styles.inviteButtonText, { color: "#FFFFFF" }]}>
          Invite Someone
        </ThemedText>
      </Pressable>
    </View>
  );

  if (userLoading || loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={connections}
        keyExtractor={(item) => item.id}
        renderItem={renderConnection}
        contentContainerStyle={[
          styles.listContent,
          {
            paddingTop: insets.top + 48,
            paddingBottom: tabBarHeight + Spacing.xl,
          },
          connections.length === 0 ? styles.emptyList : null,
        ]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          connections.length > 0 ? (
            <View style={styles.header}>
              <ThemedText style={[styles.title, { fontFamily: "Nunito_700Bold" }]}>
                My Circle
              </ThemedText>
              <Pressable
                onPress={() => setShowInviteModal(true)}
                style={[styles.addButton, { backgroundColor: Colors.light.primary }]}
              >
                <Feather name="user-plus" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={renderEmptyState}
      />

      <Modal
        visible={showInviteModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowInviteModal(false);
          setInviteCode("");
          setInviteValue("");
        }}
      >
        <View style={styles.modalOverlay}>
          <Animated.View 
            style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
            entering={FadeIn.duration(200)}
          >
            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { fontFamily: "Nunito_700Bold" }]}>
                Invite to Circle
              </ThemedText>
              <Pressable
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteCode("");
                  setInviteValue("");
                }}
              >
                <Feather name="x" size={24} color={theme.text} />
              </Pressable>
            </View>

            {inviteCode ? (
              <View style={styles.inviteSuccess}>
                <View style={[styles.successIcon, { backgroundColor: "#22C55E20" }]}>
                  <Feather name="check" size={32} color="#22C55E" />
                </View>
                <ThemedText style={[styles.successText, { fontFamily: "Nunito_600SemiBold" }]}>
                  Invite Created
                </ThemedText>
                <ThemedText style={[styles.inviteCodeLabel, { color: theme.textSecondary }]}>
                  Share this code with your friend:
                </ThemedText>
                <View style={[styles.codeBox, { backgroundColor: theme.backgroundRoot }]}>
                  <ThemedText style={[styles.codeText, { fontFamily: "Nunito_700Bold" }]}>
                    {inviteCode}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={handleShareInvite}
                  style={[styles.shareButton, { backgroundColor: Colors.light.primary }]}
                >
                  <Feather name="share" size={18} color="#FFFFFF" />
                  <ThemedText style={[styles.shareButtonText, { color: "#FFFFFF" }]}>
                    Share Invite
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.inviteTypeRow}>
                  {(["link", "phone", "email"] as const).map((type) => (
                    <Pressable
                      key={type}
                      onPress={() => setInviteType(type)}
                      style={[
                        styles.inviteTypeButton,
                        {
                          backgroundColor:
                            inviteType === type
                              ? Colors.light.primary
                              : theme.backgroundRoot,
                        },
                      ]}
                    >
                      <Feather
                        name={type === "link" ? "link" : type === "phone" ? "phone" : "mail"}
                        size={18}
                        color={inviteType === type ? "#FFFFFF" : theme.text}
                      />
                      <ThemedText
                        style={[
                          styles.inviteTypeText,
                          { color: inviteType === type ? "#FFFFFF" : theme.text },
                        ]}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>

                {inviteType !== "link" ? (
                  <TextInput
                    value={inviteValue}
                    onChangeText={setInviteValue}
                    placeholder={inviteType === "phone" ? "Phone number" : "Email address"}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType={inviteType === "phone" ? "phone-pad" : "email-address"}
                    autoCapitalize="none"
                    style={[
                      styles.inviteInput,
                      { backgroundColor: theme.backgroundRoot, color: theme.text },
                    ]}
                  />
                ) : null}

                <Pressable
                  onPress={handleCreateInvite}
                  disabled={creatingInvite}
                  style={[styles.createInviteButton, { backgroundColor: Colors.light.primary }]}
                >
                  {creatingInvite ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={[styles.createInviteText, { color: "#FFFFFF" }]}>
                      Create Invite
                    </ThemedText>
                  )}
                </Pressable>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
  },
  emptyList: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: 24,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  connectionName: {
    fontSize: 16,
  },
  connectionStatus: {
    fontSize: 13,
    marginTop: 2,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  inviteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  inviteButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
  },
  inviteTypeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  inviteTypeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  inviteTypeText: {
    fontSize: 14,
    fontFamily: "Nunito_500Medium",
  },
  inviteInput: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  createInviteButton: {
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  createInviteText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
  inviteSuccess: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  successText: {
    fontSize: 18,
    marginBottom: Spacing.sm,
  },
  inviteCodeLabel: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  codeBox: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  codeText: {
    fontSize: 24,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: "Nunito_600SemiBold",
  },
});
