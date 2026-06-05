import './GameNotifications.css';

function GameNotification({ notification, onDismiss }) {
  const { id, message, type } = notification;

  return (
    <div className={`game-notification game-notification-${type}`} onClick={() => onDismiss(id)}>
      <div className="notification-content">
        <div className="notification-icon">
          {getIcon(type)}
        </div>
        <span className="notification-message">{message}</span>
      </div>
    </div>
  );
}

function getIcon(type) {
  switch (type) {
    case 'match':
      return '✓';
    case 'hint':
      return '💡';
    case 'shuffle':
      return '🔀';
    case 'game-over':
      return '🏆';
    case 'error':
      return '⚠️';
    default:
      return 'ℹ️';
  }
}

function GameNotifications({ notifications, onDismiss }) {
  if (!notifications || notifications.length === 0) {
    return null;
  }

  return (
    <div className="game-notifications-container">
      {notifications.map(notification => (
        <GameNotification 
          key={notification.id} 
          notification={notification} 
          onDismiss={onDismiss} 
        />
      ))}
    </div>
  );
}

export default GameNotifications;
