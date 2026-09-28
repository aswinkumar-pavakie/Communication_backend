import { Module } from '@nestjs/common';
import { SupabaseStorageProvider } from './providers/supabase-storage.provider.js';
import { StorageService } from './storage.service.js';

@Module({
  providers: [SupabaseStorageProvider, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
