import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  MessageSquarePlus,
  Send,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MatterFormModal } from '../../components/matters/MatterFormModal.tsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import {
  PriorityTag,
  SpaceTypeIndicator,
  StatusTag,
} from '../../components/ui/StatusIndicators.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import {
  formatDateTime,
  formatShortDate,
  isDateOverdue,
} from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import {
  addMatterUpdate,
  deleteMatter,
  fetchMatterDetail,
  updateMatter,
} from '../../services/matterService.ts';
import type {
  MatterDetail,
  MatterPriority,
  MatterStatus,
} from '../../types/lifeos.ts';

const STATUS_OPTIONS: MatterStatus[] = [
  'Open',
  'In Progress',
  'Waiting',
  'Completed',
  'Archived',
];

const PRIORITY_OPTIONS: MatterPriority[] = ['Low', 'Normal', 'High'];

export function MatterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { triggerRefresh } = useAppLayout();

  const [matter, setMatter] = useState<MatterDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [updateMessage, setUpdateMessage] = useState('');
  const [postingUpdate, setPostingUpdate] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Prompt modal state for Waiting For or Resolution when switching status inline
  const [pendingStatusPrompt, setPendingStatusPrompt] = useState<
    'Waiting' | 'Completed' | null
  >(null);
  const [promptInput, setPromptInput] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);

  const loadMatter = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const detail = await fetchMatterDetail(id);
      setMatter(detail);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load Matter details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadMatter();
  }, [loadMatter]);

  const handleStatusChange = async (newStatus: MatterStatus) => {
    if (!matter || newStatus === matter.status) return;
    setActionError(null);

    if (newStatus === 'Waiting' && !matter.waitingFor) {
      setPromptInput('');
      setPendingStatusPrompt('Waiting');
      return;
    }
    if (newStatus === 'Completed' && !matter.resolution) {
      setPromptInput('');
      setPendingStatusPrompt('Completed');
      return;
    }

    setSavingStatus(true);
    try {
      const updated = await updateMatter(matter.id, { status: newStatus });
      setMatter(updated);
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to update status.'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handleConfirmStatusPrompt = async (e: FormEvent) => {
    e.preventDefault();
    if (!matter || !pendingStatusPrompt || !promptInput.trim()) return;
    setActionError(null);
    setSavingStatus(true);
    try {
      const payload =
        pendingStatusPrompt === 'Waiting'
          ? { status: 'Waiting' as const, waitingFor: promptInput.trim() }
          : { status: 'Completed' as const, resolution: promptInput.trim() };
      const updated = await updateMatter(matter.id, payload);
      setMatter(updated);
      setPendingStatusPrompt(null);
      setPromptInput('');
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to update status.'));
    } finally {
      setSavingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: MatterPriority) => {
    if (!matter || newPriority === matter.priority) return;
    setActionError(null);
    try {
      const updated = await updateMatter(matter.id, { priority: newPriority });
      setMatter(updated);
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to update priority.'));
    }
  };

  const handleOwnerChange = async (newOwnerId: string) => {
    if (!matter || newOwnerId === matter.ownerId) return;
    setActionError(null);
    try {
      const updated = await updateMatter(matter.id, { ownerId: newOwnerId });
      setMatter(updated);
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to reassign owner.'));
    }
  };

  const handleToggleParticipant = async (userId: string) => {
    if (!matter) return;
    setActionError(null);
    const exists = matter.participants.some((p) => p.id === userId);
    const nextIds = exists
      ? matter.participants.filter((p) => p.id !== userId).map((p) => p.id)
      : [...matter.participants.map((p) => p.id), userId];

    try {
      const updated = await updateMatter(matter.id, { participantIds: nextIds });
      setMatter(updated);
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to update participants.'));
    }
  };

  const handlePostUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!matter || !updateMessage.trim()) return;
    setActionError(null);
    setPostingUpdate(true);
    try {
      await addMatterUpdate(matter.id, {
        message: updateMessage.trim(),
        updateType: 'note',
      });
      setUpdateMessage('');
      await loadMatter();
      triggerRefresh();
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to post update.'));
    } finally {
      setPostingUpdate(false);
    }
  };

  const handleArchiveToggle = async () => {
    if (!matter) return;
    const targetStatus: MatterStatus =
      matter.status === 'Archived' ? 'Open' : 'Archived';
    await handleStatusChange(targetStatus);
  };

  const handleDelete = async () => {
    if (!matter) return;
    setDeleting(true);
    try {
      await deleteMatter(matter.id);
      triggerRefresh();
      navigate('/matters');
    } catch (err) {
      setActionError(extractErrorMessage(err, 'Failed to delete Matter.'));
      setDeleteDialogOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 animate-pulse rounded bg-[#14161A]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-96 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-8" />
          <div className="h-72 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error || !matter) {
    return (
      <div className="rounded-lg border border-[#522424] bg-[#211315] p-6">
        <h2 className="font-display text-base font-semibold text-white">
          Matter unavailable
        </h2>
        <p className="mt-1 text-sm text-[#FCA5A5]">
          {error || 'This Matter could not be found.'}
        </p>
        <Link
          to="/matters"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#2B2E38] bg-[#1A1D23] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#22262E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to My Matters</span>
        </Link>
      </div>
    );
  }

  const overdue =
    matter.status !== 'Completed' &&
    matter.status !== 'Archived' &&
    isDateOverdue(matter.nextActionAt);

  return (
    <div className="space-y-5">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/matters"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to My Matters</span>
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2B2E38] bg-[#14161A] px-3 py-1.5 text-xs font-medium text-[#E5E7EB] transition-colors hover:border-[#3A3F4C] hover:text-white"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={handleArchiveToggle}
            disabled={savingStatus}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#2B2E38] bg-[#14161A] px-3 py-1.5 text-xs font-medium text-[#E5E7EB] transition-colors hover:border-[#3A3F4C] hover:text-white"
          >
            <Archive className="h-3.5 w-3.5" />
            <span>{matter.status === 'Archived' ? 'Restore' : 'Archive'}</span>
          </button>

          <button
            type="button"
            onClick={() => setDeleteDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#472225] bg-[#211315] px-3 py-1.5 text-xs font-medium text-[#FCA5A5] transition-colors hover:bg-[#2E181B]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-[#522424] bg-[#291416] px-4 py-2.5 text-sm text-[#FCA5A5]">
          {actionError}
        </div>
      )}

      {/* Main 2-column Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left / Main Section */}
        <div className="space-y-6 lg:col-span-8">
          {/* Primary Matter Card */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A] p-6">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-[#9CA3AF]">
              <span>{matter.space?.name}</span>
              <span aria-hidden="true">·</span>
              <span>{matter.category}</span>
            </div>

            <h2 className="mt-2 font-display text-2xl font-semibold text-white [text-wrap:balance]">
              {matter.title}
            </h2>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9CA3AF]">Status</span>
                <select
                  aria-label="Matter status"
                  value={matter.status}
                  disabled={savingStatus}
                  onChange={(e) =>
                    handleStatusChange(e.target.value as MatterStatus)
                  }
                  className="rounded-md border border-[#2B2E38] bg-[#0F1114] px-2.5 py-1.5 text-xs font-medium text-white focus:border-[#F97316] focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <StatusTag status={matter.status} />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#9CA3AF]">Priority</span>
                <select
                  aria-label="Matter priority"
                  value={matter.priority}
                  onChange={(e) =>
                    handlePriorityChange(e.target.value as MatterPriority)
                  }
                  className="rounded-md border border-[#2B2E38] bg-[#0F1114] px-2.5 py-1.5 text-xs font-medium text-white focus:border-[#F97316] focus:outline-none"
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <PriorityTag priority={matter.priority} />
              </div>
            </div>

            {matter.description && (
              <div className="mt-5 border-t border-[#20232B] pt-4">
                <h3 className="text-xs font-medium text-[#9CA3AF]">
                  Description &amp; Context
                </h3>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#E5E7EB]">
                  {matter.description}
                </p>
              </div>
            )}

            {/* Waiting For Highlight */}
            {matter.status === 'Waiting' && (
              <div className="mt-5 rounded-md border border-[#4E3D19] bg-[#211B0E] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#FBBF24]">
                  <Clock className="h-4 w-4" />
                  <span>Waiting On</span>
                </div>
                <p className="mt-1 text-sm font-medium text-white">
                  {matter.waitingFor || 'Unspecified external dependency'}
                </p>
                {matter.nextActionAt && (
                  <p className="mt-1 font-mono text-xs text-[#FCD34D] tabular-nums">
                    Follow-up scheduled for {formatShortDate(matter.nextActionAt)}
                  </p>
                )}
              </div>
            )}

            {/* Next Action & Follow-up */}
            {matter.status !== 'Completed' && matter.status !== 'Archived' && (
              <div className="mt-5 grid grid-cols-1 gap-4 rounded-md border border-[#23262E] bg-[#101216] p-4 sm:grid-cols-2">
                <div>
                  <div className="text-xs font-medium text-[#9CA3AF]">
                    What Happens Next
                  </div>
                  <p className="mt-1 text-sm font-medium text-white">
                    {matter.nextAction || 'No next action set yet.'}
                  </p>
                </div>
                <div>
                  <div className="text-xs font-medium text-[#9CA3AF]">
                    When Should It Happen
                  </div>
                  <p
                    className={`mt-1 inline-flex items-center gap-1.5 font-mono text-sm font-medium tabular-nums ${
                      overdue ? 'text-[#F87171]' : 'text-white'
                    }`}
                  >
                    <CalendarClock className="h-4 w-4" />
                    <span>
                      {matter.nextActionAt
                        ? `${formatShortDate(matter.nextActionAt)}${
                            overdue ? ' (Overdue)' : ''
                          }`
                        : 'No follow-up date'}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Final Resolution */}
            {matter.status === 'Completed' && matter.resolution && (
              <div className="mt-5 rounded-md border border-[#1E4734] bg-[#0E1E16] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#34D399]">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Final Resolution</span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm text-white">
                  {matter.resolution}
                </p>
                {matter.completedAt && (
                  <p className="mt-1.5 font-mono text-xs text-[#6EE7B7] tabular-nums">
                    Completed {formatDateTime(matter.completedAt)}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Activity Timeline & Update Composer */}
          <section className="rounded-lg border border-[#23262E] bg-[#14161A]">
            <div className="flex items-center justify-between border-b border-[#23262E] px-6 py-4">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4 w-4 text-[#F97316]" />
                <h3 className="font-display text-sm font-semibold text-white">
                  Activity Timeline
                </h3>
              </div>
              <span className="font-mono text-xs text-[#8B929E] tabular-nums">
                {matter.updates.length}{' '}
                {matter.updates.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            <div className="divide-y divide-[#20232B]">
              {matter.updates.map((upd) => (
                <div key={upd.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-medium text-white">
                        {upd.authorName || 'System'}
                      </span>
                      <span aria-hidden="true" className="text-[#6B7280]">
                        ·
                      </span>
                      <span className="text-[#9CA3AF]">
                        {upd.updateType.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-[#6B7280] tabular-nums">
                      {formatDateTime(upd.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm text-[#D1D5DB]">
                    {upd.message}
                  </p>
                </div>
              ))}
            </div>

            {/* Update Composer */}
            <form
              onSubmit={handlePostUpdate}
              className="border-t border-[#23262E] bg-[#101216] p-5"
            >
              <label
                htmlFor="matter-update-input"
                className="mb-2 block text-xs font-medium text-[#CBD5E1]"
              >
                Post Progress Update or Note
              </label>
              <textarea
                id="matter-update-input"
                rows={3}
                value={updateMessage}
                onChange={(e) => setUpdateMessage(e.target.value)}
                placeholder="Log a phone call, vendor response, receipt note, or next step..."
                className="w-full rounded-md border border-[#2B2E38] bg-[#0B0C0E] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="submit"
                  disabled={postingUpdate || !updateMessage.trim()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  <span>{postingUpdate ? 'Posting...' : 'Add Update'}</span>
                </button>
              </div>
            </form>
          </section>
        </div>

        {/* Right Metadata & Responsibility Sidebar */}
        <aside className="space-y-5 lg:col-span-4">
          <div className="rounded-lg border border-[#23262E] bg-[#14161A] p-5 space-y-5">
            {/* Assigned Owner */}
            <div>
              <label
                htmlFor="detail-owner-select"
                className="mb-1.5 block text-xs font-medium text-[#9CA3AF]"
              >
                Who Is Responsible (Owner)
              </label>
              <select
                id="detail-owner-select"
                value={matter.ownerId || ''}
                onChange={(e) => handleOwnerChange(e.target.value)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2 text-sm text-white focus:border-[#F97316] focus:outline-none"
              >
                {matter.spaceMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Participants */}
            <div className="border-t border-[#20232B] pt-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF]">
                  <Users className="h-3.5 w-3.5" />
                  <span>Participants</span>
                </span>
                <span className="font-mono text-xs text-[#6B7280] tabular-nums">
                  {matter.participants.length}
                </span>
              </div>

              {matter.spaceMembers.length > 1 ? (
                <div className="mt-2.5 space-y-1.5">
                  {matter.spaceMembers.map((m) => {
                    const isParticipant = matter.participants.some(
                      (p) => p.id === m.userId
                    );
                    return (
                      <button
                        key={m.userId}
                        type="button"
                        onClick={() => handleToggleParticipant(m.userId)}
                        className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                          isParticipant
                            ? 'border-[#F97316]/60 bg-[#26180F] text-white'
                            : 'border-[#23262E] bg-[#101216] text-[#9CA3AF] hover:border-[#343842] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{m.displayName}</span>
                        <span className="ml-2 shrink-0 text-[11px]">
                          {isParticipant ? 'Added' : 'Add'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#6B7280]">
                  Personal Space Matters are private to you. Invite members in a
                  Family or Community Space to add participants.
                </p>
              )}
            </div>

            {/* Space Info */}
            <div className="border-t border-[#20232B] pt-4">
              <div className="text-xs font-medium text-[#9CA3AF]">Space</div>
              <Link
                to={`/spaces/${matter.spaceId}`}
                className="mt-1.5 flex items-center justify-between rounded-md border border-[#23262E] bg-[#101216] px-3 py-2 text-sm text-white transition-colors hover:border-[#343842]"
              >
                <span className="truncate font-medium">{matter.space?.name}</span>
                {matter.space && <SpaceTypeIndicator type={matter.space.type} />}
              </Link>
            </div>

            {/* Dates */}
            <div className="space-y-3 border-t border-[#20232B] pt-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Target Due Date</span>
                <span className="font-mono text-[#E5E7EB] tabular-nums">
                  {formatShortDate(matter.dueAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Created</span>
                <span className="font-mono text-[#E5E7EB] tabular-nums">
                  {formatShortDate(matter.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#9CA3AF]">Last Updated</span>
                <span className="font-mono text-[#E5E7EB] tabular-nums">
                  {formatDateTime(matter.updatedAt)}
                </span>
              </div>
              {matter.creator && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[#9CA3AF]">Created By</span>
                  <span className="text-[#E5E7EB]">
                    {matter.creator.displayName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Inline Status Prompt Modal (for Waiting For or Resolution) */}
      {pendingStatusPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleConfirmStatusPrompt}
            className="w-full max-w-md rounded-lg border border-[#2A2D36] bg-[#14161A] p-6 shadow-2xl"
          >
            <h3 className="font-display text-base font-semibold text-white">
              {pendingStatusPrompt === 'Waiting'
                ? 'Who or what are you waiting for?'
                : 'Record Final Resolution'}
            </h3>
            <p className="mt-1 text-xs text-[#9CA3AF]">
              {pendingStatusPrompt === 'Waiting'
                ? 'Specify the person, vendor, or event blocking progress.'
                : 'Summarize how this Matter was resolved for future reference.'}
            </p>
            <textarea
              rows={3}
              required
              autoFocus
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value)}
              placeholder={
                pendingStatusPrompt === 'Waiting'
                  ? 'e.g., Waiting for electrician quote...'
                  : 'e.g., Replaced faulty valve; no further leaks.'
              }
              className="mt-4 w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingStatusPrompt(null)}
                className="rounded-md border border-[#2B2E38] bg-[#1A1D23] px-4 py-2 text-xs font-medium text-[#E5E7EB] hover:bg-[#22262E]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingStatus || !promptInput.trim()}
                className="rounded-md bg-[#F97316] px-4 py-2 text-xs font-medium text-white hover:bg-[#EA580C] disabled:opacity-50"
              >
                {savingStatus ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </form>
        </div>
      )}

      <MatterFormModal
        open={editModalOpen}
        initialMatter={matter}
        onClose={() => setEditModalOpen(false)}
        onSaved={() => {
          setEditModalOpen(false);
          loadMatter();
          triggerRefresh();
        }}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete Matter"
        description={`Are you sure you want to permanently delete "${matter.title}" and all its timeline updates? This action cannot be undone.`}
        confirmLabel="Delete Matter"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
}
