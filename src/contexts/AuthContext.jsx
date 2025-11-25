import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { createUserDocument } from '../services/db'

const AuthContext = createContext(undefined)

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [initializing, setInitializing] = useState(true)

  useEffect(() => {
    let isMounted = true
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        if (isMounted) {
          setUser(null)
          setInitializing(false)
        }
        return
      }

      const loadProfile = async () => {
        try {
          const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
          const userData = userSnap.exists() ? userSnap.data() : {}
          if (isMounted) {
            setUser({
              ...firebaseUser,
              role: userData.role ?? 'student',
              profile: userData.profile ?? null,
              stats: userData.stats ?? null,
              settings: userData.settings ?? null,
            })
          }
        } catch {
          if (isMounted) {
            setUser({
              ...firebaseUser,
              role: 'student',
            })
          }
        } finally {
          if (isMounted) {
            setInitializing(false)
          }
        }
      }

      loadProfile()
    })

    return () => {
      isMounted = false
      unsubscribe()
    }
  }, [])

  const signup = async (email, password, name, gradData = {}) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password)

    if (name) {
      await updateProfile(userCredential.user, { displayName: name }).catch(() => {})
    }

    await createUserDocument(userCredential.user, {
      profile: {
        displayName: name,
        gradYear: gradData.gradYear ?? null,
        gradMonth: gradData.gradMonth ?? null,
      },
    })

    return userCredential.user
  }

  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)
  const logout = () => signOut(auth)

  const value = useMemo(
    () => ({
      user,
      initializing,
      signup,
      login,
      logout,
    }),
    [user, initializing],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


