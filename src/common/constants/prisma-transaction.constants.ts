/**
 * Options for the "complete an attempt/session" interactive transactions
 * (activities, interviews, roleplay, debates, writing). Prisma's default
 * transaction timeout (5000ms) is too tight once these run against a real,
 * network-hosted Postgres instance with several sequential writes inside the
 * transaction (assessment persistence, progress, recommendations, streak) -
 * it was getting tripped intermittently once live AI providers and their
 * added latency were introduced. The LLM assessment call itself always runs
 * *before* the transaction opens, so this only needs to cover DB round-trips.
 */
export const COMPLETION_TRANSACTION_OPTIONS = { timeout: 15_000 };
