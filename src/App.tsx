import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { useAuth } from '@/features/auth/AuthContext';
import { Spinner } from '@/components/common/Spinner';
import { ROLE_HOME } from '@/types';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const ComingSoonPage = lazy(() => import('@/pages/ComingSoonPage'));

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const SubjectsPage = lazy(() => import('@/pages/admin/SubjectsPage'));
const ClassesPage = lazy(() => import('@/pages/admin/ClassesPage'));
const TermsPage = lazy(() => import('@/pages/admin/TermsPage'));
const TeachersPage = lazy(() => import('@/pages/admin/TeachersPage'));
const StudentsPage = lazy(() => import('@/pages/admin/StudentsPage'));
const AssignmentsPage = lazy(() => import('@/pages/admin/AssignmentsPage'));

const TeacherDashboard = lazy(() => import('@/pages/teacher/TeacherDashboard'));
const MyClassesPage = lazy(() => import('@/pages/teacher/MyClassesPage'));
const MySubjectsPage = lazy(() => import('@/pages/teacher/MySubjectsPage'));
const SchemePage = lazy(() => import('@/pages/teacher/SchemePage'));
const LessonsPage = lazy(() => import('@/pages/teacher/LessonsPage'));
const LessonFormPage = lazy(() => import('@/pages/teacher/LessonFormPage'));
const SlideEditorPage = lazy(() => import('@/pages/teacher/SlideEditorPage'));
const UpcomingTopicsPage = lazy(() => import('@/pages/teacher/UpcomingTopicsPage'));

const StudentDashboard = lazy(() => import('@/pages/student/StudentDashboard'));
const StudentSubjectsPage = lazy(() => import('@/pages/student/StudentSubjectsPage'));
const StudentLessonsPage = lazy(() => import('@/pages/student/StudentLessonsPage'));
const LessonViewerPage = lazy(() => import('@/pages/student/LessonViewerPage'));
const StudentSchemePage = lazy(() => import('@/pages/student/StudentSchemePage'));
const StudentUpcomingPage = lazy(() => import('@/pages/student/StudentUpcomingPage'));
const ExerciseEditorPage = lazy(() => import('@/pages/teacher/ExerciseEditorPage'));
const StudentExercisesPage = lazy(() => import('@/pages/student/StudentExercisesPage'));
const ExercisePage = lazy(() => import('@/pages/student/ExercisePage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));

function RoleRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <Spinner fullScreen />;
  return <Navigate to={profile ? ROLE_HOME[profile.role] : '/login'} replace />;
}

const soon = (title: string) => <ComingSoonPage title={title} />;

export default function App() {
  return (
    <Suspense fallback={<Spinner fullScreen />}>
      <Routes>
        <Route path="/" element={<RoleRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        <Route element={<ProtectedRoute role="admin" />}>
          <Route path="/admin" element={<DashboardLayout role="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="teachers" element={<TeachersPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="assignments" element={<AssignmentsPage />} />
            <Route path="lessons" element={soon('Lessons Overview')} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="teacher" />}>
          <Route path="/teacher" element={<DashboardLayout role="teacher" />}>
            <Route index element={<TeacherDashboard />} />
            <Route path="classes" element={<MyClassesPage />} />
            <Route path="subjects" element={<MySubjectsPage />} />
            <Route path="schemes" element={<SchemePage />} />
            <Route path="upcoming" element={<UpcomingTopicsPage />} />
            <Route path="lessons" element={<LessonsPage />} />
            <Route path="lessons/new" element={<LessonFormPage />} />
            <Route path="lessons/:id" element={<LessonFormPage />} />
            <Route path="lessons/:id/slides" element={<SlideEditorPage />} />
            <Route path="lessons/:id/exercise" element={<ExerciseEditorPage />} />
            <Route path="editor" element={<LessonsPage title="Slide Editor" rowTarget="slides" />} />
            <Route path="published" element={<LessonsPage fixedStatus="published" title="Published Lessons" />} />
            <Route path="progress" element={soon('Student Progress')} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute role="student" />}>
          <Route path="/student" element={<DashboardLayout role="student" />}>
            <Route index element={<StudentDashboard />} />
            <Route path="subjects" element={<StudentSubjectsPage />} />
            <Route path="lessons" element={<StudentLessonsPage />} />
            <Route path="lessons/:id" element={<LessonViewerPage />} />
            <Route path="exercises" element={<StudentExercisesPage />} />
            <Route path="exercises/:id" element={<ExercisePage />} />
            <Route path="scheme" element={<StudentSchemePage />} />
            <Route path="upcoming" element={<StudentUpcomingPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
