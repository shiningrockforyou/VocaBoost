import { useState, useEffect, useCallback, useRef } from 'react'
import { doc, updateDoc, serverTimestamp, getDoc, runTransaction } from 'firebase/firestore'
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

  // Get pending items from queue (optionally filtered by action type)
  const getPendingItems = useCallback(async (actionFilter = null) => {
    if (!dbRef.current || !sessionId) return []

    try {
      const tx = dbRef.current.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('sessionId')
      const request = index.getAll(IDBKeyRange.only(sessionId))

      const items = await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      let pendingItems = items.filter(item => item.status === 'PENDING')

      // Filter by action type if specified
      if (actionFilter) {
        pendingItems = pendingItems.filter(item => item.action === actionFilter)
      }

      return pendingItems
    } catch (error) {
      logError('useOfflineQueue.getPendingItems', { sessionId, actionFilter }, error)
      return []
    }
  }, [sessionId])

  // Delete specific items from queue by IDs
  const deleteItems = useCallback(async (itemIds) => {
    if (!dbRef.current || !sessionId || itemIds.length === 0) return

    try {
      const tx = dbRef.current.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      for (const id of itemIds) {
        store.delete(id)
      }

      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      })

      await updateQueueLength()
    } catch (error) {
      logError('useOfflineQueue.deleteItems', { sessionId, itemIds }, error)
    }
  }, [sessionId, updateQueueLength])

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

      // Separate FLAG_TOGGLE items for special handling
      const flagToggleItems = pendingItems.filter(item => item.action === 'FLAG_TOGGLE')
      const otherItems = pendingItems.filter(item => item.action !== 'FLAG_TOGGLE')

      // Dedupe ANSWER_CHANGE items: last-write-wins per (questionId, subQuestionLabel)
      const answerChangeItems = otherItems.filter(item => item.action === 'ANSWER_CHANGE')
      const nonAnswerItems = otherItems.filter(item => item.action !== 'ANSWER_CHANGE')
      const answerByKey = new Map()
      for (const item of answerChangeItems) {
        const key = `${item.payload.questionId}:${item.payload.subQuestionLabel || '__single__'}`
        answerByKey.set(key, item) // Later items overwrite earlier (last-write-wins)
      }

      // Build update object from non-flag actions
      const updates = {}

      // Process deduped ANSWER_CHANGE items with nested paths for sub-questions
      for (const item of answerByKey.values()) {
        const { questionId, value, subQuestionLabel } = item.payload
        if (subQuestionLabel) {
          // FRQ with sub-questions: write to nested field path
          updates[`answers.${questionId}.${subQuestionLabel}`] = value
        } else {
          // MCQ or FRQ without sub-questions: write directly
          updates[`answers.${questionId}`] = value
        }
      }

      // Process other non-flag actions
      for (const item of nonAnswerItems) {
        switch (item.action) {
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

      // Handle FLAG_TOGGLE with idempotent set-membership (last-write-wins per questionId)
      if (flagToggleItems.length > 0) {
        // Dedupe: keep only the last action per questionId (last-write-wins)
        const flagsByQuestionId = new Map()
        for (const item of flagToggleItems) {
          flagsByQuestionId.set(item.payload.questionId, item.payload.markedForReview)
        }

        const sessionRef = doc(db, COLLECTIONS.SESSION_STATE, sessionId)

        await withTimeout(
          runTransaction(db, async (transaction) => {
            const sessionSnap = await transaction.get(sessionRef)
            if (!sessionSnap.exists()) {
              throw new Error('Session not found')
            }

            // Get current flaggedQuestions array
            const currentFlags = new Set(sessionSnap.data().flaggedQuestions || [])

            // Apply each flag change as SET operation (not toggle)
            for (const [questionId, markedForReview] of flagsByQuestionId) {
              if (markedForReview) {
                currentFlags.add(questionId)
              } else {
                currentFlags.delete(questionId)
              }
            }

            // Write back the updated array
            transaction.update(sessionRef, {
              flaggedQuestions: Array.from(currentFlags),
              lastAction: serverTimestamp()
            })
          }),
          TIMEOUTS.FIRESTORE_WRITE,
          'Flag toggle flush'
        )

        logDebug('useOfflineQueue.flushQueue', `Flushed ${flagsByQuestionId.size} flag changes`)
      }

      // Handle ANNOTATION_UPDATE with transaction (in-order processing for index stability)
      const annotationItems = pendingItems.filter(item => item.action === 'ANNOTATION_UPDATE')
      if (annotationItems.length > 0) {
        const sessionRef = doc(db, COLLECTIONS.SESSION_STATE, sessionId)

        await withTimeout(
          runTransaction(db, async (transaction) => {
            const sessionSnap = await transaction.get(sessionRef)
            if (!sessionSnap.exists()) {
              throw new Error('Session not found')
            }

            const data = sessionSnap.data()
            // Deep clone to avoid mutating Firestore data
            const annotations = JSON.parse(JSON.stringify(data.annotations || {}))
            const strikethroughs = JSON.parse(JSON.stringify(data.strikethroughs || {}))

            // Process each annotation update in order (important for index-based operations)
            for (const item of annotationItems) {
              const { type, questionId, choiceId, range, color, index } = item.payload

              switch (type) {
                case 'ADD_HIGHLIGHT':
                  if (!annotations[questionId]) {
                    annotations[questionId] = []
                  }
                  annotations[questionId].push({ ...range, color })
                  break

                case 'REMOVE_HIGHLIGHT':
                  if (annotations[questionId] && annotations[questionId][index] !== undefined) {
                    annotations[questionId].splice(index, 1)
                  }
                  break

                case 'CLEAR_HIGHLIGHTS':
                  annotations[questionId] = []
                  break

                case 'TOGGLE_STRIKETHROUGH':
                  if (!strikethroughs[questionId]) {
                    strikethroughs[questionId] = []
                  }
                  const strikeArr = strikethroughs[questionId]
                  const strikeIndex = strikeArr.indexOf(choiceId)
                  if (strikeIndex === -1) {
                    strikeArr.push(choiceId)
                  } else {
                    strikeArr.splice(strikeIndex, 1)
                  }
                  break

                case 'CLEAR_STRIKETHROUGHS':
                  strikethroughs[questionId] = []
                  break

                case 'CLEAR_ALL':
                  // Clear all annotations and strikethroughs
                  Object.keys(annotations).forEach(key => delete annotations[key])
                  Object.keys(strikethroughs).forEach(key => delete strikethroughs[key])
                  break

                default:
                  break
              }
            }

            // Write back the updated annotations
            transaction.update(sessionRef, {
              annotations,
              strikethroughs,
              lastAction: serverTimestamp()
            })
          }),
          TIMEOUTS.FIRESTORE_WRITE,
          'Annotation flush'
        )

        logDebug('useOfflineQueue.flushQueue', `Flushed ${annotationItems.length} annotation changes`)
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
    getPendingItems,
    deleteItems,
  }
}

export default useOfflineQueue
