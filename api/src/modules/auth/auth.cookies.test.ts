import { expect, test } from "bun:test"

const script = String.raw`
import assert from "node:assert/strict";
const target = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1"].includes(target.hostname));
assert.equal(target.port, "5434");
const { app } = await import("~/app");
const { db } = await import("~/shared/db/client");
const { resetDb } = await import("./tests/helpers");
const { fileOf } = await import("./tests/files");
const { eq } = await import("drizzle-orm");
const { user } = await import("~/modules/auth/auth.tables");
const { storePrivateFile } = await import("~/modules/uploads/uploads.store.service");
const { flushMail, testInbox } = await import("~/shared/mail/send");
try {
  await resetDb();
  const origin = process.env.WEB_ORIGIN;
  const credentials = email => ({ email, password: "Demo1234" });
  const post = (path, cookie = "", body = credentials("user@demo.sy")) => app.request(origin + "/api/v1/auth" + path, {
    method: "POST", headers: { origin, cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const login = await post("/sign-in/email");
  assert.equal(login.status, 200);
  const secure = origin.startsWith("https:");
  const name = (secure ? "__Secure-" : "") + "sy.session_token";
  const cookies = login.headers.getSetCookie();
  assert.ok(cookies.some(value => value.startsWith(name + "=")), "HTTPS development session must use secure prefix");
  for (const value of cookies) {
    assert.match(value, /; Path=\//i);
    assert.match(value, /; HttpOnly/i);
    assert.match(value, /; SameSite=Lax/i);
    assert.equal(/; Secure(?:;|$)/i.test(value), secure);
    if (process.env.COOKIE_DOMAIN) assert.match(value, /; Domain=example.test/i);
    else assert.doesNotMatch(value, /; Domain=/i);
  }
  const cookie = cookies.map(value => value.split(";")[0]).join("; ");
  for (let reload = 0; reload < 2; reload++) {
    const me = await app.request(origin + "/api/v1/me", { headers: { cookie } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).id, "u-omar");
  }
  const [owner] = await db.select().from(user).where(eq(user.id, "u-omar"));
  const upload = await storePrivateFile(db, { user: owner, file: fileOf("png", { size: 100 }), kind: "receipt" });
  assert.equal(upload.url, origin + "/api/v1/uploads/" + upload.id);
  const read = headers => app.request(upload.url, { headers });
  const owned = await read({ cookie });
  assert.equal(owned.status, 200);
  assert.equal((await owned.arrayBuffer()).byteLength, 100);
  assert.equal((await read({})).status, 404);
  const other = await post("/sign-in/email", "", credentials("workshop@demo.sy"));
  assert.equal(other.status, 200);
  const otherCookie = other.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.equal((await read({ cookie: otherCookie })).status, 404);
  const admin = await post("/sign-in/email", "", credentials("admin@demo.sy"));
  assert.equal(admin.status, 200);
  assert.equal((await admin.json()).twoFactorRedirect, true);
  const challenge = admin.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.equal((await post("/two-factor/send-otp", challenge, {})).status, 200);
  await flushMail();
  const code = testInbox.findLast(mail => mail.to === "admin@demo.sy" && mail.template === "admin-code")?.code;
  assert.ok(code);
  const verified = await post("/two-factor/verify-otp", challenge, { code });
  assert.equal(verified.status, 200);
  const adminCookie = verified.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  assert.ok(adminCookie.includes(name + "="));
  assert.equal((await read({ cookie: adminCookie })).status, 200);
  const logout = await post("/sign-out", cookie);
  assert.equal(logout.status, 200);
  const deleted = logout.headers.getSetCookie();
  assert.ok(deleted.some(value => value.startsWith(name + "=")));
  for (const value of deleted) {
    assert.match(value, /; Path=\//i);
    assert.match(value, /; Max-Age=0/i);
    assert.equal(value.startsWith("__Secure-"), secure);
    assert.equal(/; Secure(?:;|$)/i.test(value), secure);
    assert.match(value, /; HttpOnly/i);
    assert.match(value, /; SameSite=Lax/i);
    if (process.env.COOKIE_DOMAIN) assert.match(value, /; Domain=example.test/i);
    else assert.doesNotMatch(value, /; Domain=/i);
  }
  const me = await app.request(origin + "/api/v1/me", { headers: { cookie } });
  assert.equal(await me.json(), null);
  process.stdout.write("cookie-session-ok");
} finally { await db.$client.close(); }
`

for (const [label, origin, domain] of [
  ["HTTPS development host-only", "https://sayaratak-web.onrender.com", ""],
  ["local HTTP host-only", "http://localhost:3000", ""],
  ["explicit shared custom domain", "https://web.example.test", "example.test"],
]) {
  test(`${label} issues matching session/logout cookies and preserves reload identity`, () => {
    const run = Bun.spawnSync(["bun", "--no-env-file", "-e", script], {
      cwd: `${import.meta.dir}/../../..`,
      env: {
        PATH: process.env.PATH,
        DATABASE_URL: process.env.TEST_DATABASE_URL,
        NODE_ENV: "test",
        APP_ENV: "development",
        WEB_ORIGIN: origin,
        BETTER_AUTH_URL: origin,
        COOKIE_DOMAIN: domain,
        BETTER_AUTH_SECRET: "local-auth-test-secret-0123456789abcdef",
        LOG_REQUESTS: "false",
      },
    })
    expect(run.stderr.toString()).toBe("")
    expect(run.exitCode).toBe(0)
    expect(run.stdout.toString()).toBe("cookie-session-ok")
  })
}
