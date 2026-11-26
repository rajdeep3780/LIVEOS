export type SpaceType = 'personal' | 'family' | 'community';
export type SpaceRole = 'owner' | 'admin' | 'member';

export type MatterStatus =
  | 'Open'
  | 'In Progress'
  | 'Waiting'
  | 'Completed'
  | 'Archived';

export type MatterPriority = 'Low' | 'Normal' | 'High';

export interface User {
  id: string;
  uid: string | null;
  displayName: string;
  email: string;
  createdAt: string;
}

export interface PersonSummary {
  id: string;
  displayName: string;
  email: string;
}

export interface SpaceMember {
  membershipId?: string;
  spaceId?: string;
  userId: string;
  displayName: string;
  email: string;
  role: SpaceRole;
  joinedAt?: string;
}

export interface SpaceSummary {
  id: string;
  name: string;
  type: SpaceType;
  description: string;
  createdBy: string;
  createdAt: string;
  role: SpaceRole;
  memberCount: number;
  activeMatterCount: number;
  totalMatterCount: number;
  members: SpaceMember[];
}

export interface SpaceDetail {
  id: string;
  name: string;
  type: SpaceType;
  description: string;
  createdBy: string;
  createdAt: string;
  currentUserRole: SpaceRole;
  members: SpaceMember[];
}

export interface MatterUpdate {
  id: string;
  matterId: string;
  authorId: string | null;
  updateType: string;
  message: string;
  createdAt: string;
  authorName: string | null;
  authorEmail?: string | null;
}

export interface Matter {
  id: string;
  spaceId: string;
  createdBy: string | null;
  ownerId: string | null;
  title: string;
  description: string;
  category: string;
  status: MatterStatus;
  priority: MatterPriority;
  waitingFor: string | null;
  nextAction: string | null;
  nextActionAt: string | null;
  dueAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  space: {
    id: string;
    name: string;
    type: SpaceType;
  } | null;
  owner: PersonSummary | null;
  creator: PersonSummary | null;
  participants: PersonSummary[];
  updateCount: number;
}

export interface MatterPermissions {
  canEditDetails: boolean;
  canChangeStatusPriority: boolean;
  canChangeOwnership: boolean;
  canManageParticipants: boolean;
  canArchiveRestore: boolean;
  canDelete: boolean;
  canPostUpdate: boolean;
}

export interface MatterDetail extends Matter {
  currentUserRole: SpaceRole;
  permissions?: MatterPermissions;
  updates: MatterUpdate[];
  spaceMembers: SpaceMember[];
}

export interface TimelineEvent {
  id: string;
  matterId: string;
  authorId: string | null;
  updateType: string;
  message: string;
  createdAt: string;
  matterTitle: string;
  matterStatus: MatterStatus;
  spaceId: string;
  spaceName: string;
  spaceType: SpaceType;
  authorName: string | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  matterId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
  matterTitle: string | null;
  matterStatus: MatterStatus | null;
  spaceName: string | null;
}

export interface AttentionMatter extends Matter {
  attentionReason:
    | 'overdue_followup'
    | 'upcoming_followup'
    | 'waiting_followup'
    | 'pending_action';
}

export interface DashboardData {
  counts: {
    open: number;
    inProgress: number;
    waiting: number;
    completed: number;
  };
  myMatters: Matter[];
  needsAttention: AttentionMatter[];
  recentActivity: TimelineEvent[];
  spaces: SpaceSummary[];
  unreadNotifications: number;
}
