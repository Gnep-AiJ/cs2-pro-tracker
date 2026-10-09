declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AI?: Ai;
  }
}

// Cloudflare extends the standard browser CacheStorage with its default cache.
interface CacheStorage {
  readonly default: Cache;
}
