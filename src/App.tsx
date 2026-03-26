import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import SignUpPage from '@/pages/SignUpPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import WorkoutsPage from '@/pages/WorkoutsPage'
import WorkoutSessionPage from '@/pages/WorkoutSessionPage'
import ExercisesPage from '@/pages/ExercisesPage'
import ProgramsPage from '@/pages/ProgramsPage'
import ProgramDetailPage from '@/pages/ProgramDetailPage'
import RecordsPage from '@/pages/RecordsPage'
import BodyPage from '@/pages/BodyPage'
import SettingsPage from '@/pages/SettingsPage'
import DataPage from '@/pages/DataPage'
import WeeklyPlanPage from '@/pages/WeeklyPlanPage'
import RecipesPage from '@/pages/RecipesPage'
import RecipeDetailPage from '@/pages/RecipeDetailPage'
import TimersPage from '@/pages/TimersPage'
import StatsPage from '@/pages/StatsPage'
import TodaysWorkoutsPage from '@/pages/TodaysWorkoutsPage'

export default function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="workouts" element={<WorkoutsPage />} />
              <Route path="workouts/today" element={<TodaysWorkoutsPage />} />
              <Route path="workouts/:id" element={<WorkoutSessionPage />} />
              <Route path="exercises" element={<ExercisesPage />} />
              <Route path="programs" element={<ProgramsPage />} />
              <Route path="programs/:id" element={<ProgramDetailPage />} />
              <Route path="plan" element={<WeeklyPlanPage />} />
              <Route path="plan/:programId" element={<WeeklyPlanPage />} />
              <Route path="meals/recipes" element={<RecipesPage />} />
              <Route path="meals/recipes/:id" element={<RecipeDetailPage />} />
              <Route path="timers" element={<TimersPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="records" element={<RecordsPage />} />
              <Route path="body" element={<BodyPage />} />
              <Route path="data" element={<DataPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  )
}
