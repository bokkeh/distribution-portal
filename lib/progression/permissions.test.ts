import assert from 'node:assert/strict'
import test from 'node:test'
import { canViewMember, getProgressionPermissions } from './permissions'

test('admin gets every capability regardless of own level', () => {
  const perms = getProgressionPermissions(['admin'], null)
  assert.equal(perms.isAdmin, true)
  assert.equal(perms.canAssignRank, true)
  assert.equal(perms.canApprovePromotion, true)
  assert.equal(perms.canConfigureRankRequirements, true)
  assert.equal(perms.canOverrideRequirements, true)
})

test('a plain team member below the trainer threshold has no manager capabilities', () => {
  const perms = getProgressionPermissions(['taster'], 2)
  assert.equal(perms.isTrainer, false)
  assert.equal(perms.isSalesLeader, false)
  assert.equal(perms.canAssignRank, false)
  assert.equal(perms.canRecommendPromotion, false)
  assert.equal(perms.canMarkRequirementComplete, false)
})

test('reaching the trainer level threshold (Brand Guide, level 4) grants trainer capabilities but not sales-leader or admin ones', () => {
  const perms = getProgressionPermissions(['taster'], 4)
  assert.equal(perms.isTrainer, true)
  assert.equal(perms.isSalesLeader, false)
  assert.equal(perms.canRecommendPromotion, true)
  assert.equal(perms.canRecordTraining, true)
  assert.equal(perms.canAssignRank, false, 'only admins execute an actual rank change')
  assert.equal(perms.canApprovePromotion, false)
})

test('reaching the sales-leader threshold (Territory Lead, level 7) grants sales-leader and trainer capabilities', () => {
  const perms = getProgressionPermissions(['sales_rep'], 7)
  assert.equal(perms.isSalesLeader, true)
  assert.equal(perms.isTrainer, true)
  assert.equal(perms.canMarkRequirementComplete, true)
  assert.equal(perms.canViewAllMembers, true)
  assert.equal(perms.canAssignRank, false)
})

test('the sales_manager role grants sales-leader capabilities even at a low level', () => {
  const perms = getProgressionPermissions(['sales_manager'], 1)
  assert.equal(perms.isSalesLeader, true)
  assert.equal(perms.canRecommendPromotion, true)
})

test('canViewMember: self always visible even without manager-wide visibility', () => {
  const perms = getProgressionPermissions(['taster'], 1)
  assert.equal(canViewMember(perms, 'u1', 'u1', null), true)
  assert.equal(canViewMember(perms, 'u1', 'u2', null), false)
})

test('canViewMember: a direct manager can view their report even without org-wide visibility', () => {
  const perms = getProgressionPermissions(['taster'], 4) // trainer, not sales leader -> no canViewAllMembers
  assert.equal(perms.canViewAllMembers, false)
  assert.equal(canViewMember(perms, 'manager-1', 'report-1', 'manager-1'), true)
  assert.equal(canViewMember(perms, 'manager-1', 'stranger-1', 'someone-else'), false)
})

test('canViewMember: admins and sales leaders see everyone', () => {
  const perms = getProgressionPermissions(['admin'], null)
  assert.equal(canViewMember(perms, 'admin-1', 'anyone', null), true)
})
