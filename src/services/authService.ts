import type { User } from '../types/lifeos.ts';
import { api, setInMemoryAuthToken } from './api.ts';

export async function registerUser(payload: {
  displayName: string;
  email: string;
  password: string;
}): Promise<User> {
  const { data } = await api.post<{ user: User; token: string }>(
    '/auth/register',
    payload
  );
  setInMemoryAuthToken(data.token);
  return data.user;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<User> {
  const { data } = await api.post<{ user: User; token: string }>(
    '/auth/login',
    payload
  );
  setInMemoryAuthToken(data.token);
  return data.user;
}

export async function logoutUser(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    setInMemoryAuthToken(null);
  }
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<{ user: User }>('/auth/me');
  return data.user;
}

export async function updateUserProfile(displayName: string): Promise<User> {
  const { data } = await api.patch<{ user: User }>('/auth/profile', {
    displayName,
  });
  return data.user;
}
