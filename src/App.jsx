import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import SinglePlayer from './pages/SinglePlayer';
import MultiplayerLobby from './pages/MultiplayerLobby';
import Profile from './pages/Profile';
import Header from './components/Header';
import './styles.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/single-player" element={<SinglePlayer />} />
            <Route path="/multiplayer" element={<MultiplayerLobby />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </main>
        <footer className="footer">
          <p>Web Mahjong v1.0.0 | Classic tile-matching game</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
