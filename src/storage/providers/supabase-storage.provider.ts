import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { Configuration } from '../../config/configuration.js';
import {
  StorageProvider,
  UploadFileInput,
  UploadFileResult,
} from '../storage.interface.js';

const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 15;

@Injectable()
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = 'supabase';
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private readonly client: SupabaseClient | null;
  private readonly bucket: string;

  constructor(configService: ConfigService<Configuration, true>) {
    const storageConfig = configService.get('storage', { infer: true });
    this.bucket = storageConfig.supabaseStorageBucket;

    if (storageConfig.supabaseUrl && storageConfig.supabaseServiceRoleKey) {
      // Service-role key lives only on the backend and is never sent to mobile/web clients.
      this.client = createClient(
        storageConfig.supabaseUrl,
        storageConfig.supabaseServiceRoleKey,
      );
    } else {
      this.client = null;
      this.logger.warn(
        'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not configured - Supabase Storage calls will fail until they are set.',
      );
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async upload(input: UploadFileInput): Promise<UploadFileResult> {
    const client = this.getClientOrThrow();
    const folder = input.folder ?? 'uploads';
    const path = `${folder}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}-${input.fileName}`;

    const { error } = await client.storage
      .from(this.bucket)
      .upload(path, input.buffer, {
        contentType: input.contentType,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Supabase Storage upload failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to store the uploaded file.',
      );
    }

    return { path };
  }

  async getSignedUrl(
    path: string,
    expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
  ): Promise<string> {
    const client = this.getClientOrThrow();
    const { data, error } = await client.storage
      .from(this.bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error || !data) {
      this.logger.error(
        `Supabase Storage signed URL failed: ${error?.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to generate a playback URL.',
      );
    }

    return data.signedUrl;
  }

  async delete(path: string): Promise<void> {
    const client = this.getClientOrThrow();
    const { error } = await client.storage.from(this.bucket).remove([path]);
    if (error) {
      this.logger.error(`Supabase Storage delete failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to delete the stored file.',
      );
    }
  }

  private getClientOrThrow(): SupabaseClient {
    if (!this.client) {
      throw new InternalServerErrorException(
        'Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }
    return this.client;
  }
}
