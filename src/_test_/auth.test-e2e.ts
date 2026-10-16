import { readFile } from "node:fs/promises";
import { createPinto } from "../index.js";
import {
  createEmptySession,
  importNetscapeCookies,
  hasCredentials,
  cookieHeader,
} from "../Vault/index.js";

const file = process.env.COOKIES_FILE ?? "./cookies.netscape.txt";

describe("authenticated read path (needs a real cookie jar)", () => {
  let raw: string | null = null;

  beforeAll(async () => {
    try {
      raw = await readFile(file, "utf8");
    } catch {
      raw = null;
    }
  });

  it("imports a Netscape jar and exposes credentials", () => {
    if (raw === null) {
      console.warn(
        "skip: no cookie file. export Pinterest cookies (Netscape) to " +
          file +
          " or set COOKIES_FILE, then re-run `npm run test:e2e`.",
      );
      return;
    }
    const session = createEmptySession();
    const count = importNetscapeCookies(session, raw);
    expect(count).toBeGreaterThan(0);
    expect(hasCredentials(session)).toBe(true);
    expect(cookieHeader(session).length).toBeGreaterThan(0);

    const pinto = createPinto({ session });
    expect(pinto.isAuthenticated()).toBe(true);
  });

  it("getPin works (authenticated)", async () => {
    if (raw === null) {
      return;
    }
    const session = createEmptySession();
    importNetscapeCookies(session, raw);
    const pinto = createPinto({ session });
    const pin = await pinto.getPin("459156124515639652");
    expect(pin.id.length).toBeGreaterThan(0);
  });

  it("getUser works (authenticated)", async () => {
    if (raw === null) {
      return;
    }
    const session = createEmptySession();
    importNetscapeCookies(session, raw);
    const pinto = createPinto({ session });
    const user = await pinto.getUser("pinterest");
    expect(user.username.length).toBeGreaterThan(0);
  });

  it("searchPins works (authenticated, needs CSRF session)", async () => {
    if (raw === null) {
      return;
    }
    const session = createEmptySession();
    importNetscapeCookies(session, raw);
    const pinto = createPinto({ session });
    const page = await pinto.searchPins("cats");
    expect(page.results.length).toBeGreaterThan(0);
  });
});
