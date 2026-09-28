export interface UploadFileInput {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  /** Logical sub-folder inside the bucket, e.g. "voice-attempts" or "interview-answers". */
  folder?: string;
}

export interface UploadFileResult {
  /** Storage path/reference to persist in the database - never a raw blob. */
  path: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(input: UploadFileInput): Promise<UploadFileResult>;
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  delete(path: string): Promise<void>;
}
