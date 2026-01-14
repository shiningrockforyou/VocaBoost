import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Gradebook from './pages/Gradebook.jsx'
import ListLibrary from './pages/ListLibrary.jsx'
import ListEditor from './pages/ListEditor.jsx'
import ClassDetail from './pages/ClassDetail.jsx'
import DailySessionFlow from './pages/DailySessionFlow.jsx'
import BlindSpotCheck from './pages/BlindSpotCheck.jsx'
import MCQTest from './pages/MCQTest.jsx'
import TypedTest from './pages/TypedTest.jsx'
import Settings from './pages/Settings.jsx'
import { queryStudentAttempts } from './services/db'
import PrivateRoute from './components/PrivateRoute.jsx'
import TeacherRoute from './components/TeacherRoute.jsx'
import { SimulationProvider, isSimulationEnabled } from './hooks/useSimulation.jsx'
import SimulationPanel from './components/dev/SimulationPanel.jsx'
import { apBoostRoutes } from './apBoost'

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <SimulationProvider>
        <BrowserRouter>
        {/* Simulation Panel - only renders when VITE_SIMULATION_MODE=true */}
        {isSimulationEnabled() && <SimulationPanel />}
        <Routes>
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/lists"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <ListLibrary />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/lists/new"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <ListEditor mode="create" />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/lists/:listId"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <ListEditor />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/classes/:classId"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <ClassDetail />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/session/:classId/:listId"
            element={
              <PrivateRoute>
                <DailySessionFlow />
              </PrivateRoute>
            }
          />
          <Route
            path="/blindspots/:classId/:listId"
            element={
              <PrivateRoute>
                <BlindSpotCheck />
              </PrivateRoute>
            }
          />
          <Route
            path="/mcqtest/:classId/:listId"
            element={
              <PrivateRoute>
                <MCQTest />
              </PrivateRoute>
            }
          />
          <Route
            path="/typedtest/:classId/:listId"
            element={
              <PrivateRoute>
                <TypedTest />
              </PrivateRoute>
            }
          />
          <Route
            path="/gradebook"
            element={
              <PrivateRoute>
                <Gradebook
                  role="student"
                  queryFn={queryStudentAttempts}
                  showNameColumn={false}
                  showNameFilter={false}
                  showAiReasoning={false}
                  challengeMode="submit"
                />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/gradebook"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <Gradebook
                    role="teacher"
                    showNameColumn={true}
                    showNameFilter={true}
                    showAiReasoning={true}
                    challengeMode="review"
                  />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            }
          />
          {/* AP Boost Routes */}
          {apBoostRoutes}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
        </SimulationProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App
