import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import SinglePlayer from './pages/SinglePlayer';
import MultiplayerLobby from './pages/MultiplayerLobby';
import Profile from './pages/Profile';
import Header from './components/Header';
import './styles.css';

// Protected route component - redirects to login if not authenticated
function ProtectedRoute({ children }) {
  const token = localStorage.getItem('authToken');
  return token ? children : <Navigate to="/login" />;
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
  }, []);

  return (
    <BrowserRouter>
      <div className="app-container">
        <Header isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            {/* Single-player is public - no login needed */}
            <Route path="/single-player" element={<SinglePlayer />} />
            {/* Multiplayer requires login */}
            <Route 
              path="/multiplayer" 
              element={
                <ProtectedRoute>
                  <MultiplayerLobby />
                </ProtectedRoute>
              } 
            />
            {/* Profile requires login */}
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              } 
            />
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
