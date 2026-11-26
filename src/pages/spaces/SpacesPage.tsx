import { ArrowRight, Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SpaceFormModal } from '../../components/spaces/SpaceFormModal.tsx';
import { SpaceTypeIndicator } from '../../components/ui/StatusIndicators.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import { formatShortDate } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import { fetchSpaces } from '../../services/spaceService.ts';
import type { SpaceSummary } from '../../types/lifeos.ts';

export function SpacesPage() {
  const { refreshTrigger, triggerRefresh } = useAppLayout();

  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const loadSpaces = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const list = await fetchSpaces();
      setSpaces(list);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load spaces.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces, refreshTrigger]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            My Spaces
          </h2>
          <p className="mt-0.5 text-sm text-[#9CA3AF]">
            Private Personal, Family, and invitation-only Community Spaces.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#F97316] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Shared Space</span>
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-[#522424] bg-[#211315] p-4 text-sm text-[#FCA5A5]">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <Link
              key={space.id}
              to={`/spaces/${space.id}`}
              className="group flex flex-col justify-between rounded-lg border border-[#23262E] bg-[#14161A] p-5 transition-colors hover:border-[#343842] hover:bg-[#171A20]"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <SpaceTypeIndicator type={space.type} />
                  <span className="font-mono text-xs text-[#6B7280]">
                    {space.role}
                  </span>
                </div>

                <h3 className="mt-3 font-display text-base font-semibold text-white group-hover:text-[#F97316] transition-colors">
                  {space.name}
                </h3>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#9CA3AF]">
                  {space.description || 'Shared workspace for tracking Matters.'}
                </p>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-[#20232B] pt-3.5 text-xs text-[#9CA3AF]">
                <div className="flex items-center gap-2 tabular-nums">
                  <span>
                    <strong className="font-medium text-white">
                      {space.activeMatterCount}
                    </strong>{' '}
                    active
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    <strong className="font-medium text-white">
                      {space.memberCount}
                    </strong>{' '}
                    {space.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-[#CBD5E1] group-hover:text-white">
                  <span>Open</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <SpaceFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          triggerRefresh();
          loadSpaces();
        }}
      />
    </div>
  );
}
