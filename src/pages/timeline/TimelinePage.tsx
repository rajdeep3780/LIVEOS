import { Activity } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusTag } from '../../components/ui/StatusIndicators.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import { formatDateTime } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import { fetchTimeline } from '../../services/matterService.ts';
import { fetchSpaces } from '../../services/spaceService.ts';
import type { SpaceSummary, TimelineEvent } from '../../types/lifeos.ts';

export function TimelinePage() {
  const { refreshTrigger } = useAppLayout();

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [spaceFilter, setSpaceFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSpaces()
      .then(setSpaces)
      .catch(() => {});
  }, [refreshTrigger]);

  const loadTimeline = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchTimeline(spaceFilter);
      setEvents(list);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load activity timeline.'));
    } finally {
      setLoading(false);
    }
  }, [spaceFilter]);

  useEffect(() => {
    loadTimeline();
  }, [loadTimeline, refreshTrigger]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Activity Timeline
          </h2>
          <p className="mt-0.5 text-sm text-[#9CA3AF]">
            Chronological log of Matter progress, assignments, and resolutions.
          </p>
        </div>

        <select
          aria-label="Filter timeline by space"
          value={spaceFilter}
          onChange={(e) => setSpaceFilter(e.target.value)}
          className="rounded-md border border-[#2B2E38] bg-[#14161A] px-3 py-2 text-xs font-medium text-[#E5E7EB] focus:border-[#F97316] focus:outline-none"
        >
          <option value="All">All Spaces</option>
          {spaces.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-[#522424] bg-[#211315] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-lg border border-[#23262E] bg-[#14161A] px-6 py-12 text-center">
          <Activity className="mx-auto h-6 w-6 text-[#6B7280]" />
          <p className="mt-2 font-display text-sm font-medium text-white">
            No timeline events yet
          </p>
          <p className="mt-1 text-xs text-[#9CA3AF]">
            Updates will appear here as Matters are created and progressed.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#23262E] bg-[#14161A] divide-y divide-[#20232B]">
          {events.map((ev) => (
            <Link
              key={ev.id}
              to={`/matters/${ev.matterId}`}
              className="block px-5 py-4 transition-colors hover:bg-[#181B21]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-sm font-semibold text-white">
                    {ev.matterTitle}
                  </span>
                  <StatusTag status={ev.matterStatus} />
                </div>
                <span className="font-mono text-xs text-[#6B7280] tabular-nums">
                  {formatDateTime(ev.createdAt)}
                </span>
              </div>

              <p className="mt-1.5 text-sm text-[#D1D5DB]">{ev.message}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
                <span>{ev.spaceName}</span>
                <span aria-hidden="true">·</span>
                <span>By {ev.authorName || 'System'}</span>
                <span aria-hidden="true">·</span>
                <span>{ev.updateType.replace('_', ' ')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
