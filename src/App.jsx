import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // Initialize count from localStorage or default to 0
  const [count, setCount] = useState(() => {
    try {
      const savedCount = localStorage.getItem('jainMalaCount')
      return savedCount ? parseInt(savedCount, 10) : 0
    } catch {
      return 0
    }
  })

  // Save count to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('jainMalaCount', count.toString())
    } catch (error) {
      console.warn('Could not save to localStorage:', error)
    }
  }, [count])

  // Timer state: accumulated elapsed ms plus the start timestamp while running
  const [timer, setTimer] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('jainMalaTimer'))
      if (saved && typeof saved.elapsed === 'number') {
        return { elapsed: saved.elapsed, startedAt: saved.startedAt ?? null }
      }
    } catch {
      // ignore and fall through to default
    }
    return { elapsed: 0, startedAt: null }
  })
  const [now, setNow] = useState(() => Date.now())
  const isRunning = timer.startedAt !== null

  // Persist timer state
  useEffect(() => {
    try {
      localStorage.setItem('jainMalaTimer', JSON.stringify(timer))
    } catch (error) {
      console.warn('Could not save timer to localStorage:', error)
    }
  }, [timer])

  // Tick every second while running
  useEffect(() => {
    if (!isRunning) return
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const elapsedMs = timer.elapsed + (isRunning ? Math.max(0, now - timer.startedAt) : 0)

  const startTimer = () => {
    setTimer(t => (t.startedAt !== null ? t : { ...t, startedAt: Date.now() }))
  }

  const stopTimer = () => {
    setTimer(t =>
      t.startedAt === null
        ? t
        : { elapsed: t.elapsed + Math.max(0, Date.now() - t.startedAt), startedAt: null }
    )
  }

  const toggleTimer = () => {
    if (isRunning) {
      stopTimer()
    } else {
      startTimer()
    }
  }

  const formatTime = ms => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = n => n.toString().padStart(2, '0')
    return hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`
  }

  const increment = () => {
    if (count < 108) {
      const next = count + 1
      setCount(next)
      if (next === 108) {
        stopTimer()
      } else {
        startTimer()
      }
    }
  }

  const decrement = () => {
    if (count > 0) {
      setCount(prev => prev - 1)
    }
  }

  const reset = () => {
    setCount(0)
    setTimer({ elapsed: 0, startedAt: null })
  }

  const progress = (count / 108) * 100

  return (
    <div className="mala-counter">
      <div className="container">
        <div className="deity-image">
          <img src="/ghantkarmahavir.jpg" alt="Ghantkarna Mahavir" className="deity-img" />
        </div>
        <h1 className="title">🕉️ Jain Mala Counter</h1>
        <p className="subtitle">Traditional 108 bead counter</p>
        
        <div className="counter-display">
          <div className="count-circle">
            <span className="count-number">{count}</span>
            <span className="count-total">/ 108</span>
          </div>
          <div className="remaining-count">
            <span className="remaining-label">Remaining:</span>
            <span className="remaining-number">{108 - count}</span>
          </div>
        </div>

        <div className="timer-display">
          <span className="timer-label">⏱️ Time</span>
          <span className="timer-value">{formatTime(elapsedMs)}</span>
          <button
            className="btn-timer"
            onClick={toggleTimer}
            disabled={count === 108}
            aria-label={isRunning ? 'Pause timer' : 'Start timer'}
          >
            {isRunning ? 'Pause' : elapsedMs > 0 ? 'Resume' : 'Start'}
          </button>
        </div>

        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <span className="progress-text">{Math.round(progress)}% Complete</span>
        </div>

        <div className="button-container">
          <button 
            className="btn btn-decrement" 
            onClick={decrement}
            disabled={count === 0}
            aria-label="Decrease count"
          >
            −
          </button>
          
          <button 
            className="btn btn-reset" 
            onClick={reset}
            aria-label="Reset count"
          >
            Reset
          </button>
          
          <button 
            className="btn btn-increment" 
            onClick={increment}
            disabled={count === 108}
            aria-label="Increase count"
          >
            +
          </button>
        </div>

        {count === 108 && (
          <div className="completion-message">
            <p>🎉 Mala Complete! 🎉</p>
            <p>You have completed 108 repetitions</p>
            <p>Time taken: {formatTime(elapsedMs)}</p>
          </div>
        )}

        <div className="info-section">
          <p className="info-text">
            A traditional Jain mala consists of 108 beads. 
            The timer starts with your first count and stops at 108.
            Your progress is automatically saved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
