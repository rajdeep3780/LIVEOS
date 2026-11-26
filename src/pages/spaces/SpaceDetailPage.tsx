import {
  ArrowLeft,
  CalendarClock,
  Lock,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.tsx';
import {
  PriorityTag,
  SpaceTypeIndicator,
  StatusTag,
} from '../../components/ui/StatusIndicators.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { useAppLayout } from '../../layouts/AppLayout.tsx';
import { formatShortDate } from '../../lib/date.ts';
import { extractErrorMessage } from '../../services/api.ts';
import { fetchSpaceMatters } from '../../services/matterService.ts';
import {
  fetchSpaceDetail,
  inviteSpaceMember,
  removeSpaceMember,
  updateMemberRole,
} from '../../services/spaceService.ts';
import type { Matter, SpaceDetail, SpaceRole } from '../../types/lifeos.ts';

export function SpaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { openNewMatterModal, refreshTrigger, triggerRefresh } = useAppLayout();

  const [space, setSpace] = useState<SpaceDetail | null>(null);
  const [matters, setMatters] = useState<Matter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [memberSuccess, setMemberSuccess] = useState<string | null>(null);

  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    displayName: string;
  } | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [spaceRes, mattersRes] = await Promise.all([
        fetchSpaceDetail(id),
        fetchSpaceMatters(id),
      ]);
      setSpace(spaceRes);
      setMatters(mattersRes);
    } catch (err) {
      setError(extractErrorMessage(err, 'Unable to load space details.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!space || !inviteEmail.trim()) return;
    setMemberError(null);
    setMemberSuccess(null);
    setInviting(true);
    try {
      const added = await inviteSpaceMember(space.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteEmail('');
      setMemberSuccess(`${added.displayName} was added to ${space.name}.`);
      await loadData();
      triggerRefresh();
    } catch (err) {
      setMemberError(extractErrorMessage(err, 'Failed to invite member.'));
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId: string, role: SpaceRole) => {
    if (!space) return;
    setMemberError(null);
    try {
      await updateMemberRole(space.id, userId, role);
      await loadData();
    } catch (err) {
      setMemberError(extractErrorMessage(err, 'Failed to update role.'));
    }
  };

  const handleConfirmRemove = async () => {
    if (!space || !memberToRemove) return;
    setRemoving(true);
    setMemberError(null);
    try {
      await removeSpaceMember(space.id, memberToRemove.userId);
      setMemberToRemove(null);
      await loadData();
      triggerRefresh();
    } catch (err) {
      setMemberError(extractErrorMessage(err, 'Failed to remove member.'));
      setMemberToRemove(null);
    } finally {
      setRemoving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A]" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="h-72 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-8" />
          <div className="h-72 animate-pulse rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (error || !space) {
    return (
      <div className="rounded-lg border border-[#522424] bg-[#211315] p-6">
        <h2 className="font-display text-base font-semibold text-white">
          Space unavailable
        </h2>
        <p className="mt-1 text-sm text-[#FCA5A5]">
          {error || 'You do not have access to this space.'}
        </p>
        <Link
          to="/spaces"
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-[#2B2E38] bg-[#1A1D23] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#22262E]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Spaces</span>
        </Link>
      </div>
    );
  }

  const canManageMembers =
    space.type !== 'personal' &&
    (space.currentUserRole === 'owner' || space.currentUserRole === 'admin');

  return (
    <div className="space-y-6">
      <Link
        to="/spaces"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9CA3AF] hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span>Back to My Spaces</span>
      </Link>

      {/* Space Header */}
      <section className="flex flex-col justify-between gap-4 rounded-lg border border-[#23262E] bg-[#14161A] p-6 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <SpaceTypeIndicator type={space.type} />
            <span className="text-[#6B7280]" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-[#9CA3AF]">
              Your role: {space.currentUserRole}
            </span>
          </div>
          <h2 className="mt-1.5 font-display text-2xl font-semibold text-white">
            {space.name}
          </h2>
          {space.description && (
            <p className="mt-1 text-sm text-[#9CA3AF]">{space.description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => openNewMatterModal(space.id)}
          className="inline-flex items-center justify-center gap-1.5 rounded-md bg-[#F97316] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#EA580C] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Matter in Space</span>
        </button>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Matters in Space */}
        <section className="rounded-lg border border-[#23262E] bg-[#14161A] lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#23262E] px-5 py-4">
            <h3 className="font-display text-sm font-semibold text-white">
              Matters ({matters.length})
            </h3>
            <Link
              to={`/matters?spaceId=${space.id}`}
              className="text-xs font-medium text-[#9CA3AF] hover:text-white"
            >
              Filter in directory
            </Link>
          </div>

          {matters.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-white">
                No Matters in {space.name} yet
              </p>
              <p className="mt-1 text-xs text-[#9CA3AF]">
                Add a Matter to track ownership, next steps, and follow-up dates.
              </p>
              <button
                type="button"
                onClick={() => openNewMatterModal(space.id)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#F97316] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#EA580C]"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add First Matter</span>
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[#20232B]">
              {matters.map((matter) => (
                <Link
                  key={matter.id}
                  to={`/matters/${matter.id}`}
                  className="block px-5 py-3.5 transition-colors hover:bg-[#181B21]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="truncate text-sm font-medium text-white">
                          {matter.title}
                        </span>
                        <StatusTag status={matter.status} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#9CA3AF]">
                        <span>Owner: {matter.owner?.displayName || 'Unassigned'}</span>
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
                        <span className="inline-flex items-center gap-1 font-mono text-xs text-[#9CA3AF] tabular-nums">
                          <CalendarClock className="h-3 w-3" />
                          {formatShortDate(matter.nextActionAt)}
                        </span>
                      )}
                      <PriorityTag priority={matter.priority} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Members & Permissions Sidebar */}
        <aside className="space-y-4 lg:col-span-4">
          <section className="rounded-lg border border-[#23262E] bg-[#14161A] p-5">
            <h3 className="font-display text-sm font-semibold text-white">
              Space Members ({space.members.length})
            </h3>

            {space.type === 'personal' ? (
              <div className="mt-3 rounded-md border border-[#23262E] bg-[#101216] p-3.5 text-xs leading-relaxed text-[#9CA3AF]">
                <div className="flex items-center gap-1.5 font-medium text-white">
                  <Lock className="h-3.5 w-3.5 text-[#F97316]" />
                  <span>Strictly Private</span>
                </div>
                <p className="mt-1.5">
                  Personal Spaces are private to you and cannot accept external
                  members. Create a Family or Community Space to collaborate.
                </p>
              </div>
            ) : (
              <>
                {memberError && (
                  <div className="mt-3 rounded-md border border-[#522424] bg-[#291416] px-3 py-2 text-xs text-[#FCA5A5]">
                    {memberError}
                  </div>
                )}
                {memberSuccess && (
                  <div className="mt-3 rounded-md border border-[#1E4734] bg-[#0E1E16] px-3 py-2 text-xs text-[#6EE7B7]">
                    {memberSuccess}
                  </div>
                )}

                {canManageMembers && (
                  <form
                    onSubmit={handleInvite}
                    className="mt-4 space-y-2.5 border-b border-[#20232B] pb-4"
                  >
                    <label
                      htmlFor="invite-email"
                      className="block text-xs font-medium text-[#CBD5E1]"
                    >
                      Invite Member by Email
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="member@example.com"
                      className="w-full rounded-md border border-[#2B2E38] bg-[#0F1114] px-3 py-2 text-xs text-white placeholder-[#6B7280] focus:border-[#F97316] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <select
                        aria-label="Member role"
                        value={inviteRole}
                        onChange={(e) =>
                          setInviteRole(e.target.value as 'member' | 'admin')
                        }
                        className="rounded-md border border-[#2B2E38] bg-[#0F1114] px-2.5 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none"
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        type="submit"
                        disabled={inviting}
                        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-[#F97316] px-3 py-2 text-xs font-medium text-white hover:bg-[#EA580C] disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        <span>{inviting ? 'Inviting...' : 'Add Member'}</span>
                      </button>
                    </div>
                  </form>
                )}

                <div className="mt-4 divide-y divide-[#20232B]">
                  {space.members.map((m) => {
                    const isSelf = m.userId === user?.id;
                    return (
                      <div
                        key={m.userId}
                        className="flex items-center justify-between gap-2 py-2.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">
                            {m.displayName} {isSelf ? '(You)' : ''}
                          </div>
                          <div className="truncate text-[11px] text-[#8B929E]">
                            {m.email}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          {space.currentUserRole === 'owner' && !isSelf ? (
                            <select
                              aria-label={`Role for ${m.displayName}`}
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(
                                  m.userId,
                                  e.target.value as SpaceRole
                                )
                              }
                              className="rounded border border-[#2B2E38] bg-[#0F1114] px-2 py-1 text-[11px] text-[#E5E7EB]"
                            >
                              <option value="member">member</option>
                              <option value="admin">admin</option>
                              <option value="owner">owner</option>
                            </select>
                          ) : (
                            <span className="font-mono text-[11px] text-[#9CA3AF]">
                              {m.role}
                            </span>
                          )}

                          {canManageMembers &&
                            !isSelf &&
                            (space.currentUserRole === 'owner'
                              ? m.role !== 'owner' ||
                                space.members.filter((member) => member.role === 'owner')
                                  .length > 1
                              : m.role === 'member') && (
                            <button
                              type="button"
                              onClick={() =>
                                setMemberToRemove({
                                  userId: m.userId,
                                  displayName: m.displayName,
                                })
                              }
                              className="rounded p-1 text-[#8B929E] hover:bg-[#291416] hover:text-[#FCA5A5]"
                              aria-label={`Remove ${m.displayName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={Boolean(memberToRemove)}
        title="Remove Member"
        description={`Remove ${memberToRemove?.displayName} from ${space.name}? They will lose access to Matters in this space.`}
        confirmLabel="Remove Member"
        destructive
        loading={removing}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
}
