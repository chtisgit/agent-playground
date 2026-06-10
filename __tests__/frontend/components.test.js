/**
 * Tests for Frontend Components
 * 
 * Covers: Tile, GameBoard, Button, Timer, Header, GameNotifications
 * ID 201: Frontend component tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tile from '../../src/components/Tile';
import GameBoard from '../../src/components/GameBoard';
import Button from '../../src/components/Button';
import Timer from '../../src/components/Timer';
import Header from '../../src/components/Header';
import GameNotifications from '../../src/components/GameNotifications';

// ============================================================
// Tile Component Tests
// ============================================================
describe('Tile Component', () => {
  const baseTile = {
    symbol: 5,
    type: 'bamboo',
    removed: false,
  };

  describe('rendering', () => {
    it('should render tile with correct symbol', () => {
      render(<Tile tile={baseTile} index={0} />);
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('should render tile with Chinese character for object symbols', () => {
      const tile = { symbol: { char: '萬' }, type: 'character', removed: false };
      render(<Tile tile={tile} index={0} />);
      expect(screen.getByText('萬')).toBeInTheDocument();
    });

    it('should render "?" for object symbols without char property', () => {
      const tile = { symbol: {}, type: 'character', removed: false };
      render(<Tile tile={tile} index={0} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('should render empty div for removed tiles', () => {
      const tile = { ...baseTile, removed: true };
      const { container } = render(<Tile tile={tile} index={0} />);
      expect(container.querySelector('.tile-empty')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('should render tile with correct CSS class based on type', () => {
      const tile = { ...baseTile, type: 'dots' };
      const { container } = render(<Tile tile={tile} index={0} />);
      expect(container.querySelector('.tile.dots')).toBeInTheDocument();
    });

    it('should default to "bamboo" type when no type specified', () => {
      const tile = { symbol: 1, removed: false };
      const { container } = render(<Tile tile={tile} index={0} />);
      expect(container.querySelector('.tile.bamboo')).toBeInTheDocument();
    });
  });

  describe('hint state', () => {
    it('should apply tile-hint class when isHint is true', () => {
      const { container } = render(<Tile tile={baseTile} index={0} isHint={true} />);
      expect(container.querySelector('.tile-hint')).toBeInTheDocument();
    });

    it('should not apply tile-hint class when isHint is false', () => {
      const { container } = render(<Tile tile={baseTile} index={0} isHint={false} />);
      expect(container.querySelector('.tile-hint')).not.toBeInTheDocument();
    });
  });

  describe('selected state', () => {
    it('should apply tile-selected class when isSelected is true', () => {
      const { container } = render(<Tile tile={baseTile} index={0} isSelected={true} />);
      expect(container.querySelector('.tile-selected')).toBeInTheDocument();
    });

    it('should not apply tile-selected class when isSelected is false', () => {
      const { container } = render(<Tile tile={baseTile} index={0} isSelected={false} />);
      expect(container.querySelector('.tile-selected')).not.toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should apply tile-disabled class when disabled is true', () => {
      const { container } = render(<Tile tile={baseTile} index={0} disabled={true} />);
      expect(container.querySelector('.tile-disabled')).toBeInTheDocument();
    });

    it('should set tabIndex to -1 when disabled', () => {
      render(<Tile tile={baseTile} index={0} disabled={true} />);
      const tileElement = screen.getByRole('button');
      expect(tileElement).toHaveAttribute('tabIndex', '-1');
    });

    it('should set tabIndex to 0 when not disabled', () => {
      render(<Tile tile={baseTile} index={0} disabled={false} />);
      const tileElement = screen.getByRole('button');
      expect(tileElement).toHaveAttribute('tabIndex', '0');
    });

    it('should not call onClick when disabled and clicked', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} disabled={true} onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('click handling', () => {
    it('should call onClick with correct parameters when clicked', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={3} onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when no handler provided', () => {
      render(<Tile tile={baseTile} index={0} />);
      fireEvent.click(screen.getByRole('button'));
      // No error should occur
    });

    it('should handle keyboard Enter key', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard Space key', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should NOT fire onClick on Enter when disabled', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} disabled={true} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should NOT fire onClick on Space when disabled', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} disabled={true} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' });
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should ignore other keyboard keys', () => {
      const onClick = jest.fn();
      render(<Tile tile={baseTile} index={0} onClick={onClick} />);
      fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have correct aria-label', () => {
      render(<Tile tile={{ symbol: 7, type: 'dots', removed: false }} index={2} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Tile 3: 7');
    });

    it('should have correct data-type attribute', () => {
      const { container } = render(<Tile tile={{ symbol: 1, type: 'character', removed: false }} index={0} />);
      expect(container.querySelector('[data-type="character"]')).toBeInTheDocument();
    });

    it('should have role="button"', () => {
      render(<Tile tile={baseTile} index={0} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render tile-content and tile-type elements', () => {
      const { container } = render(<Tile tile={baseTile} index={0} />);
      expect(container.querySelector('.tile-content')).toBeInTheDocument();
      expect(container.querySelector('.tile-type')).toBeInTheDocument();
      expect(container.querySelector('.tile-highlight')).toBeInTheDocument();
    });
  });
});

// ============================================================
// GameBoard Component Tests
// ============================================================
describe('GameBoard Component', () => {
  const mockTiles = [
    { symbol: 1, type: 'bamboo', removed: false },
    { symbol: 2, type: 'dots', removed: false },
    { symbol: 3, type: 'character', removed: false },
    { symbol: 1, type: 'bamboo', removed: false },
  ];

  describe('rendering', () => {
    it('should render a grid of tiles', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} />
      );
      expect(container.querySelector('.tiles-grid')).toBeInTheDocument();
      expect(container.querySelector('.game-board')).toBeInTheDocument();
    });

    it('should render correct number of tiles', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} />
      );
      const tileButtons = container.querySelectorAll('[role="button"]');
      expect(tileButtons.length).toBe(4);
    });

    it('should render empty state when no tiles', () => {
      render(<GameBoard tiles={[]} onTileClick={jest.fn()} />);
      expect(screen.getByText('No tiles available')).toBeInTheDocument();
    });

    it('should render empty state when tiles is null', () => {
      render(<GameBoard tiles={null} onTileClick={jest.fn()} />);
      expect(screen.getByText('No tiles available')).toBeInTheDocument();
    });

    it('should render empty state when tiles is undefined', () => {
      render(<GameBoard onTileClick={jest.fn()} />);
      expect(screen.getByText('No tiles available')).toBeInTheDocument();
    });
  });

  describe('hint and selection', () => {
    it('should pass isHint to the correct tile', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} hintTile={2} />
      );
      expect(container.querySelectorAll('.tile-hint').length).toBe(1);
    });

    it('should pass isSelected to the correct tile', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} selectedTile={0} />
      );
      expect(container.querySelectorAll('.tile-selected').length).toBe(1);
    });

    it('should not highlight any tile when hintTile is undefined', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} />
      );
      expect(container.querySelectorAll('.tile-hint').length).toBe(0);
    });

    it('should not select any tile when selectedTile is undefined', () => {
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={jest.fn()} />
      );
      expect(container.querySelectorAll('.tile-selected').length).toBe(0);
    });
  });

  describe('click handling', () => {
    it('should call onTileClick with the tile index when clicked', () => {
      const onTileClick = jest.fn();
      const { container } = render(
        <GameBoard tiles={mockTiles} onTileClick={onTileClick} />
      );
      const tiles = container.querySelectorAll('[role="button"]');
      fireEvent.click(tiles[1]);
      expect(onTileClick).toHaveBeenCalledWith(1);
    });

    it('should not call onTileClick for removed tiles', () => {
      const onTileClick = jest.fn();
      const tilesWithRemoved = [
        { symbol: 1, type: 'bamboo', removed: true },
        { symbol: 2, type: 'dots', removed: false },
      ];
      const { container } = render(
        <GameBoard tiles={tilesWithRemoved} onTileClick={onTileClick} />
      );
      const tileElements = container.querySelectorAll('[role="button"]');
      // First tile is removed, clicking it should not call onTileClick
      fireEvent.click(tileElements[0]);
      expect(onTileClick).not.toHaveBeenCalled();
    });
  });
});

// ============================================================
// Button Component Tests
// ============================================================
describe('Button Component', () => {
  describe('rendering', () => {
    it('should render with children text', () => {
      render(<Button>Click Me</Button>);
      expect(screen.getByText('Click Me')).toBeInTheDocument();
    });

    it('should render with default type "button"', () => {
      render(<Button>Test</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('should render with custom type', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('should apply primary variant by default', () => {
      const { container } = render(<Button>Default</Button>);
      expect(container.querySelector('.btn-primary')).toBeInTheDocument();
    });

    it('should apply custom variant class', () => {
      const { container } = render(<Button variant="secondary">Secondary</Button>);
      expect(container.querySelector('.btn-secondary')).toBeInTheDocument();
    });

    it('should apply medium size by default', () => {
      const { container } = render(<Button>Medium</Button>);
      expect(container.querySelector('.btn-medium')).toBeInTheDocument();
    });

    it('should apply custom size class', () => {
      const { container } = render(<Button size="large">Large</Button>);
      expect(container.querySelector('.btn-large')).toBeInTheDocument();
    });

    it('should apply additional className', () => {
      const { container } = render(<Button className="extra-class">Extra</Button>);
      expect(container.querySelector('.extra-class')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should set disabled attribute when disabled is true', () => {
      render(<Button disabled={true}>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should not be disabled by default', () => {
      render(<Button>Enabled</Button>);
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
  });

  describe('click handling', () => {
    it('should call onClick when clicked', () => {
      const onClick = jest.fn();
      render(<Button onClick={onClick}>Click</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when disabled', () => {
      const onClick = jest.fn();
      render(<Button disabled={true} onClick={onClick}>Disabled Click</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe('spread props', () => {
    it('should pass additional props to the button element', () => {
      render(<Button data-testid="my-button" aria-label="My Button">Test</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-testid', 'my-button');
      expect(button).toHaveAttribute('aria-label', 'My Button');
    });
  });
});

// ============================================================
// Timer Component Tests
// ============================================================
describe('Timer Component', () => {
  describe('rendering', () => {
    it('should display formatted time', () => {
      render(<Timer formattedTime="05:30" isRunning={true} />);
      expect(screen.getByText('05:30')).toBeInTheDocument();
    });

    it('should display timer emoji icon', () => {
      render(<Timer formattedTime="00:00" isRunning={false} />);
      expect(screen.getByText('⏱️')).toBeInTheDocument();
    });

    it('should apply timer-running class when running', () => {
      const { container } = render(<Timer formattedTime="01:00" isRunning={true} />);
      expect(container.querySelector('.timer-running')).toBeInTheDocument();
    });

    it('should not apply timer-running class when not running', () => {
      const { container } = render(<Timer formattedTime="00:00" isRunning={false} />);
      expect(container.querySelector('.timer-running')).not.toBeInTheDocument();
    });

    it('should display "00:00" when zero time', () => {
      render(<Timer formattedTime="00:00" isRunning={false} />);
      expect(screen.getByText('00:00')).toBeInTheDocument();
    });
  });
});

// ============================================================
// Header Component Tests
// ============================================================
describe('Header Component', () => {
  const renderHeader = (isAuthenticated = false, setIsAuthenticated = jest.fn()) => {
    return render(
      <MemoryRouter initialEntries={['/']}>
        <Header isAuthenticated={isAuthenticated} setIsAuthenticated={setIsAuthenticated} />
      </MemoryRouter>
    );
  };

  describe('rendering', () => {
    it('should render the logo and title', () => {
      renderHeader();
      expect(screen.getByText('Web Mahjong')).toBeInTheDocument();
      expect(screen.getByText('麻')).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      renderHeader();
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Single Player')).toBeInTheDocument();
      expect(screen.getByText('Multiplayer')).toBeInTheDocument();
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });
  });

  describe('authentication state', () => {
    it('should show Login button when not authenticated', () => {
      renderHeader(false);
      expect(screen.getByText('Login')).toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });

    it('should show Logout button when authenticated', () => {
      renderHeader(true);
      expect(screen.getByText('Logout')).toBeInTheDocument();
      expect(screen.queryByText('Login')).not.toBeInTheDocument();
    });
  });

  describe('logout', () => {
    it('should clear localStorage and call setIsAuthenticated(false)', () => {
      localStorage.setItem('authToken', 'test-token');
      localStorage.setItem('user', JSON.stringify({ id: 1 }));
      const setIsAuthenticated = jest.fn();

      renderHeader(true, setIsAuthenticated);
      fireEvent.click(screen.getByText('Logout'));

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
      expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    });
  });

  describe('active link', () => {
    it('should mark Home link as active when on home page', () => {
      render(
        <MemoryRouter initialEntries={['/']}>
          <Header isAuthenticated={false} setIsAuthenticated={jest.fn()} />
        </MemoryRouter>
      );
      const homeLink = screen.getByText('Home').closest('a');
      expect(homeLink).toHaveClass('active');
    });

    it('should mark Single Player link as active when on single-player page', () => {
      render(
        <MemoryRouter initialEntries={['/single-player']}>
          <Header isAuthenticated={false} setIsAuthenticated={jest.fn()} />
        </MemoryRouter>
      );
      const spLink = screen.getByText('Single Player').closest('a');
      expect(spLink).toHaveClass('active');
    });
  });
});

// ============================================================
// GameNotifications Component Tests
// ============================================================
describe('GameNotifications Component', () => {
  describe('empty state', () => {
    it('should return null when notifications is empty array', () => {
      const { container } = render(
        <GameNotifications notifications={[]} onDismiss={jest.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when notifications is null', () => {
      const { container } = render(
        <GameNotifications notifications={null} onDismiss={jest.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('should return null when notifications is undefined', () => {
      const { container } = render(
        <GameNotifications onDismiss={jest.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendering notifications', () => {
    it('should render match notification with checkmark icon', () => {
      const notifications = [
        { id: 1, message: 'Match found!', type: 'match' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Match found!')).toBeInTheDocument();
      expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should render hint notification with lightbulb icon', () => {
      const notifications = [
        { id: 2, message: 'Hint: Tile 5!', type: 'hint' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Hint: Tile 5!')).toBeInTheDocument();
      expect(screen.getByText('💡')).toBeInTheDocument();
    });

    it('should render shuffle notification', () => {
      const notifications = [
        { id: 3, message: 'Board shuffled!', type: 'shuffle' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Board shuffled!')).toBeInTheDocument();
      expect(screen.getByText('🔀')).toBeInTheDocument();
    });

    it('should render game-over notification with trophy icon', () => {
      const notifications = [
        { id: 4, message: 'Game Over! Score: 500', type: 'game-over' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Game Over! Score: 500')).toBeInTheDocument();
      expect(screen.getByText('🏆')).toBeInTheDocument();
    });

    it('should render error notification with warning icon', () => {
      const notifications = [
        { id: 5, message: 'Something went wrong', type: 'error' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('⚠️')).toBeInTheDocument();
    });

    it('should render info notification with default icon for unknown type', () => {
      const notifications = [
        { id: 6, message: 'Info message', type: 'info' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('Info message')).toBeInTheDocument();
      expect(screen.getByText('ℹ️')).toBeInTheDocument();
    });

    it('should render default icon for unknown type', () => {
      const notifications = [
        { id: 7, message: 'Unknown type', type: 'custom-type' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={jest.fn()} />);
      expect(screen.getByText('ℹ️')).toBeInTheDocument();
    });

    it('should render multiple notifications', () => {
      const notifications = [
        { id: 1, message: 'First', type: 'match' },
        { id: 2, message: 'Second', type: 'hint' },
        { id: 3, message: 'Third', type: 'error' },
      ];
      const { container } = render(
        <GameNotifications notifications={notifications} onDismiss={jest.fn()} />
      );
      expect(container.querySelectorAll('.game-notification').length).toBe(3);
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });
  });

  describe('dismissal', () => {
    it('should call onDismiss with notification id when clicked', () => {
      const onDismiss = jest.fn();
      const notifications = [
        { id: 42, message: 'Dismiss me', type: 'match' },
      ];
      render(<GameNotifications notifications={notifications} onDismiss={onDismiss} />);
      fireEvent.click(screen.getByText('Dismiss me').closest('.game-notification'));
      expect(onDismiss).toHaveBeenCalledWith(42);
    });

    it('should apply correct CSS class for each notification type', () => {
      const notifications = [
        { id: 1, message: 'Match', type: 'match' },
      ];
      const { container } = render(
        <GameNotifications notifications={notifications} onDismiss={jest.fn()} />
      );
      expect(container.querySelector('.game-notification-match')).toBeInTheDocument();
    });
  });
});
