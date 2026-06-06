import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './Header.css';

function Header({ isAuthenticated, setIsAuthenticated }) {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    navigate('/');
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <span className="logo-icon">麻</span>
          <span className="logo-text">Web Mahjong</span>
        </Link>
        
        <nav className="nav">
          <Link 
            to="/" 
            className={`nav-link ${location.pathname === '/' ? 'active' : ''}`}
          >
            Home
          </Link>
          <Link 
            to="/single-player" 
            className={`nav-link ${location.pathname === '/single-player' ? 'active' : ''}`}
          >
            Single Player
          </Link>
          <Link 
            to="/multiplayer" 
            className={`nav-link ${location.pathname === '/multiplayer' ? 'active' : ''}`}
          >
            Multiplayer
          </Link>
          <Link 
            to="/profile" 
            className={`nav-link ${location.pathname === '/profile' ? 'active' : ''}`}
          >
            Profile
          </Link>
        </nav>

        <div className="auth-section">
          {isAuthenticated ? (
            <button onClick={handleLogout} className="btn btn-outline btn-sm">
              Logout
            </button>
          ) : (
            <Link to="/login" className="btn btn-primary btn-sm">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export default Header;
