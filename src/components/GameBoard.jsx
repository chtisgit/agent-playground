import Tile from './Tile';
import './GameBoard.css';

function GameBoard({ tiles, onTileClick, hintTile }) {
  if (!tiles || tiles.length === 0) {
    return <div className="game-board-empty">No tiles available</div>;
  }

  return (
    <div className="game-board">
      <div className="tiles-grid">
        {tiles.map((tile, index) => (
          <Tile
            key={index}
            tile={tile}
            index={index}
            isHint={hintTile === index}
            disabled={tile.removed}
            onClick={() => !tile.removed && onTileClick(index)}
          />
        ))}
      </div>
    </div>
  );
}

export default GameBoard;
