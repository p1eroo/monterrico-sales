import { create } from 'zustand';
import { getImportJob, type ImportJob } from '@/lib/importExportApi';

type ImportEntity = ImportJob['entity'];

type ImportJobsState = {
  jobs: ImportJob[];
  completionTickByEntity: Record<ImportEntity, number>;
  enqueueJob: (job: ImportJob) => void;
  upsertJob: (job: ImportJob) => void;
  dismissJob: (jobId: string) => void;
  pollActiveJobs: () => Promise<void>;
};

function sortJobs(items: ImportJob[]) {
  return [...items].sort((a, b) => {
    const activeA = a.status === 'queued' || a.status === 'running';
    const activeB = b.status === 'queued' || b.status === 'running';
    if (activeA !== activeB) return activeA ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export const useImportJobsStore = create<ImportJobsState>((set, get) => ({
  jobs: [],
  completionTickByEntity: {
    contacts: 0,
    companies: 0,
    opportunities: 0,
  },
  enqueueJob: (job) =>
    set((state) => ({
      jobs: sortJobs([job, ...state.jobs.filter((item) => item.id !== job.id)]).slice(0, 8),
    })),
  upsertJob: (job) =>
    set((state) => {
      const prev = state.jobs.find((item) => item.id === job.id);
      const justFinished =
        prev &&
        prev.status !== 'completed' &&
        prev.status !== 'failed' &&
        (job.status === 'completed' || job.status === 'failed');
      return {
        jobs: sortJobs([job, ...state.jobs.filter((item) => item.id !== job.id)]).slice(0, 8),
        completionTickByEntity: justFinished
          ? {
              ...state.completionTickByEntity,
              [job.entity]: Date.now(),
            }
          : state.completionTickByEntity,
      };
    }),
  dismissJob: (jobId) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
    })),
  pollActiveJobs: async () => {
    const activeJobs = get().jobs.filter(
      (job) =>
        (job.status === 'queued' || job.status === 'running') &&
        !job.id.startsWith('mock-import-'),
    );
    if (activeJobs.length === 0) return;

    await Promise.all(
      activeJobs.map(async (job) => {
        try {
          const fresh = await getImportJob(job.id);
          get().upsertJob(fresh);
        } catch {
          /* mantener el estado actual; el siguiente polling puede recuperar */
        }
      }),
    );
  },
}));
