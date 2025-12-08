import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  linkWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../firebase'
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

  const signInWithGoogle = async () => {
    try {
      const userCredential = await signInWithPopup(auth, googleProvider)
      const firebaseUser = userCredential.user

      // Check if user document exists in Firestore
      const userSnap = await getDoc(doc(db, 'users', firebaseUser.uid))
      
      if (!userSnap.exists()) {
        // First-time OAuth user - create Firestore document
        await createUserDocument(firebaseUser, {
          profile: {
            displayName: firebaseUser.displayName || '',
            avatarUrl: firebaseUser.photoURL || '',
          },
        })
      }

      return firebaseUser
    } catch (err) {
      // Handle popup closed by user gracefully
      if (err.code === 'auth/popup-closed-by-user') {
        return null // Not an error, user just closed popup
      }
      throw err
    }
  }

  const linkGoogleAccount = async () => {
    try {
      const userCredential = await linkWithPopup(auth.currentUser, googleProvider)
      return userCredential.user
    } catch (err) {
      // Handle specific errors
      if (err.code === 'auth/popup-closed-by-user') {
        return null // Not an error, user just closed popup
      }
      if (err.code === 'auth/credential-already-in-use') {
        throw new Error('This Google account is already linked to another user.')
      }
      throw err
    }
  }

  const value = useMemo(
    () => ({
      user,
      initializing,
      signup,
      login,
      logout,
      signInWithGoogle,
      linkGoogleAccount,
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


