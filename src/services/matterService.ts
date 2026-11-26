import type {
  Matter,
  MatterDetail,
  MatterPriority,
  MatterStatus,
  MatterUpdate,
  TimelineEvent,
} from '../types/lifeos.ts';
import { api } from './api.ts';

export interface MatterFilters {
  spaceId?: string;
  status?: string;
  priority?: string;
  assignedToMe?: boolean;
  search?: string;
  includeArchived?: boolean;
}

export interface MatterPayload {
  title: string;
  description?: string;
  category?: string;
  status?: MatterStatus;
  priority?: MatterPriority;
  ownerId?: string | null;
  waitingFor?: string | null;
  nextAction?: string | null;
  nextActionAt?: string | null;
  dueAt?: string | null;
  resolution?: string | null;
  participantIds?: string[];
}

export async function fetchMatters(filters: MatterFilters = {}): Promise<Matter[]> {
  const params: Record<string, string> = {};
  if (filters.spaceId) params.spaceId = filters.spaceId;
  if (filters.status && filters.status !== 'All') params.status = filters.status;
  if (filters.priority && filters.priority !== 'All') params.priority = filters.priority;
  if (filters.assignedToMe) params.assignedToMe = 'true';
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.includeArchived) params.includeArchived = 'true';

  const { data } = await api.get<{ matters: Matter[] }>('/matters', { params });
  return data.matters;
}

export async function fetchSpaceMatters(
  spaceId: string,
  filters: Omit<MatterFilters, 'spaceId'> = {}
): Promise<Matter[]> {
  const params: Record<string, string> = {};
  if (filters.status && filters.status !== 'All') params.status = filters.status;
  if (filters.priority && filters.priority !== 'All') params.priority = filters.priority;
  if (filters.assignedToMe) params.assignedToMe = 'true';
  if (filters.search?.trim()) params.search = filters.search.trim();
  if (filters.includeArchived) params.includeArchived = 'true';

  const { data } = await api.get<{ matters: Matter[] }>(
    `/spaces/${spaceId}/matters`,
    { params }
  );
  return data.matters;
}

export async function createMatter(
  spaceId: string,
  payload: MatterPayload
): Promise<Matter> {
  const { data } = await api.post<{ matter: Matter }>(
    `/spaces/${spaceId}/matters`,
    payload
  );
  return data.matter;
}

export async function fetchMatterDetail(matterId: string): Promise<MatterDetail> {
  const { data } = await api.get<{ matter: MatterDetail }>(`/matters/${matterId}`);
  return data.matter;
}

export async function updateMatter(
  matterId: string,
  payload: Partial<MatterPayload>
): Promise<MatterDetail> {
  const { data } = await api.put<{ matter: MatterDetail }>(
    `/matters/${matterId}`,
    payload
  );
  return data.matter;
}

export async function deleteMatter(matterId: string): Promise<void> {
  await api.delete(`/matters/${matterId}`);
}

export async function addMatterUpdate(
  matterId: string,
  payload: { message: string; updateType?: string }
): Promise<MatterUpdate> {
  const { data } = await api.post<{ update: MatterUpdate }>(
    `/matters/${matterId}/updates`,
    payload
  );
  return data.update;
}

export async function fetchTimeline(spaceId?: string): Promise<TimelineEvent[]> {
  const params: Record<string, string> = {};
  if (spaceId && spaceId !== 'All') params.spaceId = spaceId;
  const { data } = await api.get<{ events: TimelineEvent[] }>('/timeline', {
    params,
  });
  return data.events;
}
