import { X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toDateInputValue } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import {
  createMatter,
  updateMatter,
} from '../../services/matterService.ts';
import { fetchSpaceDetail, fetchSpaces } from '../../services/spaceService.ts';
import type {
  Matter,
  MatterPriority,
  MatterStatus,
  SpaceMember,
  SpaceSummary,
} from '../../types/lifeos.ts';

const STATUS_OPTIONS: MatterStatus[] = [
  'Open',
  'In Progress',
  'Waiting',
  'Completed',
  'Archived',
];

const PRIORITY_OPTIONS: MatterPriority[] = ['Low', 'Normal', 'High'];

const CATEGORY_OPTIONS = [
  'General',
  'Household',
  'Repairs & Maintenance',
  'Tech & Devices',
  'Family',
  'Finance & Admin',
  'Health & Care',
  'Community',
  'Errands',
];

interface MatterFormModalProps {
  open: boolean;
  initialMatter?: Matter | null;
  defaultSpaceId?: string;
  onClose: () => void;
  onSaved: (matterId: string) => void;
}

export function MatterFormModal({
  open,
  initialMatter,
  defaultSpaceId,
  onClose,
  onSaved,
}: MatterFormModalProps) {
  const isEditing = Boolean(initialMatter);

  const [spaces, setSpaces] = useState<SpaceSummary[]>([]);
  const [spaceId, setSpaceId] = useState(
    initialMatter?.spaceId || defaultSpaceId || ''
  );
  const [members, setMembers] = useState<SpaceMember[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('General');
  const [status, setStatus] = useState<MatterStatus>('Open');
  const [priority, setPriority] = useState<MatterPriority>('Normal');
  const [ownerId, setOwnerId] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [waitingFor, setWaitingFor] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [nextActionAt, setNextActionAt] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [resolution, setResolution] = useState('');

  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setError(null);
    if (initialMatter) {
      setSpaceId(initialMatter.spaceId);
      setTitle(initialMatter.title);
      setDescription(initialMatter.description || '');
      setCategory(initialMatter.category || 'General');
      setStatus(initialMatter.status);
      setPriority(initialMatter.priority);
      setOwnerId(initialMatter.ownerId || '');
      setParticipantIds(initialMatter.participants.map((p) => p.id));
      setWaitingFor(initialMatter.waitingFor || '');
      setNextAction(initialMatter.nextAction || '');
      setNextActionAt(toDateInputValue(initialMatter.nextActionAt));
      setDueAt(toDateInputValue(initialMatter.dueAt));
      setResolution(initialMatter.resolution || '');
    } else {
      setTitle('');
      setDescription('');
      setCategory('General');
      setStatus('Open');
      setPriority('Normal');
      setOwnerId('');
      setParticipantIds([]);
      setWaitingFor('');
      setNextAction('');
      setNextActionAt('');
      setDueAt('');
      setResolution('');
      if (defaultSpaceId) {
        setSpaceId(defaultSpaceId);
      }
    }

    let cancelled = false;
    setLoadingSpaces(true);
    fetchSpaces()
      .then((list) => {
        if (cancelled) return;
        setSpaces(list);
        if (!initialMatter) {
          const targetId =
            defaultSpaceId && list.some((s) => s.id === defaultSpaceId)
              ? defaultSpaceId
              : list[0]?.id || '';
          setSpaceId(targetId);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(extractErrorMessage(err, 'Unable to load spaces.'));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSpaces(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, initialMatter, defaultSpaceId]);

  useEffect(() => {
    if (!open || !spaceId) return;
    let cancelled = false;

    fetchSpaceDetail(spaceId)
      .then((detail) => {
        if (cancelled) return;
        setMembers(detail.members);
        if (!initialMatter && !ownerId && detail.members.length > 0) {
          setOwnerId(detail.members[0].userId);
        }
      })
      .catch(() => {
        if (!cancelled) setMembers([]);
      });

    return () => {
      cancelled = true;
    };
  }, [open, spaceId, initialMatter, ownerId]);

  if (!open) return null;

  const toggleParticipant = (uid: string) => {
    setParticipantIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (title.trim().length < 2) {
      setError('Please enter a Matter title (at least 2 characters).');
      return;
    }
    if (!spaceId) {
      setError('Please select a Space for this Matter.');
      return;
    }
    if (status === 'Waiting' && !waitingFor.trim()) {
      setError('When status is Waiting, please specify who or what you are waiting for.');
      return;
    }
    if (status === 'Completed' && !resolution.trim()) {
      setError('Please enter a final resolution before marking this Matter completed.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        category,
        status,
        priority,
        ownerId: ownerId || null,
        participantIds,
        waitingFor: waitingFor.trim() || null,
        nextAction: nextAction.trim() || null,
        nextActionAt: nextActionAt ? new Date(`${nextActionAt}T12:00:00`).toISOString() : null,
        dueAt: dueAt ? new Date(`${dueAt}T17:00:00`).toISOString() : null,
        resolution: resolution.trim() || null,
      };

      if (isEditing && initialMatter) {
        const updated = await updateMatter(initialMatter.id, payload);
        onSaved(updated.id);
      } else {
        const created = await createMatter(spaceId, payload);
        onSaved(created.id);
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to save Matter.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matter-modal-title"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-[#2A2D36] bg-[#14161A] p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#23262E] pb-4">
          <div>
            <h2
              id="matter-modal-title"
              className="font-display text-lg font-semibold text-white"
            >
              {isEditing ? 'Edit Matter' : 'New Matter'}
            </h2>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Define ownership, next action, and follow-up date so nothing gets forgotten.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-[#9CA3AF] transition-colors hover:bg-[#1E2128] hover:text-white"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-md border border-[#522424] bg-[#291416] px-3.5 py-2.5 text-sm text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="matter-space"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Space
              </label>
              <select
                id="matter-space"
                disabled={isEditing || loadingSpaces}
                value={spaceId}
                onChange={(e) => {
                  setSpaceId(e.target.value);
                  setOwnerId('');
                  setParticipantIds([]);
                }}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none disabled:opacity-60"
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.type})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="matter-category"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Category
              </label>
              <select
                id="matter-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="matter-title"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Matter Title
            </label>
            <input
              id="matter-title"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Fix kitchen sink leak / Laptop warranty repair"
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="matter-description"
              className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
            >
              Context &amp; Details
            </label>
            <textarea
              id="matter-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, reference numbers, vendor notes, or background..."
              className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label
                htmlFor="matter-status"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Status
              </label>
              <select
                id="matter-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as MatterStatus)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="matter-priority"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Priority
              </label>
              <select
                id="matter-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as MatterPriority)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none"
              >
                {PRIORITY_OPTIONS.map((pr) => (
                  <option key={pr} value={pr}>
                    {pr}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="matter-owner"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Assigned Owner
              </label>
              <select
                id="matter-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 text-sm text-white focus:border-[#F97316] focus:outline-none"
              >
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {status === 'Waiting' && (
            <div className="rounded-md border border-[#4E3D19] bg-[#211B0E] p-3.5">
              <label
                htmlFor="matter-waiting-for"
                className="mb-1.5 block text-xs font-medium text-[#FBBF24]"
              >
                Waiting For (Required)
              </label>
              <input
                id="matter-waiting-for"
                type="text"
                required
                value={waitingFor}
                onChange={(e) => setWaitingFor(e.target.value)}
                placeholder="e.g., Plumber quote from Mario, Service center diagnostics..."
                className="w-full rounded-md border border-[#4E3D19] bg-[#14110A] px-3.5 py-2 text-sm text-white placeholder-[#9CA3AF] focus:border-[#FBBF24] focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label
                htmlFor="matter-next-action"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Next Action
              </label>
              <input
                id="matter-next-action"
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="What happens next? e.g., Call repair shop for ETA"
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3.5 py-2.5 text-sm text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="matter-followup-date"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Follow-up Date
              </label>
              <input
                id="matter-followup-date"
                type="date"
                value={nextActionAt}
                onChange={(e) => setNextActionAt(e.target.value)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 font-mono text-sm text-white focus:border-[#F97316] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="matter-due-date"
                className="mb-1.5 block text-xs font-medium text-[#CBD5E1]"
              >
                Target Due Date (Optional)
              </label>
              <input
                id="matter-due-date"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2.5 font-mono text-sm text-white focus:border-[#F97316] focus:outline-none"
              />
            </div>

            {members.length > 1 && (
              <div>
                <span className="mb-1.5 block text-xs font-medium text-[#CBD5E1]">
                  Participants
                </span>
                <div className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-md border border-[#2B2E38] bg-[#0F1114] p-2">
                  {members.map((m) => {
                    const checked = participantIds.includes(m.userId);
                    return (
                      <label
                        key={m.userId}
                        className={`inline-flex cursor-pointer items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors ${
                          checked
                            ? 'border-[#F97316] bg-[#26180F] text-white'
                            : 'border-[#262930] bg-[#16181C] text-[#9CA3AF] hover:text-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(m.userId)}
                          className="sr-only"
                        />
                        <span>{m.displayName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {status === 'Completed' && (
            <div className="rounded-md border border-[#1E4734] bg-[#0E1E16] p-3.5">
              <label
                htmlFor="matter-resolution"
                className="mb-1.5 block text-xs font-medium text-[#34D399]"
              >
                Final Resolution (Required)
              </label>
              <textarea
                id="matter-resolution"
                rows={2}
                required
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="How was this Matter resolved?"
                className="w-full rounded-md border border-[#1E4734] bg-[#0A140F] px-3.5 py-2 text-sm text-white placeholder-[#6B7280] focus:border-[#34D399] focus:outline-none"
              />
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-[#23262E] pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-md border border-[#2B2E38] bg-[#1A1D23] px-4 py-2 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#22262E]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || loadingSpaces}
              className="rounded-md bg-[#F97316] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] disabled:opacity-50"
            >
              {submitting
                ? 'Saving...'
                : isEditing
                ? 'Save Changes'
                : 'Create Matter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
