import Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api/v1'),

  DATABASE_URL: Joi.string().required(),
  DIRECT_URL: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  CORS_ORIGINS: Joi.string().allow('').default(''),

  AI_MODE: Joi.string().valid('mock', 'live').default('mock'),

  STT_PROVIDER: Joi.string().default('mock'),
  STT_API_KEY: Joi.string().allow('').optional(),

  LLM_PROVIDER: Joi.string().default('mock'),
  LLM_API_KEY: Joi.string().allow('').optional(),

  TTS_PROVIDER: Joi.string().default('mock'),
  TTS_API_KEY: Joi.string().allow('').optional(),

  STORAGE_PROVIDER: Joi.string().default('supabase'),
  SUPABASE_URL: Joi.string().allow('').optional(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().allow('').optional(),
  SUPABASE_STORAGE_BUCKET: Joi.string().default('voice-recordings'),

  THROTTLE_TTL: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
  AI_THROTTLE_TTL: Joi.number().default(60),
  AI_THROTTLE_LIMIT: Joi.number().default(10),
});
