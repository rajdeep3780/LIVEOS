import type { DashboardData } from '../types/lifeos.ts';
import { api } from './api.ts';

export async function fetchDashboard(): Promise<DashboardData> {
  const { data } = await api.get<DashboardData>('/dashboard');
  return data;
}
