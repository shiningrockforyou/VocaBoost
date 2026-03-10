import { Route, Outlet } from 'react-router-dom'
import APDashboard from './pages/APDashboard'
import APTestSession from './pages/APTestSession'
import APReportCard from './pages/APReportCard'
import APGradebook from './pages/APGradebook'
import APTeacherDashboard from './pages/APTeacherDashboard'
import APTestEditor from './pages/APTestEditor'
import APQuestionBank from './pages/APQuestionBank'
import APQuestionEditor from './pages/APQuestionEditor'
import APAssignTest from './pages/APAssignTest'
import APExamAnalytics from './pages/APExamAnalytics'
import APClassManager from './pages/APClassManager'
import APStudentProfile from './pages/APStudentProfile'
import PrivateRoute from '../components/PrivateRoute'
import TeacherRoute from './components/TeacherRoute'
import APMathProvider from './components/APMathProvider'

/**
 * Layout wrapper that provides MathJax context to all AP routes
 */
function APLayout() {
  return (
    <APMathProvider>
      <Outlet />
    </APMathProvider>
  )
}

export const apBoostRoutes = (
  <Route element={<APLayout />}>
    {/* Student Routes */}
    <Route
      path="/ap"
      element={
        <PrivateRoute>
          <APDashboard />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/test/:testId"
      element={
        <PrivateRoute>
          <APTestSession />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/test/:testId/assignment/:assignmentId"
      element={
        <PrivateRoute>
          <APTestSession />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/results/:resultId"
      element={
        <PrivateRoute>
          <APReportCard />
        </PrivateRoute>
      }
    />

    {/* Teacher Routes */}
    <Route
      path="/ap/teacher"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APTeacherDashboard />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/test/new"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APTestEditor />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/test/:testId/edit"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APTestEditor />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/test/:testId/assign"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APAssignTest />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/questions"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APQuestionBank />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/question/:questionId/edit"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APQuestionEditor />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/gradebook"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APGradebook />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/analytics/:testId"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APExamAnalytics />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/classes"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APClassManager />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/student/:userId"
      element={
        <PrivateRoute>
          <TeacherRoute>
            <APStudentProfile />
          </TeacherRoute>
        </PrivateRoute>
      }
    />
  </Route>
)
