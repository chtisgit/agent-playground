import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../services/gameService';
import GameBoard from '../components/GameBoard';
import './SinglePlayer.css';

const DIFFICULTIES = {
  easy: { label: 'Easy', matches: 30 },
  medium: { label: 'Medium', matches: 20 },
  hard: { label: 'Hard', matches: 10 },
};

function SinglePlayer() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [matches, setMatches] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const startGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await gameService.startSinglePlayer(difficulty);
      setGameState(response.game);
      setScore(response.game.score || 0);
      setMatches(response.game.matches || 0);
      setGameOver(false);
    } catch (err) {
      setError('Failed to start game. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [difficulty]);

  useEffect(() => {
    startGame();
  }, []);

  const handleTileClick = async (tileIndex) => {
    if (loading || gameOver) return;
    
    try {
      const result = await gameService.makeMove(gameState.id, tileIndex);
      setGameState(result.game);
      setScore(result.game.score);
      setMatches(result.game.matches);
      
      if (result.game.ended) {
        setGameOver(true);
        await gameService.endGame(gameState.id, result.game.score);
      }
    } catch (err) {
      console.error('Move failed:', err);
    }
  };

  const handleHint = async () => {
    try {
      const hint = await gameService.hint(gameState.id);
      setGameState({ ...gameState, hintTile: hint.tileIndex });
    } catch (err) {
      console.error('Hint failed:', err);
    }
  };

  const handleShuffle = async () => {
    try {
      const result = await gameService.shuffle(gameState.id);
      setGameState(result.game);
    } catch (err) {
      console.error('Shuffle failed:', err);
    }
  };

  const handleNewGame = () => {
    startGame();
  };

  if (loading && !gameState) {
    return <div className="loading">Loading game...</div>;
  }

  return (
    <div className="single-player-container">
      <div className="game-header">
        <h2>Single Player Mode</h2>
        
        {!gameState || gameOver ? (
          <div className="game-over-panel">
            <h3>{gameOver ? 'Game Over!' : 'Select Difficulty'}</h3>
            {gameOver && <p>Final Score: {score}</p>}
            <div className="difficulty-select">
              {Object.entries(DIFFICULTIES).map(([key, { label }]) => (
                <button
                  key={key}
                  className={`btn ${difficulty === key ? 'btn-selected' : ''}`}
                  onClick={() => setDifficulty(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={handleNewGame}>
              {gameOver ? 'Play Again' : 'Start Game'}
            </button>
          </div>
        ) : (
          <>
            <div className="game-stats">
              <span>Score: {score}</span>
              <span>Matches: {matches}/{DIFFICULTIES[difficulty].matches}</span>
            </div>
            <div className="game-controls">
              <button className="btn btn-secondary" onClick={handleHint}>
                Hint
              </button>
              <button className="btn btn-secondary" onClick={handleShuffle}>
                Shuffle
              </button>
              <button className="btn btn-outline" onClick={handleNewGame}>
                New Game
              </button>
            </div>
          </>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {gameState && !gameOver && (
        <GameBoard
          tiles={gameState.tiles}
          onTileClick={handleTileClick}
          hintTile={gameState.hintTile}
        />
      )}
    </div>
  );
}

export default SinglePlayer;
