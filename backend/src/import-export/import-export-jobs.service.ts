import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { BulkImportResultDto } from './import-export.service';

export type ImportJobEntity = 'contacts' | 'companies' | 'opportunities' | 'flota-prospecto';
export type ImportJobStatus = 'queued' | 'running' | 'completed' | 'failed';

export type ImportJobProgressInput = {
  processedRows: number;
  created: number;
  updated?: number;
  linked?: number;
  blocked?: number;
  processed?: number;
  skipped: number;
  errorCount: number;
};

type ImportJobState = {
  id: string;
  entity: ImportJobEntity;
  ownerUserId: string;
  filename?: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  linked: number;
  blocked: number;
  processed: number;
  skipped: number;
  errorCount: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  result?: BulkImportResultDto;
  errorMessage?: string;
};

export type ImportJobDto = {
  id: string;
  entity: ImportJobEntity;
  filename?: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  created: number;
  updated: number;
  linked: number;
  blocked: number;
  processed: number;
  skipped: number;
  errorCount: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  finishedAt?: string;
  result?: BulkImportResultDto;
  errorMessage?: string;
};

@Injectable()
export class ImportExportJobsService {
  private readonly jobs = new Map<string, ImportJobState>();

  private toDto(job: ImportJobState): ImportJobDto {
    const percent =
      job.totalRows > 0
        ? Math.min(100, Math.max(0, Math.round((job.processedRows / job.totalRows) * 100)))
        : job.status === 'completed'
          ? 100
          : 0;
    return {
      id: job.id,
      entity: job.entity,
      filename: job.filename,
      status: job.status,
      totalRows: job.totalRows,
      processedRows: job.processedRows,
      created: job.created,
      updated: job.updated,
      linked: job.linked,
      blocked: job.blocked,
      processed: job.processed,
      skipped: job.skipped,
      errorCount: job.errorCount,
      percent,
      startedAt: job.startedAt,
      updatedAt: job.updatedAt,
      finishedAt: job.finishedAt,
      result: job.result,
      errorMessage: job.errorMessage,
    };
  }

  private pruneOwnerJobs(ownerUserId: string) {
    const ownerJobs = [...this.jobs.values()]
      .filter((job) => job.ownerUserId === ownerUserId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    for (const stale of ownerJobs.slice(15)) {
      this.jobs.delete(stale.id);
    }
  }

  startJob(
    params: {
      entity: ImportJobEntity;
      ownerUserId: string;
      totalRows: number;
      filename?: string;
    },
    runner: (update: (progress: ImportJobProgressInput) => void) => Promise<BulkImportResultDto>,
  ): ImportJobDto {
    const now = new Date().toISOString();
    const job: ImportJobState = {
      id: randomUUID(),
      entity: params.entity,
      ownerUserId: params.ownerUserId,
      filename: params.filename,
      status: 'queued',
      totalRows: params.totalRows,
      processedRows: 0,
      created: 0,
      updated: 0,
      linked: 0,
      blocked: 0,
      processed: 0,
      skipped: 0,
      errorCount: 0,
      startedAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    this.pruneOwnerJobs(params.ownerUserId);

    setTimeout(() => {
      void this.runJob(job.id, runner);
    }, 0);

    return this.toDto(job);
  }

  private async runJob(
    jobId: string,
    runner: (update: (progress: ImportJobProgressInput) => void) => Promise<BulkImportResultDto>,
  ) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    job.status = 'running';
    job.updatedAt = new Date().toISOString();

    try {
      const result = await runner((progress) => {
        const current = this.jobs.get(jobId);
        if (!current) return;
        current.processedRows = Math.min(current.totalRows, Math.max(0, progress.processedRows));
        current.created = Math.max(0, progress.created);
        if (progress.updated !== undefined) current.updated = Math.max(0, progress.updated);
        if (progress.linked !== undefined) current.linked = Math.max(0, progress.linked);
        if (progress.blocked !== undefined) current.blocked = Math.max(0, progress.blocked);
        if (progress.processed !== undefined) current.processed = Math.max(0, progress.processed);
        current.skipped = Math.max(0, progress.skipped);
        current.errorCount = Math.max(0, progress.errorCount);
        current.updatedAt = new Date().toISOString();
      });
      const finished = this.jobs.get(jobId);
      if (!finished) return;
      finished.status = 'completed';
      finished.processedRows = finished.totalRows;
      finished.processed = result.processed;
      finished.created = result.created;
      finished.updated = result.updated;
      finished.linked = result.linked;
      finished.blocked = result.blocked;
      finished.skipped = result.skipped;
      finished.errorCount = result.errors.length;
      finished.result = result;
      finished.finishedAt = new Date().toISOString();
      finished.updatedAt = finished.finishedAt;
    } catch (error: unknown) {
      const failed = this.jobs.get(jobId);
      if (!failed) return;
      failed.status = 'failed';
      failed.errorMessage =
        error instanceof Error ? error.message : 'Error inesperado al importar';
      failed.finishedAt = new Date().toISOString();
      failed.updatedAt = failed.finishedAt;
    }
  }

  getJob(jobId: string, ownerUserId: string): ImportJobDto {
    const job = this.jobs.get(jobId);
    if (!job || job.ownerUserId !== ownerUserId) {
      throw new NotFoundException('Importación no encontrada');
    }
    return this.toDto(job);
  }
}
