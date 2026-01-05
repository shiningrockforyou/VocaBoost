import { Modal } from './ui'
import { BookOpen, ClipboardList, LayoutDashboard, List, Play, Sparkles, Users } from 'lucide-react'

/**
 * HelpModal - Onboarding help modal for students and teachers
 * Shows role-specific content for navigating VocaBoost
 */
const HelpModal = ({ isOpen, onClose, isTeacher = false }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isTeacher ? "How to Use VocaBoost (Teacher)" : "How to Use VocaBoost"}
      size="xl"
    >
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {isTeacher ? (
          // ===== TEACHER CONTENT =====
          <>
            {/* Section 1: Quick Start */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center">
                  <Play size={16} className="text-brand-accent" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Quick Start</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">1.</span>
                  <span><strong>Create a Class</strong> — Click "Create New Class" and name your class</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">2.</span>
                  <span><strong>Share the Join Code</strong> — Give students the 6-character code to join</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">3.</span>
                  <span><strong>Assign a Word List</strong> — Add vocabulary lists for students to study</span>
                </li>
              </ul>
            </section>

            <hr className="border-border-default" />

            {/* Section 2: Class Management */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <Users size={16} className="text-brand-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Class Management</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>View Students</strong> — See enrolled students, join dates, and progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Remove Students</strong> — Select and remove students (their records are preserved)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Export List</strong> — Download student list as CSV</span>
                </li>
              </ul>
            </section>

            <hr className="border-border-default" />

            {/* Section 3: Word List Management */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <List size={16} className="text-emerald-500" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Word List Management</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Create Lists</strong> — Build custom vocabulary lists with definitions</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Import from Excel</strong> — Bulk import words using the template</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Assign to Classes</strong> — Configure learning pace and test settings</span>
                </li>
              </ul>
            </section>

            <hr className="border-border-default" />

            {/* Section 4: Gradebook */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <ClipboardList size={16} className="text-amber-500" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Gradebook</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>View Scores</strong> — See all test results with filtering options</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Export Grades</strong> — Download grades as Excel file</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Review Challenges</strong> — Approve or reject student answer disputes</span>
                </li>
              </ul>
            </section>
          </>
        ) : (
          // ===== STUDENT CONTENT =====
          <>
            {/* Section 1: Quick Start */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center">
                  <Play size={16} className="text-brand-accent" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Quick Start</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">1.</span>
                  <span><strong>Join a Class</strong> — Enter the 6-character code your teacher gave you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">2.</span>
                  <span><strong>Start Session</strong> — Click the orange button to begin your daily vocabulary session</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-brand-primary min-w-[24px]">3.</span>
                  <span><strong>Complete all 5 phases</strong> — Study → Test → Review → Test → Done</span>
                </li>
              </ul>
            </section>

            <hr className="border-border-default" />

            {/* Section 2: Understanding the Dashboard */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center">
                  <LayoutDashboard size={16} className="text-brand-primary" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Understanding the Dashboard</h3>
              </div>
              <div className="rounded-xl border border-border-default overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-border-default">
                      <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Weekly Goals</td>
                      <td className="px-4 py-3 text-text-secondary">Your current vocabulary list and weekly progress</td>
                    </tr>
                    <tr className="border-b border-border-default">
                      <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Words Introduced</td>
                      <td className="px-4 py-3 text-text-secondary">Total vocabulary words you've been introduced to</td>
                    </tr>
                    <tr className="border-b border-border-default">
                      <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Mastery Rate</td>
                      <td className="px-4 py-3 text-text-secondary">Your average score on review tests</td>
                    </tr>
                    <tr className="border-b border-border-default">
                      <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Current Streak</td>
                      <td className="px-4 py-3 text-text-secondary">Consecutive days you've studied</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">7-Day Rhythm</td>
                      <td className="px-4 py-3 text-text-secondary">Your recent study activity</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <hr className="border-border-default" />

            {/* Section 3: Daily Session */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <BookOpen size={16} className="text-emerald-500" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Daily Session</h3>
              </div>
              <p className="text-sm text-text-secondary mb-4">
                Each day, you complete a structured session that introduces new words and reinforces what you've already learned.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">1</span>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">Learn New Words</p>
                    <p className="text-xs text-text-muted">Flip through flashcards, mark "Know This" or "Not Sure"</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">2</span>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">New Words Test</p>
                    <p className="text-xs text-text-muted">Must score 95% to continue (retake if needed)</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">3</span>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">Review Past Words</p>
                    <p className="text-xs text-text-muted">Practice words from previous days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                  <span className="w-6 h-6 rounded-full bg-brand-primary text-white text-xs font-bold flex items-center justify-center">4</span>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">Review Test</p>
                    <p className="text-xs text-text-muted">Test your retention</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10">
                  <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center">5</span>
                  <div>
                    <p className="font-semibold text-sm text-text-primary">Complete!</p>
                    <p className="text-xs text-text-muted">See your summary and come back tomorrow</p>
                  </div>
                </div>
              </div>
            </section>

            <hr className="border-border-default" />

            {/* Section 4: Other Features */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Sparkles size={16} className="text-amber-500" />
                </div>
                <h3 className="font-heading font-bold text-lg text-text-primary">Other Features</h3>
              </div>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Blind Spots</strong> — Words you struggle with or haven't seen recently</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>PDF buttons</strong> — Download study sheets to print or review offline</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-brand-primary">•</span>
                  <span><strong>Gradebook</strong> — View your test history</span>
                </li>
              </ul>
            </section>
          </>
        )}

        <hr className="border-border-default" />

        {/* Link to detailed guide */}
        <div className="text-center pt-2">
          <a
            href={isTeacher ? "/help-teacher-en.html" : "/help-student-en.html"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-brand-primary hover:underline"
          >
            Click here for a more detailed guide.
          </a>
        </div>
      </div>
    </Modal>
  )
}

export default HelpModal
