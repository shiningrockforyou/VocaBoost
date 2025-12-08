import { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

// Default settings
const DEFAULTS = {
  theme: 'light',
  roundness: 'normal',
  borderWeight: 'normal',
}

// Roundness values
const ROUNDNESS_VALUES = {
  sharp: {
    '--radius-button': '0.5rem',
    '--radius-button-sm': '0.25rem',
    '--radius-card': '0.75rem',
    '--radius-card-lg': '1rem',
    '--radius-input': '0.5rem',
    '--radius-alert': '0.25rem',
    '--radius-modal': '0.75rem',
  },
  normal: {
    '--radius-button': '1rem',
    '--radius-button-sm': '0.5rem',
    '--radius-card': '1rem',
    '--radius-card-lg': '1.5rem',
    '--radius-input': '0.75rem',
    '--radius-alert': '0.5rem',
    '--radius-modal': '1rem',
  },
  rounded: {
    '--radius-button': '1.5rem',
    '--radius-button-sm': '0.75rem',
    '--radius-card': '1.5rem',
    '--radius-card-lg': '2rem',
    '--radius-input': '1rem',
    '--radius-alert': '0.75rem',
    '--radius-modal': '1.5rem',
  },
}

// Border weight values (RGB values for light mode)
const BORDER_WEIGHT_VALUES = {
  light: {
    light: '241 245 249',   // slate-100
    dark: '51 65 85',       // slate-700
  },
  normal: {
    light: '226 232 240',   // slate-200
    dark: '71 85 105',      // slate-600
  },
  strong: {
    light: '203 213 225',   // slate-300
    dark: '100 116 139',    // slate-500
  },
}

export function ThemeProvider({ children }) {
  // Load settings from localStorage or use defaults
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem('vocaboost-theme')
    return stored || DEFAULTS.theme
  })
  
  const [roundness, setRoundness] = useState(() => {
    const stored = localStorage.getItem('vocaboost-roundness')
    return stored || DEFAULTS.roundness
  })
  
  const [borderWeight, setBorderWeight] = useState(() => {
    const stored = localStorage.getItem('vocaboost-border-weight')
    return stored || DEFAULTS.borderWeight
  })

  // Apply theme (light/dark)
  useEffect(() => {
    const root = document.documentElement
    
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    
    localStorage.setItem('vocaboost-theme', theme)
  }, [theme])

  // Apply roundness
  useEffect(() => {
    const root = document.documentElement
    const values = ROUNDNESS_VALUES[roundness] || ROUNDNESS_VALUES.normal
    
    Object.entries(values).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })
    
    localStorage.setItem('vocaboost-roundness', roundness)
  }, [roundness])

  // Apply border weight
  useEffect(() => {
    const root = document.documentElement
    const weightValues = BORDER_WEIGHT_VALUES[borderWeight] || BORDER_WEIGHT_VALUES.normal
    const colorValue = theme === 'dark' ? weightValues.dark : weightValues.light
    
    root.style.setProperty('--border-default-rgb', colorValue)
    
    localStorage.setItem('vocaboost-border-weight', borderWeight)
  }, [borderWeight, theme])

  // Listen for system theme preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const handleChange = (e) => {
      const stored = localStorage.getItem('vocaboost-theme')
      if (!stored) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  const value = {
    // Theme
    theme,
    setTheme,
    isDark: theme === 'dark',
    setLightMode: () => setTheme('light'),
    setDarkMode: () => setTheme('dark'),
    toggleTheme: () => setTheme(prev => prev === 'light' ? 'dark' : 'light'),
    
    // Roundness
    roundness,
    setRoundness,
    
    // Border weight
    borderWeight,
    setBorderWeight,
    
    // Reset to defaults
    resetToDefaults: () => {
      setTheme(DEFAULTS.theme)
      setRoundness(DEFAULTS.roundness)
      setBorderWeight(DEFAULTS.borderWeight)
    },
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

