import { useState, useEffect, useCallback, useRef } from 'react';

export function useTimer(isRunning = false, onTick = null) {
  const [ elapsedTime, setElapsedTime ] = useState(0);
  const intervalRef = useRef(null);

  const start = useCallback(() => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 1;
        if (onTick) onTick(newTime);
        return newTime;
      });
    }, 1000);
  }, [onTick]);

  const pause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    pause();
    setElapsedTime(0);
  }, [pause]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  useEffect(() => {
    if (isRunning) {
      start();
    } else {
      pause();
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, start, pause]);

  return {
    elapsedTime,
    formattedTime: formatTime(elapsedTime),
    start,
    pause,
    reset
  };
}

export default useTimer;
