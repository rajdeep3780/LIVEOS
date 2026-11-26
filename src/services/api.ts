import axios from 'axios';

let inMemoryToken: string | null = null;
let firebaseTokenResolver: (() => Promise<string | null>) | null = null;

export function setInMemoryAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function setFirebaseTokenResolver(
  resolver: (() => Promise<string | null>) | null
) {
  firebaseTokenResolver = resolver;
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

api.interceptors.request.use(async (config) => {
  if (inMemoryToken) {
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  } else if (firebaseTokenResolver) {
    const fbToken = await firebaseTokenResolver();
    if (fbToken) {
      config.headers.Authorization = `Bearer ${fbToken}`;
    }
  }
  return config;
});

export function extractErrorMessage(err: unknown, fallback = 'Something went wrong.') {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
