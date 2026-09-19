import { describe, expect, it } from "vitest";
import packageJson from "../package.json";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("production deployment", () => {
  it("pins Hugeicons to the known-good Linux-safe release", () => {
    expect(packageJson.dependencies["@hugeicons/core-free-icons"]).toBe("4.3.0");
  });

  it("applies remote D1 migrations before deploying the Worker", () => {
    expect(packageJson.scripts.deploy).toMatch(/db:migrate:remote.*wrangler deploy/);
  });

  it("preserves dashboard variables during Wrangler deployments", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "wrangler.jsonc"), "utf8"));
    expect(config.keep_vars).toBe(true);
  });
});
