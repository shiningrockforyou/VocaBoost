import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, User, Mail, Shield, Check } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import HeaderBar from '../components/HeaderBar'
import { Card, Button } from '../components/ui'

const Profile = () => {
  const { user, updateUserName } = useAuth()
  const navigate = useNavigate()

  const currentName = user?.profile?.displayName || user?.displayName || ''
  const [name, setName] = useState(currentName)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const trimmed = name.trim()
  const dirty = trimmed !== currentName.trim()
  const valid = trimmed.length >= 1 && trimmed.length <= 60

  const handleSave = async () => {
    setSuccess('')
    setError('')
    if (!valid) {
      setError('Name must be between 1 and 60 characters.')
      return
    }
    setSaving(true)
    try {
      await updateUserName(trimmed)
      setSuccess('Your name has been updated.')
    } catch (err) {
      setError(err.message || 'Failed to update name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-base px-4 py-10 transition-colors">
      <div className="mx-auto max-w-3xl">
        <HeaderBar />

        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm font-medium text-text-muted hover:text-text-primary transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-heading font-bold text-brand-text">Profile</h1>
          <p className="font-body mt-1 text-base text-text-muted">
            Manage your account details.
          </p>
        </div>

        <Card variant="section" className="space-y-8">
          {/* Display Name (editable) */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2 flex items-center gap-2">
              <User size={18} className="text-text-faint" />
              Display Name
            </h2>
            <p className="text-sm text-text-muted mb-4">
              This is the name your teacher sees in the gradebook and class roster.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setSuccess(''); setError('') }}
                maxLength={80}
                placeholder="Your name"
                className="w-full sm:max-w-sm rounded-input border border-border-strong bg-surface px-4 py-2.5 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <Button
                variant="primary-blue"
                onClick={handleSave}
                disabled={saving || !dirty || !valid}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>

            {success && (
              <p className="mt-3 flex items-center gap-1.5 text-sm font-medium text-green-600">
                <Check size={16} /> {success}
              </p>
            )}
            {error && (
              <p className="mt-3 text-sm font-medium text-red-600">{error}</p>
            )}
          </div>

          <hr className="border-border-default" />

          {/* Email (read-only) */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2 flex items-center gap-2">
              <Mail size={18} className="text-text-faint" />
              Email
            </h2>
            <p className="text-sm text-text-secondary">{user?.email || '—'}</p>
          </div>

          <hr className="border-border-default" />

          {/* Role (read-only) */}
          <div>
            <h2 className="text-lg font-heading font-bold text-text-primary mb-2 flex items-center gap-2">
              <Shield size={18} className="text-text-faint" />
              Role
            </h2>
            <p className="text-sm text-text-secondary capitalize">{user?.role || 'student'}</p>
          </div>
        </Card>
      </div>
    </main>
  )
}

export default Profile
