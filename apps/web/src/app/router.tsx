import { createBrowserRouter, Navigate } from "react-router";
import { Guard, Shell } from "../components/shell/Shell";
import { AdminApplicationDetail, AdminApplicationList, AdminHome, AuditPage, CourseFormPage, CourseListPage, EnrollmentAdminPage, ImportsPage, OrganizationsPage, UsersPage } from "../pages/admin/AdminPages";
import { AccountPage, ApplicationDetailPage, ApplicationEditPage, ApplicationListPage, CertificationPage, EnrollmentPage, LearningPage, NewApplicationPage, PortalHome, ProfilePage } from "../pages/portal/PortalPages";
import { CmsPage, ContractTemplatesPage, IssueContractPage, IssuedContractDetailPage, IssuedContractsPage, PermissionsPage, ReportsPage, SiteReviewDetail, SiteReviewPage } from "../pages/admin/InfoAdminPages";
import { RenewalPage, ResourcePage, SupplementPage } from "../pages/portal/MemberPages";
import { ContractPage, ContractSignPage } from "../pages/portal/ContractFlow";
import { AboutPage, ContactPage, FaqPage, NewsDetailPage, NewsListPage, VerificationPage } from "../pages/public/InfoPages";
import { CourseDetailPage, CoursesPage, ForgotPage, GuidePage, HomePage, LoginPage, RegisterPage, ResetPage } from "../pages/public/PublicPages";

export const router = createBrowserRouter([
  { element: <Shell area="public" />, children: [
    { path: "/", element: <HomePage /> },
    { path: "/about", element: <AboutPage /> },
    { path: "/news", element: <NewsListPage /> },
    { path: "/news/:slug", element: <NewsDetailPage /> },
    { path: "/verification", element: <VerificationPage /> },
    { path: "/guide", element: <GuidePage /> },
    { path: "/faq", element: <FaqPage /> },
    { path: "/contact", element: <ContactPage /> },
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
      { path: "/portal/supplements", element: <SupplementPage /> },
      { path: "/portal/contracts", element: <ContractPage /> },
      { path: "/portal/contracts/:contractId", element: <ContractSignPage /> },
      { path: "/portal/renewals", element: <RenewalPage /> },
      { path: "/portal/resources", element: <ResourcePage /> },
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
      { path: "/admin/cms", element: <Navigate to="/admin/cms/home" replace /> },
      { path: "/admin/cms/:page", element: <CmsPage /> },
      { path: "/admin/applications", element: <AdminApplicationList /> },
      { path: "/admin/site-reviews", element: <SiteReviewPage /> },
      { path: "/admin/site-reviews/:applicationId", element: <SiteReviewDetail /> },
      { path: "/admin/contracts", element: <Navigate to="/admin/contracts/issued" replace /> },
      { path: "/admin/contracts/issued", element: <IssuedContractsPage /> },
      { path: "/admin/contracts/issued/:contractId", element: <IssuedContractDetailPage /> },
      { path: "/admin/contracts/issue", element: <IssueContractPage /> },
      { path: "/admin/contracts/templates", element: <ContractTemplatesPage /> },
      { path: "/admin/reports", element: <ReportsPage /> },
      { path: "/admin/permissions", element: <PermissionsPage /> },
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
