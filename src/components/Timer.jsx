import './Timer.css';

function Timer({ formattedTime, isRunning }) {
  return (
    <div className={`timer ${isRunning ? 'timer-running' : ''}`}>
      <span className="timer-icon">⏱️</span>
      <span className="timer-value">{formattedTime}</span>
    </div>
  );
}

export default Timer;
