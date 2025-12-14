import { Modal } from './ui'
import { BookOpen, LayoutDashboard, Play, Sparkles } from 'lucide-react'

/**
 * HelpModal - Onboarding help modal for first-day students
 * Shows how to navigate the dashboard and use VocaBoost
 */
const HelpModal = ({ isOpen, onClose }) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="How to Use VocaBoost" size="xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
                  <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Words Mastered</td>
                  <td className="px-4 py-3 text-text-secondary">Estimated words you've learned</td>
                </tr>
                <tr className="border-b border-border-default">
                  <td className="px-4 py-3 font-semibold text-text-primary bg-muted whitespace-nowrap">Retention Rate</td>
                  <td className="px-4 py-3 text-text-secondary">How well you remember past words</td>
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
      </div>
    </Modal>
  )
}

export default HelpModal
