# Happiness Reserve - Design Guidelines

## Brand Identity

**Purpose**: A piggybank for happiness. Users deposit joyful moments (photos, videos, audio) and make withdrawals on rainy days when they need emotional support.

**Metaphor**: Just like a piggybank saves money for later, Happiness Reserve saves happy moments that can be "withdrawn" when feeling down.

## Navigation Architecture

**5 Bottom Tabs**:
1. **Home** - Reserve balance, quick emotion tags, action shortcuts
2. **Deposit** - Add new happy moments with emotion tagging and media
3. **Rainy** - Rainy day mode to get a deposit when feeling down
4. **History** - Browse all saved deposits chronologically
5. **Settings** - Preferences and app settings

**Modal Screens**:
- **Playback** - Auto-plays a deposit when triggered from Rainy Day

## Color Palette

- **Primary**: #F4A261 (Warm amber - main actions, positive emotions)
- **Secondary**: #E76F51 (Coral - highlights, delete actions, negative emotions)
- **Background**: #FFFCF9 (Warm off-white)
- **Surface**: #FFFFFF (Cards, inputs)
- **Text Primary**: #2D2D2D (Soft black)
- **Text Secondary**: #6B6B6B (Gray)
- **Success**: #A8DADC (Soft teal)
- **Border**: #E8E0D8 (Subtle warm gray)

## Typography

**Font**: Nunito (Google Font)

**Type Scale**:
- Display: 28-32px, Bold (titles)
- Balance Number: 64px, Bold (reserve count)
- Headline: 20px, SemiBold (section headers)
- Body: 16px, Regular (content)
- Caption: 14px, Medium (labels, chips)
- Small: 12-13px, Regular (metadata)

## Visual Design

- **Buttons**: Rounded corners (16px), full-width for primary actions
- **Cards**: 16px radius, subtle elevation
- **Chips**: Pill-shaped (full radius), used for emotion selection
- **Icons**: Feather icons from @expo/vector-icons
- **Spacing**: 8px base unit

## Terminology

- **Deposit**: A saved happy moment (not "memory")
- **Reserve Balance**: Count of total deposits
- **Rainy Day**: When user needs emotional support
- **Withdrawal**: Viewing a deposit on a rainy day

## Emotion Presets

**For Deposits (Positive)**:
- Grateful for...
- A small win
- A kind thing
- Pure joy
- Peaceful moment
- Love

**For Rainy Days (Negative)**:
- Sad
- Anxious
- Lonely
- Stressed
- Tired
- Overwhelmed

## Core Flows

1. **Deposit Flow**: User describes moment → selects emotion → optionally adds media → saves
2. **Rainy Day Flow**: User selects how they feel → app picks a deposit → auto-plays with encouraging message
3. **History Browse**: View all deposits by month → tap to see details → option to delete
