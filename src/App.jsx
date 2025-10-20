import { useState, useEffect } from 'react'
import './App.css'
import ghantkarmahavir from './ghantkarmahavir.jpg'

function App() {
  // Initialize count from localStorage or default to 0
  const [count, setCount] = useState(() => {
    const savedCount = localStorage.getItem('jainMalaCount')
    return savedCount ? parseInt(savedCount, 10) : 0
  })

  // Save count to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('jainMalaCount', count.toString())
  }, [count])

  const increment = () => {
    if (count < 108) {
      setCount(prev => prev + 1)
    }
  }

  const decrement = () => {
    if (count > 0) {
      setCount(prev => prev - 1)
    }
  }

  const reset = () => {
    setCount(0)
  }

  const progress = (count / 108) * 100

  return (
    <div className="mala-counter">
      <div className="container">
        <div className="deity-image">
          <img src={ghantkarmahavir} alt="Ghantkarna Mahavir" className="deity-img" />
        </div>
        <h1 className="title">Jain Mala Counter</h1>
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
          </div>
        )}

        <div className="info-section">
          <p className="info-text">
            A traditional Jain mala consists of 108 beads. 
            Your progress is automatically saved.
          </p>
        </div>
      </div>
    </div>
  )
}

export default App
