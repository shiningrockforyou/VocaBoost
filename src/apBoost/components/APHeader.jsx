import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/**
 * APHeader - Header component for AP Boost pages
 * Displays AP branding, user info, and navigation
 */
export default function APHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-surface border-b border-border-default px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo and branding */}
        <Link to="/ap" className="flex items-center gap-3">
          <img
            src="/apBoost/ap_logo.png"
            alt="AP Logo"
            className="h-8 w-auto"
            onError={(e) => {
              // Fallback if logo doesn't exist
              e.target.style.display = 'none'
            }}
          />
          <span className="text-lg font-semibold text-text-primary">AP Practice</span>
        </Link>

        {/* User info and actions */}
        <div className="flex items-center gap-4">
          <span className="text-text-secondary text-sm hidden sm:inline">
            {user?.displayName || user?.email || 'Student'}
          </span>
          <Link
            to="/"
            className="text-text-muted text-sm hover:text-text-secondary transition-colors"
          >
            VocaBoost
          </Link>
        </div>
      </div>
    </header>
  )
}
