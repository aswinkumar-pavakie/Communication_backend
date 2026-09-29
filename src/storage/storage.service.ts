import { Injectable } from '@nestjs/common';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider.js';
import {
  StorageProvider,
  UploadFileInput,
  UploadFileResult,
} from './storage.interface.js';

/**
 * Business logic (voice, interviews, writing, ...) must depend on this service only -
 * never on SupabaseStorageProvider directly - so the storage backend stays replaceable.
 */
@Injectable()
export class StorageService {
  constructor(private readonly provider: SupabaseStorageProvider) {}

  isConfigured(): boolean {
    return (this.provider as StorageProvider).isConfigured();
  }

  upload(input: UploadFileInput): Promise<UploadFileResult> {
    return (this.provider as StorageProvider).upload(input);
  }

  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string> {
    return (this.provider as StorageProvider).getSignedUrl(
      path,
      expiresInSeconds,
    );
  }

  delete(path: string): Promise<void> {
    return (this.provider as StorageProvider).delete(path);
  }
}
