import { useState, useCallback, useEffect } from 'react';

const NOTIFICATION_TYPES = {
  MATCH: 'match',
  HINT: 'hint',
  SHUFFLE: 'shuffle',
  GAME_OVER: 'game-over',
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
    return addNotification(`Match found! Tiles "${tile1.symbol}" and "${tile2.symbol}" removed.`, NOTIFICATION_TYPES.MATCH);
  }, [addNotification]);

  const notifyHint = useCallback((tileIndex) => {
    return addNotification(`Hint: Tile ${tileIndex + 1} has a match!`, NOTIFICATION_TYPES.HINT, 2000);
  }, [addNotification]);

  const notifyShuffle = useCallback(() => {
    return addNotification('Board shuffled!', NOTIFICATION_TYPES.SHUFFLE);
  }, [addNotification]);

  const notifyGameOver = useCallback((score) => {
    return addNotification(`Game Over! Final Score: ${score}`, NOTIFICATION_TYPES.GAME_OVER, 0);
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
    notifyError,
    NOTIFICATION_TYPES
  };
}

export default useNotifications;
