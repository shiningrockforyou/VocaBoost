/**
 * RestudyBrowser.jsx — DF2-51-c: the past-day browser at `/restudy/:classId/:listId`.
 *
 * Fold 3 of 8 in the DF2-51 train (`docs/plans/deepfix2/22_DF2-51_PASTDAY_NAV_
 * DESIGN.md` §7 RATIFIED). Reads and renders the past-days list from the SHIPPING
 * wireframe (`mockups/df2-51-extended.html` §2) — day number, studied/tested
 * dates, the five-state chip, the two pips, a bookmark toggle, and Re-study/
 * Re-test buttons. It does NOT submit tests (51-d wires the buttons) and does
 * NOT own the Dashboard entry point or the resume panel (51-f).
 *
 * CONSUMES, DOES NOT REBUILD:
 *  - `src/utils/pastDayAuthority.js` (51-a, landed) — every day/state/pip
 *    derivation. This file never computes a state or a pip; see
 *    `RestudyBrowser.viewModel.js` for the (also non-domain) presentation
 *    mapping from a `pastDayAuthority` row to display props.
 *  - `src/services/restudyVisit.js` (51-b, landed) — NOT used here. Browsing
 *    mints nothing; the mint happens at the first rerun compose (51-d).
 *
 * FLAG-OFF: this component only ever mounts when `REVIEW_V2_CLIENT` is true —
 * the route itself does not exist in `src/App.jsx` when the flag is false (see
 * that file's `REVIEW_V2_CLIENT &&` guard). There is deliberately no internal
 * flag re-check here: the route registration is the ONE call site (design doc
 * §7 decision (e)), and this component can structurally never render flag-off.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { collection, deleteField, doc, getDoc, getDocs, query, updateDoc, where } from 'firebase/firestore'
import { ChevronLeft, Info, Star } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext.jsx'
import HeaderBar from '../components/HeaderBar.jsx'
import LoadingSpinner from '../components/LoadingSpinner.jsx'
import { Badge, Button, Card, IconButton } from '../components/ui'
import { db } from '../firebase'
import { fetchUserAttempts } from '../services/db'
import { getClassProgress } from '../services/progressService'
import { attemptsForList } from '../utils/dayStatusAuthority'
import { DAY_STATES, bookmarkedDayForList, derivePastDays, deriveTodayRow } from '../utils/pastDayAuthority'
import {
  buildRestudyRows,
  computeBookmarkToggleTarget,
  dayStateChipConfig,
  isDayActionable,
  selectBranch,
} from './RestudyBrowser.viewModel'

// Fixed legend order — mirrors DAY_STATES' own declaration order, which is
// already exactly the wireframe's legend order (untouched -> studied ->
// tested -> re-completed -> bookmarked).
const LEGEND_STATES = [
  DAY_STATES.UNTOUCHED,
  DAY_STATES.STUDIED,
  DAY_STATES.TESTED,
  DAY_STATES.RE_COMPLETED,
  DAY_STATES.BOOKMARKED,
]

const ROW_GRID = 'sm:grid-cols-[1.4fr_1fr_0.9fr_1.6fr_0.7fr]'

/** One pip dot. Design-tokens-only; `pip` is `{state, title}` from the view model. */
function Pip({ pip }) {
  if (!pip) return null
  const stateClass =
    pip.state === 'on'
      ? 'border-brand-primary bg-brand-primary'
      : pip.state === 'na'
        ? 'border-dashed border-border-muted bg-transparent'
        : 'border-border-strong bg-transparent'
  return (
    <span
      title={pip.title}
      aria-label={pip.title}
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 ${stateClass}`}
    />
  )
}

/**
 * One row of the day list — a past day (chip/pips/actions/bookmark all live)
 * or today (the wireframe's non-actionable placeholder). `isDayActionable`
 * (the view model) is the ONE gate deciding which of those two this row
 * renders — both branches share it so "today never gets buttons" and "a real
 * past day always does" are the SAME fixtured predicate, not two independent
 * guesses.
 */
function DayRow({
  day, dateLabel, today, chip, pips, bookmarked, restudyDisabled, retestDisabled,
  bookmarkSaving, onRestudy, onRetest, onToggleBookmark,
}) {
  const actionable = isDayActionable({ today })
  return (
    <li className={`grid grid-cols-1 gap-2 px-4 py-3 sm:items-center sm:gap-3 ${ROW_GRID} ${today ? 'bg-muted' : ''}`}>
      <div className="flex flex-col">
        <span className="inline-flex items-center gap-2 font-heading text-sm font-bold text-text-primary">
          Day {day}
          {today && <Badge variant="info" size="sm">Today</Badge>}
        </span>
        {today ? (
          <span className="font-body text-xs italic text-text-muted">In progress</span>
        ) : (
          dateLabel && <span className="font-body text-xs text-text-muted">{dateLabel}</span>
        )}
      </div>

      <div>
        {actionable && chip ? (
          <Badge variant={chip.variant}>{chip.symbol} {chip.label}</Badge>
        ) : (
          <span className="font-body text-sm text-text-faint">—</span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {actionable && pips ? (
          <>
            <Pip pip={pips.review} />
            <Pip pip={pips.new} />
          </>
        ) : (
          <span className="font-body text-sm text-text-faint">—</span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {actionable ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              disabled={restudyDisabled}
              title={restudyDisabled ? 'No new-word half exists for this day' : undefined}
              onClick={onRestudy}
            >
              Re-study
            </Button>
            <Button variant="primary-blue" size="sm" disabled={retestDisabled} onClick={onRetest}>
              Re-test
            </Button>
          </>
        ) : (
          <span className="font-body text-sm italic text-text-muted">Come back once finished</span>
        )}
      </div>

      <div className="flex sm:justify-center">
        {actionable && (
          <IconButton
            variant="default"
            size="sm"
            disabled={bookmarkSaving}
            onClick={onToggleBookmark}
            title={bookmarked ? 'Bookmarked — tap to remove' : 'Tap to bookmark this day'}
            aria-pressed={bookmarked}
            className={bookmarked ? 'border border-brand-primary bg-accent-blue text-brand-primary' : 'border border-border-default'}
          >
            <Star size={16} fill={bookmarked ? 'currentColor' : 'none'} />
          </IconButton>
        )}
      </div>
    </li>
  )
}

function RestudyBrowser() {
  const { classId, listId } = useParams()
  const { user } = useAuth()

  const [listTitle, setListTitle] = useState(null)
  const [progress, setProgress] = useState(null)
  const [attempts, setAttempts] = useState([])
  const [visits, setVisits] = useState([])
  const [bookmarkedDay, setBookmarkedDay] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [bookmarkSaving, setBookmarkSaving] = useState(false)
  const [bookmarkError, setBookmarkError] = useState('')

  // Loading idiom mirrors Dashboard.jsx's own loaders (loadUserAttempts /
  // loadProgressData): useState data + loading + error, a cancelled-flag
  // guarded async body, try/catch/finally, console.error on failure rather
  // than throwing into render.
  useEffect(() => {
    if (!user?.uid || !classId || !listId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')

    const load = async () => {
      try {
        const [listSnap, userSnap, progressDoc, allAttempts, visitsSnap] = await Promise.all([
          getDoc(doc(db, 'lists', listId)),
          getDoc(doc(db, 'users', user.uid)),
          getClassProgress(user.uid, classId, listId),
          fetchUserAttempts(user.uid),
          getDocs(query(
            collection(db, `users/${user.uid}/restudy_visits`),
            where('classId', '==', classId),
            where('listId', '==', listId),
          )),
        ])
        if (cancelled) return

        setListTitle(listSnap.exists() ? (listSnap.data().title || 'Vocabulary List') : 'Vocabulary List')

        const userData = userSnap.exists() ? userSnap.data() : {}
        setBookmarkedDay(bookmarkedDayForList(userData.restudyBookmarks, classId, listId))

        setProgress(progressDoc)
        setAttempts(attemptsForList(allAttempts, classId, listId))
        setVisits(visitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      } catch (err) {
        console.error('Failed to load the restudy browser:', err)
        if (!cancelled) setError('We could not load your past days. Please try again.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [user?.uid, classId, listId])

  const currentStudyDay = progress?.currentStudyDay ?? 0

  const pastDays = useMemo(
    () => derivePastDays({ currentStudyDay, attempts, visits, bookmarks: bookmarkedDay }),
    [currentStudyDay, attempts, visits, bookmarkedDay],
  )
  const todayRow = useMemo(() => deriveTodayRow({ currentStudyDay }), [currentStudyDay])
  const rows = useMemo(() => buildRestudyRows({ pastDays }), [pastDays])
  const branch = selectBranch({ loading, error, pastDays })

  // Bookmark write — the OWNER-writable UI-preference scalar on `users/{uid}`
  // (`restudyBookmarks.{classId}_{listId} = day`, `15_H6:196`). No existing
  // db.js helper covers this field (`updateUserSettings` only knows
  // weeklyGoal/useUnifiedQueue/primaryFocus*) and db.js is outside this fold's
  // touch-list, so this mirrors `updateUserSettings`'s OWN dot-path
  // `updateDoc` idiom directly rather than adding a second generic writer or
  // widening a file this fold does not own (see the fold report).
  const handleToggleBookmark = useCallback(async (day) => {
    if (!user?.uid || !classId || !listId || bookmarkSaving) return
    const nextDay = computeBookmarkToggleTarget({ currentBookmarkedDay: bookmarkedDay, clickedDay: day })
    setBookmarkSaving(true)
    setBookmarkError('')
    try {
      const fieldPath = `restudyBookmarks.${classId}_${listId}`
      await updateDoc(doc(db, 'users', user.uid), {
        [fieldPath]: nextDay == null ? deleteField() : nextDay,
      })
      setBookmarkedDay(nextDay)
    } catch (err) {
      console.error('Failed to update the restudy bookmark:', err)
      setBookmarkError('Could not update your bookmark. Please try again.')
    } finally {
      setBookmarkSaving(false)
    }
  }, [user?.uid, classId, listId, bookmarkedDay, bookmarkSaving])

  // 51-d wires these to the real rerun-compose + navigation flow. Stubs only
  // — browsing must never mint a visit or fake navigation (brief, Build §2).
  const handleRestudyStub = useCallback(() => {
    // intentionally empty — 51-d implements this
  }, [])
  const handleRetestStub = useCallback(() => {
    // intentionally empty — 51-d implements this
  }, [])

  return (
    <main className="min-h-screen bg-base px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <HeaderBar />

        <Link
          to="/"
          className="inline-flex items-center gap-1 font-body text-sm font-semibold text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft size={16} />
          {listTitle || 'Back to Dashboard'}
        </Link>

        <h1 className="mt-3 font-heading text-3xl font-bold text-brand-text">Past Days</h1>
        <p className="mt-1 font-body text-sm text-text-secondary">
          Pick an earlier day to re-study its flashcards or take a short, non-advancing re-test.
        </p>

        {branch !== 'loading' && (
          <div className="mt-5 flex items-start gap-2 rounded-alert border border-border-default bg-info-subtle px-4 py-3 font-body text-sm text-info-text-strong">
            <Info size={16} className="mt-0.5 shrink-0" />
            <span>Re-tests never change your progress or grade — they&apos;re just extra practice, every time.</span>
          </div>
        )}

        {branch !== 'loading' && (
          <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Status legend">
            {LEGEND_STATES.map((state) => {
              const cfg = dayStateChipConfig(state)
              return (
                <Badge key={state} variant={cfg.variant} size="sm">
                  {cfg.symbol} {cfg.label}
                </Badge>
              )
            })}
          </div>
        )}

        {bookmarkError && (
          <p className="mt-3 font-body text-xs font-medium text-error-text" role="alert">{bookmarkError}</p>
        )}

        {branch === 'loading' && (
          <div className="mt-10 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        )}

        {branch === 'error' && (
          <Card variant="alert-error" className="mt-6">
            <p className="font-body text-sm font-medium text-error-text">{error}</p>
          </Card>
        )}

        {(branch === 'empty' || branch === 'list') && (
          <div className="mt-6 overflow-hidden rounded-card border border-border-default bg-surface">
            <div className={`hidden border-b border-border-default bg-muted px-4 py-2 font-body text-xs font-bold uppercase tracking-wide text-text-muted sm:grid sm:gap-3 ${ROW_GRID}`}>
              <span>Day</span>
              <span>Status</span>
              <span>Pips</span>
              <span>Actions</span>
              <span className="text-center">Bookmark</span>
            </div>

            {branch === 'empty' && (
              <div className="px-4 py-8 text-center">
                <p className="font-body text-sm text-text-muted">
                  You have not completed a past day yet — come back once today&apos;s session is finished.
                </p>
              </div>
            )}

            <ul className="divide-y divide-border-default">
              {rows.map((row) => (
                <DayRow
                  key={row.day}
                  day={row.day}
                  dateLabel={row.dateLabel}
                  today={false}
                  chip={row.chip}
                  pips={row.pips}
                  bookmarked={row.bookmarked}
                  restudyDisabled={row.restudyDisabled}
                  retestDisabled={row.retestDisabled}
                  bookmarkSaving={bookmarkSaving}
                  onRestudy={handleRestudyStub}
                  onRetest={handleRetestStub}
                  onToggleBookmark={() => handleToggleBookmark(row.day)}
                />
              ))}

              <DayRow
                key={`today-${todayRow.day}`}
                day={todayRow.day}
                dateLabel=""
                today
                chip={null}
                pips={null}
                bookmarked={false}
                restudyDisabled
                retestDisabled
                bookmarkSaving={bookmarkSaving}
                onRestudy={handleRestudyStub}
                onRetest={handleRetestStub}
                onToggleBookmark={() => {}}
              />
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}

export default RestudyBrowser
