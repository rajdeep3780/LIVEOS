import type {
  SpaceDetail,
  SpaceMember,
  SpaceRole,
  SpaceSummary,
} from '../types/lifeos.ts';
import { api } from './api.ts';

export async function fetchSpaces(): Promise<SpaceSummary[]> {
  const { data } = await api.get<{ spaces: SpaceSummary[] }>('/spaces');
  return data.spaces;
}

export async function createSpace(payload: {
  name: string;
  type: 'family' | 'community';
  description?: string;
}) {
  const { data } = await api.post('/spaces', payload);
  return data.space;
}

export async function fetchSpaceDetail(spaceId: string): Promise<SpaceDetail> {
  const { data } = await api.get<{ space: SpaceDetail }>(`/spaces/${spaceId}`);
  return data.space;
}

export async function inviteSpaceMember(
  spaceId: string,
  payload: { email: string; role: 'admin' | 'member' }
): Promise<SpaceMember> {
  const { data } = await api.post<{ member: SpaceMember }>(
    `/spaces/${spaceId}/members`,
    payload
  );
  return data.member;
}

export async function updateMemberRole(
  spaceId: string,
  userId: string,
  role: SpaceRole
) {
  const { data } = await api.patch(`/spaces/${spaceId}/members/${userId}`, {
    role,
  });
  return data.membership;
}

export async function removeSpaceMember(spaceId: string, userId: string) {
  const { data } = await api.delete(`/spaces/${spaceId}/members/${userId}`);
  return data;
}
