import { Moon, Sun, Circle, Square, RotateCcw, ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import HeaderBar from '../components/HeaderBar'
import { Card, Button } from '../components/ui'

const Settings = () => {
  const { 
    theme, setLightMode, setDarkMode,
    roundness, setRoundness,
    borderWeight, setBorderWeight,
    resetToDefaults,
  } = useTheme()
  const navigate = useNavigate()

  return (
    <main className="min-h-screen bg-base px-4 py-10 transition-colors">
      <div className="mx-auto max-w-3xl">
        <HeaderBar />

        {/* Back Button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-heading font-bold text-brand-text">
              Settings
            </h1>
            <p className="font-body mt-1 text-base text-text-muted">
              Customize your VocaBoost experience.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            onClick={resetToDefaults}
          >
            <RotateCcw size={16} />
            Reset
          </Button>
        </div>

        {/* Settings Card */}
        <Card variant="section" className="space-y-8">
          
          {/* Theme Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Theme
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Choose light or dark mode.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={theme === 'light'}
                onClick={setLightMode}
                icon={<Sun size={24} />}
                label="Light"
              />
              <OptionButton
                active={theme === 'dark'}
                onClick={setDarkMode}
                icon={<Moon size={24} />}
                label="Dark"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Roundness Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Roundness
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Adjust the corner radius of buttons and cards.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={roundness === 'sharp'}
                onClick={() => setRoundness('sharp')}
                icon={<Square size={24} />}
                label="Sharp"
              />
              <OptionButton
                active={roundness === 'normal'}
                onClick={() => setRoundness('normal')}
                icon={<RoundedSquare />}
                label="Normal"
              />
              <OptionButton
                active={roundness === 'rounded'}
                onClick={() => setRoundness('rounded')}
                icon={<Circle size={24} />}
                label="Rounded"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Border Weight Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Border Weight
            </h2>
            <p className="text-sm text-text-muted mb-4">
              Adjust the visibility of borders.
            </p>

            <div className="flex flex-wrap gap-3">
              <OptionButton
                active={borderWeight === 'light'}
                onClick={() => setBorderWeight('light')}
                icon={<BorderIcon weight="light" />}
                label="Light"
              />
              <OptionButton
                active={borderWeight === 'normal'}
                onClick={() => setBorderWeight('normal')}
                icon={<BorderIcon weight="normal" />}
                label="Normal"
              />
              <OptionButton
                active={borderWeight === 'strong'}
                onClick={() => setBorderWeight('strong')}
                icon={<BorderIcon weight="strong" />}
                label="Strong"
              />
            </div>
          </div>

          <hr className="border-border-default" />

          {/* Preview Section */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2">
              Preview
            </h2>
            <p className="text-sm text-text-muted mb-4">
              See how your settings look.
            </p>

            <div className="flex flex-wrap gap-4">
              <Card variant="content" className="w-48">
                <p className="text-sm font-medium text-text-primary mb-2">Sample Card</p>
                <p className="text-xs text-text-muted">This is a preview of your current settings.</p>
              </Card>
              
              <div className="flex flex-col gap-2">
                <Button variant="primary" size="md">Primary Button</Button>
                <Button variant="outline" size="md">Outline Button</Button>
                <Button variant="ghost" size="md">Ghost Button</Button>
              </div>
            </div>
          </div>

        </Card>
      </div>
    </main>
  )
}

// Reusable option button component
const OptionButton = ({ active, onClick, icon, label }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex flex-col items-center gap-2 p-4 rounded-card border-2 transition-all min-w-[100px] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95 ${
      active
        ? 'border-brand-primary bg-accent-blue'
        : 'border-border-default bg-surface hover:border-border-strong'
    }`}
  >
    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
      active 
        ? 'bg-brand-primary text-white' 
        : 'bg-muted text-text-muted'
    }`}>
      {icon}
    </div>
    <span className={`text-sm font-semibold ${
      active 
        ? 'text-brand-text' 
        : 'text-text-secondary'
    }`}>
      {label}
    </span>
  </button>
)

// Custom icon for "Normal" roundness (rounded square)
const RoundedSquare = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="4" ry="4" />
  </svg>
)

// Custom icon for border weight
const BorderIcon = ({ weight }) => {
  const strokeWidth = weight === 'light' ? 1 : weight === 'strong' ? 3 : 2
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  )
}

export default Settings

