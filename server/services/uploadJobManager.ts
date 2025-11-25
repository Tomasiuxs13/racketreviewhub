import { randomUUID } from "crypto";
import {
  processRacketUpload,
  type UploadResults,
  type UploadProgressUpdate,
} from "./racketUpload.js";

export type UploadJobStatus = "pending" | "processing" | "completed" | "failed";

export interface UploadJobProgress extends UploadProgressUpdate {}

export interface UploadJobSummary {
  id: string;
  filename: string;
  status: UploadJobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  userId?: string;
  progress: UploadJobProgress;
  result?: UploadResults;
  error?: string;
}

interface QueueItem {
  jobId: string;
  buffer: Buffer;
  filename: string;
}

class UploadJobManager {
  private jobs = new Map<string, UploadJobSummary>();
  private queue: QueueItem[] = [];
  private processing = false;

  enqueue(buffer: Buffer, filename: string, userId?: string): UploadJobSummary {
    const id = randomUUID();
    const job: UploadJobSummary = {
      id,
      filename,
      status: "pending",
      createdAt: new Date().toISOString(),
      userId,
      progress: {},
    };

    this.jobs.set(id, job);
    this.queue.push({ jobId: id, buffer, filename });
    this.processNext();
    return this.sanitizeJob(job);
  }

  getJob(id: string): UploadJobSummary | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    return this.sanitizeJob(job);
  }

  listJobs(limit = 20): UploadJobSummary[] {
    const jobs = Array.from(this.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    return jobs.map((job) => this.sanitizeJob(job));
  }

  private sanitizeJob(job: UploadJobSummary): UploadJobSummary {
    return {
      ...job,
      progress: { ...job.progress },
      result: job.result ? { ...job.result, preview: job.result.preview } : undefined,
    };
  }

  private updateJob(id: string, updates: Partial<UploadJobSummary>) {
    const job = this.jobs.get(id);
    if (!job) return;
    Object.assign(job, updates);
    job.progress = { ...job.progress, ...(updates.progress ?? {}) };
    this.jobs.set(id, job);
  }

  private async processNext() {
    if (this.processing) return;
    const item = this.queue.shift();
    if (!item) return;

    this.processing = true;
    const job = this.jobs.get(item.jobId);
    if (!job) {
      this.processing = false;
      return;
    }

    this.updateJob(job.id, {
      status: "processing",
      startedAt: new Date().toISOString(),
    });

    try {
      const result = await processRacketUpload(item.buffer, item.filename, {
        uploadId: job.id,
        onProgress: (progress) => {
          this.updateJob(job.id, {
            progress: {
              ...job.progress,
              ...progress,
            },
          });
        },
      });

      this.updateJob(job.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        result,
        progress: {
          ...job.progress,
          stage: "completed",
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to process upload";
      this.updateJob(job.id, {
        status: "failed",
        completedAt: new Date().toISOString(),
        error: message,
        progress: {
          ...job.progress,
          stage: "failed",
          message,
        },
      });
    } finally {
      item.buffer = Buffer.alloc(0);
      this.processing = false;
      this.processNext();
    }
  }
}

export const uploadJobManager = new UploadJobManager();

