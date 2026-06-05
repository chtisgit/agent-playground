import { Link } from 'react-router-dom';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <section className="hero-section">
        <h1>Web Mahjong</h1>
        <p className="tagline">Classic tile-matching game for everyone</p>
      </section>

      <section className="game-modes">
        <div className="game-mode-card">
          <h2>Single Player</h2>
          <p>Challenge yourself with our adaptive AI opponent</p>
          <Link to="/single-player" className="btn btn-primary">Start Game</Link>
        </div>

        <div className="game-mode-card">
          <h2>Multiplayer</h2>
          <p>Play with friends in real-time multiplayer lobbies</p>
          <Link to="/multiplayer" className="btn btn-secondary">Join Lobby</Link>
        </div>
      </section>

      <section className="features">
        <h3>Game Features</h3>
        <ul>
          <li>144 classic Mahjong tiles</li>
          <li>Multiple difficulty levels</li>
          <li>Hint system for beginners</li>
          <li>Shuffle option when stuck</li>
          <li>Track your statistics</li>
        </ul>
      </section>
    </div>
  );
}

export default Home;
