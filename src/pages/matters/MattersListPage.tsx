import { CalendarClock, Plus, Search, UserCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  PriorityTag,
  StatusTag,
} from '../../components/ui/StatusIndicators.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import { formatShortDate, isDateOverdue } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import { fetchMatters } from '../../services/matterService.ts';
import { fetchSpaces } from '../../services/spaceService.ts';
import type { Matter, SpaceSummary } from '../../types/lifeos.ts';

const STATUS_TABS = [
  'All',
  'Open',
  'In Progress',
  'Waiting',
  'Completed',
  'Archived',
];

export function MattersListPage() {
  const { openNewMatterModal, refreshTrigger } = useAppLayout();
  const [searchParams, setSearchParams] = useSearchParams();

  const [status, setStatus] = useState(searchParams.get('status') || 'All');
  const [priority, setPriority] = useState(searchParams.get('priority') || 'All');
  const [spaceId, setSpaceId] = useState(searchParams.get('spaceId') || '');
  const [assignedToMe, setAssignedToMe] = useState(
    searchParams.get('assignedToMe') === 'true'
  );
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  const [matters, setMatters] = useState<Matter[]>([]);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchSpaces()
      .then(setSpaces)
      .catch(() => {});
  }, [refreshTrigger]);

  const loadMatters = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchMatters({
        spaceId: spaceId || undefined,
        status,
        priority,
        assignedToMe,
        search: debouncedSearch,
        includeArchived: status === 'Archived',
      });
      setMatters(list);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load matters.'));
    } finally {
      setLoading(false);
    }
  }, [spaceId, status, priority, assignedToMe, debouncedSearch]);

  useEffect(() => {
    loadMatters();
  }, [loadMatters, refreshTrigger]);

  const syncParams = (
    nextStatus: string,
    nextPriority: string,
    nextSpace: string,
    nextMine: boolean,
    nextSearch: string
  ) => {
    const params = new URLSearchParams();
    if (nextStatus && nextStatus !== 'All') params.set('status', nextStatus);
    if (nextPriority && nextPriority !== 'All') params.set('priority', nextPriority);
    if (nextSpace) params.set('spaceId', nextSpace);
    if (nextMine) params.set('assignedToMe', 'true');
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    setSearchParams(params, { replace: true });
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Matter Directory
          </h2>
          <p className="mt-0.5 text-sm text-[#9CA3AF]">
            Search, filter, and track every responsibility across your spaces.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewMatterModal(spaceId || undefined)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#F97316] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Matter</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="space-y-3 rounded-lg border border-[#23262E] bg-[#14161A] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                syncParams(status, priority, spaceId, assignedToMe, e.target.value);
              }}
              placeholder="Search matters by title, next action, waiting for, or category..."
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] py-2 pr-3 pl-9 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filter by space"
              value={spaceId}
              onChange={(e) => {
                setSpaceId(e.target.value);
                syncParams(status, priority, e.target.value, assignedToMe, search);
              }}
              className="rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2 text-xs font-medium text-[#E5E7EB] focus:border-[#F97316] focus:outline-none"
            >
              <option value="">All Spaces</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                syncParams(status, e.target.value, spaceId, assignedToMe, search);
              }}
              className="rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2 text-xs font-medium text-[#E5E7EB] focus:border-[#F97316] focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Normal">Normal Priority</option>
              <option value="Low">Low Priority</option>
            </select>

            <button
              type="button"
              onClick={() => {
                const next = !assignedToMe;
                setAssignedToMe(next);
                syncParams(status, priority, spaceId, next, search);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                assignedToMe
                  ? 'border-[#F97316] bg-[#26180F] text-[#FB923C]'
                  : 'border-[#2B2E38] bg-[#0F1114] text-[#9CA3AF] hover:text-white'
              }`}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>Assigned to me</span>
            </button>
          </div>
        </div>

        {/* Segmented Status Filter */}
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-[#23262E] bg-[#0E1013] p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setStatus(tab);
                syncParams(tab, priority, spaceId, assignedToMe, search);
              }}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                status === tab
                  ? 'bg-[#1F232B] text-white'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Matters List */}
      {error && (
        <div className="rounded-lg border border-[#522424] bg-[#211315] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]"
            />
          ))}
        </div>
      ) : matters.length === 0 ? (
        <div className="rounded-lg border border-[#23262E] bg-[#14161A] px-6 py-12 text-center">
          <p className="font-display text-base font-medium text-white">
            No matching Matters found
          </p>
          <p className="mt-1 text-sm text-[#9CA3AF]">
            Try clearing a filter or create a new Matter to start tracking.
          </p>
          <button
            type="button"
            onClick={() => openNewMatterModal(spaceId || undefined)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-4 py-2 text-xs font-medium text-white hover:bg-[#EA580C]"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Matter</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#23262E] bg-[#14161A]">
          <div className="divide-y divide-[#20232B]">
            {matters.map((matter) => {
              const overdue =
                matter.status !== 'Completed' &&
                matter.status !== 'Archived' &&
                isDateOverdue(matter.nextActionAt);

              return (
                <Link
                  key={matter.id}
                  to={`/matters/${matter.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-[#181B21]"
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="text-sm font-semibold text-white">
                          {matter.title}
                        </span>
                        <StatusTag status={matter.status} />
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#9CA3AF]">
                        <span>{matter.space?.name}</span>
                        <span aria-hidden="true">·</span>
                        <span>{matter.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>Owner: {matter.owner?.displayName || 'Unassigned'}</span>
                        {matter.participants.length > 0 && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>
                              {matter.participants.length}{' '}
                              {matter.participants.length === 1
                                ? 'participant'
                                : 'participants'}
                            </span>
                          </>
                        )}
                      </div>

                      {matter.status === 'Waiting' && matter.waitingFor && (
                        <p className="mt-1.5 text-xs font-medium text-[#FBBF24]">
                          Waiting for: {matter.waitingFor}
                        </p>
                      )}

                      {matter.nextAction && matter.status !== 'Completed' && (
                        <p className="mt-1 text-xs text-[#CBD5E1]">
                          Next action: {matter.nextAction}
                        </p>
                      )}

                      {matter.status === 'Completed' && matter.resolution && (
                        <p className="mt-1 text-xs text-[#34D399]">
                          Resolution: {matter.resolution}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-5 md:flex-col md:items-end md:gap-1.5">
                      <PriorityTag priority={matter.priority} />
                      {matter.nextActionAt && (
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-xs tabular-nums ${
                            overdue ? 'text-[#F87171]' : 'text-[#9CA3AF]'
                          }`}
                        >
                          <CalendarClock className="h-3 w-3" />
                          {overdue ? 'Overdue: ' : 'Follow-up: '}
                          {formatShortDate(matter.nextActionAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
