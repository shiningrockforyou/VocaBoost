/**
 * Node.js script to seed AP Boost data into Firestore using Firebase Admin SDK.
 * Usage: node scripts/seed-ap-data.js [teacherUid]
 *
 * Uses application default credentials from Firebase CLI login.
 */

import { readFileSync } from 'fs'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

// Init with application default credentials from Firebase CLI
const credPath = `${process.env.APPDATA || process.env.HOME + '/.config'}/firebase/dmchwang_gmail_com_application_default_credentials.json`
let credential
try {
  const credJson = JSON.parse(readFileSync(credPath, 'utf-8'))
  // Application default credentials use refresh tokens
  credential = applicationDefault()
} catch {
  credential = applicationDefault()
}

// Read project ID from .env
const envContent = readFileSync('.env', 'utf-8')
const env = {}
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) env[match[1].trim()] = match[2].trim().replace(/\r$/, '')
})

const projectId = env.VITE_FIREBASE_PROJECT_ID
console.log('Firebase project:', projectId)

// Set the env var so applicationDefault() picks it up
process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath

const app = initializeApp({ projectId })
const db = getFirestore(app)

// --- Constants ---
const COLLECTIONS = {
  TESTS: 'ap_tests',
  QUESTIONS: 'ap_questions',
  CLASSES: 'ap_classes',
  ASSIGNMENTS: 'ap_assignments',
  TEST_RESULTS: 'ap_test_results',
}

const TEACHER_ID = process.argv[2] || 'teacher_seed_001'

const STUDENTS = [
  { id: 'student_seed_001', displayName: 'Alex Johnson', email: 'alex.j@school.edu' },
  { id: 'student_seed_002', displayName: 'Maria Garcia', email: 'maria.g@school.edu' },
  { id: 'student_seed_003', displayName: 'James Chen', email: 'james.c@school.edu' },
  { id: 'student_seed_004', displayName: 'Priya Patel', email: 'priya.p@school.edu' },
  { id: 'student_seed_005', displayName: 'Ethan Williams', email: 'ethan.w@school.edu' },
]
const STUDENT_IDS = STUDENTS.map(s => s.id)

// --- AP MICRO QUESTIONS ---
const MICRO_TEST_ID = 'test_micro_full_1'
const MICRO_MCQ = [
  { id: 'micro_q1', questionDomain: 'Unit 1: Basic Economic Concepts', questionTopic: 'Scarcity & Opportunity Cost', difficulty: 'EASY', questionText: 'A production possibilities curve that is bowed outward (concave to the origin) illustrates which economic concept?', choiceA: { text: 'Constant opportunity costs' }, choiceB: { text: 'Increasing opportunity costs' }, choiceC: { text: 'Decreasing marginal returns' }, choiceD: { text: 'Economies of scale' }, correctAnswers: ['B'], explanation: 'A bowed-out PPC shows increasing opportunity costs.' },
  { id: 'micro_q2', questionDomain: 'Unit 1: Basic Economic Concepts', questionTopic: 'Comparative Advantage', difficulty: 'MEDIUM', questionText: 'Country A can produce 100 units of wheat or 50 units of cloth. Country B can produce 80 units of wheat or 60 units of cloth. Which country has a comparative advantage in cloth production?', choiceA: { text: 'Country A, because it can produce more wheat' }, choiceB: { text: 'Country B, because it has a lower opportunity cost of cloth' }, choiceC: { text: 'Country A, because it has higher total output' }, choiceD: { text: 'Neither country has a comparative advantage' }, correctAnswers: ['B'], explanation: 'A: 1 cloth = 2 wheat. B: 1 cloth = 1.33 wheat. B has lower OC.' },
  { id: 'micro_q3', questionDomain: 'Unit 2: Supply and Demand', questionTopic: 'Demand Shifters', difficulty: 'EASY', questionText: 'If the price of a substitute good increases, what happens to the demand curve for the original good?', choiceA: { text: 'It shifts to the left' }, choiceB: { text: 'It shifts to the right' }, choiceC: { text: 'There is a movement along the curve' }, choiceD: { text: 'The curve becomes more elastic' }, correctAnswers: ['B'], explanation: 'Substitute price up = demand for original up.' },
  { id: 'micro_q4', questionDomain: 'Unit 2: Supply and Demand', questionTopic: 'Elasticity', difficulty: 'MEDIUM', questionText: 'A firm raises its price by 10% and sees quantity demanded fall by 5%. The price elasticity of demand (in absolute value) is:', choiceA: { text: '0.5, and demand is inelastic' }, choiceB: { text: '2.0, and demand is elastic' }, choiceC: { text: '0.5, and demand is elastic' }, choiceD: { text: '1.0, and demand is unit elastic' }, correctAnswers: ['A'], explanation: 'PED = 5%/10% = 0.5 < 1, inelastic.' },
  { id: 'micro_q5', questionDomain: 'Unit 2: Supply and Demand', questionTopic: 'Consumer & Producer Surplus', difficulty: 'MEDIUM', questionText: 'At the market equilibrium, consumer surplus is measured as the area:', choiceA: { text: 'Below the demand curve and above the equilibrium price' }, choiceB: { text: 'Above the supply curve and below the equilibrium price' }, choiceC: { text: 'Between the supply and demand curves' }, choiceD: { text: 'Below the supply curve and above zero' }, correctAnswers: ['A'], explanation: 'CS = willingness to pay minus actual price.' },
  { id: 'micro_q6', questionDomain: 'Unit 3: Production & Cost', questionTopic: 'Marginal Product', difficulty: 'MEDIUM', questionText: 'When marginal product is at its maximum, marginal cost is:', choiceA: { text: 'At its maximum' }, choiceB: { text: 'At its minimum' }, choiceC: { text: 'Equal to average variable cost' }, choiceD: { text: 'Equal to average total cost' }, correctAnswers: ['B'], explanation: 'MC and MP have an inverse relationship.' },
  { id: 'micro_q7', questionDomain: 'Unit 3: Production & Cost', questionTopic: 'Perfect Competition', difficulty: 'EASY', questionText: 'In a perfectly competitive market, a firm maximizes profit by producing where:', choiceA: { text: 'Total revenue is maximized' }, choiceB: { text: 'MR = MC' }, choiceC: { text: 'ATC is minimized' }, choiceD: { text: 'P = AVC' }, correctAnswers: ['B'], explanation: 'All firms maximize profit at MR = MC.' },
  { id: 'micro_q8', questionDomain: 'Unit 3: Production & Cost', questionTopic: 'Shutdown Rule', difficulty: 'HARD', questionText: 'A perfectly competitive firm should shut down in the short run if:', choiceA: { text: 'Price is below ATC' }, choiceB: { text: 'Price is below AVC' }, choiceC: { text: 'MC exceeds MR' }, choiceD: { text: 'Economic profits are zero' }, correctAnswers: ['B'], explanation: 'Shut down when P < AVC.' },
  { id: 'micro_q9', questionDomain: 'Unit 4: Imperfect Competition', questionTopic: 'Monopoly', difficulty: 'MEDIUM', questionText: 'Compared to perfect competition, a monopoly produces:', choiceA: { text: 'More output at a lower price' }, choiceB: { text: 'Less output at a higher price' }, choiceC: { text: 'Same output at a higher price' }, choiceD: { text: 'More output at a higher price' }, correctAnswers: ['B'], explanation: 'Monopolist restricts output, raises price.' },
  { id: 'micro_q10', questionDomain: 'Unit 4: Imperfect Competition', questionTopic: 'Monopolistic Competition', difficulty: 'MEDIUM', questionText: 'In the long run, a monopolistically competitive firm earns:', choiceA: { text: 'Positive economic profit' }, choiceB: { text: 'Zero economic profit' }, choiceC: { text: 'Negative economic profit' }, choiceD: { text: 'Positive economic profit due to barriers' }, correctAnswers: ['B'], explanation: 'Free entry/exit drives profit to zero.' },
  { id: 'micro_q11', questionDomain: 'Unit 4: Imperfect Competition', questionTopic: 'Game Theory', difficulty: 'HARD', questionText: "In a prisoner's dilemma, the dominant strategy is to:", choiceA: { text: 'Cooperate' }, choiceB: { text: 'Defect' }, choiceC: { text: 'Randomize' }, choiceD: { text: 'Cooperate if repeated' }, correctAnswers: ['B'], explanation: 'Defecting dominates regardless of opponent.' },
  { id: 'micro_q12', questionDomain: 'Unit 5: Factor Markets', questionTopic: 'Labor Market', difficulty: 'MEDIUM', questionText: 'The marginal revenue product (MRP) of labor is:', choiceA: { text: 'MP x P' }, choiceB: { text: 'TR / workers' }, choiceC: { text: 'W x workers' }, choiceD: { text: 'MC x MP' }, correctAnswers: ['A'], explanation: 'MRP = MP x MR. In competition, MR = P.' },
  { id: 'micro_q13', questionDomain: 'Unit 5: Factor Markets', questionTopic: 'Labor Market', difficulty: 'EASY', questionText: 'A firm hires workers until:', choiceA: { text: 'MRP = W' }, choiceB: { text: 'MP = 0' }, choiceC: { text: 'TR is maximized' }, choiceD: { text: 'AP is maximized' }, correctAnswers: ['A'], explanation: 'Hire until MRP equals wage.' },
  { id: 'micro_q14', questionDomain: 'Unit 6: Market Failure', questionTopic: 'Externalities', difficulty: 'MEDIUM', questionText: 'A negative externality causes the market to produce:', choiceA: { text: 'Less than optimal' }, choiceB: { text: 'More than optimal' }, choiceC: { text: 'Exactly optimal' }, choiceD: { text: 'At a price below MC' }, correctAnswers: ['B'], explanation: 'Social cost > private cost = overproduction.' },
  { id: 'micro_q15', questionDomain: 'Unit 6: Market Failure', questionTopic: 'Public Goods', difficulty: 'MEDIUM', questionText: 'Which is a public good?', choiceA: { text: 'A hamburger' }, choiceB: { text: 'National defense' }, choiceC: { text: 'A toll road' }, choiceD: { text: 'Cable TV' }, correctAnswers: ['B'], explanation: 'Non-rivalrous and non-excludable.' },
]
const MICRO_FRQ = [
  { id: 'micro_frq1', questionDomain: 'Unit 4: Imperfect Competition', questionTopic: 'Monopoly Analysis', difficulty: 'HARD', questionText: 'Assume a profit-maximizing monopoly operates with no externalities.', subQuestions: [{ label: 'a', prompt: 'Draw a correctly labeled monopoly graph. Identify Qm and Pm.', points: 3 }, { label: 'b', prompt: 'Shade the deadweight loss area.', points: 2 }, { label: 'c', prompt: 'Explain how a per-unit subsidy affects output and DWL.', points: 3 }, { label: 'd', prompt: 'Would a lump-sum tax change P and Q? Explain.', points: 2 }], points: 10 },
  { id: 'micro_frq2', questionDomain: 'Unit 5: Factor Markets', questionTopic: 'Monopsony', difficulty: 'HARD', questionText: 'Consider a monopsony labor market.', subQuestions: [{ label: 'a', prompt: 'Draw a labeled graph showing MFC, S, and MRP. Identify Wm and Lm.', points: 3 }, { label: 'b', prompt: 'Compare to competitive outcome.', points: 2 }, { label: 'c', prompt: 'Explain how a minimum wage could increase both W and L.', points: 3 }], points: 8 },
]

// --- AP MACRO QUESTIONS ---
const MACRO_TEST_ID = 'test_macro_full_1'
const MACRO_MCQ = [
  { id: 'macro_q1', questionDomain: 'Unit 1: Basic Concepts', questionTopic: 'Circular Flow', difficulty: 'EASY', questionText: 'In the circular flow model, households supply which to the factor market?', choiceA: { text: 'Goods and services' }, choiceB: { text: 'Land, labor, and capital' }, choiceC: { text: 'Government transfers' }, choiceD: { text: 'Tax revenue' }, correctAnswers: ['B'], explanation: 'Households supply factors of production.' },
  { id: 'macro_q2', questionDomain: 'Unit 2: Economic Indicators', questionTopic: 'GDP', difficulty: 'MEDIUM', questionText: 'Which is NOT in GDP (expenditure approach)?', choiceA: { text: 'Consumer spending on new cars' }, choiceB: { text: 'Government military purchases' }, choiceC: { text: '100 shares of Apple stock' }, choiceD: { text: 'Business factory investment' }, correctAnswers: ['C'], explanation: 'Stock purchases are financial transactions.' },
  { id: 'macro_q3', questionDomain: 'Unit 2: Economic Indicators', questionTopic: 'Unemployment', difficulty: 'EASY', questionText: 'A worker who quits to find a better job is:', choiceA: { text: 'Cyclically unemployed' }, choiceB: { text: 'Structurally unemployed' }, choiceC: { text: 'Frictionally unemployed' }, choiceD: { text: 'Not in the labor force' }, correctAnswers: ['C'], explanation: 'Frictional: temporarily between jobs.' },
  { id: 'macro_q4', questionDomain: 'Unit 2: Economic Indicators', questionTopic: 'Inflation', difficulty: 'MEDIUM', questionText: 'CPI was 200 last year, 210 this year. Inflation rate?', choiceA: { text: '10%' }, choiceB: { text: '5%' }, choiceC: { text: '210%' }, choiceD: { text: '4.76%' }, correctAnswers: ['B'], explanation: '(210-200)/200 = 5%.' },
  { id: 'macro_q5', questionDomain: 'Unit 3: AD-AS', questionTopic: 'Aggregate Demand', difficulty: 'MEDIUM', questionText: 'Which shifts AD right?', choiceA: { text: 'Higher income taxes' }, choiceB: { text: 'Lower government spending' }, choiceC: { text: 'Higher consumer confidence' }, choiceD: { text: 'Higher interest rates' }, correctAnswers: ['C'], explanation: 'Confidence up = consumption up = AD right.' },
  { id: 'macro_q6', questionDomain: 'Unit 3: AD-AS', questionTopic: 'Multiplier Effect', difficulty: 'HARD', questionText: 'If MPC = 0.8, the spending multiplier is:', choiceA: { text: '4' }, choiceB: { text: '5' }, choiceC: { text: '0.8' }, choiceD: { text: '1.25' }, correctAnswers: ['B'], explanation: '1/(1-0.8) = 5.' },
  { id: 'macro_q7', questionDomain: 'Unit 3: AD-AS', questionTopic: 'SRAS', difficulty: 'MEDIUM', questionText: 'Higher input prices (oil) cause:', choiceA: { text: 'AD shifts left' }, choiceB: { text: 'SRAS shifts left' }, choiceC: { text: 'LRAS shifts right' }, choiceD: { text: 'SRAS shifts right' }, correctAnswers: ['B'], explanation: 'Higher costs shift SRAS left (stagflation).' },
  { id: 'macro_q8', questionDomain: 'Unit 4: Financial Sector', questionTopic: 'Money Supply', difficulty: 'MEDIUM', questionText: 'Reserve requirement 10%, $1,000 deposit. Max new money?', choiceA: { text: '$1,000' }, choiceB: { text: '$9,000' }, choiceC: { text: '$10,000' }, choiceD: { text: '$100' }, correctAnswers: ['C'], explanation: 'Multiplier = 1/0.10 = 10. $1,000 x 10 = $10,000.' },
  { id: 'macro_q9', questionDomain: 'Unit 4: Financial Sector', questionTopic: 'Federal Reserve', difficulty: 'EASY', questionText: 'To combat a recession, the Fed would:', choiceA: { text: 'Increase discount rate' }, choiceB: { text: 'Sell bonds' }, choiceC: { text: 'Buy bonds' }, choiceD: { text: 'Increase reserve requirement' }, correctAnswers: ['C'], explanation: 'Buy bonds = expansionary monetary policy.' },
  { id: 'macro_q10', questionDomain: 'Unit 4: Financial Sector', questionTopic: 'Loanable Funds', difficulty: 'HARD', questionText: 'Government deficit spending in loanable funds market causes:', choiceA: { text: 'Lower real interest rate' }, choiceB: { text: 'Higher real interest rate + crowding out' }, choiceC: { text: 'No effect' }, choiceD: { text: 'More supply of loanable funds' }, correctAnswers: ['B'], explanation: 'Government borrowing raises rates, crowds out private investment.' },
  { id: 'macro_q11', questionDomain: 'Unit 5: Stabilization Policies', questionTopic: 'Phillips Curve', difficulty: 'MEDIUM', questionText: 'The long-run Phillips curve is vertical at:', choiceA: { text: 'Zero unemployment' }, choiceB: { text: 'Natural rate of unemployment' }, choiceC: { text: 'Current inflation rate' }, choiceD: { text: 'Full employment output' }, correctAnswers: ['B'], explanation: 'LRPC is vertical at natural rate.' },
  { id: 'macro_q12', questionDomain: 'Unit 5: Stabilization Policies', questionTopic: 'Fiscal Policy', difficulty: 'MEDIUM', questionText: 'Which is an automatic stabilizer?', choiceA: { text: 'Infrastructure bill' }, choiceB: { text: 'Fed lowering rates' }, choiceC: { text: 'Unemployment insurance' }, choiceD: { text: 'Tax cut law' }, correctAnswers: ['C'], explanation: 'Automatic stabilizers adjust without legislation.' },
  { id: 'macro_q13', questionDomain: 'Unit 6: Open Economy', questionTopic: 'Exchange Rates', difficulty: 'MEDIUM', questionText: 'If US interest rates rise vs Japan, the dollar will:', choiceA: { text: 'Depreciate' }, choiceB: { text: 'Appreciate' }, choiceC: { text: 'Yen appreciates' }, choiceD: { text: 'No effect' }, correctAnswers: ['B'], explanation: 'Higher rates attract capital, dollar appreciates.' },
  { id: 'macro_q14', questionDomain: 'Unit 6: Open Economy', questionTopic: 'Balance of Payments', difficulty: 'HARD', questionText: 'A current account deficit means:', choiceA: { text: 'Capital account surplus' }, choiceB: { text: 'Capital account deficit' }, choiceC: { text: 'Balanced budget' }, choiceD: { text: 'Falling exchange rates' }, correctAnswers: ['A'], explanation: 'Current + capital must sum to zero.' },
  { id: 'macro_q15', questionDomain: 'Unit 3: AD-AS', questionTopic: 'Self-Adjustment', difficulty: 'HARD', questionText: 'In a recessionary gap, self-adjustment works via:', choiceA: { text: 'Wages falling, SRAS shifting right' }, choiceB: { text: 'Government spending rising' }, choiceC: { text: 'Fed lowering rates' }, choiceD: { text: 'AD shifting right' }, correctAnswers: ['A'], explanation: 'Unemployment pushes wages down, SRAS shifts right.' },
]
const MACRO_FRQ = [
  { id: 'macro_frq1', questionDomain: 'Unit 3: AD-AS', questionTopic: 'AD-AS Model', difficulty: 'HARD', questionText: 'Assume the economy is below full employment.', subQuestions: [{ label: 'a', prompt: 'Draw a labeled AD-AS graph. Label PL1, Y1, Yf.', points: 3 }, { label: 'b', prompt: 'Identify a fiscal policy to restore full employment. Explain.', points: 3 }, { label: 'c', prompt: 'Show the effect on your graph. Label PL2, Y2.', points: 2 }, { label: 'd', prompt: 'Explain effect on real interest rate and private investment (crowding out).', points: 2 }], points: 10 },
  { id: 'macro_frq2', questionDomain: 'Unit 4: Financial Sector', questionTopic: 'Monetary Policy', difficulty: 'HARD', questionText: 'The economy has high inflation.', subQuestions: [{ label: 'a', prompt: 'Identify the appropriate open market operation. Explain effect on reserves.', points: 2 }, { label: 'b', prompt: 'Using a money market graph, show effect on nominal interest rate.', points: 3 }, { label: 'c', prompt: 'Explain how interest rate change affects AD and price level.', points: 3 }], points: 8 },
]

// --- AP CALC AB QUESTIONS ---
const CALC_TEST_ID = 'test_calc_ab_full_1'
const CALC_MCQ = [
  { id: 'calc_q1', questionDomain: 'Unit 1: Limits', questionTopic: 'Evaluating Limits', difficulty: 'EASY', questionText: 'Find $\\displaystyle\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}$.', choiceA: { text: '$0$' }, choiceB: { text: '$3$' }, choiceC: { text: '$6$' }, choiceD: { text: 'DNE' }, correctAnswers: ['C'], explanation: 'Factor: (x+3)(x-3)/(x-3) = x+3 → 6.' },
  { id: 'calc_q2', questionDomain: 'Unit 1: Limits', questionTopic: 'Continuity', difficulty: 'MEDIUM', questionText: '$f(x) = \\begin{cases} x^2 & x < 2 \\\\ ax + 1 & x \\geq 2 \\end{cases}$ is continuous at $x=2$ when $a=$', choiceA: { text: '$\\frac{1}{2}$' }, choiceB: { text: '$\\frac{3}{2}$' }, choiceC: { text: '$2$' }, choiceD: { text: '$3$' }, correctAnswers: ['B'], explanation: '4 = 2a+1, a=3/2.' },
  { id: 'calc_q3', questionDomain: 'Unit 2: Differentiation', questionTopic: 'Basic Derivatives', difficulty: 'EASY', questionText: "If $f(x) = 3x^4 - 2x^2 + 5x - 7$, then $f'(x) =$", choiceA: { text: '$12x^3 - 4x + 5$' }, choiceB: { text: '$12x^3 - 2x + 5$' }, choiceC: { text: '$12x^4 - 4x^2 + 5x$' }, choiceD: { text: '$3x^3 - 2x + 5$' }, correctAnswers: ['A'], explanation: 'Power rule.' },
  { id: 'calc_q4', questionDomain: 'Unit 2: Differentiation', questionTopic: 'Product Rule', difficulty: 'MEDIUM', questionText: "If $f(x) = x^2 \\sin(x)$, then $f'(x) =$", choiceA: { text: '$2x\\cos(x)$' }, choiceB: { text: '$2x\\sin(x) + x^2\\cos(x)$' }, choiceC: { text: '$x^2\\cos(x) - 2x\\sin(x)$' }, choiceD: { text: '$2x\\sin(x) - x^2\\cos(x)$' }, correctAnswers: ['B'], explanation: 'Product rule.' },
  { id: 'calc_q5', questionDomain: 'Unit 3: Chain Rule', questionTopic: 'Chain Rule', difficulty: 'MEDIUM', questionText: 'If $y = \\sqrt{3x^2+1}$, then $dy/dx =$', choiceA: { text: '$\\frac{3x}{\\sqrt{3x^2+1}}$' }, choiceB: { text: '$\\frac{6x}{\\sqrt{3x^2+1}}$' }, choiceC: { text: '$\\frac{1}{2\\sqrt{3x^2+1}}$' }, choiceD: { text: '$\\frac{6x}{2(3x^2+1)}$' }, correctAnswers: ['A'], explanation: 'Chain rule: 3x/sqrt(3x²+1).' },
  { id: 'calc_q6', questionDomain: 'Unit 3: Chain Rule', questionTopic: 'Implicit Differentiation', difficulty: 'HARD', questionText: '$x^2+y^2=25$, find $dy/dx$ at $(3,4)$.', choiceA: { text: '$-3/4$' }, choiceB: { text: '$3/4$' }, choiceC: { text: '$-4/3$' }, choiceD: { text: '$4/3$' }, correctAnswers: ['A'], explanation: 'dy/dx = -x/y = -3/4.' },
  { id: 'calc_q7', questionDomain: 'Unit 4: Applications', questionTopic: 'Related Rates', difficulty: 'HARD', questionText: 'Balloon inflates at $100\\pi$ cm³/s. How fast is radius growing at $r=5$?', choiceA: { text: '$1$ cm/s' }, choiceB: { text: '$4$ cm/s' }, choiceC: { text: '$1/\\pi$ cm/s' }, choiceD: { text: '$20$ cm/s' }, correctAnswers: ['A'], explanation: 'dr/dt = 100π/(4π·25) = 1.' },
  { id: 'calc_q8', questionDomain: 'Unit 5: Analysis', questionTopic: 'Critical Points', difficulty: 'MEDIUM', questionText: '$f(x)=x^3-3x^2+4$ has a local max at $x=$', choiceA: { text: '$0$' }, choiceB: { text: '$1$' }, choiceC: { text: '$2$' }, choiceD: { text: '$-1$' }, correctAnswers: ['A'], explanation: "f''(0)=-6<0, local max." },
  { id: 'calc_q9', questionDomain: 'Unit 5: Analysis', questionTopic: 'MVT', difficulty: 'MEDIUM', questionText: '$f(x)=x^3$ on $[1,3]$. MVT value of $c$:', choiceA: { text: '$\\sqrt{13/3}$' }, choiceB: { text: '$2$' }, choiceC: { text: '$7/3$' }, choiceD: { text: '$\\sqrt{3}$' }, correctAnswers: ['A'], explanation: '3c²=13, c=√(13/3).' },
  { id: 'calc_q10', questionDomain: 'Unit 6: Integration', questionTopic: 'Antiderivatives', difficulty: 'EASY', questionText: '$\\int(4x^3+6x-2)dx =$', choiceA: { text: '$x^4+3x^2-2x+C$' }, choiceB: { text: '$12x^2+6+C$' }, choiceC: { text: '$x^4+6x^2-2x+C$' }, choiceD: { text: '$4x^4+3x^2-2x+C$' }, correctAnswers: ['A'], explanation: 'Integrate term by term.' },
  { id: 'calc_q11', questionDomain: 'Unit 6: Integration', questionTopic: 'Definite Integrals', difficulty: 'MEDIUM', questionText: '$\\int_0^2(3x^2+1)dx =$', choiceA: { text: '$8$' }, choiceB: { text: '$10$' }, choiceC: { text: '$12$' }, choiceD: { text: '$14$' }, correctAnswers: ['B'], explanation: '[x³+x]₀²=10.' },
  { id: 'calc_q12', questionDomain: 'Unit 6: Integration', questionTopic: 'FTC', difficulty: 'MEDIUM', questionText: "$F(x)=\\int_1^x\\sqrt{t^2+1}dt$, then $F'(x)=$", choiceA: { text: '$\\sqrt{x^2+1}$' }, choiceB: { text: '$x/\\sqrt{x^2+1}$' }, choiceC: { text: '$\\sqrt{x^2+1}-\\sqrt{2}$' }, choiceD: { text: '$2x\\sqrt{x^2+1}$' }, correctAnswers: ['A'], explanation: 'FTC Part 1.' },
  { id: 'calc_q13', questionDomain: 'Unit 7: Diff Equations', questionTopic: 'Separation of Variables', difficulty: 'HARD', questionText: '$dy/dx=2xy$, $y(0)=1$. Solution:', choiceA: { text: '$y=e^{x^2}$' }, choiceB: { text: '$y=e^{2x}$' }, choiceC: { text: '$y=x^2+1$' }, choiceD: { text: '$y=e^{x^2/2}$' }, correctAnswers: ['A'], explanation: 'Separate, integrate: y=e^(x²).' },
  { id: 'calc_q14', questionDomain: 'Unit 8: Applications of Integration', questionTopic: 'Area', difficulty: 'MEDIUM', questionText: 'Area between $y=x^2$ and $y=x$:', choiceA: { text: '$1/3$' }, choiceB: { text: '$1/6$' }, choiceC: { text: '$1/2$' }, choiceD: { text: '$1/4$' }, correctAnswers: ['B'], explanation: '∫₀¹(x-x²)dx=1/6.' },
  { id: 'calc_q15', questionDomain: 'Unit 8: Applications of Integration', questionTopic: 'Volume', difficulty: 'HARD', questionText: 'Volume: $y=\\sqrt{x}$, $y=0$, $x=4$ about x-axis:', choiceA: { text: '$4\\pi$' }, choiceB: { text: '$8\\pi$' }, choiceC: { text: '$16\\pi$' }, choiceD: { text: '$2\\pi$' }, correctAnswers: ['B'], explanation: 'Disk: π∫₀⁴xdx=8π.' },
]
const CALC_FRQ = [
  { id: 'calc_frq1', questionDomain: 'Unit 5: Analysis', questionTopic: 'Curve Analysis', difficulty: 'HARD', questionText: 'Let $f(x)=x^3-6x^2+9x+2$.', subQuestions: [{ label: 'a', prompt: 'Find all critical values. Classify each. Justify.', points: 4 }, { label: 'b', prompt: 'Find concavity intervals and inflection points.', points: 3 }, { label: 'c', prompt: 'Find absolute max/min on $[0,5]$.', points: 3 }], points: 10 },
  { id: 'calc_frq2', questionDomain: 'Unit 8: Applications of Integration', questionTopic: 'Accumulation', difficulty: 'HARD', questionText: 'Water flows at $R(t)=10+5\\sin(\\pi t/6)$ gal/min, $0\\leq t\\leq 12$. Tank has 50 gal at $t=0$.', subQuestions: [{ label: 'a', prompt: 'Total water from $t=0$ to $t=6$.', points: 3 }, { label: 'b', prompt: 'Expression for total water at time $t$.', points: 2 }, { label: 'c', prompt: 'When is flow rate maximum? Justify.', points: 2 }, { label: 'd', prompt: 'If drain rate is 8 gal/min, total water at $t=12$.', points: 3 }], points: 10 },
]

// --- Helpers ---
function buildQ(q, testId, subject) {
  return {
    testId, subject,
    questionType: q.subQuestions ? 'FRQ' : 'MCQ',
    format: 'VERTICAL',
    questionDomain: q.questionDomain, questionTopic: q.questionTopic,
    difficulty: q.difficulty, questionText: q.questionText,
    ...(q.choiceA && { choiceA: q.choiceA, choiceB: q.choiceB, choiceC: q.choiceC, choiceD: q.choiceD, choiceCount: 4 }),
    ...(q.correctAnswers && { correctAnswers: q.correctAnswers }),
    ...(q.explanation && { explanation: q.explanation }),
    ...(q.subQuestions && { subQuestions: q.subQuestions }),
    partialCredit: false, points: q.points || 1,
    createdBy: TEACHER_ID, createdAt: FieldValue.serverTimestamp(),
  }
}

function genMCQResults(questions, rate) {
  return questions.map(q => {
    const ok = Math.random() < rate
    const correct = q.correctAnswers[0]
    const wrong = ['A','B','C','D'].filter(l => l !== correct)
    return { questionId: q.id, questionDomain: q.questionDomain, questionTopic: q.questionTopic, selectedAnswer: ok ? correct : wrong[Math.floor(Math.random()*wrong.length)], correctAnswer: correct, correct: ok, timeSpent: Math.floor(30+Math.random()*120) }
  })
}

function genResult(sid, tid, subj, mcqQ, frqQ, rate, daysAgo) {
  const mcq = genMCQResults(mcqQ, rate)
  const mcqOk = mcq.filter(r=>r.correct).length
  const frqMax = frqQ.reduce((s,q)=>s+(q.points||0),0)
  const frqS = Math.round(frqMax*(rate*0.8+Math.random()*0.2))
  const pct = Math.round(((mcqOk+frqS)/(mcqQ.length+frqMax))*100)
  let ap = 1; if(pct>=80)ap=5;else if(pct>=65)ap=4;else if(pct>=50)ap=3;else if(pct>=35)ap=2
  const d = new Date(); d.setDate(d.getDate()-daysAgo)
  return { userId:sid,testId:tid,subject:subj,mcqResults:mcq,mcqCorrect:mcqOk,mcqTotal:mcqQ.length,frqScore:frqS,frqMaxPoints:frqMax,percentage:pct,apScore:ap,totalTimeSpent:Math.floor(1800+Math.random()*2400),completedAt:Timestamp.fromDate(d),gradingStatus:Math.random()>0.3?'GRADED':'PENDING' }
}

// --- Main ---
async function seed() {
  console.log('Seeding full AP Boost data...')
  console.log('Teacher ID:', TEACHER_ID)

  await db.doc(`users/${TEACHER_ID}`).set({ displayName:'Ms. Thompson', email:'thompson@school.edu', role:'teacher', createdAt:FieldValue.serverTimestamp() }, { merge:true })
  console.log('Created teacher profile')

  for (const s of STUDENTS) await db.doc(`users/${s.id}`).set({ displayName:s.displayName, email:s.email, role:'student', createdAt:FieldValue.serverTimestamp() }, { merge:true })
  console.log('Created 5 student profiles')

  await db.doc(`${COLLECTIONS.CLASSES}/class_econ_p1`).set({ name:'AP Economics Period 1', period:'1', subject:'AP_MICRO', teacherId:TEACHER_ID, studentIds:STUDENT_IDS, createdAt:FieldValue.serverTimestamp() })
  await db.doc(`${COLLECTIONS.CLASSES}/class_calc_p3`).set({ name:'AP Calculus AB Period 3', period:'3', subject:'AP_CALC_AB', teacherId:TEACHER_ID, studentIds:STUDENT_IDS, createdAt:FieldValue.serverTimestamp() })
  console.log('Created 2 classes')

  // MICRO
  await db.doc(`${COLLECTIONS.TESTS}/${MICRO_TEST_ID}`).set({ title:'AP Microeconomics Practice Exam', subject:'AP_MICRO', testType:'EXAM', createdBy:TEACHER_ID, isPublished:true, questionOrder:'FIXED', sections:[{id:'micro_mcq',title:'Section I: Multiple Choice',sectionType:'MCQ',timeLimit:35,questionIds:MICRO_MCQ.map(q=>q.id),mcqMultiplier:1},{id:'micro_frq',title:'Section II: Free Response',sectionType:'FRQ',timeLimit:25,questionIds:MICRO_FRQ.map(q=>q.id),frqMultipliers:{micro_frq1:1,micro_frq2:1}}], scoreRanges:{ap5:{min:80,max:100},ap4:{min:65,max:79},ap3:{min:50,max:64},ap2:{min:35,max:49},ap1:{min:0,max:34}}, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() })
  for (const q of MICRO_MCQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, MICRO_TEST_ID, 'AP_MICRO'))
  for (const q of MICRO_FRQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, MICRO_TEST_ID, 'AP_MICRO'))
  console.log('Created AP Micro test (15 MCQ + 2 FRQ)')

  // MACRO
  await db.doc(`${COLLECTIONS.TESTS}/${MACRO_TEST_ID}`).set({ title:'AP Macroeconomics Practice Exam', subject:'AP_MACRO', testType:'EXAM', createdBy:TEACHER_ID, isPublished:true, questionOrder:'FIXED', sections:[{id:'macro_mcq',title:'Section I: Multiple Choice',sectionType:'MCQ',timeLimit:35,questionIds:MACRO_MCQ.map(q=>q.id),mcqMultiplier:1},{id:'macro_frq',title:'Section II: Free Response',sectionType:'FRQ',timeLimit:25,questionIds:MACRO_FRQ.map(q=>q.id),frqMultipliers:{macro_frq1:1,macro_frq2:1}}], scoreRanges:{ap5:{min:80,max:100},ap4:{min:65,max:79},ap3:{min:50,max:64},ap2:{min:35,max:49},ap1:{min:0,max:34}}, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() })
  for (const q of MACRO_MCQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, MACRO_TEST_ID, 'AP_MACRO'))
  for (const q of MACRO_FRQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, MACRO_TEST_ID, 'AP_MACRO'))
  console.log('Created AP Macro test (15 MCQ + 2 FRQ)')

  // CALC
  await db.doc(`${COLLECTIONS.TESTS}/${CALC_TEST_ID}`).set({ title:'AP Calculus AB Practice Exam', subject:'AP_CALC_AB', testType:'EXAM', createdBy:TEACHER_ID, isPublished:true, questionOrder:'FIXED', sections:[{id:'calc_mcq',title:'Section I: Multiple Choice',sectionType:'MCQ',timeLimit:45,questionIds:CALC_MCQ.map(q=>q.id),mcqMultiplier:1,calculatorEnabled:false},{id:'calc_frq',title:'Section II: Free Response',sectionType:'FRQ',timeLimit:30,questionIds:CALC_FRQ.map(q=>q.id),frqMultipliers:{calc_frq1:1,calc_frq2:1}}], scoreRanges:{ap5:{min:80,max:100},ap4:{min:65,max:79},ap3:{min:50,max:64},ap2:{min:35,max:49},ap1:{min:0,max:34}}, createdAt:FieldValue.serverTimestamp(), updatedAt:FieldValue.serverTimestamp() })
  for (const q of CALC_MCQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, CALC_TEST_ID, 'AP_CALC_AB'))
  for (const q of CALC_FRQ) await db.doc(`${COLLECTIONS.QUESTIONS}/${q.id}`).set(buildQ(q, CALC_TEST_ID, 'AP_CALC_AB'))
  console.log('Created AP Calc AB test (15 MCQ + 2 FRQ)')

  // Assignments
  await db.doc(`${COLLECTIONS.ASSIGNMENTS}/assign_micro_p1`).set({ testId:MICRO_TEST_ID, classId:'class_econ_p1', teacherId:TEACHER_ID, studentIds:STUDENT_IDS, maxAttempts:3, dueDate:null, assignedAt:FieldValue.serverTimestamp() })
  await db.doc(`${COLLECTIONS.ASSIGNMENTS}/assign_macro_p1`).set({ testId:MACRO_TEST_ID, classId:'class_econ_p1', teacherId:TEACHER_ID, studentIds:STUDENT_IDS, maxAttempts:3, dueDate:null, assignedAt:FieldValue.serverTimestamp() })
  await db.doc(`${COLLECTIONS.ASSIGNMENTS}/assign_calc_p3`).set({ testId:CALC_TEST_ID, classId:'class_calc_p3', teacherId:TEACHER_ID, studentIds:STUDENT_IDS, maxAttempts:2, dueDate:null, assignedAt:FieldValue.serverTimestamp() })
  console.log('Created 3 assignments')

  // Results
  const rates = [0.85,0.72,0.60,0.45,0.90]
  let cnt = 0
  for (let i=0;i<STUDENTS.length;i++) {
    const s=STUDENTS[i], r=rates[i]
    await db.doc(`${COLLECTIONS.TEST_RESULTS}/result_micro_${s.id}`).set({...genResult(s.id,MICRO_TEST_ID,'AP_MICRO',MICRO_MCQ,MICRO_FRQ,r,14-i),studentName:s.displayName,studentEmail:s.email}); cnt++
    await db.doc(`${COLLECTIONS.TEST_RESULTS}/result_macro_${s.id}`).set({...genResult(s.id,MACRO_TEST_ID,'AP_MACRO',MACRO_MCQ,MACRO_FRQ,r*0.95,7-i),studentName:s.displayName,studentEmail:s.email}); cnt++
    if(i<3){await db.doc(`${COLLECTIONS.TEST_RESULTS}/result_calc_${s.id}`).set({...genResult(s.id,CALC_TEST_ID,'AP_CALC_AB',CALC_MCQ,CALC_FRQ,r*0.9,3-i),studentName:s.displayName,studentEmail:s.email}); cnt++}
  }
  console.log(`Created ${cnt} test results`)
  console.log('\n=== SEED COMPLETE ===')
  console.log(`3 tests, 51 questions, 1 teacher, 5 students, 2 classes, 3 assignments, ${cnt} results`)
}

seed().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})
