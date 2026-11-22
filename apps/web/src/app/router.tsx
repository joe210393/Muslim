import { createBrowserRouter, Navigate, useParams } from "react-router";
import { FeatureGuard, Guard, Shell } from "../components/shell/Shell";
import { AdminApplicationDetail, AdminApplicationList, AdminCertificatesPage, AdminHome, AuditPage, CourseFormPage, EnrollmentAdminPage, ImportsPage, OrganizationsPage, UsersPage } from "../pages/admin/AdminPages";
import { CertificateTemplatesPage } from "../pages/admin/CertificateTemplatesPage";
import {
  BasicCoursesAdminPage,
  CompanyTrainingAdminPage,
  CourseTrainingPage,
  QuestionBankAdminPage,
  TrainingCertificatesAdminPage,
  TrainingPolicyAdminPage,
} from "../pages/admin/TrainingAdminPages";
import { AccountPage, ApplicationDetailPage, ApplicationEditPage, ApplicationListPage, CertificationPage, EnrollmentPage, FileWindowPage, LearningPage, NewApplicationPage, PortalHome, ProfilePage } from "../pages/portal/PortalPages";
import { CmsPage, ContractSealsPage, ContractTemplatesPage, IssueContractPage, IssuedContractDetailPage, IssuedContractsPage, PermissionsPage, ReportsPage } from "../pages/admin/InfoAdminPages";
import { PaymentsPage } from "../pages/admin/PaymentsPage";
import { PortalPaymentsPage, RenewalPage, ResourcePage, SupplementPage } from "../pages/portal/MemberPages";
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
      { path: "/portal/payments", element: <PortalPaymentsPage /> },
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
      { path: "/admin/applications/certificate-templates", element: <Navigate to="/admin/certificates/templates" replace /> },
      { path: "/admin/site-reviews", element: <Navigate to="/admin/applications/second-review" replace /> },
      { path: "/admin/site-reviews/:applicationId", element: <SiteReviewRedirect /> },
      { path: "/admin/contracts/issued", element: <Navigate to="/admin/contracts" replace /> },
      { path: "/admin/users", element: <UsersPage /> },
      { path: "/admin/imports", element: <ImportsPage /> },
      { element: <FeatureGuard anyOf={["cms.edit"]} />, children: [
        { path: "/admin/cms", element: <Navigate to="/admin/cms/home" replace /> },
        { path: "/admin/cms/:page", element: <CmsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["applications.review", "applications.decide"]} />, children: [
        { path: "/admin/applications", element: <AdminApplicationList /> },
        { path: "/admin/applications/initial-review", element: <AdminApplicationList /> },
        { path: "/admin/applications/need-supplement", element: <AdminApplicationList /> },
        { path: "/admin/applications/second-review", element: <AdminApplicationList /> },
        { path: "/admin/applications/final-review", element: <AdminApplicationList /> },
        { path: "/admin/applications/approved", element: <AdminApplicationList /> },
        { path: "/admin/applications/rejected", element: <AdminApplicationList /> },
        { path: "/admin/applications/:applicationId", element: <AdminApplicationDetail /> },
      ] },
      { element: <FeatureGuard anyOf={["applications.decide"]} />, children: [
        { path: "/admin/certificates", element: <AdminCertificatesPage /> },
        { path: "/admin/certificates/issued", element: <AdminCertificatesPage /> },
        { path: "/admin/certificates/templates", element: <CertificateTemplatesPage /> },
      ] },
      { element: <FeatureGuard anyOf={["contracts.issue"]} />, children: [
        { path: "/admin/contracts", element: <IssuedContractsPage /> },
        { path: "/admin/contracts/issued/:contractId", element: <IssuedContractDetailPage /> },
        { path: "/admin/contracts/issue", element: <IssueContractPage /> },
        { path: "/admin/contracts/templates", element: <ContractTemplatesPage /> },
        { path: "/admin/contracts/seals", element: <ContractSealsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["payments.manage"]} />, children: [
        { path: "/admin/payments", element: <PaymentsPage /> },
        { path: "/admin/payments/plans", element: <PaymentsPage /> },
        { path: "/admin/payments/reconciliation", element: <PaymentsPage /> },
        { path: "/admin/payments/accounting", element: <PaymentsPage /> },
        { path: "/admin/payments/record", element: <PaymentsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["training.manage"]} />, children: [
        { path: "/admin/courses", element: <CourseTrainingPage /> },
        { path: "/admin/courses/new", element: <CourseFormPage /> },
        { path: "/admin/courses/:courseId/edit", element: <CourseFormPage /> },
        { path: "/admin/courses/:courseId/enrollments", element: <EnrollmentAdminPage /> },
        { path: "/admin/training/basic", element: <BasicCoursesAdminPage /> },
        { path: "/admin/training/question-bank", element: <QuestionBankAdminPage /> },
        { path: "/admin/training/policy", element: <TrainingPolicyAdminPage /> },
        { path: "/admin/training/company-requests", element: <CompanyTrainingAdminPage /> },
        { path: "/admin/training/certificates", element: <TrainingCertificatesAdminPage /> },
      ] },
      { element: <FeatureGuard anyOf={["reports.export"]} />, children: [
        { path: "/admin/reports", element: <ReportsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["users.manage"]} />, children: [
        { path: "/admin/permissions", element: <PermissionsPage /> },
        { path: "/admin/organizations", element: <OrganizationsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["audit.view"]} />, children: [
        { path: "/admin/audit-logs", element: <AuditPage /> },
      ] },
    ] },
  ] },
  { path: "/files/:fileId", element: <FileWindowPage /> },
  { path: "*", element: <p className="p-6">找不到這個頁面。</p> },
]);

function SiteReviewRedirect() {
  const { applicationId = "" } = useParams();
  return <Navigate to={`/admin/applications/${applicationId}`} replace />;
}
