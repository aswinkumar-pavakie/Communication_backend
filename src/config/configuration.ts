export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
}

export interface DatabaseConfig {
  url: string;
  directUrl: string;
}

export interface JwtConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

export interface CorsConfig {
  origins: string[];
}

export interface AiConfig {
  mode: 'mock' | 'live';
  stt: { provider: string; apiKey?: string };
  llm: { provider: string; apiKey?: string };
  tts: { provider: string; apiKey?: string; googleCredentialsPath?: string };
}

export interface StorageConfig {
  provider: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  supabaseStorageBucket: string;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
  aiTtl: number;
  aiLimit: number;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  cors: CorsConfig;
  ai: AiConfig;
  storage: StorageConfig;
  throttle: ThrottleConfig;
}

export default (): Configuration => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3000', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
  },
  database: {
    url: process.env.DATABASE_URL ?? '',
    directUrl: process.env.DIRECT_URL ?? '',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? '',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  cors: {
    origins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  ai: {
    mode: (process.env.AI_MODE as 'mock' | 'live') ?? 'mock',
    stt: {
      provider: process.env.STT_PROVIDER ?? 'mock',
      apiKey: process.env.STT_API_KEY,
    },
    llm: {
      provider: process.env.LLM_PROVIDER ?? 'mock',
      apiKey: process.env.LLM_API_KEY,
    },
    tts: {
      provider: process.env.TTS_PROVIDER ?? 'mock',
      apiKey: process.env.TTS_API_KEY,
      googleCredentialsPath: process.env.GOOGLE_TTS_CREDENTIALS_PATH,
    },
  },
  storage: {
    provider: process.env.STORAGE_PROVIDER ?? 'supabase',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseStorageBucket:
      process.env.SUPABASE_STORAGE_BUCKET ?? 'voice-recordings',
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
    aiTtl: parseInt(process.env.AI_THROTTLE_TTL ?? '60', 10),
    aiLimit: parseInt(process.env.AI_THROTTLE_LIMIT ?? '10', 10),
  },
});
