# Web-based Mahjong - Project Specification

## 1. Project Overview

### Project Name
Web-based Mahjong

### Project Type
Browser-based multiplayer game

### Core Functionality Summary
A web-based implementation of the classic Mahjong tile-matching game, featuring multiplayer support, AI opponents, and a polished user interface built with modern web technologies.

### Target Users
- Casual gamers who enjoy classic tile-matching games
- Players looking for both solo and multiplayer Mahjong experiences

---

## 2. Technical Specification

### Frontend Technologies
- **Framework**: React.js
- **Styling**: CSS3 with responsive design
- **State Management**: React hooks / Redux
- **Build Tool**: Vite

### Backend Technologies
- **Runtime**: Node.js
- **Framework**: Express.js
- **WebSocket**: Socket.IO for real-time multiplayer
- **Database**: SQLite for game state persistence

---

## 3. Functionality Specification

### Core Features
1. **Single Player Mode**
   - Solo gameplay against AI opponents
   - Difficulty levels: Easy, Medium, Hard
   - Score tracking and leaderboard

2. **Multiplayer Mode**
   - Real-time multiplayer support (2-4 players)
   - Lobby system for matchmaking
   - Chat functionality

3. **Game Mechanics**
   - Standard Mahjong tile set (144 tiles)
   - Traditional scoring rules
   - Tile matching validation

4. **User Interface**
   - Responsive design (desktop and mobile)
   - Drag-and-drop tile selection
   - Visual tile highlighting for valid matches
   - Animated tile removal effects

5. **User Management**
   - User registration and login
   - Profile management
   - Game history and statistics

### User Interactions and Flows
1. User opens the application and lands on the home page
2. User can choose between Single Player or Multiplayer mode
3. Single Player: Select difficulty → Start game → Play until tiles cleared or no moves available
4. Multiplayer: Join/Create lobby → Wait for players → Play game

### Edge Cases
- Handle disconnection during multiplayer games
- Validate tile matching rules strictly
- Handle browser refresh/resume game scenarios
- Empty tile matching pool detection

---

## 4. UI/UX Specification

### Layout Structure
- **Header**: Logo, navigation menu, user profile
- **Main Content**: Game board (center), side panels for info
- **Footer**: Credits, version info

### Visual Design
- **Color Palette**:
  - Primary: #2C3E50 (Dark Blue)
  - Secondary: #E74C3C (Coral Red)
  - Accent: #F1C40F (Gold)
  - Background: #ECF0F1 (Light Gray)
  - Text: #2C3E50 (Dark Blue)

- **Typography**: 
  - Headers: 'Segoe UI', sans-serif
  - Body: 'Arial', sans-serif

- **Spacing**: 8px base unit, 16px standard padding

### Component States
- **Tiles**: Default, Hover (glow effect), Selected (highlighted border), Matched (fade out)
- **Buttons**: Default, Hover (lighter shade), Active (pressed effect), Disabled (grayed out)

---

## 5. Project Structure

```
web-mahjong/
├── src/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   └── utils/
├── public/
├── server/
│   ├── routes/
│   ├── models/
│   └── controllers/
├── SPEC.md
├── README.md
└── package.json
```

---

## 6. Acceptance Criteria

1. ✅ Game board displays correctly with all 144 tiles arranged in traditional layout
2. ✅ Only matching tiles that are unblocked can be selected
3. ✅ Tiles are removed with animation when a valid match is made
4. ✅ Game detects when no more valid moves are available
5. ✅ Single player mode works with AI opponents
6. ✅ Multiplayer mode supports 2-4 players in real-time
7. ✅ User can register, login, and view game statistics
8. ✅ UI is responsive and works on both desktop and mobile devices
9. ✅ All game rules follow standard Mahjong specifications
