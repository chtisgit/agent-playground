import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gameService } from '../services/gameService';
import { useTimer } from '../hooks/useTimer';
import { useNotifications } from '../hooks/useNotifications';
import GameBoard from '../components/GameBoard';
import Timer from '../components/Timer';
import GameNotifications from '../components/GameNotifications';
import './SinglePlayer.css';

// Difficulty configuration - affects scoring and timer
const DIFFICULTIES = {
  easy: { 
    label: 'Easy', 
    scoreMultiplier: 1,
    shuffleLimit: 5,
    hintLimit: 10,
    timeLimit: 600, // 10 minutes
  },
  medium: { 
    label: 'Medium', 
    scoreMultiplier: 2,
    shuffleLimit: 3,
    hintLimit: 5,
    timeLimit: 480, // 8 minutes
  },
  hard: { 
    label: 'Hard', 
    scoreMultiplier: 3,
    shuffleLimit: 1,
    hintLimit: 2,
    timeLimit: 360, // 6 minutes
  },
};

function SinglePlayer() {
  const navigate = useNavigate();
  const [gameState, setGameState] = useState(null);
  const [difficulty, setDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [matches, setMatches] = useState(0);
  const [selectedTile, setSelectedTile] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState(null); // 'win' | 'no-moves' | null
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shufflesUsed, setShufflesUsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);

  const diffConfig = DIFFICULTIES[difficulty];
  const { formattedTime, reset: resetTimer, elapsedTime } = useTimer(!loading && !gameOver && !!gameState);
  const { notifications, notifyMatch, notifyHint, notifyShuffle, notifyGameOver, notifyNoMoves, notifyError } = useNotifications();

  const startGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedTile(null);
    setShufflesUsed(0);
    setHintsUsed(0);
    resetTimer();
    try {
      const response = await gameService.startSinglePlayer(difficulty);
      setGameState(response.game);
      setScore(response.game.score || 0);
      setMatches(response.game.matches || 0);
      setGameOver(false);
      setGameResult(null);
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

  // Check for no-moves condition after each move
  const checkGameStatus = useCallback(async (game) => {
    // Check if all tiles removed - victory!
    const remainingTiles = game.tiles.filter(t => !t.removed).length;
    if (remainingTiles === 0) {
      setGameOver(true);
      setGameResult('win');
      notifyGameOver(game.score);
      await gameService.endGame(game.id, game.score);
      return;
    }

    // Check if game was marked as ended by server
    if (game.ended) {
      setGameOver(true);
      setGameResult('win');
      notifyGameOver(game.score);
      return;
    }
  }, [notifyGameOver]);

  const handleTileClick = async (tileIndex) => {
    if (loading || gameOver) return;
    
    const clickedTile = gameState.tiles[tileIndex];
    if (clickedTile.removed) return;

    // First tile selection
    if (selectedTile === null) {
      setSelectedTile(tileIndex);
      return;
    }

    // Same tile clicked - deselect
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
      
      if (result.matched) {
        const tile1 = gameState.tiles[selectedTile];
        const tile2 = gameState.tiles[tileIndex];
        if (tile1 && tile2) {
          notifyMatch(tile1, tile2);
        }
        
        // Check for win/no-moves after successful match
        await checkGameStatus(result.game);
      }
      
      setSelectedTile(null);
    } catch (err) {
      console.error('Move failed:', err);
      notifyError('Failed to make move. Please try again.');
      setSelectedTile(null);
    }
  };

  const handleHint = async () => {
    if (hintsUsed >= diffConfig.hintLimit) {
      notifyError(`No hints remaining! Limit: ${diffConfig.hintLimit}`);
      return;
    }
    try {
      const hint = await gameService.hint(gameState.id);
      if (hint.tileIndex === null || hint.tileIndex === undefined) {
        // No valid moves available
        setGameOver(true);
        setGameResult('no-moves');
        notifyNoMoves();
        await gameService.endGame(gameState.id, gameState.score);
        return;
      }
      setGameState({ ...gameState, hintTile: hint.tileIndex });
      setHintsUsed(prev => prev + 1);
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
    if (shufflesUsed >= diffConfig.shuffleLimit) {
      notifyError(`No shuffles remaining! Limit: ${diffConfig.shuffleLimit}`);
      return;
    }
    try {
      const result = await gameService.shuffle(gameState.id);
      setGameState(result.game);
      setShufflesUsed(prev => prev + 1);
      setSelectedTile(null);
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

  // Victory screen
  if (gameOver && gameResult === 'win') {
    return (
      <div className="single-player-container">
        <GameNotifications notifications={notifications} onDismiss={() => {}} />
        <div className="game-over-panel victory-panel">
          <div className="victory-icon">🎉</div>
          <h2>Congratulations! You Won!</h2>
          <div className="victory-stats">
            <p className="final-score">Final Score: <strong>{score}</strong></p>
            <p>Time: {formattedTime}</p>
            <p>Matches: {matches}</p>
            <p>Shuffles Used: {shufflesUsed}/{diffConfig.shuffleLimit}</p>
            <p>Hints Used: {hintsUsed}/{diffConfig.hintLimit}</p>
          </div>
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
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // No moves screen
  if (gameOver && gameResult === 'no-moves') {
    return (
      <div className="single-player-container">
        <GameNotifications notifications={notifications} onDismiss={() => {}} />
        <div className="game-over-panel no-moves-panel">
          <div className="no-moves-icon">😔</div>
          <h2>No More Moves!</h2>
          <div className="victory-stats">
            <p className="final-score">Final Score: <strong>{score}</strong></p>
            <p>Time: {formattedTime}</p>
            <p>Matches: {matches}</p>
            <p>Remaining Tiles: {gameState?.tiles.filter(t => !t.removed).length || 0}</p>
          </div>
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
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="single-player-container">
      <GameNotifications notifications={notifications} onDismiss={() => {}} />
      
      <div className="game-header">
        <h2>Single Player Mode</h2>
        
        {!gameState ? (
          <div className="game-over-panel">
            <h3>Select Difficulty</h3>
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
              Start Game
            </button>
          </div>
        ) : (
          <>
            <div className="game-stats">
              <Timer formattedTime={formattedTime} isRunning={!gameOver && !!gameState} />
              <span className="stat-divider">|</span>
              <span className="stat-item">Score: {score}</span>
              <span className="stat-divider">|</span>
              <span className="stat-item">Matches: {matches}</span>
              <span className="stat-divider">|</span>
              <span className="stat-item">Difficulty: {diffConfig.label}</span>
            </div>
            <div className="game-controls">
              <button 
                className="btn btn-secondary" 
                onClick={handleHint}
                disabled={hintsUsed >= diffConfig.hintLimit}
                title={`Hints: ${hintsUsed}/${diffConfig.hintLimit}`}
              >
                Hint ({diffConfig.hintLimit - hintsUsed})
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={handleShuffle}
                disabled={shufflesUsed >= diffConfig.shuffleLimit}
                title={`Shuffles: ${shufflesUsed}/${diffConfig.shuffleLimit}`}
              >
                Shuffle ({diffConfig.shuffleLimit - shufflesUsed})
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
