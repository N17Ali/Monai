/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  GOOGLE_API_KEY?: string;
}
