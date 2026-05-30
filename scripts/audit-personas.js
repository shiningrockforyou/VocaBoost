/**
 * Audit persona definitions and 50-account allocation.
 *
 * Shared by scripts/seed-audit-students.js and scripts/cleanup-audit-students.js,
 * and consumed by the Playwright audit (see audit/playwright/PLAN.md "Personas").
 *
 * Allocation: 25 students to TOP class, 25 students to CORE class.
 * Distribution biased toward chat-log evidence — the Korean Native Typist, ESL Learner,
 * and Phone-Only personas are over-weighted because they're the demographic majority
 * in the real winter intensive cohort.
 */

export const PERSONAS = [
  // Baseline behaviors
  { id: 'careful',            label: 'Careful Student',         transform: 'canonical_en_verbatim' },
  { id: 'distracted',         label: 'Distracted Student',      transform: 'canonical_en_verbatim' },
  { id: 'rushed',             label: 'Rushed Student',          transform: 'canonical_en_verbatim' },
  { id: 'lazy',               label: 'Lazy Student',            transform: 'random_from_idk_set' },
  { id: 'anxious',            label: 'Anxious Student',         transform: 'canonical_en_verbatim' },
  { id: 'recovering',         label: 'Recovering Student',      transform: 'canonical_en_verbatim' },
  { id: 'hostile',            label: 'Hostile Student',         transform: 'canonical_en_verbatim' },

  // Linguistic / cultural
  { id: 'korean',             label: 'Korean Native Typist',    transform: 'canonical_ko' },
  { id: 'codeswitch',         label: 'Code-Switching Student',  transform: 'code_switch_one_noun' },
  { id: 'esl',                label: 'ESL Learner',             transform: 'esl_strip_articles_mispluralize' },
  { id: 'beginner',           label: 'Beginner Student',        transform: 'one_word_synonym' },
  { id: 'advanced',           label: 'Advanced Student',        transform: 'elaborated_verbose' },

  // Device / network
  { id: 'phone',              label: 'Phone-Only Student',      transform: 'canonical_en_verbatim' },
  { id: 'slowlaptop',         label: 'Slow-Laptop Student',     transform: 'canonical_en_verbatim' },
  { id: 'academywifi',        label: 'Academy-WiFi Student',    transform: 'canonical_en_verbatim' },
  { id: 'mobiledata',         label: 'Mobile-Data Student',     transform: 'canonical_en_verbatim' },
  { id: 'multidevice',        label: 'Multi-Device Student',    transform: 'canonical_en_verbatim' },

  // Behaviour outliers
  { id: 'speedrunner',        label: 'Speed Runner',            transform: 'first_word_only' },
  { id: 'perfectionist',      label: 'Perfectionist',           transform: 'canonical_en_with_edits' },
  { id: 'trolling',           label: 'Trolling Student',        transform: 'random_from_joke_set' },
  { id: 'cheater',            label: 'Cheater',                 transform: 'canonical_en_verbatim' },
  { id: 'refresher',          label: 'Habitual Refresher',      transform: 'canonical_en_verbatim' },
  { id: 'classswitcher',      label: 'Class-Switcher',          transform: 'canonical_en_verbatim' },
  { id: 'firsttimer',         label: 'Confused First-Timer',    transform: 'half_formed_question' },
]

/**
 * 50-account allocation, split 25 TOP / 25 CORE.
 * Total per persona = ALLOCATION.TOP[id] + ALLOCATION.CORE[id].
 */
export const ALLOCATION = {
  TOP: {
    careful: 1, distracted: 1, rushed: 1, lazy: 1, anxious: 1, recovering: 1, hostile: 1, // 7
    korean: 2, codeswitch: 1, esl: 2, beginner: 0, advanced: 2,                          // 7
    phone: 1, slowlaptop: 1, academywifi: 1, mobiledata: 1, multidevice: 1,              // 5
    speedrunner: 1, perfectionist: 1, trolling: 1, cheater: 1, refresher: 1,             //
    classswitcher: 0, firsttimer: 1,                                                     // 6
  },
  CORE: {
    careful: 1, distracted: 1, rushed: 1, lazy: 1, anxious: 1, recovering: 1, hostile: 1, // 7
    korean: 1, codeswitch: 1, esl: 1, beginner: 2, advanced: 0,                          // 5
    phone: 1, slowlaptop: 1, academywifi: 1, mobiledata: 1, multidevice: 1,              // 5
    speedrunner: 1, perfectionist: 1, trolling: 1, cheater: 1, refresher: 1,             //
    classswitcher: 2, firsttimer: 1,                                                     // 8
  },
}

export const TOP_JOIN_CODE = 'QSTRZL'   // 25WT 2차 TOP OFFLINE
export const CORE_JOIN_CODE = '3VEHE8'  // 25WT 2차 CORE OFFLINE
export const EMAIL_DOMAIN = 'vocaboost.test'
export const SHARED_PASSWORD = 'AuditPass2026!'

/**
 * Build the full list of account records to be seeded.
 * Returns array of { email, password, displayName, personaId, targetClass, indexInPersona, globalIdx }.
 */
export function buildAccountList() {
  const accounts = []
  let globalIdx = 0
  for (const targetClass of ['TOP', 'CORE']) {
    for (const persona of PERSONAS) {
      const count = ALLOCATION[targetClass][persona.id] || 0
      for (let i = 0; i < count; i++) {
        const indexInPersona = i + 1
        const idxStr = String(indexInPersona).padStart(2, '0')
        const classSuffix = targetClass.toLowerCase()
        globalIdx++
        accounts.push({
          email: `audit_${persona.id}_${idxStr}_${classSuffix}@${EMAIL_DOMAIN}`,
          password: SHARED_PASSWORD,
          displayName: `Audit ${persona.label} ${idxStr} (${targetClass})`,
          personaId: persona.id,
          personaLabel: persona.label,
          personaTransform: persona.transform,
          targetClass,
          indexInPersona,
          globalIdx,
        })
      }
    }
  }
  return accounts
}

/**
 * Sanity-check the allocation totals at module load.
 * If counts drift in editing, this fails fast with a helpful message.
 */
;(function validateAllocation() {
  const topTotal = Object.values(ALLOCATION.TOP).reduce((a, b) => a + b, 0)
  const coreTotal = Object.values(ALLOCATION.CORE).reduce((a, b) => a + b, 0)
  if (topTotal !== 25 || coreTotal !== 25) {
    throw new Error(`Allocation drift: TOP=${topTotal}, CORE=${coreTotal} (expected 25 each)`)
  }
})()
