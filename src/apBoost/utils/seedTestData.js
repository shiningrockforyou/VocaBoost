/**
 * Seed Test Data for AP Boost
 *
 * Run this in the browser console or import and call seedAPTestData()
 * to populate Firestore with sample test data for development.
 */

import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { COLLECTIONS, QUESTION_TYPE, QUESTION_FORMAT, SECTION_TYPE, TEST_TYPE, QUESTION_ORDER } from './apTypes'

/**
 * Create sample test data in Firestore
 */
export async function seedAPTestData() {
  console.log('Seeding AP test data...')

  try {
    // Create test document
    const testId = 'test_apush_practice_1'
    await setDoc(doc(db, COLLECTIONS.TESTS, testId), {
      title: 'AP US History Practice Exam #1',
      subject: 'AP_US_HISTORY',
      testType: TEST_TYPE.EXAM,
      createdBy: 'system',
      isPublic: true,
      questionOrder: QUESTION_ORDER.FIXED,
      sections: [
        {
          id: 'section1',
          title: 'Multiple Choice',
          sectionType: SECTION_TYPE.MCQ,
          timeLimit: 45, // 45 minutes
          questionIds: ['q1', 'q2', 'q3', 'q4', 'q5'],
          mcqMultiplier: 1.0,
          calculatorEnabled: false,
        }
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
    console.log('Created test:', testId)

    // Create question documents
    const questions = [
      {
        id: 'q1',
        testId,
        subject: 'AP_US_HISTORY',
        questionType: QUESTION_TYPE.MCQ,
        format: QUESTION_FORMAT.VERTICAL,
        questionDomain: 'Unit 3: Colonial America',
        questionTopic: 'Colonial Economy',
        difficulty: 'MEDIUM',
        questionText: 'Which of the following best describes the economic system that developed in the colonial Chesapeake region during the 17th century?',
        choiceA: { text: 'A diversified economy based on small family farms' },
        choiceB: { text: 'A plantation economy based on tobacco cultivation and enslaved labor' },
        choiceC: { text: 'An industrial economy centered on textile manufacturing' },
        choiceD: { text: 'A fishing and shipbuilding economy similar to New England' },
        choiceCount: 4,
        correctAnswers: ['B'],
        partialCredit: false,
        explanation: 'The Chesapeake colonies (Virginia and Maryland) developed a plantation economy centered on tobacco cultivation, which relied heavily on enslaved African labor by the late 17th century.',
        points: 1,
      },
      {
        id: 'q2',
        testId,
        subject: 'AP_US_HISTORY',
        questionType: QUESTION_TYPE.MCQ,
        format: QUESTION_FORMAT.VERTICAL,
        questionDomain: 'Unit 4: Revolutionary America',
        questionTopic: 'Causes of Revolution',
        difficulty: 'EASY',
        questionText: 'The Stamp Act of 1765 was significant because it:',
        choiceA: { text: 'Established direct taxation on the colonies by Parliament' },
        choiceB: { text: 'Closed Boston Harbor to all trade' },
        choiceC: { text: 'Quartered British soldiers in colonial homes' },
        choiceD: { text: 'Prohibited settlement west of the Appalachian Mountains' },
        choiceCount: 4,
        correctAnswers: ['A'],
        partialCredit: false,
        explanation: 'The Stamp Act was the first direct tax levied on the colonies by Parliament, requiring colonists to pay a tax on printed materials. This sparked widespread protest and the famous slogan "no taxation without representation."',
        points: 1,
      },
      {
        id: 'q3',
        testId,
        subject: 'AP_US_HISTORY',
        questionType: QUESTION_TYPE.MCQ,
        format: QUESTION_FORMAT.VERTICAL,
        questionDomain: 'Unit 5: Early Republic',
        questionTopic: 'Constitutional Convention',
        difficulty: 'MEDIUM',
        questionText: 'The Three-Fifths Compromise addressed which issue at the Constitutional Convention?',
        choiceA: { text: 'How to elect the President' },
        choiceB: { text: 'How to count enslaved people for representation and taxation' },
        choiceC: { text: 'How to regulate interstate commerce' },
        choiceD: { text: 'How to amend the Constitution' },
        choiceCount: 4,
        correctAnswers: ['B'],
        partialCredit: false,
        explanation: 'The Three-Fifths Compromise determined that three-fifths of the enslaved population would be counted for both representation in Congress and direct taxation, resolving a dispute between Northern and Southern states.',
        points: 1,
      },
      {
        id: 'q4',
        testId,
        subject: 'AP_US_HISTORY',
        questionType: QUESTION_TYPE.MCQ,
        format: QUESTION_FORMAT.HORIZONTAL,
        questionDomain: 'Unit 6: Market Revolution',
        questionTopic: 'Industrial Development',
        difficulty: 'HARD',
        questionText: 'Based on the passage above, which of the following best describes the author\'s view of early American manufacturing?',
        stimulus: {
          type: 'PASSAGE',
          title: 'Document A: Observations on American Manufacturing',
          content: '"The factory system, as introduced into this country, has been more humane and beneficial than it was in England. The hours of labor are shorter, the wages higher, and the operatives are better educated and more intelligent..."',
          source: 'Harriet Martineau, Society in America, 1837',
          tags: ['primary-source', 'industrial-revolution', 'market-revolution'],
        },
        choiceA: { text: 'American factories were worse than their English counterparts' },
        choiceB: { text: 'American factories offered better conditions than English factories' },
        choiceC: { text: 'Factory work was unsuitable for American workers' },
        choiceD: { text: 'The factory system should be abolished in America' },
        choiceCount: 4,
        correctAnswers: ['B'],
        partialCredit: false,
        explanation: 'The passage explicitly states that American factories were "more humane and beneficial" than English factories, with shorter hours, higher wages, and better-educated workers.',
        points: 1,
      },
      {
        id: 'q5',
        testId,
        subject: 'AP_US_HISTORY',
        questionType: QUESTION_TYPE.MCQ,
        format: QUESTION_FORMAT.VERTICAL,
        questionDomain: 'Unit 7: Civil War Era',
        questionTopic: 'Causes of Civil War',
        difficulty: 'MEDIUM',
        questionText: 'The Kansas-Nebraska Act of 1854 is most significant because it:',
        choiceA: { text: 'Ended the institution of slavery in Kansas' },
        choiceB: { text: 'Repealed the Missouri Compromise line of 36°30\'' },
        choiceC: { text: 'Admitted California as a free state' },
        choiceD: { text: 'Established the Underground Railroad' },
        choiceCount: 4,
        correctAnswers: ['B'],
        partialCredit: false,
        explanation: 'The Kansas-Nebraska Act effectively repealed the Missouri Compromise by allowing popular sovereignty to determine the status of slavery in the new territories, regardless of their location relative to the 36°30\' line.',
        points: 1,
      },
    ]

    for (const question of questions) {
      const { id, ...questionData } = question
      await setDoc(doc(db, COLLECTIONS.QUESTIONS, id), {
        ...questionData,
        createdBy: 'system',
        createdAt: serverTimestamp(),
      })
      console.log('Created question:', id)
    }

    console.log('Seed data complete!')
    return { testId, questionIds: questions.map(q => q.id) }
  } catch (error) {
    console.error('Error seeding data:', error)
    throw error
  }
}

/**
 * Delete all seeded test data
 */
export async function clearAPTestData() {
  console.log('Clearing AP test data...')
  // This would delete the seeded documents
  // Implementation depends on Firestore batch operations
  console.log('Clear function not fully implemented - delete documents manually')
}

export default seedAPTestData
