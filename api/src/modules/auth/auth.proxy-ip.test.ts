import { expect, test } from "bun:test"

const script = `
import assert from "node:assert/strict";
const target = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
assert.equal(target.port, "5434");
const { app } = await import("~/app");
const { db } = await import("~/shared/db/client");
const { resetDb } = await import("./tests/helpers");
const { signClientIp } = await import("@sayaratak/shared/lib/proxy-client-ip");
try {
  await resetDb();
  const origin = process.env.API_PUBLIC_ORIGIN;
  const login = origin + "/api/v1/auth/sign-in/email";
  const headers = signClientIp(new Request(login, { method: "POST" }), {
    ip: "192.0.2.7", secret: process.env.PROXY_CLIENT_IP_SECRET, now: Date.now(),
  });
  headers.set("content-type", "application/json");
  headers.set("origin", process.env.WEB_ORIGIN);
  headers.set("cf-connecting-ip", "198.51.100.9");
  headers.set("x-sy-client-ip", "6.6.6.6");
  const body = JSON.stringify({ email: "user@demo.sy", password: "Demo1234" });
  const signed = await app.request(login, { method: "POST", headers, body });
  assert.equal(signed.status, 200);
  // Fixed local-test catalog query verifies the IP Better-Auth persisted, not a configuration mock.
  const [{ ip_address }] = await db.$client.unsafe("select ip_address from session where user_id = 'u-omar' order by created_at desc limit 1");
  assert.equal(ip_address, "192.0.2.7");
  const cookie = signed.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  const meUrl = origin + "/api/v1/me";
  const ssr = signClientIp(new Request(meUrl), {
    ip: "192.0.2.7", secret: process.env.PROXY_CLIENT_IP_SECRET, now: Date.now(),
  });
  ssr.set("cookie", cookie);
  const me = await app.request(meUrl, { headers: ssr });
  assert.equal((await me.json()).id, "u-omar");
  const mobile = await app.request(login, { method: "POST", body, headers: {
    "content-type": "application/json", "cf-connecting-ip": "192.0.2.8",
    "x-sy-client-ip": "6.6.6.6",
  }});
  assert.equal(mobile.status, 200);
  const token = (await mobile.json()).token;
  const nativeMe = await app.request(meUrl, { headers: {
    authorization: "Bearer " + token, "cf-connecting-ip": "192.0.2.8",
  }});
  assert.equal((await nativeMe.json()).id, "u-omar");
  process.stdout.write("render-auth-ip-ok");
} finally { await db.$client.close(); }
`

test("signed web/SSR and direct native sessions preserve trusted IP without auth bypass", () => {
  const run = Bun.spawnSync(["bun", "--no-env-file", "-e", script], {
    cwd: `${import.meta.dir}/../../..`,
    env: {
      PATH: process.env.PATH,
      DATABASE_URL: process.env.TEST_DATABASE_URL,
      NODE_ENV: "test",
      APP_ENV: "test",
      WEB_ORIGIN: "http://localhost:3000",
      BETTER_AUTH_URL: "http://localhost:4000",
      BETTER_AUTH_SECRET: "local-auth-test-secret-0123456789abcdef",
      CLIENT_IP_MODE: "render",
      API_PUBLIC_ORIGIN: "https://api.example.test",
      PROXY_CLIENT_IP_SECRET: "local-proxy-test-key-0123456789abcdef",
      LOG_REQUESTS: "false",
    },
  })
  expect(run.stderr.toString()).toBe("")
  expect(run.exitCode).toBe(0)
  expect(run.stdout.toString()).toBe("render-auth-ip-ok")
})
