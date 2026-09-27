import { ApplicationStatus, UserRole } from "@mf/db/enums";

export type Actor = {
  id: string;
  role: UserRole;
  organizationId: string | null;
  isActive: boolean;
};

export type ApplicationAccess = {
  organizationId: string;
  assignedToId: string | null;
  status: ApplicationStatus;
};

export const rolePermissions = {
  [UserRole.APPLICANT]: {
    manageOwnOrganization: true,
    createDraft: true,
    reviewCases: false,
    finalDecision: false,
    assignCases: false,
    manageCourses: false,
    recordAttendance: false,
    manageUsers: false,
    viewAllOrganizations: false,
    viewAudit: false,
    importData: false,
  },
  [UserRole.CASE_OFFICER]: {
    manageOwnOrganization: false,
    createDraft: false,
    reviewCases: true,
    finalDecision: false,
    assignCases: false,
    manageCourses: true,
    recordAttendance: true,
    manageUsers: false,
    viewAllOrganizations: false,
    viewAudit: false,
    importData: false,
  },
  [UserRole.ADMIN]: {
    manageOwnOrganization: false,
    createDraft: false,
    reviewCases: true,
    finalDecision: true,
    assignCases: true,
    manageCourses: true,
    recordAttendance: true,
    manageUsers: true,
    viewAllOrganizations: true,
    viewAudit: true,
    importData: true,
  },
} as const;

export function canViewApplication(actor: Actor, application: ApplicationAccess): boolean {
  if (!actor.isActive) return false;
  if (actor.role === UserRole.ADMIN) return true;
  if (actor.role === UserRole.APPLICANT) {
    return actor.organizationId !== null && actor.organizationId === application.organizationId;
  }
  return application.assignedToId === actor.id;
}

export function canEditApplicationContent(actor: Actor, application: ApplicationAccess): boolean {
  if (actor.role !== UserRole.APPLICANT) return false;
  if (!canViewApplication(actor, application)) return false;
  return (
    application.status === ApplicationStatus.DRAFT ||
    application.status === ApplicationStatus.NEED_SUPPLEMENT
  );
}

export function canDownloadApplicationFile(actor: Actor, application: ApplicationAccess): boolean {
  return canViewApplication(actor, application);
}

export function homePathForRole(role: UserRole): string {
  if (role === UserRole.APPLICANT) return "/portal";
  return "/admin";
}
