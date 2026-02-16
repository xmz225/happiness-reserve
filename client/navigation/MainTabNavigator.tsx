import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import HistoryStackNavigator from "@/navigation/HistoryStackNavigator";
import SettingsStackNavigator from "@/navigation/SettingsStackNavigator";
import DepositScreen from "@/screens/DepositScreen";
import RainyDayScreen from "@/screens/RainyDayScreen";
import CircleScreen from "@/screens/CircleScreen";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type MainTabParamList = {
  HomeTab: undefined;
  CircleTab: undefined;
  DepositTab: undefined;
  RainyTab: undefined;
  HistoryTab: undefined;
  SettingsTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const screenOptions = useScreenOptions();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.light.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DepositTab"
        component={DepositScreen}
        options={{
          title: "Deposit",
          headerShown: true,
          headerTitle: "Add a Moment",
          ...screenOptions,
          tabBarIcon: ({ color, size }) => (
            <Feather name="plus-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="RainyTab"
        component={RainyDayScreen}
        options={{
          title: "Rainy",
          headerShown: true,
          headerTitle: "Rainy Day",
          ...screenOptions,
          tabBarIcon: ({ color, size }) => (
            <Feather name="cloud-rain" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="CircleTab"
        component={CircleScreen}
        options={{
          title: "Circle",
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Feather name="clock" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStackNavigator}
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
