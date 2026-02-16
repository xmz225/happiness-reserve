import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import MemoryDetailScreen from "@/screens/MemoryDetailScreen";
import PlaybackScreen from "@/screens/PlaybackScreen";
import SendDepositScreen from "@/screens/SendDepositScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { Memory } from "@/lib/storage";

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

export type RootStackParamList = {
  Main: undefined;
  MemoryDetail: { memory: Memory };
  Playback: {
    memory: Memory;
    emotion: string;
    logId?: string;
    sessionTarget: number;
    sessionShown: number;
    sessionThumbsUp: number;
    excludeIds: string[];
  };
  SendDeposit: { connection: Connection };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MemoryDetail"
        component={MemoryDetailScreen}
        options={{
          headerTitle: "Deposit Details",
        }}
      />
      <Stack.Screen
        name="Playback"
        component={PlaybackScreen}
        options={{
          presentation: "modal",
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SendDeposit"
        component={SendDepositScreen}
        options={{
          headerTitle: "Send Joy",
        }}
      />
    </Stack.Navigator>
  );
}
