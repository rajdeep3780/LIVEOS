import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  FolderOpen,
  Plus,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PriorityTag,
  SpaceTypeIndicator,
  StatusTag,
} from '../../components/ui/StatusIndicators.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import {
  formatLongDate,
  formatRelativeTime,
  formatShortDate,
  getTimeGreeting,
  isDateOverdue,
} from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import { fetchDashboard } from '../../services/dashboardService.ts';
import type { DashboardData } from '../../types/lifeos.ts';

export function DashboardPage() {
  const { user } = useAuth();
  const { openNewMatterModal, refreshTrigger } = useAppLayout();

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetchDashboard();
      setData(res);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load dashboard data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-8" />
          <div className="h-72 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[#522424] bg-[#211315] p-6">
        <h2 className="font-display text-base font-semibold text-white">
          Unable to load dashboard
        </h2>
        <p className="mt-1 text-sm text-[#FCA5A5]">{error}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            load();
          }}
          className="mt-4 rounded-md bg-[#F97316] px-4 py-2 text-xs font-medium text-white hover:bg-[#EA580C]"
        >
          Retry
        </button>
      </div>
    );
  }

  const counts = data?.counts || { open: 0, inProgress: 0, waiting: 0, completed: 0 };

  const overviewCards = [
    {
      label: 'Open Matters',
      value: counts.open,
      status: 'Open',
      hint: 'Ready to begin',
    },
    {
      label: 'In Progress',
      value: counts.inProgress,
      status: 'In Progress',
      hint: 'Currently underway',
    },
    {
      label: 'Waiting',
      value: counts.waiting,
      status: 'Waiting',
      hint: 'Pending response or external step',
    },
    {
      label: 'Completed',
      value: counts.completed,
      status: 'Completed',
      hint: 'Resolved and closed',
    },
  ];

  const attentionLabels: Record<string, { text: string; tone: string }> = {
    overdue_followup: { text: 'Overdue follow-up', tone: 'text-[#F87171]' },
    upcoming_followup: { text: 'Upcoming follow-up', tone: 'text-[#FBBF24]' },
    waiting_followup: { text: 'Waiting on external', tone: 'text-[#FBBF24]' },
    pending_action: { text: 'Pending next action', tone: 'text-[#9CA3AF]' },
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-[#23262E] bg-[#14161A] p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono text-xs text-[#9CA3AF]">{formatLongDate()}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-white">
            {getTimeGreeting()}, {user?.displayName}
          </h2>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Track what matters, who owns it, and what needs follow-up next.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewMatterModal()}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F97316] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Quick Add Matter</span>
        </button>
      </section>

      {/* Overview Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {overviewCards.map((card) => (
          <Link
            key={card.label}
            to={`/matters?status=${encodeURIComponent(card.status)}`}
            className="group rounded-lg border border-[#23262E] bg-[#14161A] p-4 transition-colors hover:border-[#343842] hover:bg-[#171A20]"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#9CA3AF]">
                {card.label}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-[#6B7280] transition-transform group-hover:translate-x-0.5 group-hover:text-[#F97316]" />
            </div>
            <div className="mt-2 font-mono text-2xl font-semibold text-white tabular-nums">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-[#6B7280]">{card.hint}</div>
          </Link>
        ))}
      </section>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Primary Column: Needs Attention & My Matters */}
        <div className="space-y-6 lg:col-span-8">
          {/* Needs Attention */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-[#23262E] px-5 py-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-[#F97316]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Needs Attention
                </h3>
              </div>
              <Link
                to="/matters"
                className="text-xs font-medium text-[#9CA3AF] hover:text-white"
              >
                View all matters
              </Link>
            </div>

            {data && data.needsAttention.length > 0 ? (
              <div className="divide-y divide-[#20232B]">
                {data.needsAttention.map((matter) => {
                  const reason = attentionLabels[matter.attentionReason];
                  const overdue = isDateOverdue(matter.nextActionAt);
                  return (
                    <Link
                      key={matter.id}
                      to={`/matters/${matter.id}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-[#181B21]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className="truncate text-sm font-medium text-white">
                              {matter.title}
                            </span>
                            <StatusTag status={matter.status} />
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9CA3AF]">
                            <span>{matter.space?.name}</span>
                            <span aria-hidden="true">·</span>
                            <span className={reason.tone}>{reason.text}</span>
                            {matter.status === 'Waiting' && matter.waitingFor && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-[#FBBF24]">
                                  Waiting for: {matter.waitingFor}
                                </span>
                              </>
                            )}
                          </div>

                          {matter.nextAction && (
                            <p className="mt-1.5 text-xs text-[#CBD5E1]">
                              Next: {matter.nextAction}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <PriorityTag priority={matter.priority} />
                          {matter.nextActionAt && (
                            <span
                              className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
                                overdue ? 'text-[#F87171]' : 'text-[#9CA3AF]'
                              }`}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {formatShortDate(matter.nextActionAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-8 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-[#34D399]" />
                <p className="mt-2 text-sm font-medium text-white">
                  All caught up
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  No overdue follow-ups or pending actions right now.
                </p>
              </div>
            )}
          </section>

          {/* My Matters */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-[#23262E] px-5 py-4">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-[#CBD5E1]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-white">
                  My Matters
                </h3>
              </div>
              <Link
                to="/matters?assignedToMe=true"
                className="text-xs font-medium text-[#9CA3AF] hover:text-white"
              >
                See all assigned
              </Link>
            </div>

            {data && data.myMatters.length > 0 ? (
              <div className="divide-y divide-[#20232B]">
                {data.myMatters.map((matter) => (
                  <Link
                    key={matter.id}
                    to={`/matters/${matter.id}`}
                    className="flex flex-col justify-between gap-2 px-5 py-3.5 transition-colors hover:bg-[#181B21] sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="truncate text-sm font-medium text-white">
                          {matter.title}
                        </span>
                        <StatusTag status={matter.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
                        <span>{matter.space?.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{matter.category}</span>
                        {matter.nextAction && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate text-[#CBD5E1]">
                              Next: {matter.nextAction}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-4">
                      {matter.nextActionAt && (
                        <span className="font-mono text-xs text-[#9CA3AF] tabular-nums">
                          {formatShortDate(matter.nextActionAt)}
                        </span>
                      )}
                      <PriorityTag priority={matter.priority} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-medium text-white">
                  No active Matters assigned to you yet
                </p>
                <p className="mt-1 text-xs text-[#9CA3AF]">
                  Create your first Matter to track a repair, follow-up, or
                  responsibility.
                </p>
                <button
                  type="button"
                  onClick={() => openNewMatterModal()}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#EA580C]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create First Matter</span>
                </button>
              </div>
            )}
          </section>
        </div>

        {/* Secondary Column: My Spaces & Recent Activity */}
        <div className="space-y-6 lg:col-span-4">
          {/* My Spaces */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-[#23262E] px-5 py-4">
              <h3 className="font-display text-sm font-semibold text-white">
                My Spaces
              </h3>
              <Link
                to="/spaces"
                className="text-xs font-medium text-[#F97316] hover:text-[#FB923C]"
              >
                Manage spaces
              </Link>
            </div>

            <div className="divide-y divide-[#20232B]">
              {data?.spaces.map((space) => (
                <Link
                  key={space.id}
                  to={`/spaces/${space.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-[#181B21]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">
                      {space.name}
                    </span>
                    <SpaceTypeIndicator type={space.type} />
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-[#9CA3AF] tabular-nums">
                    <span>
                      {space.activeMatterCount}{' '}
                      {space.activeMatterCount === 1 ? 'active matter' : 'active matters'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      {space.memberCount}{' '}
                      {space.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-[#23262E] px-5 py-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#9CA3AF]" aria-hidden="true" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Recent Activity
                </h3>
              </div>
              <Link
                to="/timeline"
                className="text-xs font-medium text-[#9CA3AF] hover:text-white"
              >
                Full timeline
              </Link>
            </div>

            {data && data.recentActivity.length > 0 ? (
              <div className="divide-y divide-[#20232B]">
                {data.recentActivity.map((ev) => (
                  <Link
                    key={ev.id}
                    to={`/matters/${ev.matterId}`}
                    className="block px-5 py-3 transition-colors hover:bg-[#181B21]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-white">
                        {ev.matterTitle}
                      </span>
                      <span className="shrink-0 font-mono text-[11px] text-[#6B7280] tabular-nums">
                        {formatRelativeTime(ev.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[#9CA3AF]">
                      <span className="text-[#CBD5E1]">
                        {ev.authorName || 'System'}:
                      </span>{' '}
                      {ev.message}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="px-5 py-8 text-center text-xs text-[#9CA3AF]">
                Updates and progress notes will appear here chronologically.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
