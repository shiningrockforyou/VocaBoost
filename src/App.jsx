import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from './pages/Login.jsx'
import Signup from './pages/Signup.jsx'
import { AuthProvider } from './contexts/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Gradebook from './pages/Gradebook.jsx'
import ListLibrary from './pages/ListLibrary.jsx'
import ListEditor from './pages/ListEditor.jsx'
import ClassDetail from './pages/ClassDetail.jsx'
import StudySession from './pages/StudySession.jsx'
import TakeTest from './pages/TakeTest.jsx'
import TeacherGradebook from './pages/TeacherGradebook.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'
import TeacherRoute from './components/TeacherRoute.jsx'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
            path="/study/:listId"
            element={
              <PrivateRoute>
                <StudySession />
              </PrivateRoute>
            }
          />
          <Route
            path="/test/:listId"
            element={
              <PrivateRoute>
                <TakeTest />
              </PrivateRoute>
            }
          />
          <Route
            path="/gradebook"
            element={
              <PrivateRoute>
                <Gradebook />
              </PrivateRoute>
            }
          />
          <Route
            path="/teacher/gradebook"
            element={
              <PrivateRoute>
                <TeacherRoute>
                  <TeacherGradebook />
                </TeacherRoute>
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
