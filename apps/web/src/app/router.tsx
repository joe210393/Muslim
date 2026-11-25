import { SITE_BUILTIN_PAGES } from "@mf/contracts";
import { createBrowserRouter, Navigate, useParams } from "react-router";
import { FeatureGuard, Guard, Shell } from "../components/shell/Shell";
import { AdminApplicationDetail, AdminApplicationList, AdminCertificatesPage, AdminHome, AuditPage, CourseFormPage, EnrollmentAdminPage, ImportsPage, OrganizationsPage, UsersPage } from "../pages/admin/AdminPages";
import { CertificateTemplatesPage } from "../pages/admin/CertificateTemplatesPage";
import { CategoryFormsPage } from "../pages/admin/CategoryFormsPage";
import { SystemSettingsPage } from "../pages/admin/SystemSettingsPage";
import {
  BasicCoursesAdminPage,
  CompanyTrainingAdminPage,
  CourseTrainingPage,
  QuestionBankAdminPage,
  TrainingCertificatesAdminPage,
  TrainingPolicyAdminPage,
} from "../pages/admin/TrainingAdminPages";
import { AccountPage, ApplicationDetailPage, ApplicationEditPage, ApplicationListPage, CertificationPage, FileWindowPage, LearningPage, NewApplicationPage, PortalHome, ProfilePage } from "../pages/portal/PortalPages";
import { PortalNoticesPage, AdminNoticesPage, OrganizationMailPage } from "../pages/NoticesPage";
import { TrainingSectionPage } from "../pages/portal/TrainingSections";
import { ContractSealsPage, ContractTemplatesPage, IssueContractPage, IssuedContractDetailPage, IssuedContractsPage, PermissionsPage, ReportsPage } from "../pages/admin/InfoAdminPages";
import { PaymentsPage } from "../pages/admin/PaymentsPage";
import { PortalPaymentsPage, RenewalPage, ResourcePage, SupplementPage } from "../pages/portal/MemberPages";
import { ContractPage, ContractSignPage } from "../pages/portal/ContractFlow";
import { NewsDetailPage } from "../pages/public/InfoPages";
import { CourseDetailPage, ForgotPage, LoginPage, RegisterPage, ResetPage } from "../pages/public/PublicPages";
import { LivePublicLayout, PageFrame, PublishedPage, SitePageView } from "../pages/public/preview/PreviewSite";
import { SiteStudio } from "../pages/public/preview/PreviewStudio";

export const router = createBrowserRouter([
  { element: <LivePublicLayout />, children: [
    ...SITE_BUILTIN_PAGES.map((page) => ({ path: page.path, element: <SitePageView key={page.slug} slug={page.slug} /> })),
    { path: "/p/:slug", element: <PublishedPage /> },
    { element: <PageFrame />, children: [
      { path: "/news/:slug", element: <NewsDetailPage /> },
      { path: "/courses/:courseId", element: <CourseDetailPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/forgot-password", element: <ForgotPage /> },
      { path: "/reset-password", element: <ResetPage /> },
    ] },
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
      { path: "/portal/enrollments", element: <Navigate to="/portal/training/online" replace /> },
      { path: "/portal/training/:section", element: <TrainingSectionPage /> },
      { path: "/portal/learning-records", element: <LearningPage /> },
      { path: "/portal/certifications", element: <CertificationPage /> },
      { path: "/portal/notices", element: <PortalNoticesPage /> },
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
        { path: "/admin/cms", element: <Navigate to="/admin/studio" replace /> },
        { path: "/admin/cms/:page", element: <CmsRedirect /> },
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
        { path: "/admin/application-forms", element: <CategoryFormsPage /> },
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
      { element: <FeatureGuard anyOf={["users.manage", "payments.manage"]} />, children: [
        { path: "/admin/settings", element: <SystemSettingsPage /> },
      ] },
      { element: <FeatureGuard anyOf={["users.manage"]} />, children: [
        { path: "/admin/permissions", element: <PermissionsPage /> },
        { path: "/admin/organizations", element: <OrganizationsPage /> },
        { path: "/admin/organizations/:organizationId", element: <OrganizationMailPage /> },
        { path: "/admin/notifications", element: <AdminNoticesPage /> },
        { path: "/admin/notifications/all", element: <AdminNoticesPage /> },
        { path: "/admin/notifications/templates", element: <AdminNoticesPage /> },
      ] },
      { element: <FeatureGuard anyOf={["audit.view"]} />, children: [
        { path: "/admin/audit-logs", element: <AuditPage /> },
      ] },
    ] },
  ] },
  { path: "/guide", element: <Navigate to="/verification" replace /> },
  { path: "/preview", element: <Navigate to="/" replace /> },
  { path: "/preview/:page", element: <PreviewRedirect /> },
  { element: <Guard allow={["ADMIN", "CASE_OFFICER"]} />, children: [
    { element: <FeatureGuard anyOf={["cms.edit"]} />, children: [
      { path: "/admin/studio", element: <SiteStudio /> },
    ] },
  ] },
  { path: "/files/:fileId", element: <FileWindowPage /> },
  { path: "*", element: <p className="p-6">找不到這個頁面。</p> },
]);

const previewPaths: Record<string, string> = { verify: "/verification", login: "/login", studio: "/admin/studio" };

function PreviewRedirect() {
  const { page = "" } = useParams();
  const known = SITE_BUILTIN_PAGES.find((item) => item.slug === page);
  return <Navigate to={previewPaths[page] ?? known?.path ?? "/"} replace />;
}

const cmsPages: Record<string, string> = { home: "home", about: "about", news: "news", faq: "faq", training: "courses", verification: "verification" };

function CmsRedirect() {
  const { page = "" } = useParams();
  if (page === "support") return <Navigate to="/admin/settings" replace />;
  return <Navigate to={cmsPages[page] ? `/admin/studio?page=${cmsPages[page]}` : "/admin/studio"} replace />;
}

function SiteReviewRedirect() {
  const { applicationId = "" } = useParams();
  return <Navigate to={`/admin/applications/${applicationId}`} replace />;
}
