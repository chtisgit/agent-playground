# Web-based Mahjong

A browser-based multiplayer Mahjong game built with modern web technologies.

## Project Overview

This is a full-stack web application that brings the classic Mahjong tile-matching game to the browser. The project supports both single-player mode (against AI) and multiplayer mode for 2-4 players.

## Tech Stack

### Frontend
- React.js
- CSS3 (responsive design)
- Vite (build tool)

### Backend
- Node.js
- Express.js
- Socket.IO (real-time multiplayer)
- SQLite (game state persistence)

## Getting Started

### Prerequisites
- Node.js v18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone git@github.com:chtisgit/agent-playground.git
cd agent-playground

# Install dependencies
npm install

# Start development server
npm run dev
```

## Project Structure

```
web-mahjong/
├── src/              # Frontend source code
│   ├── components/   # React components
│   ├── pages/        # Page components
│   ├── services/     # API services
│   ├── hooks/        # Custom React hooks
│   └── utils/        # Utility functions
├── public/           # Static assets
├── server/           # Backend source code
│   ├── routes/       # API routes
│   ├── models/       # Database models
│   └── controllers/  # Request handlers
├── SPEC.md           # Detailed project specification
└── package.json     # Dependencies
```

## Game Features

### Single Player Mode
- Play against AI opponents
- Three difficulty levels: Easy, Medium, Hard
- Score tracking and leaderboard

### Multiplayer Mode
- Real-time multiplayer for 2-4 players
- Lobby system for matchmaking
- In-game chat

### Game Mechanics
- 144 tiles (standard Mahjong set)
- Traditional scoring rules
- Intelligent tile matching validation

## Development Team

| Name | Role |
|------|------|
| Boris Baller | Project Manager |
| Linus Bobwald | Maintainer |
| Stefan Schnorrer | Security Specialist |
| Matthew Garfield | Software Engineer |
| Friedrich Bambusholz | Software Engineer |
| Montgomery Smith | Test Engineer |
| Jebediah Papulovski | Test Engineer |

## License

MIT License
