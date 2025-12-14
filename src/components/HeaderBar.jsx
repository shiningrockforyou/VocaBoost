import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Home, ClipboardList, User, Settings, LogOut, BookOpen, CircleUser, ChevronDown, GraduationCap, HelpCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import { useTheme } from '../contexts/ThemeContext'
import { fetchTeacherClasses } from '../services/db'
import { NavButton } from './ui'
import HelpModal from './HelpModal'

/**
 * HeaderBar - Global navigation header used across all pages
 */
const HeaderBar = () => {
  const { user, logout } = useAuth()
  const { isDark } = useTheme()
  const location = useLocation()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [classesDropdownOpen, setClassesDropdownOpen] = useState(false)
  const [teacherClasses, setTeacherClasses] = useState([])
  const [classesLoading, setClassesLoading] = useState(false)
  const [helpModalOpen, setHelpModalOpen] = useState(false)
  const dropdownRef = useRef(null)
  const classesDropdownRef = useRef(null)
  
  const isTeacher = user?.role === 'teacher'
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User'

  // Fetch teacher classes for dropdown
  useEffect(() => {
    const loadClasses = async () => {
      if (!isTeacher || !user?.uid) return
      setClassesLoading(true)
      try {
        const classes = await fetchTeacherClasses(user.uid)
        setTeacherClasses(classes)
      } catch (err) {
        console.error('Failed to load classes:', err)
      } finally {
        setClassesLoading(false)
      }
    }
    loadClasses()
  }, [isTeacher, user?.uid])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false)
      }
      if (classesDropdownRef.current && !classesDropdownRef.current.contains(event.target)) {
        setClassesDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = async () => {
    try {
      await logout()
    } catch (err) {
      console.error('Logout failed:', err)
    }
  }

  const gradebookPath = isTeacher ? '/teacher/gradebook' : '/gradebook'
  const isOnGradebook = location.pathname === gradebookPath || location.pathname.startsWith('/teacher/gradebook')
  const isOnLists = location.pathname === '/lists' || location.pathname.startsWith('/lists/')
  const isOnClassDetail = location.pathname.startsWith('/classes/')

  return (
    <div className="mb-8 flex items-center justify-between">
      {/* Logo */}
      <Link to="/">
        <img 
          src={isDark ? "/logo_white.png" : "/logo.png"} 
          alt="VocaBoost" 
          className="w-32 md:w-48 h-auto" 
        />
      </Link>

      {/* Right Side: Nav Buttons + Avatar */}
      <div className="flex items-center gap-3">
        {/* Dashboard Button */}
        <NavButton to="/" icon={Home} active={location.pathname === '/'}>
          Dashboard
        </NavButton>

        {/* Teacher-only: Classes Dropdown */}
        {isTeacher && (
          <div className="relative" ref={classesDropdownRef}>
            <button
              type="button"
              onClick={() => setClassesDropdownOpen(!classesDropdownOpen)}
              className={`
                h-12 flex items-center gap-2 px-5 
                rounded-button shadow-sm font-heading font-bold
                transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95
                ${isOnClassDetail 
                  ? 'bg-brand-primary text-white hover:bg-brand-primary/90' 
                  : 'bg-surface border border-border-default text-brand-text hover:bg-hover'}
              `}
            >
              <GraduationCap size={20} />
              <span>Classes</span>
              <ChevronDown size={16} className={`transition-transform ${classesDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Classes Dropdown Menu */}
            {classesDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-surface border border-border-default rounded-card shadow-lg z-50 overflow-hidden">
                {classesLoading ? (
                  <div className="px-4 py-3 text-sm text-text-muted">Loading...</div>
                ) : teacherClasses.length > 0 ? (
                  <div className="py-2 max-h-64 overflow-y-auto">
                    {teacherClasses.map((klass) => (
                      <Link
                        key={klass.id}
                        to={`/classes/${klass.id}`}
                        onClick={() => setClassesDropdownOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                          ${location.pathname === `/classes/${klass.id}` 
                            ? 'bg-accent-blue text-brand-text font-semibold' 
                            : 'text-text-secondary hover:bg-hover'}
                        `}
                      >
                        <span className="truncate">{klass.name}</span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-3 text-sm text-text-muted">No classes yet</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Gradebook Button */}
        <NavButton 
          to={gradebookPath} 
          icon={ClipboardList}
          active={isOnGradebook}
        >
          Gradebook
        </NavButton>

        {/* Teacher-only: Lists Button */}
        {isTeacher && (
          <NavButton 
            to="/lists" 
            icon={BookOpen}
            active={isOnLists}
          >
            Lists
          </NavButton>
        )}

        {/* Help Button (Students only) */}
        {!isTeacher && (
          <button
            type="button"
            onClick={() => setHelpModalOpen(true)}
            className="h-12 w-12 flex items-center justify-center rounded-button bg-surface border border-border-default text-text-secondary hover:bg-hover hover:text-brand-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
            aria-label="Help"
          >
            <HelpCircle size={24} />
          </button>
        )}

        {/* Avatar Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="h-12 w-12 flex items-center justify-center rounded-button bg-surface border border-border-default text-text-secondary hover:bg-hover hover:text-brand-primary transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-95"
            aria-label="User menu"
          >
            <CircleUser size={24} />
          </button>

          {/* Dropdown Menu */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-surface border border-border-default rounded-card shadow-lg z-50 overflow-hidden">
              {/* User Info Header */}
              <div className="px-4 py-3 border-b border-border-muted">
                <p className="font-heading font-bold text-text-primary truncate">{displayName}</p>
                <p className="text-sm text-text-muted truncate">{user?.email}</p>
              </div>

              {/* Menu Items */}
              <div className="py-2">
                <Link
                  to="/profile"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-hover transition-colors"
                >
                  <User size={18} className="text-text-faint" />
                  <span>Profile</span>
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:bg-hover transition-colors"
                >
                  <Settings size={18} className="text-text-faint" />
                  <span>Settings</span>
                </Link>
              </div>

              {/* Sign Out */}
              <div className="border-t border-border-muted py-2">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal (Students only) */}
      {!isTeacher && (
        <HelpModal isOpen={helpModalOpen} onClose={() => setHelpModalOpen(false)} />
      )}
    </div>
  )
}

export default HeaderBar
