import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";

const DEVICE_ID_KEY = "@happiness_reserve_device_id";

interface User {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  summaryFrequencyWeeks: number | null;
}

interface UserContextType {
  user: User | null;
  loading: boolean;
  updateUser: (data: Partial<User>) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function generateDeviceId(): string {
  return "device_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const initializeUser = async () => {
    try {
      let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
      
      if (!deviceId) {
        deviceId = generateDeviceId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
      }

      const response = await apiRequest("POST", "/api/users/current", { deviceId });
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error("Error initializing user:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initializeUser();
  }, []);

  const updateUser = async (data: Partial<User>) => {
    if (!user) return;
    
    try {
      const response = await apiRequest("PATCH", `/api/users/${user.id}/settings`, data);
      const updated = await response.json();
      setUser(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  };

  const refreshUser = async () => {
    await initializeUser();
  };

  return (
    <UserContext.Provider value={{ user, loading, updateUser, refreshUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
