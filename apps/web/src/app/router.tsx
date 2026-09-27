import { createBrowserRouter } from "react-router";
import { Guard, Shell } from "../components/shell/Shell";
import { AdminApplicationDetail, AdminApplicationList, AdminHome, AuditPage, CourseFormPage, CourseListPage, EnrollmentAdminPage, ImportsPage, OrganizationsPage, UsersPage } from "../pages/admin/AdminPages";
import { AccountPage, ApplicationDetailPage, ApplicationEditPage, ApplicationListPage, CertificationPage, EnrollmentPage, LearningPage, NewApplicationPage, PortalHome, ProfilePage } from "../pages/portal/PortalPages";
import { CourseDetailPage, CoursesPage, ForgotPage, GuidePage, HomePage, LoginPage, RegisterPage, ResetPage } from "../pages/public/PublicPages";

export const router = createBrowserRouter([
  { element: <Shell area="public" />, children: [
    { path: "/", element: <HomePage /> },
    { path: "/guide", element: <GuidePage /> },
    { path: "/courses", element: <CoursesPage /> },
    { path: "/courses/:courseId", element: <CourseDetailPage /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    { path: "/forgot-password", element: <ForgotPage /> },
    { path: "/reset-password", element: <ResetPage /> },
  ] },
  { element: <Shell area="portal" />, children: [
    { element: <Guard allow={["APPLICANT"]} />, children: [
      { path: "/portal", element: <PortalHome /> },
      { path: "/portal/profile", element: <ProfilePage /> },
      { path: "/portal/account", element: <AccountPage /> },
      { path: "/portal/applications", element: <ApplicationListPage /> },
      { path: "/portal/applications/new", element: <NewApplicationPage /> },
      { path: "/portal/applications/:applicationId/edit", element: <ApplicationEditPage /> },
      { path: "/portal/applications/:applicationId", element: <ApplicationDetailPage /> },
      { path: "/portal/enrollments", element: <EnrollmentPage /> },
      { path: "/portal/learning-records", element: <LearningPage /> },
      { path: "/portal/certifications", element: <CertificationPage /> },
    ] },
  ] },
  { element: <Shell area="admin" />, children: [
    { element: <Guard allow={["ADMIN", "CASE_OFFICER"]} />, children: [
      { path: "/admin", element: <AdminHome /> },
      { path: "/admin/applications", element: <AdminApplicationList /> },
      { path: "/admin/applications/:applicationId", element: <AdminApplicationDetail /> },
      { path: "/admin/courses", element: <CourseListPage /> },
      { path: "/admin/courses/new", element: <CourseFormPage /> },
      { path: "/admin/courses/:courseId/edit", element: <CourseFormPage /> },
      { path: "/admin/courses/:courseId/enrollments", element: <EnrollmentAdminPage /> },
      { path: "/admin/users", element: <UsersPage /> },
      { path: "/admin/organizations", element: <OrganizationsPage /> },
      { path: "/admin/imports", element: <ImportsPage /> },
      { path: "/admin/audit-logs", element: <AuditPage /> },
    ] },
  ] },
  { path: "*", element: <p className="p-6">找不到這個頁面。</p> },
]);
