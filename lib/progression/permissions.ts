import { SALES_LEADER_LEVEL_THRESHOLD, TRAINER_LEVEL_THRESHOLD } from './ranks'

/**
 * Team Progression permissions are derived from the acting user's system role plus their
 * own current rank level — there is no separate "trainer" or "sales leader" user role.
 * A Brand Guide (level 4+) automatically gains trainer capabilities; a Territory Lead
 * (level 7+) automatically gains sales-leader capabilities. Administrators always have
 * every capability. This keeps the permission model driven by real, existing data
 * (role + rank) instead of an extra flag to maintain.
 */
export type ProgressionPermissions = {
  isAdmin: boolean
  isSalesLeader: boolean
  isTrainer: boolean
  /** Full visibility into every member's data, not just direct reports/trainees. */
  canViewAllMembers: boolean
  canConfigureRankRequirements: boolean
  /** Executes an actual rank change (promotion, demotion, correction, temporary, override). */
  canAssignRank: boolean
  canApprovePromotion: boolean
  canRecommendPromotion: boolean
  canOverrideRequirements: boolean
  canMarkRequirementComplete: boolean
  canScheduleReview: boolean
  canAddManagerNotes: boolean
  canRecordTraining: boolean
  canManageLeaderboardVisibility: boolean
  canExportReports: boolean
}

export function getProgressionPermissions(roles: string[], ownCurrentLevel: number | null): ProgressionPermissions {
  const isAdmin = roles.includes('admin')
  const isSalesManagerRole = roles.includes('sales_manager')
  const isSalesLeader = isAdmin || isSalesManagerRole || (ownCurrentLevel != null && ownCurrentLevel >= SALES_LEADER_LEVEL_THRESHOLD)
  const isTrainer = isAdmin || isSalesLeader || (ownCurrentLevel != null && ownCurrentLevel >= TRAINER_LEVEL_THRESHOLD)

  return {
    isAdmin,
    isSalesLeader,
    isTrainer,
    canViewAllMembers: isAdmin || isSalesLeader,
    canConfigureRankRequirements: isAdmin,
    canAssignRank: isAdmin,
    canApprovePromotion: isAdmin,
    canRecommendPromotion: isAdmin || isSalesLeader || isTrainer,
    canOverrideRequirements: isAdmin,
    canMarkRequirementComplete: isAdmin || isSalesLeader,
    canScheduleReview: isAdmin || isSalesLeader,
    canAddManagerNotes: isAdmin || isSalesLeader || isTrainer,
    canRecordTraining: isAdmin || isTrainer,
    canManageLeaderboardVisibility: isAdmin,
    canExportReports: isAdmin || isSalesLeader,
  }
}

/** Whether the acting user may view a given member's progression profile. */
export function canViewMember(permissions: ProgressionPermissions, actingUserId: string, memberUserId: string, memberManagerUserId: string | null) {
  if (permissions.canViewAllMembers) return true
  if (actingUserId === memberUserId) return true
  return memberManagerUserId === actingUserId
}
