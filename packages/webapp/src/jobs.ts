import { randomUUID } from 'node:crypto';

export interface Job {
  id: string;
  kind: string;
  status: 'running' | 'done' | 'error';
  startedAt: number;
  result?: unknown;
  error?: string;
}

const jobs = new Map<string, Job>();
let running: Job | null = null;

/** Nur ein Bildjob gleichzeitig (RAM: Klein 9B braucht ~20 GB). */
export function startJob(kind: string, work: () => Promise<unknown>): Job {
  if (running) throw new Error('Es läuft bereits eine Bildgenerierung. Bitte warten.');
  const job: Job = { id: randomUUID(), kind, status: 'running', startedAt: Date.now() };
  jobs.set(job.id, job);
  running = job;
  work()
    .then((r) => { job.result = r; job.status = 'done'; })
    .catch((e) => { job.error = e instanceof Error ? e.message : String(e); job.status = 'error'; })
    .finally(() => { running = null; });
  return job;
}

export function getJob(id: string): Job | undefined {
  return jobs.get(id);
}
