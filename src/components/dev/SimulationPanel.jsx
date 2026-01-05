import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSimulationContext, isSimulationEnabled } from '../../hooks/useSimulation.jsx'
import { STUDENT_PROFILES, SIMULATION_SPEEDS, SIM_PHASES, WORD_STATUSES } from '../../utils/simulationConfig'
import SimulationLog from './SimulationLog'
import WordPoolChart from './WordPoolChart'

/**
 * Simulation Control Panel - Developer tool for automated testing
 *
 * Appears as a floating overlay when VITE_SIMULATION_MODE=true
 */
export default function SimulationPanel() {
  const sim = useSimulationContext()
  const navigate = useNavigate()
  const [isExpanded, setIsExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState('controls') // controls, log, chart
  const [isMinimized, setIsMinimized] = useState(false)

  // Pass navigate to simulation context
  useEffect(() => {
    if (sim?.setNavigate) {
      sim.setNavigate(navigate)
    }
  }, [sim, navigate])

  // Keyboard shortcut to toggle panel (Ctrl+Shift+S)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        setIsMinimized(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!isSimulationEnabled() || !sim) return null

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-[9999] bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-purple-700 transition-colors"
      >
        🔧 SIM (Ctrl+Shift+S)
      </button>
    )
  }

  const { liveStats, phase, profile, speed, isAutoMode, currentDay, log } = sim

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-96 max-h-[80vh] bg-gray-900 text-white rounded-lg shadow-2xl border border-purple-500 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="bg-purple-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔧</span>
          <span className="font-bold">Simulation Mode</span>
          {phase === SIM_PHASES.RUNNING && (
            <span className="animate-pulse text-green-300">● Running</span>
          )}
          {phase === SIM_PHASES.PAUSED && (
            <span className="text-yellow-300">⏸ Paused</span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="hover:bg-purple-600 p-1 rounded"
          >
            {isExpanded ? '▼' : '▲'}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="hover:bg-purple-600 p-1 rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Tabs */}
          <div className="flex border-b border-gray-700">
            {['controls', 'log', 'chart'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-sm ${
                  activeTab === tab
                    ? 'bg-gray-800 text-purple-300 border-b-2 border-purple-500'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab === 'controls' && '⚙️ Controls'}
                {tab === 'log' && '📋 Log'}
                {tab === 'chart' && '📊 Chart'}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto p-4">
            {activeTab === 'controls' && (
              <ControlsTab sim={sim} />
            )}
            {activeTab === 'log' && (
              <SimulationLog log={log} profile={profile} />
            )}
            {activeTab === 'chart' && (
              <WordPoolChart history={log.wordPoolHistory} profile={profile} />
            )}
          </div>

          {/* Live Stats Footer */}
          <div className="border-t border-gray-700 p-3 bg-gray-800 text-xs">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <StatBox label="Day" value={liveStats.dayNumber || '-'} />
              <StatBox label="Phase" value={liveStats.phase || 'idle'} small />
              <StatBox label="Cards" value={`${liveStats.cardsStudied}/${liveStats.cardsTotal || '?'}`} />
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <StatBox
                label="Intervention"
                value={`${Math.round(liveStats.interventionLevel * 100)}%`}
                color={liveStats.interventionLevel > 0.5 ? 'text-red-400' : liveStats.interventionLevel > 0 ? 'text-yellow-400' : 'text-green-400'}
              />
              <StatBox label="Pace" value={liveStats.adjustedPace} />
              <StatBox
                label="Scores"
                value={liveStats.recentScores.map(s => `${Math.round(s * 100)}%`).join(', ') || '-'}
                small
              />
            </div>
            <div className="grid grid-cols-6 gap-1 text-center">
              {Object.entries(WORD_STATUSES).map(([key, status]) => (
                <div key={key} className="bg-gray-700 rounded p-1">
                  <div className="text-gray-400 text-[10px]">{key.slice(0, 3)}</div>
                  <div className="font-mono">{liveStats.wordCounts[status] || 0}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Controls Tab Content
 */
function ControlsTab({ sim }) {
  const {
    phase, profile, speed, isAutoMode, autoAdvance,
    setProfile, setSpeed, setAutoAdvance,
    startSimulation, startFullSimulation, pauseSimulation, resumeSimulation, stopSimulation, resetSimulation,
    advanceDay, advanceTime, toggleAutoMode
  } = sim

  return (
    <div className="space-y-4">
      {/* Profile Selection */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Student Profile</label>
        <select
          value={profile.id}
          onChange={(e) => setProfile(STUDENT_PROFILES[e.target.value.toUpperCase()])}
          className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white"
          disabled={phase === SIM_PHASES.RUNNING}
        >
          {Object.values(STUDENT_PROFILES).map(p => (
            <option key={p.id} value={p.id}>
              {p.name} - {p.description} ({Math.round(p.accuracy * 100)}%)
            </option>
          ))}
        </select>
      </div>

      {/* Speed Selection */}
      <div>
        <label className="block text-sm text-gray-400 mb-1">Speed</label>
        <div className="flex gap-2">
          {Object.values(SIMULATION_SPEEDS).map(s => (
            <button
              key={s.id}
              onClick={() => setSpeed(s)}
              className={`flex-1 px-3 py-2 rounded text-sm ${
                speed.id === s.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Auto Mode Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Auto-Answer Mode</span>
        <button
          onClick={toggleAutoMode}
          className={`px-4 py-2 rounded ${
            isAutoMode
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {isAutoMode ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Auto Advance Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">Auto-Advance Days</span>
        <button
          onClick={() => setAutoAdvance(!autoAdvance)}
          className={`px-4 py-2 rounded ${
            autoAdvance
              ? 'bg-green-600 text-white'
              : 'bg-gray-700 text-gray-300'
          }`}
        >
          {autoAdvance ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {phase === SIM_PHASES.IDLE && (
          <>
            <button
              onClick={() => startFullSimulation('sim-class-001', 'sim-list-3200')}
              className="col-span-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded font-bold"
            >
              🚀 Run Full Simulation
            </button>
            <button
              onClick={startSimulation}
              className="col-span-2 bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded text-sm"
            >
              ▶ Manual Start (no auto-navigate)
            </button>
          </>
        )}

        {phase === SIM_PHASES.RUNNING && (
          <button
            onClick={pauseSimulation}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded"
          >
            ⏸ Pause
          </button>
        )}

        {phase === SIM_PHASES.PAUSED && (
          <button
            onClick={resumeSimulation}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
          >
            ▶ Resume
          </button>
        )}

        {phase !== SIM_PHASES.IDLE && (
          <button
            onClick={stopSimulation}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            ⏹ Stop
          </button>
        )}

        <button
          onClick={advanceDay}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          disabled={phase === SIM_PHASES.IDLE}
        >
          → Next Day
        </button>

        <button
          onClick={() => advanceTime(21)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded"
        >
          ⏩ +21 Days
        </button>

        <button
          onClick={resetSimulation}
          className="col-span-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
        >
          🔄 Reset
        </button>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2 pt-2 border-t border-gray-700">
        <button
          onClick={() => {
            const json = sim.log.exportLog()
            downloadFile(json, 'simulation-log.json', 'application/json')
          }}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm px-3 py-2 rounded"
        >
          📥 Export JSON
        </button>
        <button
          onClick={() => {
            const csv = sim.log.exportWordPoolCSV(profile.name)
            downloadFile(csv, 'word-pool.csv', 'text/csv')
          }}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-sm px-3 py-2 rounded"
        >
          📥 Export CSV
        </button>
      </div>
    </div>
  )
}

/**
 * Stat display box
 */
function StatBox({ label, value, color = 'text-white', small = false }) {
  return (
    <div className="bg-gray-700 rounded p-2 text-center">
      <div className="text-gray-400 text-[10px] uppercase">{label}</div>
      <div className={`font-mono ${small ? 'text-xs' : 'text-sm'} ${color}`}>{value}</div>
    </div>
  )
}

/**
 * Download helper
 */
function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
