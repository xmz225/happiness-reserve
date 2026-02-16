# Happiness Reserve

## Overview

Happiness Reserve is a mobile-first emotional wellness app built with React Native/Expo. It serves as a personal sanctuary for collecting and preserving joyful moments to build emotional resilience. Users can save memories (text, photos, videos, audio) and when feeling low, the app surfaces saved memories with encouraging messages to remind them of brighter times.

The app features a "inner glow" visualization concept - an abstract, ethereal orb of warm light that represents accumulated happiness. The more moments collected, the brighter it glows.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React Native with Expo SDK 54 (new architecture enabled)
- **Navigation**: React Navigation v7 with native stack and bottom tabs
  - Root stack navigator handles modals and detail screens (MemoryDetail, Playback, SendDeposit)
  - Bottom tab navigator with 6 tabs: Home, Circle, Deposit, Rainy Day, History, Settings
  - Each tab has its own stack navigator for internal navigation
- **State Management**: TanStack React Query for server state, local component state for UI
- **Styling**: StyleSheet API with a custom theme system supporting light/dark modes
- **Animations**: React Native Reanimated for smooth, gesture-driven animations
- **Typography**: Nunito font family (Google Fonts) loaded via expo-font

### Design System
- Warm, refined aesthetic with amber/coral accent colors
- Custom theming via `@/constants/theme.ts` with Colors, Spacing, BorderRadius, Typography
- Themed components: ThemedText, ThemedView, Button, Card
- Platform-aware blur effects for iOS tab bar and headers

### Data Storage
- **Local Storage**: AsyncStorage for persisting memories and user settings locally
- **Server Database**: PostgreSQL with Drizzle ORM (schema in `shared/schema.ts`)
- Current implementation uses in-memory storage on server (`MemStorage` class) with PostgreSQL schema ready for migration

### Backend Architecture
- Express.js server with TypeScript
- CORS configured for Replit domains and localhost development
- Routes registered in `server/routes.ts`
- Shared types between client and server via `@shared/*` path alias

### Key Features
- **Memory Types**: Text, photo, video, audio support
- **Media Handling**: expo-image-picker for photos/videos, expo-av for playback
- **Mood Check-in Flow**: User selects mood → app surfaces relevant memory with encouraging message
- **Memory Surfacing**: Algorithm tracks last surfaced date to show forgotten memories
- **Circle Feature**: Connect with friends/family to share happy moments
  - Invite via link, phone, or email with 7-day expiring codes
  - Bi-directional connections (two records per pair)
  - Share deposits with connections (privacy-preserving - senders don't see when used)
  - Receive periodic summaries about how shared moments helped (configurable 1-13 weeks)
- **User Context**: Device ID-based user identification via UserContext provider

### Path Aliases
- `@/*` → `./client/*`
- `@shared/*` → `./shared/*`

## External Dependencies

### Core Services
- **PostgreSQL Database**: Connection via DATABASE_URL environment variable, managed through Drizzle ORM
- **Expo Services**: Splash screen, image picker, media library, haptics, video playback

### Key Packages
- `drizzle-orm` + `drizzle-zod`: Database ORM with Zod schema validation
- `@tanstack/react-query`: Async state management for API calls
- `react-native-reanimated`: High-performance animations
- `react-native-keyboard-controller`: Keyboard-aware scrolling
- `expo-image-picker` + `expo-media-library`: Media capture and access
- `expo-av` + `expo-video`: Audio/video playback

### Development Setup
- Metro bundler configured via Replit environment variables (EXPO_PACKAGER_PROXY_URL, REACT_NATIVE_PACKAGER_HOSTNAME)
- API URL constructed from EXPO_PUBLIC_DOMAIN environment variable
- Babel configured with module-resolver for path aliases