import { useState, useCallback, useEffect } from 'react';

const NOTIFICATION_TYPES = {
  MATCH: 'match',
  HINT: 'hint',
  SHUFFLE: 'shuffle',
  GAME_OVER: 'game-over',
  NO_MOVES: 'no-moves',
  ERROR: 'error',
  INFO: 'info'
};

export function useNotifications() {
  const [ notifications, setNotifications ] = useState([]);

  const addNotification = useCallback((message, type = NOTIFICATION_TYPES.INFO, duration = 3000) => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };

    setNotifications(prev => [...prev, notification]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Convenience methods
  const notifyMatch = useCallback((tile1, tile2) => {
    const name1 = tile1.label || tile1.type || tile1.symbol || '?';
    const name2 = tile2.label || tile2.type || tile2.symbol || '?';
    return addNotification(`Match found! "${name1}" and "${name2}" removed.`, NOTIFICATION_TYPES.MATCH);
  }, [addNotification]);

  const notifyHint = useCallback((tileIndex) => {
    return addNotification(`Hint: Tile ${tileIndex + 1} has a match!`, NOTIFICATION_TYPES.HINT, 2000);
  }, [addNotification]);

  const notifyShuffle = useCallback(() => {
    return addNotification('Board shuffled!', NOTIFICATION_TYPES.SHUFFLE);
  }, [addNotification]);

  const notifyGameOver = useCallback((score) => {
    return addNotification(`🎉 Victory! Final Score: ${score}`, NOTIFICATION_TYPES.GAME_OVER, 0);
  }, [addNotification]);

  const notifyNoMoves = useCallback(() => {
    return addNotification('No more valid moves available!', NOTIFICATION_TYPES.NO_MOVES, 0);
  }, [addNotification]);

  const notifyError = useCallback((message) => {
    return addNotification(message, NOTIFICATION_TYPES.ERROR);
  }, [addNotification]);

  return {
    notifications,
    addNotification,
    removeNotification,
    clearAll,
    notifyMatch,
    notifyHint,
    notifyShuffle,
    notifyGameOver,
    notifyNoMoves,
    notifyError,
    NOTIFICATION_TYPES
  };
}

export default useNotifications;
