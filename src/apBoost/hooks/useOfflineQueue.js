import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS } from '../utils/apTypes'
import { logError, logDebug } from '../utils/logError'
import { withTimeout, TIMEOUTS } from '../utils/withTimeout'

// IndexedDB database name and store
const DB_NAME = 'ap_boost_queue'
const STORE_NAME = 'actions'
const DB_VERSION = 1

/**
 * Open IndexedDB database
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        store.createIndex('sessionId', 'sessionId', { unique: false })
        store.createIndex('status', 'status', { unique: false })
      }
    }
  })
}

/**
 * Generate unique ID
 */
function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`
}

/**
 * useOfflineQueue - Queue writes to IndexedDB, flush to Firestore when online
 * @param {string} sessionId - Current session ID
 * @returns {Object} Queue state and methods
 */
export function useOfflineQueue(sessionId) {
  const [queueLength, setQueueLength] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isFlushing, setIsFlushing] = useState(false)
  const dbRef = useRef(null)
  const flushTimeoutRef = useRef(null)
  const retryCountRef = useRef(0)

  // Initialize IndexedDB
  useEffect(() => {
    let mounted = true

    async function initDB() {
      try {
        dbRef.current = await openDatabase()
        if (mounted) {
          await updateQueueLength()
        }
      } catch (error) {
        logError('useOfflineQueue.initDB', { sessionId }, error)
      }
    }

    initDB()

    return () => {
      mounted = false
      if (dbRef.current) {
        dbRef.current.close()
      }
    }
  }, [sessionId])

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      retryCountRef.current = 0
      // Try to flush when we come back online
      scheduleFlush(1000)
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Update queue length from IndexedDB
  const updateQueueLength = useCallback(async () => {
    if (!dbRef.current || !sessionId) return

    try {
      const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('sessionId')
      const request = index.count(IDBKeyRange.only(sessionId))

      request.onsuccess = () => {
        setQueueLength(request.result)
      }
    } catch (error) {
      logError('useOfflineQueue.updateQueueLength', { sessionId }, error)
    }
  }, [sessionId])

  // Add action to queue
  const addToQueue = useCallback(async (action) => {
    if (!dbRef.current || !sessionId) {
      logError('useOfflineQueue.addToQueue', { sessionId }, new Error('DB not ready'))
      return
    }

    const queueItem = {
      id: generateId(),
      sessionId,
      localTimestamp: Date.now(),
      action: action.action,
      payload: action.payload,
      status: 'PENDING',
    }

    try {
      const tx = dbRef.current.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      store.add(queueItem)

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })

      await updateQueueLength()
      logDebug('useOfflineQueue.addToQueue', 'Added to queue', queueItem)

      // Schedule flush if online
      if (isOnline) {
        scheduleFlush(1000) // 1 second debounce
      }
    } catch (error) {
      logError('useOfflineQueue.addToQueue', { sessionId, action }, error)
    }
  }, [sessionId, isOnline, updateQueueLength])

  // Schedule a flush with debounce
  const scheduleFlush = useCallback((delay) => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current)
    }
    flushTimeoutRef.current = setTimeout(() => {
      flushQueue()
    }, delay)
  }, [])

  // Flush queue to Firestore
  const flushQueue = useCallback(async () => {
    if (!dbRef.current || !sessionId || isFlushing || !isOnline) {
      return
    }

    setIsFlushing(true)

    try {
      // Get all pending items for this session
      const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('sessionId')
      const request = index.getAll(IDBKeyRange.only(sessionId))

      const items = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const pendingItems = items.filter(item => item.status === 'PENDING')

      if (pendingItems.length === 0) {
        setIsFlushing(false)
        return
      }

      logDebug('useOfflineQueue.flushQueue', `Flushing ${pendingItems.length} items`)

      // Build update object from queued actions
      const updates = {}
      for (const item of pendingItems) {
        switch (item.action) {
          case 'ANSWER_CHANGE':
            updates[`answers.${item.payload.questionId}`] = item.payload.value
            break
          case 'FLAG_TOGGLE':
            // Flags need special handling - we'd need to maintain the array
            break
          case 'NAVIGATION':
            updates.currentSectionIndex = item.payload.currentSectionIndex
            updates.currentQuestionIndex = item.payload.currentQuestionIndex
            break
          case 'TIMER_SYNC':
            if (item.payload.sectionTimeRemaining) {
              Object.entries(item.payload.sectionTimeRemaining).forEach(([sectionId, time]) => {
                updates[`sectionTimeRemaining.${sectionId}`] = time
              })
            }
            break
          default:
            break
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.lastAction = serverTimestamp()

        // Write to Firestore with timeout
        await withTimeout(
          updateDoc(doc(db, COLLECTIONS.SESSION_STATE, sessionId), updates),
          TIMEOUTS.FIRESTORE_WRITE,
          'Queue flush'
        )
      }

      // Mark items as confirmed and delete
      const deleteTx = dbRef.current.transaction(STORE_NAME, 'readwrite')
      const deleteStore = deleteTx.objectStore(STORE_NAME)

      for (const item of pendingItems) {
        deleteStore.delete(item.id)
      }

      await new Promise((resolve, reject) => {
        deleteTx.oncomplete = resolve
        deleteTx.onerror = () => reject(deleteTx.error)
      })

      retryCountRef.current = 0
      await updateQueueLength()
      logDebug('useOfflineQueue.flushQueue', 'Flush complete')
    } catch (error) {
      logError('useOfflineQueue.flushQueue', { sessionId }, error)

      // Exponential backoff retry
      retryCountRef.current++
      if (retryCountRef.current < 5) {
        const delay = Math.pow(2, retryCountRef.current) * 1000 // 2s, 4s, 8s, 16s
        scheduleFlush(delay)
      }
    } finally {
      setIsFlushing(false)
    }
  }, [sessionId, isFlushing, isOnline, updateQueueLength, scheduleFlush])

  // Cleanup
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current)
      }
    }
  }, [])

  return {
    addToQueue,
    flushQueue,
    queueLength,
    isOnline,
    isFlushing,
  }
}

export default useOfflineQueue
