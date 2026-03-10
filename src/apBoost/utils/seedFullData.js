/**
 * Full Seed Data for AP Boost
 *
 * Creates:
 * - 3 full tests (AP Micro, AP Macro, AP Calc AB) with 15-20 questions each
 * - 5 student profiles + 1 teacher profile in Firestore
 * - 2 classes with students linked
 * - Assignments for each test
 * - Completed test results with varied scores
 * - Mix of graded + pending FRQ results
 *
 * Run via: import { seedFullData } from './seedFullData'; seedFullData(teacherUid)
 * All IDs are deterministic (setDoc) so re-running is idempotent.
 *
 * NOTE: Firebase Auth accounts must be created separately (Console or Admin SDK).
 * This only creates Firestore profile documents.
 */

import { doc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS, QUESTION_TYPE, QUESTION_FORMAT, SECTION_TYPE, TEST_TYPE, QUESTION_ORDER } from './apTypes'

// ============================================================
// STUDENT & TEACHER PROFILES
// ============================================================

const TEACHER_ID = 'teacher_seed_001'

const STUDENTS = [
  { id: 'student_seed_001', displayName: 'Alex Johnson', email: 'alex.j@school.edu' },
  { id: 'student_seed_002', displayName: 'Maria Garcia', email: 'maria.g@school.edu' },
  { id: 'student_seed_003', displayName: 'James Chen', email: 'james.c@school.edu' },
  { id: 'student_seed_004', displayName: 'Priya Patel', email: 'priya.p@school.edu' },
  { id: 'student_seed_005', displayName: 'Ethan Williams', email: 'ethan.w@school.edu' },
]

const STUDENT_IDS = STUDENTS.map(s => s.id)

// ============================================================
// CLASSES
// ============================================================

const CLASSES = [
  {
    id: 'class_econ_p1',
    name: 'AP Economics Period 1',
    period: '1',
    subject: 'AP_MICRO',
    teacherId: TEACHER_ID,
    studentIds: STUDENT_IDS,
  },
  {
    id: 'class_calc_p3',
    name: 'AP Calculus AB Period 3',
    period: '3',
    subject: 'AP_CALC_AB',
    teacherId: TEACHER_ID,
    studentIds: STUDENT_IDS,
  },
]

// ============================================================
// AP MICROECONOMICS TEST (15 MCQ + 2 FRQ)
// ============================================================

const MICRO_TEST_ID = 'test_micro_full_1'
const MICRO_MCQ_QUESTIONS = [
  {
    id: 'micro_q1',
    questionDomain: 'Unit 1: Basic Economic Concepts',
    questionTopic: 'Scarcity & Opportunity Cost',
    difficulty: 'EASY',
    questionText: 'A production possibilities curve that is bowed outward (concave to the origin) illustrates which economic concept?',
    choiceA: { text: 'Constant opportunity costs' },
    choiceB: { text: 'Increasing opportunity costs' },
    choiceC: { text: 'Decreasing marginal returns' },
    choiceD: { text: 'Economies of scale' },
    correctAnswers: ['B'],
    explanation: 'A bowed-out PPC shows increasing opportunity costs because resources are not perfectly adaptable between the production of two goods.',
  },
  {
    id: 'micro_q2',
    questionDomain: 'Unit 1: Basic Economic Concepts',
    questionTopic: 'Comparative Advantage',
    difficulty: 'MEDIUM',
    questionText: 'Country A can produce 100 units of wheat or 50 units of cloth. Country B can produce 80 units of wheat or 60 units of cloth. Which country has a comparative advantage in cloth production?',
    choiceA: { text: 'Country A, because it can produce more wheat' },
    choiceB: { text: 'Country B, because it has a lower opportunity cost of cloth' },
    choiceC: { text: 'Country A, because it has higher total output' },
    choiceD: { text: 'Neither country has a comparative advantage' },
    correctAnswers: ['B'],
    explanation: 'Country A\'s opportunity cost of 1 cloth = 2 wheat. Country B\'s opportunity cost of 1 cloth = 80/60 ≈ 1.33 wheat. B has the lower opportunity cost of cloth.',
  },
  {
    id: 'micro_q3',
    questionDomain: 'Unit 2: Supply and Demand',
    questionTopic: 'Demand Shifters',
    difficulty: 'EASY',
    questionText: 'If the price of a substitute good increases, what happens to the demand curve for the original good?',
    choiceA: { text: 'It shifts to the left' },
    choiceB: { text: 'It shifts to the right' },
    choiceC: { text: 'There is a movement along the curve' },
    choiceD: { text: 'The curve becomes more elastic' },
    correctAnswers: ['B'],
    explanation: 'When the price of a substitute increases, consumers switch to the original good, increasing demand (shifting the curve right).',
  },
  {
    id: 'micro_q4',
    questionDomain: 'Unit 2: Supply and Demand',
    questionTopic: 'Elasticity',
    difficulty: 'MEDIUM',
    questionText: 'A firm raises its price by 10% and sees quantity demanded fall by 5%. The price elasticity of demand (in absolute value) is:',
    choiceA: { text: '0.5, and demand is inelastic' },
    choiceB: { text: '2.0, and demand is elastic' },
    choiceC: { text: '0.5, and demand is elastic' },
    choiceD: { text: '1.0, and demand is unit elastic' },
    correctAnswers: ['A'],
    explanation: 'PED = %ΔQd / %ΔP = 5% / 10% = 0.5. Since |PED| < 1, demand is inelastic.',
  },
  {
    id: 'micro_q5',
    questionDomain: 'Unit 2: Supply and Demand',
    questionTopic: 'Consumer & Producer Surplus',
    difficulty: 'MEDIUM',
    questionText: 'At the market equilibrium, consumer surplus is measured as the area:',
    choiceA: { text: 'Below the demand curve and above the equilibrium price' },
    choiceB: { text: 'Above the supply curve and below the equilibrium price' },
    choiceC: { text: 'Between the supply and demand curves' },
    choiceD: { text: 'Below the supply curve and above zero' },
    correctAnswers: ['A'],
    explanation: 'Consumer surplus is the difference between what consumers are willing to pay (demand curve) and what they actually pay (market price).',
  },
  {
    id: 'micro_q6',
    questionDomain: 'Unit 3: Production, Cost, and the Perfect Competition Model',
    questionTopic: 'Marginal Product',
    difficulty: 'MEDIUM',
    questionText: 'When marginal product is at its maximum, marginal cost is:',
    choiceA: { text: 'At its maximum' },
    choiceB: { text: 'At its minimum' },
    choiceC: { text: 'Equal to average variable cost' },
    choiceD: { text: 'Equal to average total cost' },
    correctAnswers: ['B'],
    explanation: 'Marginal cost and marginal product have an inverse relationship. When MP is maximized, MC is minimized.',
  },
  {
    id: 'micro_q7',
    questionDomain: 'Unit 3: Production, Cost, and the Perfect Competition Model',
    questionTopic: 'Perfect Competition',
    difficulty: 'EASY',
    questionText: 'In a perfectly competitive market, a firm maximizes profit by producing where:',
    choiceA: { text: 'Total revenue is maximized' },
    choiceB: { text: 'Marginal revenue equals marginal cost (MR = MC)' },
    choiceC: { text: 'Average total cost is minimized' },
    choiceD: { text: 'Price equals average variable cost' },
    correctAnswers: ['B'],
    explanation: 'All firms maximize profit (or minimize loss) by producing at the quantity where MR = MC.',
  },
  {
    id: 'micro_q8',
    questionDomain: 'Unit 3: Production, Cost, and the Perfect Competition Model',
    questionTopic: 'Shutdown Rule',
    difficulty: 'HARD',
    questionText: 'A perfectly competitive firm should shut down in the short run if:',
    choiceA: { text: 'Price is below average total cost' },
    choiceB: { text: 'Price is below average variable cost' },
    choiceC: { text: 'Marginal cost exceeds marginal revenue' },
    choiceD: { text: 'Economic profits are zero' },
    correctAnswers: ['B'],
    explanation: 'A firm shuts down when P < AVC because it cannot even cover its variable costs. It loses less by shutting down (losing only fixed costs) than by producing.',
  },
  {
    id: 'micro_q9',
    questionDomain: 'Unit 4: Imperfect Competition',
    questionTopic: 'Monopoly',
    difficulty: 'MEDIUM',
    questionText: 'Compared to a perfectly competitive market, a monopoly produces:',
    choiceA: { text: 'More output at a lower price' },
    choiceB: { text: 'Less output at a higher price' },
    choiceC: { text: 'The same output at a higher price' },
    choiceD: { text: 'More output at a higher price' },
    correctAnswers: ['B'],
    explanation: 'A monopolist restricts output below the competitive level and charges a higher price, creating deadweight loss.',
  },
  {
    id: 'micro_q10',
    questionDomain: 'Unit 4: Imperfect Competition',
    questionTopic: 'Monopolistic Competition',
    difficulty: 'MEDIUM',
    questionText: 'In the long run, a monopolistically competitive firm earns:',
    choiceA: { text: 'Positive economic profit due to product differentiation' },
    choiceB: { text: 'Zero economic profit because of free entry and exit' },
    choiceC: { text: 'Negative economic profit due to excess capacity' },
    choiceD: { text: 'Positive economic profit because of barriers to entry' },
    correctAnswers: ['B'],
    explanation: 'Free entry and exit drive economic profit to zero in the long run, though firms have excess capacity and charge above MC.',
  },
  {
    id: 'micro_q11',
    questionDomain: 'Unit 4: Imperfect Competition',
    questionTopic: 'Oligopoly & Game Theory',
    difficulty: 'HARD',
    questionText: 'In a prisoner\'s dilemma, the dominant strategy for each player is to:',
    choiceA: { text: 'Cooperate, because mutual cooperation yields the highest joint payoff' },
    choiceB: { text: 'Defect, because it yields a higher payoff regardless of the other player\'s choice' },
    choiceC: { text: 'Randomize between cooperation and defection' },
    choiceD: { text: 'Cooperate if the game is repeated, defect if it is one-shot' },
    correctAnswers: ['B'],
    explanation: 'In a prisoner\'s dilemma, defecting is the dominant strategy — it yields a better outcome regardless of the opponent\'s choice, even though mutual cooperation would be better for both.',
  },
  {
    id: 'micro_q12',
    questionDomain: 'Unit 5: Factor Markets',
    questionTopic: 'Labor Market',
    difficulty: 'MEDIUM',
    questionText: 'The marginal revenue product (MRP) of labor is calculated as:',
    choiceA: { text: 'Marginal product × price of the good' },
    choiceB: { text: 'Total revenue ÷ number of workers' },
    choiceC: { text: 'Wage rate × number of workers' },
    choiceD: { text: 'Marginal cost × marginal product' },
    correctAnswers: ['A'],
    explanation: 'MRP = MP × MR. In a competitive product market, MR = P, so MRP = MP × P.',
  },
  {
    id: 'micro_q13',
    questionDomain: 'Unit 5: Factor Markets',
    questionTopic: 'Labor Market',
    difficulty: 'EASY',
    questionText: 'A profit-maximizing firm hires workers up to the point where:',
    choiceA: { text: 'MRP = Wage (MRP = W)' },
    choiceB: { text: 'MP = 0' },
    choiceC: { text: 'Total revenue is maximized' },
    choiceD: { text: 'Average product is maximized' },
    correctAnswers: ['A'],
    explanation: 'Firms hire labor until the additional revenue from the last worker (MRP) equals the cost of hiring that worker (wage).',
  },
  {
    id: 'micro_q14',
    questionDomain: 'Unit 6: Market Failure and the Role of Government',
    questionTopic: 'Externalities',
    difficulty: 'MEDIUM',
    questionText: 'A negative externality causes the market to produce:',
    choiceA: { text: 'Less than the socially optimal quantity' },
    choiceB: { text: 'More than the socially optimal quantity' },
    choiceC: { text: 'Exactly the socially optimal quantity' },
    choiceD: { text: 'At a price below marginal cost' },
    correctAnswers: ['B'],
    explanation: 'With a negative externality, the social cost exceeds the private cost, so the market overproduces relative to the social optimum.',
  },
  {
    id: 'micro_q15',
    questionDomain: 'Unit 6: Market Failure and the Role of Government',
    questionTopic: 'Public Goods',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following is the best example of a public good?',
    choiceA: { text: 'A hamburger from a fast-food restaurant' },
    choiceB: { text: 'National defense' },
    choiceC: { text: 'A toll road' },
    choiceD: { text: 'Cable television' },
    correctAnswers: ['B'],
    explanation: 'National defense is non-rivalrous (one person\'s use doesn\'t diminish another\'s) and non-excludable (everyone benefits regardless of payment).',
  },
]

const MICRO_MCQ_MULTI_QUESTIONS = [
  {
    id: 'micro_mm1',
    questionDomain: 'Unit 2: Supply and Demand',
    questionTopic: 'Demand Shifters',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following would cause the demand curve for beef to shift to the right? Select ALL that apply.',
    questionType: 'MCQ_MULTI',
    choiceA: { text: 'An increase in the price of chicken (a substitute)' },
    choiceB: { text: 'A decrease in consumer income (beef is a normal good)' },
    choiceC: { text: 'An increase in the population' },
    choiceD: { text: 'A successful advertising campaign for beef' },
    choiceE: { text: 'An increase in the price of beef' },
    correctAnswers: ['A', 'C', 'D'],
    explanation: 'Higher price of substitute (A), larger population (C), and successful advertising (D) all increase demand. Lower income decreases demand for normal goods (B). A price change causes movement along the curve, not a shift (E).',
  },
  {
    id: 'micro_mm2',
    questionDomain: 'Unit 3: Production, Cost, and the Perfect Competition Model',
    questionTopic: 'Cost Curves',
    difficulty: 'HARD',
    questionText: 'Which of the following statements about cost curves are true? Select ALL that apply.',
    questionType: 'MCQ_MULTI',
    choiceA: { text: 'When marginal cost is below average total cost, ATC is falling' },
    choiceB: { text: 'Marginal cost intersects ATC at its minimum point' },
    choiceC: { text: 'Average fixed cost continually rises as output increases' },
    choiceD: { text: 'Average variable cost eventually rises due to diminishing marginal returns' },
    correctAnswers: ['A', 'B', 'D'],
    explanation: 'MC pulls ATC down when below it (A), MC crosses ATC at its minimum (B), and AVC rises due to diminishing returns (D). AFC continuously falls as output increases (C is false).',
  },
]

const MICRO_FRQ_QUESTIONS = [
  {
    id: 'micro_frq1',
    questionDomain: 'Unit 4: Imperfect Competition',
    questionTopic: 'Monopoly Analysis',
    difficulty: 'HARD',
    questionText: 'Assume a profit-maximizing monopoly operates in a market with no externalities. Answer the following based on the standard monopoly model.',
    subQuestions: [
      { label: 'a', prompt: 'Draw a correctly labeled graph showing the monopolist\'s demand, marginal revenue, and marginal cost curves. Identify the profit-maximizing quantity (Qm) and price (Pm).', points: 3 },
      { label: 'b', prompt: 'On your graph, shade the area representing deadweight loss.', points: 2 },
      { label: 'c', prompt: 'Explain how a per-unit subsidy equal to the difference between the competitive price and the monopoly price would affect the monopolist\'s output and the deadweight loss.', points: 3 },
      { label: 'd', prompt: 'Would a lump-sum tax on the monopolist change the profit-maximizing price and quantity? Explain.', points: 2 },
    ],
    points: 10,
  },
  {
    id: 'micro_frq2',
    questionDomain: 'Unit 5: Factor Markets',
    questionTopic: 'Labor Market with Monopsony',
    difficulty: 'HARD',
    questionText: 'Consider a labor market in which a single firm (monopsony) is the only employer.',
    subQuestions: [
      { label: 'a', prompt: 'Draw a correctly labeled graph showing the monopsony\'s marginal factor cost (MFC), supply of labor (S), and marginal revenue product (MRP). Identify the wage (Wm) and quantity of labor (Lm) the monopsony will hire.', points: 3 },
      { label: 'b', prompt: 'Compare the monopsony outcome to the competitive outcome in terms of wage and employment.', points: 2 },
      { label: 'c', prompt: 'Explain how an effective minimum wage set between Wm and the competitive wage could increase both the wage and employment in this market.', points: 3 },
    ],
    points: 8,
  },
]

// ============================================================
// AP MACROECONOMICS TEST (15 MCQ + 2 FRQ)
// ============================================================

const MACRO_TEST_ID = 'test_macro_full_1'
const MACRO_MCQ_QUESTIONS = [
  {
    id: 'macro_q1',
    questionDomain: 'Unit 1: Basic Economic Concepts',
    questionTopic: 'Circular Flow',
    difficulty: 'EASY',
    questionText: 'In the circular flow model, households supply which of the following to the factor market?',
    choiceA: { text: 'Goods and services' },
    choiceB: { text: 'Land, labor, and capital' },
    choiceC: { text: 'Government transfers' },
    choiceD: { text: 'Tax revenue' },
    correctAnswers: ['B'],
    explanation: 'Households supply factors of production (land, labor, capital, entrepreneurship) to firms through the factor market.',
  },
  {
    id: 'macro_q2',
    questionDomain: 'Unit 2: Economic Indicators and the Business Cycle',
    questionTopic: 'GDP',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following is NOT included in the calculation of GDP using the expenditure approach?',
    choiceA: { text: 'Consumer spending on new cars' },
    choiceB: { text: 'Government purchases of military equipment' },
    choiceC: { text: 'Purchase of 100 shares of Apple stock' },
    choiceD: { text: 'Business investment in new factories' },
    correctAnswers: ['C'],
    explanation: 'GDP = C + I + G + NX. Stock purchases are financial transactions, not production of new goods/services, so they are excluded.',
  },
  {
    id: 'macro_q3',
    questionDomain: 'Unit 2: Economic Indicators and the Business Cycle',
    questionTopic: 'Unemployment',
    difficulty: 'EASY',
    questionText: 'A worker who quits their job to search for a better one is classified as:',
    choiceA: { text: 'Cyclically unemployed' },
    choiceB: { text: 'Structurally unemployed' },
    choiceC: { text: 'Frictionally unemployed' },
    choiceD: { text: 'Not in the labor force' },
    correctAnswers: ['C'],
    explanation: 'Frictional unemployment occurs when workers are temporarily between jobs, including those who voluntarily left to search for better opportunities.',
  },
  {
    id: 'macro_q4',
    questionDomain: 'Unit 2: Economic Indicators and the Business Cycle',
    questionTopic: 'Inflation',
    difficulty: 'MEDIUM',
    questionText: 'If the Consumer Price Index (CPI) was 200 last year and is 210 this year, the inflation rate is:',
    choiceA: { text: '10%' },
    choiceB: { text: '5%' },
    choiceC: { text: '210%' },
    choiceD: { text: '4.76%' },
    correctAnswers: ['B'],
    explanation: 'Inflation rate = ((210 - 200) / 200) × 100 = 5%.',
  },
  {
    id: 'macro_q5',
    questionDomain: 'Unit 3: National Income and Price Determination',
    questionTopic: 'Aggregate Demand',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following would shift the aggregate demand curve to the right?',
    choiceA: { text: 'An increase in personal income taxes' },
    choiceB: { text: 'A decrease in government spending' },
    choiceC: { text: 'An increase in consumer confidence' },
    choiceD: { text: 'An increase in the interest rate' },
    correctAnswers: ['C'],
    explanation: 'Increased consumer confidence leads to more consumption spending, shifting AD to the right. Tax increases, spending cuts, and higher interest rates shift AD left.',
  },
  {
    id: 'macro_q6',
    questionDomain: 'Unit 3: National Income and Price Determination',
    questionTopic: 'Multiplier Effect',
    difficulty: 'HARD',
    questionText: 'If the marginal propensity to consume (MPC) is 0.8, the spending multiplier is:',
    choiceA: { text: '4' },
    choiceB: { text: '5' },
    choiceC: { text: '0.8' },
    choiceD: { text: '1.25' },
    correctAnswers: ['B'],
    explanation: 'Spending multiplier = 1/(1 - MPC) = 1/(1 - 0.8) = 1/0.2 = 5.',
  },
  {
    id: 'macro_q7',
    questionDomain: 'Unit 3: National Income and Price Determination',
    questionTopic: 'Short-Run Aggregate Supply',
    difficulty: 'MEDIUM',
    questionText: 'An increase in input prices (e.g., oil prices) would cause:',
    choiceA: { text: 'Aggregate demand to shift left' },
    choiceB: { text: 'Short-run aggregate supply to shift left (decrease)' },
    choiceC: { text: 'Long-run aggregate supply to shift right' },
    choiceD: { text: 'Short-run aggregate supply to shift right (increase)' },
    correctAnswers: ['B'],
    explanation: 'Higher input prices increase production costs, shifting SRAS to the left, causing stagflation (higher prices and lower output).',
  },
  {
    id: 'macro_q8',
    questionDomain: 'Unit 4: Financial Sector',
    questionTopic: 'Money Supply',
    difficulty: 'MEDIUM',
    questionText: 'If the reserve requirement is 10% and a bank receives a $1,000 deposit, the maximum amount the banking system can create in new money is:',
    choiceA: { text: '$1,000' },
    choiceB: { text: '$9,000' },
    choiceC: { text: '$10,000' },
    choiceD: { text: '$100' },
    correctAnswers: ['C'],
    explanation: 'Money multiplier = 1/reserve requirement = 1/0.10 = 10. Maximum new money = $1,000 × 10 = $10,000 (including the original deposit).',
  },
  {
    id: 'macro_q9',
    questionDomain: 'Unit 4: Financial Sector',
    questionTopic: 'Federal Reserve',
    difficulty: 'EASY',
    questionText: 'To combat a recession, the Federal Reserve would most likely:',
    choiceA: { text: 'Increase the discount rate' },
    choiceB: { text: 'Sell government bonds in open market operations' },
    choiceC: { text: 'Buy government bonds in open market operations' },
    choiceD: { text: 'Increase the reserve requirement' },
    correctAnswers: ['C'],
    explanation: 'Buying bonds increases the money supply, lowers interest rates, and stimulates investment and consumption — expansionary monetary policy.',
  },
  {
    id: 'macro_q10',
    questionDomain: 'Unit 4: Financial Sector',
    questionTopic: 'Loanable Funds',
    difficulty: 'HARD',
    questionText: 'An increase in government borrowing (deficit spending) in the loanable funds market will:',
    choiceA: { text: 'Decrease the real interest rate and increase investment' },
    choiceB: { text: 'Increase the real interest rate and decrease private investment (crowding out)' },
    choiceC: { text: 'Have no effect on interest rates' },
    choiceD: { text: 'Increase the supply of loanable funds' },
    correctAnswers: ['B'],
    explanation: 'Government borrowing increases demand for loanable funds, raising real interest rates and crowding out private investment.',
  },
  {
    id: 'macro_q11',
    questionDomain: 'Unit 5: Long-Run Consequences of Stabilization Policies',
    questionTopic: 'Phillips Curve',
    difficulty: 'MEDIUM',
    questionText: 'The long-run Phillips curve is vertical at:',
    choiceA: { text: 'Zero percent unemployment' },
    choiceB: { text: 'The natural rate of unemployment' },
    choiceC: { text: 'The current inflation rate' },
    choiceD: { text: 'Full employment output' },
    correctAnswers: ['B'],
    explanation: 'In the long run, there is no trade-off between inflation and unemployment. The LRPC is vertical at the natural rate of unemployment.',
  },
  {
    id: 'macro_q12',
    questionDomain: 'Unit 5: Long-Run Consequences of Stabilization Policies',
    questionTopic: 'Fiscal Policy',
    difficulty: 'MEDIUM',
    questionText: 'Which of the following is an example of an automatic stabilizer?',
    choiceA: { text: 'Congress passing a new infrastructure bill' },
    choiceB: { text: 'The Fed lowering interest rates' },
    choiceC: { text: 'Unemployment insurance payments increasing during a recession' },
    choiceD: { text: 'The president signing a tax cut into law' },
    correctAnswers: ['C'],
    explanation: 'Automatic stabilizers (like unemployment insurance and progressive taxes) adjust automatically without new legislation, cushioning economic downturns.',
  },
  {
    id: 'macro_q13',
    questionDomain: 'Unit 6: Open Economy—International Trade and Finance',
    questionTopic: 'Exchange Rates',
    difficulty: 'MEDIUM',
    questionText: 'If interest rates in the United States increase relative to those in Japan, what will happen to the value of the US dollar relative to the yen?',
    choiceA: { text: 'The dollar will depreciate' },
    choiceB: { text: 'The dollar will appreciate' },
    choiceC: { text: 'The yen will appreciate' },
    choiceD: { text: 'There will be no effect on exchange rates' },
    correctAnswers: ['B'],
    explanation: 'Higher US interest rates attract foreign capital, increasing demand for dollars and causing the dollar to appreciate relative to the yen.',
  },
  {
    id: 'macro_q14',
    questionDomain: 'Unit 6: Open Economy—International Trade and Finance',
    questionTopic: 'Balance of Payments',
    difficulty: 'HARD',
    questionText: 'If a country has a current account deficit, it must have:',
    choiceA: { text: 'A capital (financial) account surplus' },
    choiceB: { text: 'A capital (financial) account deficit' },
    choiceC: { text: 'A balanced budget' },
    choiceD: { text: 'Falling exchange rates' },
    correctAnswers: ['A'],
    explanation: 'The current account and capital (financial) account must sum to zero. A current account deficit means more capital is flowing in than out.',
  },
  {
    id: 'macro_q15',
    questionDomain: 'Unit 3: National Income and Price Determination',
    questionTopic: 'Long-Run Self-Adjustment',
    difficulty: 'HARD',
    questionText: 'If the economy is in a recessionary gap with no government intervention, the long-run self-adjustment mechanism works through:',
    choiceA: { text: 'Wages and input prices falling, shifting SRAS right' },
    choiceB: { text: 'Government increasing spending automatically' },
    choiceC: { text: 'The Fed lowering interest rates' },
    choiceD: { text: 'Aggregate demand shifting right due to lower prices' },
    correctAnswers: ['A'],
    explanation: 'In a recessionary gap, high unemployment puts downward pressure on wages/input prices, decreasing costs and shifting SRAS right until full employment is restored.',
  },
  {
    id: 'macro_q16',
    questionDomain: 'Unit 4: Financial Sector',
    questionTopic: 'Money Market Analysis',
    difficulty: 'HARD',
    questionText: 'Based on the passage below, what is the most likely outcome of the Federal Reserve\'s policy action?',
    stimulus: {
      type: 'TEXT',
      content: 'The Federal Reserve announced today that it will purchase $80 billion in Treasury securities over the next month as part of its ongoing quantitative easing program. The current federal funds rate stands at 0.25%, and the unemployment rate is 7.2%. Consumer spending has been sluggish, and business investment has declined for two consecutive quarters. Several FOMC members expressed concern about deflationary pressures, noting that the PCE inflation rate has fallen to 0.8%, well below the 2% target.',
    },
    choiceA: { text: 'Short-term interest rates will increase significantly' },
    choiceB: { text: 'The money supply will expand, putting downward pressure on long-term interest rates' },
    choiceC: { text: 'The federal funds rate will be raised to combat inflation' },
    choiceD: { text: 'Bank lending will decrease due to reduced reserves' },
    correctAnswers: ['B'],
    explanation: 'QE purchases increase bank reserves and expand the money supply, which puts downward pressure on long-term interest rates to stimulate borrowing and spending.',
  },
  {
    id: 'macro_q17',
    questionDomain: 'Unit 5: Long-Run Consequences of Stabilization Policies',
    questionTopic: 'Phillips Curve',
    difficulty: 'MEDIUM',
    questionText: 'According to the data presented below, which conclusion about the short-run Phillips Curve is best supported?',
    stimulus: {
      type: 'TEXT',
      content: 'Table: Hypothetical Economy Data (2020-2024)\n\nYear | Unemployment Rate | Inflation Rate\n2020 | 3.5%             | 4.2%\n2021 | 5.8%             | 1.8%\n2022 | 7.1%             | 0.9%\n2023 | 4.3%             | 3.1%\n2024 | 3.2%             | 4.8%\n\nDuring this period, no significant supply shocks occurred, and the central bank adjusted monetary policy in response to changing economic conditions.',
    },
    choiceA: { text: 'There is no relationship between unemployment and inflation' },
    choiceB: { text: 'The short-run Phillips Curve shows a positive relationship between unemployment and inflation' },
    choiceC: { text: 'The data supports an inverse relationship between unemployment and inflation in the short run' },
    choiceD: { text: 'The natural rate of unemployment increased over the period' },
    correctAnswers: ['C'],
    explanation: 'The data shows that as unemployment falls, inflation rises (and vice versa), supporting the inverse relationship depicted by the short-run Phillips Curve.',
  },
]

const MACRO_FRQ_QUESTIONS = [
  {
    id: 'macro_frq1',
    questionDomain: 'Unit 3: National Income and Price Determination',
    questionTopic: 'AD-AS Model',
    difficulty: 'HARD',
    questionText: 'Assume the economy of Country X is currently operating below full employment.',
    subQuestions: [
      { label: 'a', prompt: 'Draw a correctly labeled AD-AS graph showing the current short-run equilibrium below full employment. Label the current price level (PL₁) and output (Y₁), and the full-employment output (Yf).', points: 3 },
      { label: 'b', prompt: 'Identify one fiscal policy action the government could take to restore full employment. Explain the mechanism through which this policy increases output.', points: 3 },
      { label: 'c', prompt: 'Show the effect of the policy from part (b) on your graph. Label the new equilibrium price level (PL₂) and output (Y₂).', points: 2 },
      { label: 'd', prompt: 'Explain how the policy from part (b) would affect the real interest rate in the loanable funds market and, consequently, the level of private investment. This effect is known as ______.', points: 2 },
    ],
    points: 10,
  },
  {
    id: 'macro_frq2',
    questionDomain: 'Unit 4: Financial Sector',
    questionTopic: 'Monetary Policy',
    difficulty: 'HARD',
    questionText: 'The economy is experiencing high inflation.',
    subQuestions: [
      { label: 'a', prompt: 'Identify the appropriate open market operation the Federal Reserve should conduct. Explain its effect on bank reserves.', points: 2 },
      { label: 'b', prompt: 'Using a correctly labeled money market graph, show the effect of the Fed\'s action on the nominal interest rate.', points: 3 },
      { label: 'c', prompt: 'Explain how the change in interest rates from part (b) affects aggregate demand and the price level.', points: 3 },
    ],
    points: 8,
  },
]

// ============================================================
// AP CALCULUS AB TEST (15 MCQ + 2 FRQ with LaTeX)
// ============================================================

const CALC_TEST_ID = 'test_calc_ab_full_1'
const CALC_MCQ_QUESTIONS = [
  {
    id: 'calc_q1',
    questionDomain: 'Unit 1: Limits and Continuity',
    questionTopic: 'Evaluating Limits',
    difficulty: 'EASY',
    questionText: 'Find $\\displaystyle\\lim_{x \\to 3} \\frac{x^2 - 9}{x - 3}$.',
    choiceA: { text: '$0$' },
    choiceB: { text: '$3$' },
    choiceC: { text: '$6$' },
    choiceD: { text: 'The limit does not exist' },
    correctAnswers: ['C'],
    explanation: 'Factor: (x²-9)/(x-3) = (x+3)(x-3)/(x-3) = x+3. As x→3, this equals 6.',
  },
  {
    id: 'calc_q2',
    questionDomain: 'Unit 1: Limits and Continuity',
    questionTopic: 'Continuity',
    difficulty: 'MEDIUM',
    questionText: 'The function $f(x) = \\begin{cases} x^2 & x < 2 \\\\ ax + 1 & x \\geq 2 \\end{cases}$ is continuous at $x = 2$ when $a$ equals:',
    choiceA: { text: '$\\frac{1}{2}$' },
    choiceB: { text: '$\\frac{3}{2}$' },
    choiceC: { text: '$2$' },
    choiceD: { text: '$3$' },
    correctAnswers: ['B'],
    explanation: 'For continuity: lim(x→2⁻) f(x) = f(2). So 4 = 2a + 1, giving a = 3/2.',
  },
  {
    id: 'calc_q3',
    questionDomain: 'Unit 2: Differentiation: Definition and Fundamental Properties',
    questionTopic: 'Basic Derivatives',
    difficulty: 'EASY',
    questionText: 'If $f(x) = 3x^4 - 2x^2 + 5x - 7$, then $f\'(x) =$',
    choiceA: { text: '$12x^3 - 4x + 5$' },
    choiceB: { text: '$12x^3 - 2x + 5$' },
    choiceC: { text: '$12x^4 - 4x^2 + 5x$' },
    choiceD: { text: '$3x^3 - 2x + 5$' },
    correctAnswers: ['A'],
    explanation: 'Apply power rule: d/dx[3x⁴] = 12x³, d/dx[-2x²] = -4x, d/dx[5x] = 5, d/dx[-7] = 0.',
  },
  {
    id: 'calc_q4',
    questionDomain: 'Unit 2: Differentiation: Definition and Fundamental Properties',
    questionTopic: 'Product Rule',
    difficulty: 'MEDIUM',
    questionText: 'If $f(x) = x^2 \\sin(x)$, then $f\'(x) =$',
    choiceA: { text: '$2x \\cos(x)$' },
    choiceB: { text: '$2x \\sin(x) + x^2 \\cos(x)$' },
    choiceC: { text: '$x^2 \\cos(x) - 2x \\sin(x)$' },
    choiceD: { text: '$2x \\sin(x) - x^2 \\cos(x)$' },
    correctAnswers: ['B'],
    explanation: 'Product rule: f\'(x) = (2x)(sin x) + (x²)(cos x) = 2x sin(x) + x² cos(x).',
  },
  {
    id: 'calc_q5',
    questionDomain: 'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
    questionTopic: 'Chain Rule',
    difficulty: 'MEDIUM',
    questionText: 'If $y = \\sqrt{3x^2 + 1}$, then $\\frac{dy}{dx} =$',
    choiceA: { text: '$\\frac{3x}{\\sqrt{3x^2 + 1}}$' },
    choiceB: { text: '$\\frac{6x}{\\sqrt{3x^2 + 1}}$' },
    choiceC: { text: '$\\frac{1}{2\\sqrt{3x^2 + 1}}$' },
    choiceD: { text: '$\\frac{6x}{2(3x^2 + 1)}$' },
    correctAnswers: ['A'],
    explanation: 'Chain rule: dy/dx = (1/2)(3x²+1)^(-1/2) · 6x = 3x/√(3x²+1).',
  },
  {
    id: 'calc_q6',
    questionDomain: 'Unit 3: Differentiation: Composite, Implicit, and Inverse Functions',
    questionTopic: 'Implicit Differentiation',
    difficulty: 'HARD',
    questionText: 'Given $x^2 + y^2 = 25$, find $\\frac{dy}{dx}$ at the point $(3, 4)$.',
    choiceA: { text: '$-\\frac{3}{4}$' },
    choiceB: { text: '$\\frac{3}{4}$' },
    choiceC: { text: '$-\\frac{4}{3}$' },
    choiceD: { text: '$\\frac{4}{3}$' },
    correctAnswers: ['A'],
    explanation: 'Differentiate implicitly: 2x + 2y(dy/dx) = 0, so dy/dx = -x/y = -3/4.',
  },
  {
    id: 'calc_q7',
    questionDomain: 'Unit 4: Contextual Applications of Differentiation',
    questionTopic: 'Related Rates',
    difficulty: 'HARD',
    questionText: 'A spherical balloon is being inflated so that its volume increases at a rate of $100\\pi$ cm³/sec. How fast is the radius increasing when the radius is 5 cm? (Recall: $V = \\frac{4}{3}\\pi r^3$)',
    choiceA: { text: '$1$ cm/sec' },
    choiceB: { text: '$4$ cm/sec' },
    choiceC: { text: '$\\frac{1}{\\pi}$ cm/sec' },
    choiceD: { text: '$20$ cm/sec' },
    correctAnswers: ['A'],
    explanation: 'dV/dt = 4πr²(dr/dt). 100π = 4π(25)(dr/dt). dr/dt = 100π/(100π) = 1 cm/sec.',
  },
  {
    id: 'calc_q8',
    questionDomain: 'Unit 5: Analytical Applications of Differentiation',
    questionTopic: 'Critical Points',
    difficulty: 'MEDIUM',
    questionText: 'The function $f(x) = x^3 - 3x^2 + 4$ has a local maximum at $x =$',
    choiceA: { text: '$0$' },
    choiceB: { text: '$1$' },
    choiceC: { text: '$2$' },
    choiceD: { text: '$-1$' },
    correctAnswers: ['A'],
    explanation: 'f\'(x) = 3x² - 6x = 3x(x-2) = 0 at x=0 and x=2. f\'\'(x) = 6x-6. f\'\'(0) = -6 < 0, so x=0 is a local max.',
  },
  {
    id: 'calc_q9',
    questionDomain: 'Unit 5: Analytical Applications of Differentiation',
    questionTopic: 'Mean Value Theorem',
    difficulty: 'MEDIUM',
    questionText: 'If $f(x) = x^3$ on the interval $[1, 3]$, the value of $c$ guaranteed by the Mean Value Theorem is:',
    choiceA: { text: '$\\sqrt{\\frac{13}{3}}$' },
    choiceB: { text: '$2$' },
    choiceC: { text: '$\\frac{7}{3}$' },
    choiceD: { text: '$\\sqrt{3}$' },
    correctAnswers: ['A'],
    explanation: 'MVT: f\'(c) = (f(3)-f(1))/(3-1) = (27-1)/2 = 13. f\'(c) = 3c² = 13, so c = √(13/3).',
  },
  {
    id: 'calc_q10',
    questionDomain: 'Unit 6: Integration and Accumulation of Change',
    questionTopic: 'Basic Integrals',
    difficulty: 'EASY',
    questionText: '$\\displaystyle\\int (4x^3 + 6x - 2)\\,dx =$',
    choiceA: { text: '$x^4 + 3x^2 - 2x + C$' },
    choiceB: { text: '$12x^2 + 6 + C$' },
    choiceC: { text: '$x^4 + 6x^2 - 2x + C$' },
    choiceD: { text: '$4x^4 + 3x^2 - 2x + C$' },
    correctAnswers: ['A'],
    explanation: '∫4x³dx = x⁴, ∫6xdx = 3x², ∫-2dx = -2x. Answer: x⁴ + 3x² - 2x + C.',
  },
  {
    id: 'calc_q11',
    questionDomain: 'Unit 6: Integration and Accumulation of Change',
    questionTopic: 'Definite Integrals',
    difficulty: 'MEDIUM',
    questionText: '$\\displaystyle\\int_0^2 (3x^2 + 1)\\,dx =$',
    choiceA: { text: '$8$' },
    choiceB: { text: '$10$' },
    choiceC: { text: '$12$' },
    choiceD: { text: '$14$' },
    correctAnswers: ['B'],
    explanation: '∫₀² (3x²+1)dx = [x³ + x]₀² = (8+2) - (0+0) = 10.',
  },
  {
    id: 'calc_q12',
    questionDomain: 'Unit 6: Integration and Accumulation of Change',
    questionTopic: 'Fundamental Theorem of Calculus',
    difficulty: 'MEDIUM',
    questionText: 'If $F(x) = \\displaystyle\\int_1^x \\sqrt{t^2 + 1}\\,dt$, then $F\'(x) =$',
    choiceA: { text: '$\\sqrt{x^2 + 1}$' },
    choiceB: { text: '$\\frac{x}{\\sqrt{x^2 + 1}}$' },
    choiceC: { text: '$\\sqrt{x^2 + 1} - \\sqrt{2}$' },
    choiceD: { text: '$2x\\sqrt{x^2 + 1}$' },
    correctAnswers: ['A'],
    explanation: 'By the Fundamental Theorem of Calculus Part 1: F\'(x) = √(x²+1).',
  },
  {
    id: 'calc_q13',
    questionDomain: 'Unit 7: Differential Equations',
    questionTopic: 'Separation of Variables',
    difficulty: 'HARD',
    questionText: 'The solution to $\\frac{dy}{dx} = 2xy$ with $y(0) = 1$ is:',
    choiceA: { text: '$y = e^{x^2}$' },
    choiceB: { text: '$y = e^{2x}$' },
    choiceC: { text: '$y = x^2 + 1$' },
    choiceD: { text: '$y = e^{x^2/2}$' },
    correctAnswers: ['A'],
    explanation: 'Separate: dy/y = 2x dx. Integrate: ln|y| = x² + C. y(0)=1 → C=0. y = e^(x²).',
  },
  {
    id: 'calc_q14',
    questionDomain: 'Unit 8: Applications of Integration',
    questionTopic: 'Area Between Curves',
    difficulty: 'MEDIUM',
    questionText: 'The area of the region enclosed by $y = x^2$ and $y = x$ is:',
    choiceA: { text: '$\\frac{1}{3}$' },
    choiceB: { text: '$\\frac{1}{6}$' },
    choiceC: { text: '$\\frac{1}{2}$' },
    choiceD: { text: '$\\frac{1}{4}$' },
    correctAnswers: ['B'],
    explanation: 'Intersection: x² = x → x=0,1. Area = ∫₀¹(x - x²)dx = [x²/2 - x³/3]₀¹ = 1/2 - 1/3 = 1/6.',
  },
  {
    id: 'calc_q15',
    questionDomain: 'Unit 8: Applications of Integration',
    questionTopic: 'Volume of Revolution',
    difficulty: 'HARD',
    questionText: 'The volume of the solid formed by revolving the region bounded by $y = \\sqrt{x}$, $y = 0$, and $x = 4$ about the $x$-axis is:',
    choiceA: { text: '$4\\pi$' },
    choiceB: { text: '$8\\pi$' },
    choiceC: { text: '$16\\pi$' },
    choiceD: { text: '$2\\pi$' },
    correctAnswers: ['B'],
    explanation: 'Disk method: V = π∫₀⁴(√x)²dx = π∫₀⁴ x dx = π[x²/2]₀⁴ = π(8) = 8π.',
  },
]

const CALC_FRQ_QUESTIONS = [
  {
    id: 'calc_frq1',
    questionDomain: 'Unit 5: Analytical Applications of Differentiation',
    questionTopic: 'Curve Analysis',
    difficulty: 'HARD',
    questionText: 'Let $f(x) = x^3 - 6x^2 + 9x + 2$.',
    subQuestions: [
      { label: 'a', prompt: 'Find all critical values of $f$ and determine whether each is a local maximum, local minimum, or neither. Justify your answer using the First or Second Derivative Test.', points: 4 },
      { label: 'b', prompt: 'Find the intervals on which $f$ is concave up and concave down. Identify any inflection points.', points: 3 },
      { label: 'c', prompt: 'Find the absolute maximum and minimum values of $f$ on the interval $[0, 5]$.', points: 3 },
    ],
    points: 10,
  },
  {
    id: 'calc_frq2',
    questionDomain: 'Unit 8: Applications of Integration',
    questionTopic: 'Accumulation & Area',
    difficulty: 'HARD',
    questionText: 'The rate at which water flows into a tank is modeled by $R(t) = 10 + 5\\sin\\left(\\frac{\\pi t}{6}\\right)$ gallons per minute, where $t$ is measured in minutes for $0 \\leq t \\leq 12$. At time $t = 0$, the tank contains 50 gallons.',
    subQuestions: [
      { label: 'a', prompt: 'Find the total amount of water that flows into the tank from $t = 0$ to $t = 6$.', points: 3 },
      { label: 'b', prompt: 'Write an expression for the total amount of water in the tank at time $t$.', points: 2 },
      { label: 'c', prompt: 'At what time $t$ is the rate of flow at its maximum? Justify your answer.', points: 2 },
      { label: 'd', prompt: 'If water also drains from the tank at a constant rate of 8 gallons per minute, find the total amount of water in the tank at $t = 12$.', points: 3 },
    ],
    points: 10,
  },
]

// ============================================================
// HELPER: Build question docs
// ============================================================

function buildQuestionDoc(q, testId, subject) {
  return {
    testId,
    subject,
    questionType: q.questionType ? QUESTION_TYPE[q.questionType] || q.questionType : (q.subQuestions ? QUESTION_TYPE.FRQ : QUESTION_TYPE.MCQ),
    format: q.stimulus ? QUESTION_FORMAT.HORIZONTAL : QUESTION_FORMAT.VERTICAL,
    questionDomain: q.questionDomain,
    questionTopic: q.questionTopic,
    difficulty: q.difficulty,
    questionText: q.questionText,
    ...(q.choiceA && { choiceA: q.choiceA }),
    ...(q.choiceB && { choiceB: q.choiceB }),
    ...(q.choiceC && { choiceC: q.choiceC }),
    ...(q.choiceD && { choiceD: q.choiceD }),
    ...(q.choiceE && { choiceE: q.choiceE }),
    ...(q.choiceA && { choiceCount: q.choiceE ? 5 : 4 }),
    ...(q.correctAnswers && { correctAnswers: q.correctAnswers }),
    ...(q.explanation && { explanation: q.explanation }),
    ...(q.subQuestions && { subQuestions: q.subQuestions }),
    ...(q.stimulus && { stimulus: q.stimulus }),
    partialCredit: false,
    points: q.points || 1,
    createdBy: TEACHER_ID,
    createdAt: serverTimestamp(),
  }
}

// ============================================================
// HELPER: Generate fake test results
// ============================================================

function generateMCQResults(questions, correctRate) {
  return questions.map(q => {
    const isCorrect = Math.random() < correctRate
    const correct = q.correctAnswers[0]
    const wrong = ['A', 'B', 'C', 'D'].filter(l => l !== correct)
    const answer = isCorrect ? correct : wrong[Math.floor(Math.random() * wrong.length)]
    return {
      questionId: q.id,
      questionDomain: q.questionDomain,
      questionTopic: q.questionTopic,
      studentAnswer: answer,
      selectedAnswer: answer, // Alias for backwards compatibility
      correctAnswer: correct,
      correct: isCorrect,
      timeSpent: Math.floor(30 + Math.random() * 120),
    }
  })
}

function generateTestResult(studentId, testId, subject, mcqQuestions, frqQuestions, correctRate, daysAgo) {
  const mcqResults = generateMCQResults(mcqQuestions, correctRate)
  const mcqCorrect = mcqResults.filter(r => r.correct).length
  const mcqTotal = mcqResults.length

  const frqMaxPoints = frqQuestions.reduce((sum, q) => sum + (q.points || 0), 0)
  const frqScore = Math.round(frqMaxPoints * (correctRate * 0.8 + Math.random() * 0.2))

  // Generate frqAnswers for each FRQ question
  const sampleResponses = [
    'The equilibrium price is determined by the intersection of supply and demand curves.',
    'When price increases above equilibrium, a surplus results causing prices to fall.',
    'Consumer surplus is the area below the demand curve and above the equilibrium price.',
    'The law of demand states that as price rises, quantity demanded falls, ceteris paribus.',
  ]
  const frqAnswers = {}
  for (const frqQ of frqQuestions) {
    const answers = {}
    for (const sq of (frqQ.subQuestions || [])) {
      answers[sq.label] = sampleResponses[Math.floor(Math.random() * sampleResponses.length)]
    }
    frqAnswers[frqQ.id] = answers
  }

  const maxScore = mcqTotal + frqMaxPoints
  const totalEarned = mcqCorrect + frqScore
  const percentage = Math.round((totalEarned / maxScore) * 100)

  let apScore = 1
  if (percentage >= 80) apScore = 5
  else if (percentage >= 65) apScore = 4
  else if (percentage >= 50) apScore = 3
  else if (percentage >= 35) apScore = 2

  const completedDate = new Date()
  completedDate.setDate(completedDate.getDate() - daysAgo)

  return {
    userId: studentId,
    testId,
    subject,
    mcqResults,
    mcqCorrect,
    mcqTotal,
    frqScore,
    frqMaxPoints,
    frqAnswers,
    score: totalEarned,
    maxScore,
    percentage,
    apScore,
    totalTimeSpent: Math.floor(30 * 60 + Math.random() * 40 * 60),
    completedAt: Timestamp.fromDate(completedDate),
    gradingStatus: Math.random() > 0.3 ? 'COMPLETE' : 'PENDING',
  }
}

// ============================================================
// MAIN SEED FUNCTION
// ============================================================

export async function seedFullData(teacherUid = null) {
  const actualTeacherId = teacherUid || TEACHER_ID
  console.log('Seeding full AP Boost data...')
  console.log('Teacher ID:', actualTeacherId)

  try {
    // --- 1. Teacher profile ---
    await setDoc(doc(db, 'users', actualTeacherId), {
      displayName: 'Ms. Thompson',
      email: 'thompson@school.edu',
      role: 'teacher',
      createdAt: serverTimestamp(),
    }, { merge: true })
    console.log('Created teacher profile')

    // --- 2. Student profiles (best-effort; Firestore rules may block writing other users' docs) ---
    let studentProfileCount = 0
    for (const student of STUDENTS) {
      try {
        await setDoc(doc(db, 'users', student.id), {
          displayName: student.displayName,
          email: student.email,
          role: 'student',
          createdAt: serverTimestamp(),
        }, { merge: true })
        studentProfileCount++
      } catch (e) {
        console.warn(`Skipped student profile ${student.id} (permissions):`, e.message)
      }
    }
    console.log('Created', studentProfileCount, '/', STUDENTS.length, 'student profiles (others skipped due to permissions)')

    // --- 3. Classes ---
    for (const cls of CLASSES) {
      await setDoc(doc(db, COLLECTIONS.CLASSES, cls.id), {
        name: cls.name,
        period: cls.period,
        subject: cls.subject,
        teacherId: actualTeacherId,
        studentIds: STUDENT_IDS,
        createdAt: serverTimestamp(),
      })
    }
    console.log('Created', CLASSES.length, 'classes')

    // --- 4. MICRO TEST ---
    const microMcqIds = MICRO_MCQ_QUESTIONS.map(q => q.id)
    const microMcqMultiIds = MICRO_MCQ_MULTI_QUESTIONS.map(q => q.id)
    const microFrqIds = MICRO_FRQ_QUESTIONS.map(q => q.id)

    await setDoc(doc(db, COLLECTIONS.TESTS, MICRO_TEST_ID), {
      title: 'AP Microeconomics Practice Exam',
      subject: 'AP_MICRO',
      testType: TEST_TYPE.EXAM,
      createdBy: actualTeacherId,
      isPublished: true,
      hasFRQ: true,
      questionOrder: QUESTION_ORDER.FIXED,
      sections: [
        {
          id: 'micro_mcq_section',
          title: 'Section I: Multiple Choice',
          sectionType: SECTION_TYPE.MCQ,
          timeLimit: 35,
          questionIds: [...microMcqIds, ...microMcqMultiIds],
          mcqMultiplier: 1.0,
        },
        {
          id: 'micro_frq_section',
          title: 'Section II: Free Response',
          sectionType: SECTION_TYPE.FRQ,
          timeLimit: 25,
          questionIds: microFrqIds,
          frqMultipliers: { micro_frq1: 1, micro_frq2: 1 },
        },
      ],
      scoreRanges: {
        ap5: { min: 80, max: 100 },
        ap4: { min: 65, max: 79 },
        ap3: { min: 50, max: 64 },
        ap2: { min: 35, max: 49 },
        ap1: { min: 0, max: 34 },
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    for (const q of MICRO_MCQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, MICRO_TEST_ID, 'AP_MICRO'))
    }
    for (const q of MICRO_MCQ_MULTI_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, MICRO_TEST_ID, 'AP_MICRO'))
    }
    for (const q of MICRO_FRQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, MICRO_TEST_ID, 'AP_MICRO'))
    }
    console.log('Created AP Micro test with', microMcqIds.length, 'MCQ +', microMcqMultiIds.length, 'MCQ_MULTI +', microFrqIds.length, 'FRQ')

    // --- 5. MACRO TEST ---
    const macroMcqIds = MACRO_MCQ_QUESTIONS.map(q => q.id)
    const macroFrqIds = MACRO_FRQ_QUESTIONS.map(q => q.id)

    await setDoc(doc(db, COLLECTIONS.TESTS, MACRO_TEST_ID), {
      title: 'AP Macroeconomics Practice Exam',
      subject: 'AP_MACRO',
      testType: TEST_TYPE.EXAM,
      createdBy: actualTeacherId,
      isPublished: true,
      hasFRQ: true,
      questionOrder: QUESTION_ORDER.FIXED,
      sections: [
        {
          id: 'macro_mcq_section',
          title: 'Section I: Multiple Choice',
          sectionType: SECTION_TYPE.MCQ,
          timeLimit: 35,
          questionIds: macroMcqIds,
          mcqMultiplier: 1.0,
        },
        {
          id: 'macro_frq_section',
          title: 'Section II: Free Response',
          sectionType: SECTION_TYPE.FRQ,
          timeLimit: 25,
          questionIds: macroFrqIds,
          frqMultipliers: { macro_frq1: 1, macro_frq2: 1 },
        },
      ],
      scoreRanges: {
        ap5: { min: 80, max: 100 },
        ap4: { min: 65, max: 79 },
        ap3: { min: 50, max: 64 },
        ap2: { min: 35, max: 49 },
        ap1: { min: 0, max: 34 },
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    for (const q of MACRO_MCQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, MACRO_TEST_ID, 'AP_MACRO'))
    }
    for (const q of MACRO_FRQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, MACRO_TEST_ID, 'AP_MACRO'))
    }
    console.log('Created AP Macro test with', macroMcqIds.length, 'MCQ +', macroFrqIds.length, 'FRQ')

    // --- 6. CALC AB TEST ---
    const calcMcqIds = CALC_MCQ_QUESTIONS.map(q => q.id)
    const calcFrqIds = CALC_FRQ_QUESTIONS.map(q => q.id)

    await setDoc(doc(db, COLLECTIONS.TESTS, CALC_TEST_ID), {
      title: 'AP Calculus AB Practice Exam',
      subject: 'AP_CALC_AB',
      testType: TEST_TYPE.EXAM,
      createdBy: actualTeacherId,
      isPublished: true,
      hasFRQ: true,
      questionOrder: QUESTION_ORDER.FIXED,
      sections: [
        {
          id: 'calc_mcq_section',
          title: 'Section I: Multiple Choice (No Calculator)',
          sectionType: SECTION_TYPE.MCQ,
          timeLimit: 45,
          questionIds: calcMcqIds,
          mcqMultiplier: 1.0,
          calculatorEnabled: false,
        },
        {
          id: 'calc_frq_section',
          title: 'Section II: Free Response',
          sectionType: SECTION_TYPE.FRQ,
          timeLimit: 30,
          questionIds: calcFrqIds,
          frqMultipliers: { calc_frq1: 1, calc_frq2: 1 },
        },
      ],
      scoreRanges: {
        ap5: { min: 80, max: 100 },
        ap4: { min: 65, max: 79 },
        ap3: { min: 50, max: 64 },
        ap2: { min: 35, max: 49 },
        ap1: { min: 0, max: 34 },
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    for (const q of CALC_MCQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, CALC_TEST_ID, 'AP_CALC_AB'))
    }
    for (const q of CALC_FRQ_QUESTIONS) {
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, q.id), buildQuestionDoc(q, CALC_TEST_ID, 'AP_CALC_AB'))
    }
    console.log('Created AP Calc AB test with', calcMcqIds.length, 'MCQ +', calcFrqIds.length, 'FRQ')

    // --- 7. Assignments ---
    await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, 'assign_micro_econ_p1'), {
      testId: MICRO_TEST_ID,
      classId: 'class_econ_p1',
      teacherId: actualTeacherId,
      studentIds: STUDENT_IDS,
      maxAttempts: 3,
      dueDate: null,
      assignedAt: serverTimestamp(),
    })
    await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, 'assign_macro_econ_p1'), {
      testId: MACRO_TEST_ID,
      classId: 'class_econ_p1',
      teacherId: actualTeacherId,
      studentIds: STUDENT_IDS,
      maxAttempts: 3,
      dueDate: null,
      assignedAt: serverTimestamp(),
    })
    await setDoc(doc(db, COLLECTIONS.ASSIGNMENTS, 'assign_calc_p3'), {
      testId: CALC_TEST_ID,
      classId: 'class_calc_p3',
      teacherId: actualTeacherId,
      studentIds: STUDENT_IDS,
      maxAttempts: 2,
      dueDate: null,
      assignedAt: serverTimestamp(),
    })
    console.log('Created 3 assignments')

    // --- 8. Test Results (varied scores per student) ---
    const correctRates = [0.85, 0.72, 0.60, 0.45, 0.90] // Alex=strong, Maria=good, James=avg, Priya=struggling, Ethan=top
    let resultCount = 0

    for (let i = 0; i < STUDENTS.length; i++) {
      const student = STUDENTS[i]
      const rate = correctRates[i]

      // Micro result
      // Use short IDs: result_micro_student1, result_macro_student2, etc.
      const studentNum = i + 1

      const microResult = generateTestResult(student.id, MICRO_TEST_ID, 'AP_MICRO', [...MICRO_MCQ_QUESTIONS, ...MICRO_MCQ_MULTI_QUESTIONS], MICRO_FRQ_QUESTIONS, rate, 14 - i)
      await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_micro_student${studentNum}`), {
        ...microResult,
        teacherId: actualTeacherId,
        studentName: student.displayName,
        studentEmail: student.email,
        testTitle: 'AP Microeconomics Practice Exam',
        classId: 'class_econ_p1',
      })
      resultCount++

      // Macro result
      const macroResult = generateTestResult(student.id, MACRO_TEST_ID, 'AP_MACRO', MACRO_MCQ_QUESTIONS, MACRO_FRQ_QUESTIONS, rate * 0.95, 7 - i)
      await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_macro_student${studentNum}`), {
        ...macroResult,
        teacherId: actualTeacherId,
        studentName: student.displayName,
        studentEmail: student.email,
        testTitle: 'AP Macroeconomics Practice Exam',
        classId: 'class_econ_p1',
      })
      resultCount++

      // Calc result (only 3 students have completed it)
      if (i < 3) {
        const calcResult = generateTestResult(student.id, CALC_TEST_ID, 'AP_CALC_AB', CALC_MCQ_QUESTIONS, CALC_FRQ_QUESTIONS, rate * 0.9, 3 - i)
        await setDoc(doc(db, COLLECTIONS.TEST_RESULTS, `result_calc_student${studentNum}`), {
          ...calcResult,
          teacherId: actualTeacherId,
          studentName: student.displayName,
          studentEmail: student.email,
          testTitle: 'AP Calculus AB Practice Exam',
          classId: 'class_calc_p3',
        })
        resultCount++
      }
    }
    console.log('Created', resultCount, 'test results')

    console.log('\n=== SEED COMPLETE ===')
    console.log('3 tests (Micro, Macro, Calc AB)')
    console.log('51 questions (45 MCQ + 6 FRQ)')
    console.log('1 teacher + 5 students')
    console.log('2 classes')
    console.log('3 assignments')
    console.log(resultCount, 'test results')
    console.log('\nTeacher ID:', actualTeacherId)
    console.log('To use your own account as teacher, run: seedFullData(yourUid)')

    return {
      teacherId: actualTeacherId,
      testIds: [MICRO_TEST_ID, MACRO_TEST_ID, CALC_TEST_ID],
      studentIds: STUDENT_IDS,
      classIds: CLASSES.map(c => c.id),
    }
  } catch (error) {
    console.error('Seed error:', error)
    throw error
  }
}

export default seedFullData
