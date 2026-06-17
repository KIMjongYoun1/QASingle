import { api } from './client';
import type { Project } from '../types/qa';

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get('/api/projects');
  return data;
}

export async function createProject(name: string): Promise<Project> {
  const { data } = await api.post('/api/projects', { name });
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}
