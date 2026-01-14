import { Route } from 'react-router-dom'
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
import PrivateRoute from '../components/PrivateRoute'

export const apBoostRoutes = (
  <>
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
          <APTeacherDashboard />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/test/:testId/edit"
      element={
        <PrivateRoute>
          <APTestEditor />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/test/:testId/assign"
      element={
        <PrivateRoute>
          <APAssignTest />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/questions"
      element={
        <PrivateRoute>
          <APQuestionBank />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/question/:questionId/edit"
      element={
        <PrivateRoute>
          <APQuestionEditor />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/gradebook"
      element={
        <PrivateRoute>
          <APGradebook />
        </PrivateRoute>
      }
    />
    <Route
      path="/ap/teacher/analytics/:testId"
      element={
        <PrivateRoute>
          <APExamAnalytics />
        </PrivateRoute>
      }
    />
  </>
)
