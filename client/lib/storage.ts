import AsyncStorage from "@react-native-async-storage/async-storage";

export type MemoryType = "photo" | "video" | "audio";

export interface Memory {
  id: string;
  content: string;
  emotion?: string;
  mediaUri?: string;
  mediaType?: MemoryType;
  createdAt: string;
  tags: string[];
  lastSurfacedAt?: string;
  status?: number;
}

export interface RainyDayLog {
  id: string;
  emotion: string;
  memoryId: string;
  createdAt: string;
}

export interface UserSettings {
  displayName: string;
  avatarUri?: string;
  resurfaceIntervalDays: number;
  dailyBoostReminder: boolean;
  summaryFrequencyWeeks: number;
  rainyDayMomentCount: number;
}

const MEMORIES_KEY = "@happiness_reserve_memories";
const SETTINGS_KEY = "@happiness_reserve_settings";
const RAINY_DAY_LOG_KEY = "@happiness_reserve_rainy_day_log";

const defaultSettings: UserSettings = {
  displayName: "",
  resurfaceIntervalDays: 30,
  dailyBoostReminder: false,
  summaryFrequencyWeeks: 2,
  rainyDayMomentCount: 1,
};

export const EMOTION_PRESETS = [
  { id: "grateful", label: "Grateful", icon: "heart" },
  { id: "win", label: "A small win", icon: "award" },
  { id: "kindness", label: "A kind thing", icon: "gift" },
  { id: "joy", label: "Pure joy", icon: "sun" },
  { id: "peace", label: "Peaceful moment", icon: "feather" },
  { id: "love", label: "Love", icon: "heart" },
];

export async function getMemories(): Promise<Memory[]> {
  try {
    const data = await AsyncStorage.getItem(MEMORIES_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Error loading memories:", error);
    return [];
  }
}

export async function saveMemory(memory: Omit<Memory, "id" | "createdAt">): Promise<Memory> {
  const memories = await getMemories();
  const newMemory: Memory = {
    ...memory,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  memories.unshift(newMemory);
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
  return newMemory;
}

export async function updateMemory(id: string, updates: Partial<Memory>): Promise<Memory | null> {
  const memories = await getMemories();
  const index = memories.findIndex((m) => m.id === id);
  if (index === -1) return null;
  
  memories[index] = { ...memories[index], ...updates };
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(memories));
  return memories[index];
}

export async function deleteMemory(id: string): Promise<boolean> {
  const memories = await getMemories();
  const filtered = memories.filter((m) => m.id !== id);
  if (filtered.length === memories.length) return false;
  
  await AsyncStorage.setItem(MEMORIES_KEY, JSON.stringify(filtered));
  return true;
}

export async function getSettings(): Promise<UserSettings> {
  try {
    const data = await AsyncStorage.getItem(SETTINGS_KEY);
    if (data) {
      return { ...defaultSettings, ...JSON.parse(data) };
    }
    return defaultSettings;
  } catch (error) {
    console.error("Error loading settings:", error);
    return defaultSettings;
  }
}

export async function saveSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const current = await getSettings();
  const updated = { ...current, ...settings };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  return updated;
}

export async function getEligibleMemoryForSurfacing(): Promise<Memory | null> {
  const memories = await getMemories();
  const settings = await getSettings();
  
  if (memories.length === 0) return null;
  
  const now = new Date();
  const intervalMs = settings.resurfaceIntervalDays * 24 * 60 * 60 * 1000;
  
  const eligible = memories.filter((memory) => {
    if (!memory.lastSurfacedAt) return true;
    const lastSurfaced = new Date(memory.lastSurfacedAt);
    return now.getTime() - lastSurfaced.getTime() >= intervalMs;
  });
  
  if (eligible.length === 0) {
    return memories[Math.floor(Math.random() * memories.length)];
  }
  
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export async function markMemoryAsSurfaced(id: string): Promise<void> {
  await updateMemory(id, { lastSurfacedAt: new Date().toISOString() });
}

export async function getRainyDayLogs(): Promise<RainyDayLog[]> {
  try {
    const data = await AsyncStorage.getItem(RAINY_DAY_LOG_KEY);
    if (data) {
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error("Error loading rainy day logs:", error);
    return [];
  }
}

export async function saveRainyDayLog(emotion: string, memoryId: string): Promise<RainyDayLog> {
  const logs = await getRainyDayLogs();
  const newLog: RainyDayLog = {
    id: generateId(),
    emotion,
    memoryId,
    createdAt: new Date().toISOString(),
  };
  logs.unshift(newLog);
  await AsyncStorage.setItem(RAINY_DAY_LOG_KEY, JSON.stringify(logs));
  return newLog;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getDaysSince(dateString: string): number {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}
