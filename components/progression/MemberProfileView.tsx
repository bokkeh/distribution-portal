import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getMemberProfile } from '@/actions/progression'
import { Avatar, EligibilityBadge, RankBadge, CareerStagePill, StatTile, formatDate, formatNumber, formatPercent } from '@/components/progression/shared'
import { RequirementChecklist } from '@/components/progression/RequirementChecklist'
import { StarterKitChecklist } from '@/components/progression/StarterKitChecklist'
import { PromotionHistoryList } from '@/components/progression/PromotionHistoryList'
import { RankChangeDialog } from '@/components/progression/RankChangeDialog'
import { RecommendPromotionForm, DecideRecommendationPanel, ScheduleReviewForm, PendingReviewBanner, RecordTrainingForm, RequestReviewButton } from '@/components/progression/ManagerActionsPanel'
import { Button } from '@/components/ui/button'
import { MIN_LEVEL } from '@/lib/progression/ranks'

/**
 * The individual progress profile — shared by the admin roster detail page and the
 * self-service "My Rank" pages under /taster and /sales. Permissions come from the acting
 * user's role + their OWN current level (see lib/progression/permissions.ts); viewing your
 * own record never grants edit rights over it, even if your level would otherwise qualify
 * you as a trainer or sales leader for OTHER people's records.
 */
export async function MemberProfileView({ userId, backHref }: { userId: string; backHref?: string }) {
  const profile = await getMemberProfile(userId)
  if (!profile) notFound()

  const { member, rank, nextRank, level, performance, eligibility, history, starterKit, recommendation, pendingReview, pendingReviewOverdue, permissions, daysAtCurrentLevel, isSelf } = profile
  const canManage = !isSelf || permissions.isAdmin

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} avatarUrl={member.avatarUrl} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{isSelf ? 'My Rank' : member.name}</h1>
            <p className="text-sm text-slate-500">{member.email} · {member.homeRegion ?? 'No market set'}{member.managerName ? ` · Manager: ${member.managerName}` : ''}</p>
          </div>
        </div>
        {canManage && permissions.canAssignRank && (
          <RankChangeDialog
            userId={userId}
            memberName={member.name}
            currentLevel={level}
            suggestedLevel={nextRank?.level}
            trigger={<Button>Change rank</Button>}
          />
        )}
      </div>

      {pendingReview && (
        <PendingReviewBanner
          review={pendingReview}
          canComplete={canManage && permissions.canScheduleReview}
          overdue={pendingReviewOverdue}
        />
      )}

      {/* Rank summary */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <RankBadge level={level} name={rank.name} size="lg" />
          <CareerStagePill stage={rank.careerStage} />
        </div>
        <p className="mt-3 text-sm text-slate-500">{rank.milestone}</p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-slate-400">Rank start date</p><p className="font-medium text-slate-800">{formatDate(profile.assignment?.effectiveAt ?? null)}</p></div>
          <div><p className="text-xs text-slate-400">Assigned by</p><p className="font-medium text-slate-800">{profile.assignment?.assignedByName ?? '—'}</p></div>
          <div><p className="text-xs text-slate-400">Previous rank</p><p className="font-medium text-slate-800">{profile.assignment?.previousLevel != null ? `Level ${profile.assignment.previousLevel}` : '—'}</p></div>
          <div><p className="text-xs text-slate-400">Days at current level</p><p className="font-medium text-slate-800">{daysAtCurrentLevel ?? '—'}</p></div>
        </div>
        {profile.assignment?.reason && <p className="mt-3 text-sm text-slate-600">&ldquo;{profile.assignment.reason}&rdquo;</p>}
      </section>

      {/* Performance summary */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Performance summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatTile label="Tastings completed" value={performance.tastingsCompleted} />
          <StatTile label="Avg tasting hours" value={performance.tastingHours ?? '—'} />
          <StatTile label="Bottles sold" value={formatNumber(performance.bottlesSold)} sublabel={`${formatNumber(performance.tastingBottlesSold)} at tastings, ${formatNumber(performance.repAttributedBottles)} wholesale`} />
          <StatTile label="Cases sold" value={formatNumber(performance.casesSold)} />
          <StatTile label="Avg bottles / tasting" value={formatNumber(performance.avgBottlesPerTasting)} />
          <StatTile label="Avg cases / activation" value={formatNumber(performance.avgCasesPerActivation)} />
          <StatTile label="Accounts opened" value={performance.accountsOpened} />
          <StatTile label="Reorders influenced" value={performance.reordersInfluenced} />
          <StatTile label="Training sessions completed" value={performance.trainingSessionsCompleted} />
          <StatTile label="Team members trained" value={performance.teamMembersTrained} />
          <StatTile label="Reporting completion" value={formatPercent(performance.reportingCompletionPct)} />
          <StatTile label="Reliability / attendance" value={formatPercent(performance.reliabilityPct)} />
        </div>
      </section>

      {/* Starter kit (Level 1) */}
      {level === MIN_LEVEL && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Starter kit</h2>
          <StarterKitChecklist userId={userId} items={starterKit} canEdit={canManage && permissions.canMarkRequirementComplete} />
        </section>
      )}

      {/* Next-rank checklist */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{nextRank ? `Next rank: Level ${nextRank.level} — ${nextRank.name}` : 'Top of the ladder'}</h2>
            {nextRank && <p className="text-sm text-slate-500">{eligibility.requiredCompleteCount} of {eligibility.requiredCount} required items complete</p>}
          </div>
          <EligibilityBadge status={eligibility.status} />
        </div>

        {eligibility.status === 'eligible_for_review' && nextRank && (
          <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            {isSelf ? 'You have' : `${member.name} has`} completed the measurable requirements for Level {nextRank.level}. Manager review is still required.
          </p>
        )}

        {nextRank && (
          <div className="mt-4">
            <RequirementChecklist userId={userId} level={nextRank.level} requirements={eligibility.requirements} canMark={canManage && permissions.canMarkRequirementComplete} canOverride={canManage && permissions.canOverrideRequirements} />
          </div>
        )}

        {nextRank && (
          <div className="mt-4 flex flex-wrap gap-2">
            {recommendation ? (
              canManage && permissions.canApprovePromotion ? <DecideRecommendationPanel recommendation={recommendation} /> : <p className="text-sm text-slate-500">A promotion to Level {nextRank.level} has been recommended and is awaiting admin approval.</p>
            ) : (
              canManage && permissions.canRecommendPromotion && <RecommendPromotionForm userId={userId} nextLevel={nextRank.level} />
            )}
            {canManage && permissions.canScheduleReview && !pendingReview && <ScheduleReviewForm userId={userId} />}
            {isSelf && !pendingReview && <RequestReviewButton />}
          </div>
        )}
      </section>

      {/* Manager: training */}
      {canManage && permissions.canRecordTraining && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">Training</h2>
          <RecordTrainingForm traineeUserId={userId} />
        </section>
      )}

      {/* Promotion history */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">Promotion history</h2>
        <PromotionHistoryList rows={history} />
      </section>

      {backHref && <Link href={backHref} className="inline-block text-sm font-medium text-blue-600 hover:underline">← Back to roster</Link>}
    </div>
  )
}
