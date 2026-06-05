import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../services/gameService';
import { useTimer } from '../hooks/useTimer';
import { useNotifications } from '../hooks/useNotifications';
import GameBoard from '../components/GameBoard';
import Timer from '../components/Timer';
import GameNotifications from '../components/GameNotifications';
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
  const [selectedTile, setSelectedTile] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { formattedTime, reset: resetTimer, elapsedTime } = useTimer(!loading && !gameOver && !!gameState);
  const { notifications, notifyMatch, notifyHint, notifyShuffle, notifyGameOver, notifyError } = useNotifications();

  const startGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedTile(null);
    resetTimer();
    try {
      const response = await gameService.startSinglePlayer(difficulty);
      setGameState(response.game);
      setScore(response.game.score || 0);
      setMatches(response.game.matches || 0);
      setGameOver(false);
    } catch (err) {
      setError('Failed to start game. Please try again.');
      notifyError('Failed to connect to server. Please refresh the page.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [difficulty, resetTimer, notifyError]);

  useEffect(() => {
    startGame();
  }, []);

  const handleTileClick = async (tileIndex) => {
    if (loading || gameOver) return;
    
    const clickedTile = gameState.tiles[tileIndex];
    if (clickedTile.removed) return;

    // First tile selection
    if (selectedTile === null) {
      setSelectedTile(tileIndex);
      return;
    }

    // Same tile clicked
    if (selectedTile === tileIndex) {
      setSelectedTile(null);
      return;
    }

    // Check for match
    try {
      const result = await gameService.makeMove(gameState.id, tileIndex);
      setGameState(result.game);
      setScore(result.game.score);
      setMatches(result.game.matches);
      
      // Notify about match if tiles matched
      if (result.matched) {
        const tile1 = gameState.tiles[selectedTile];
        const tile2 = gameState.tiles[tileIndex];
        if (tile1 && tile2) {
          notifyMatch(tile1, tile2);
        }
      }
      
      setSelectedTile(null);
      
      if (result.game.ended) {
        setGameOver(true);
        notifyGameOver(result.game.score);
        await gameService.endGame(gameState.id, result.game.score);
      }
    } catch (err) {
      console.error('Move failed:', err);
      notifyError('Failed to make move. Please try again.');
      setSelectedTile(null);
    }
  };

  const handleHint = async () => {
    try {
      const hint = await gameService.hint(gameState.id);
      setGameState({ ...gameState, hintTile: hint.tileIndex });
      notifyHint(hint.tileIndex);
      
      // Clear hint after 3 seconds
      setTimeout(() => {
        setGameState(prev => prev ? { ...prev, hintTile: undefined } : prev);
      }, 3000);
    } catch (err) {
      console.error('Hint failed:', err);
      notifyError('Failed to get hint. You may be out of hints.');
    }
  };

  const handleShuffle = async () => {
    try {
      const result = await gameService.shuffle(gameState.id);
      setGameState(result.game);
      notifyShuffle();
    } catch (err) {
      console.error('Shuffle failed:', err);
      notifyError('Failed to shuffle board. Please try again.');
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
      <GameNotifications notifications={notifications} onDismiss={() => {}} />
      
      <div className="game-header">
        <h2>Single Player Mode</h2>
        
        {!gameState || gameOver ? (
          <div className="game-over-panel">
            <h3>{gameOver ? 'Game Over!' : 'Select Difficulty'}</h3>
            {gameOver && (
              <>
                <p>Final Score: {score}</p>
                <p className="game-over-stats">Time: {formattedTime}</p>
              </>
            )}
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
              <Timer formattedTime={formattedTime} isRunning={!gameOver && !!gameState} />
              <span className="stat-divider">|</span>
              <span className="stat-item">Score: {score}</span>
              <span className="stat-divider">|</span>
              <span className="stat-item">Matches: {matches}/{DIFFICULTIES[difficulty].matches}</span>
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
          selectedTile={selectedTile}
        />
      )}
    </div>
  );
}

export default SinglePlayer;
