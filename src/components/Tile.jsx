import './Tile.css';

const TILE_SYMBOLS = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
  6: '六', 7: '七', 8: '八', 9: '九',
  dots: '●',
  bamboo: '竹',
  character: '字',
};

function Tile({ tile, index, isHint, isSelected, disabled, onClick }) {
  if (tile.removed) {
    return <div className="tile tile-empty" role="button" />;
  }

  const tileClass = `tile ${tile.type || 'bamboo'} ${isHint ? 'tile-hint' : ''} ${isSelected ? 'tile-selected' : ''} ${disabled ? 'tile-disabled' : ''}`;

  const getTileContent = () => {
    if (typeof tile.symbol === 'object') {
      return (
        <span className="tile-symbol tile-symbol-chinese">{tile.symbol.char || '?'}</span>
      );
    }
    return <span className="tile-symbol tile-symbol-number">{tile.symbol}</span>;
  };

  return (
    <div 
      className={tileClass}
      onClick={disabled ? undefined : onClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Tile ${index + 1}: ${tile.symbol}`}
      data-type={tile.type}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (!disabled) onClick();
        }
      }}
    >
      <div className="tile-content">
        {getTileContent()}
        <span className="tile-type">{tile.type || ''}</span>
      </div>
      <div className="tile-highlight" />
    </div>
  );
}

export default Tile;
