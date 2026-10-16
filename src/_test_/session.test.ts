import { createPinto } from "../index.js";
import {
  createEmptySession,
  setSessionCookies,
  hasCredentials,
  importCookies,
} from "../Vault/session.js";
import {
  configureTransport,
  fetchWidgetJson,
  ensureSession,
  clearCache,
} from "../Client/client.js";

function counting(counter: { calls: number }): typeof fetch {
  const impl = async function () {
    counter.calls = counter.calls + 1;
    return new Response(JSON.stringify({ data: { at: counter.calls } }), {
      status: 200,
    });
  } as typeof fetch;
  return impl;
}

describe("setSessionCookies", () => {
  it("parses a raw Cookie header string", () => {
    const state = createEmptySession();
    setSessionCookies(
      state,
      "_pinterest_sess=abc123; csrftoken=tok999; _js_dat=xyz",
    );
    expect(state.cookies["_pinterest_sess"]).toBe("abc123");
    expect(state.cookies["csrftoken"]).toBe("tok999");
    expect(state.csrftoken).toBe("tok999");
    expect(hasCredentials(state)).toBe(true);
  });

  it("accepts a JSON object string", () => {
    const state = createEmptySession();
    setSessionCookies(state, '{"_pinterest_sess":"s1","csrftoken":"c1"}');
    expect(state.cookies["_pinterest_sess"]).toBe("s1");
    expect(state.csrftoken).toBe("c1");
  });

  it("accepts a plain object", () => {
    const state = createEmptySession();
    setSessionCookies(state, { _pinterest_sess: "s2", csrftoken: "c2" });
    expect(state.cookies["_pinterest_sess"]).toBe("s2");
    expect(hasCredentials(state)).toBe(true);
  });

  it("hasCredentials is false without a _pinterest_sess cookie", () => {
    const state = createEmptySession();
    setSessionCookies(state, { csrftoken: "only-csrf" });
    expect(hasCredentials(state)).toBe(false);
  });
});

describe("importCookies", () => {
  it("handles a full Cookie header with quotes, encoding, and JSON values", () => {
    const pinto = createPinto();
    const header =
      "csrftoken=tok123; _auth=1; _pinterest_sess=sessABC; " +
      '__Secure-s_a=plain; _b="quoted-value"; ' +
      "usersync=%7B%22magnite%22%3A%7B%22id%22%3A%22X%22%7D%7D; " +
      '_routing_id="route-1"; sessionFunnelEventLogged=1; ' +
      'g_state={"i_l":0,"i_b":"abc;def"}';
    const count = importCookies(pinto.session, header);
    expect(count).toBe(9);
    expect(pinto.session.cookies["csrftoken"]).toBe("tok123");
    expect(pinto.session.cookies["_pinterest_sess"]).toBe("sessABC");
    expect(pinto.session.cookies["_b"]).toBe("quoted-value");
    expect(pinto.session.cookies["usersync"]).toBe('{"magnite":{"id":"X"}}');
    expect(pinto.session.cookies["_routing_id"]).toBe("route-1");
    expect(pinto.session.cookies["g_state"]).toBe('{"i_l":0,"i_b":"abc;def"}');
    expect(pinto.isAuthenticated()).toBe(true);
    const out = pinto.exportCookies();
    expect(out).toContain("_pinterest_sess=sessABC");
    expect(out).toContain("csrftoken=tok123");
  });

  it("handles extension-style JSON cookie arrays", () => {
    const state = createEmptySession();
    const extJson = JSON.stringify([
      { name: "csrftoken", value: "tok999" },
      { name: "_pinterest_sess", value: "sess999" },
      { name: "_b", value: '"quoted9"' },
      { name: "usersync", value: "%7B%22a%22%3A1%7D" },
    ]);
    const count = importCookies(state, extJson);
    expect(count).toBe(4);
    expect(state.cookies["csrftoken"]).toBe("tok999");
    expect(state.cookies["_pinterest_sess"]).toBe("sess999");
    expect(state.cookies["_b"]).toBe("quoted9");
    expect(state.cookies["usersync"]).toBe('{"a":1}');
    expect(state.csrftoken).toBe("tok999");
    expect(hasCredentials(state)).toBe(true);
  });

  it("handles netscape text and plain-header fallback", () => {
    const s1 = createPinto().session;
    const netscape =
      "# Netscape HTTP Cookie File\n" +
      "www.pinterest.com\tFALSE\t/\tTRUE\t0\tcsrftoken\ttab-tok\n" +
      ".pinterest.com\tTRUE\t/\tTRUE\t0\t_pinterest_sess\ttab-sess\n";
    expect(importCookies(s1, netscape)).toBe(2);
    expect(s1.cookies["csrftoken"]).toBe("tab-tok");
    expect(hasCredentials(s1)).toBe(true);

    const s2 = createPinto().session;
    expect(importCookies(s2, "_pinterest_sess=x; csrftoken=y")).toBe(2);
    expect(hasCredentials(s2)).toBe(true);
  });

  it("strips Set-Cookie attributes, keeps Expires commas intact", () => {
    const state = createEmptySession();
    const setCookies =
      "csrftoken=tok-set; Path=/; Secure; HttpOnly, " +
      "_pinterest_sess=sess-set; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Secure; HttpOnly, " +
      "_b=plain9; Path=/";
    expect(importCookies(state, setCookies)).toBe(3);
    expect(state.cookies["csrftoken"]).toBe("tok-set");
    expect(state.cookies["_pinterest_sess"]).toBe("sess-set");
    expect(state.cookies["_b"]).toBe("plain9");
    expect(state.cookies["Path"]).toBeUndefined();
    expect(state.csrftoken).toBe("tok-set");
    expect(hasCredentials(state)).toBe(true);
  });

  it("strips Cookie:/header-block/curl pastes down to pairs", () => {
    const state = createEmptySession();
    const block =
      "Cookie: csrftoken=tok-hdr; _pinterest_sess=sess-hdr\n" +
      "User-Agent: Mozilla/5.0\n" +
      "Accept: */*";
    expect(importCookies(state, block)).toBe(2);
    expect(state.cookies["csrftoken"]).toBe("tok-hdr");
    expect(state.cookies["_pinterest_sess"]).toBe("sess-hdr");
    expect(state.cookies["User-Agent"]).toBeUndefined();
  });

  it("handles playwright storageState + name/value dict JSON", () => {
    const storage = JSON.stringify({
      cookies: [
        { name: "csrftoken", value: "tok-pw", domain: ".pinterest.com" },
        { name: "_pinterest_sess", value: "sess-pw" },
      ],
      origins: [],
    });
    const s1 = createEmptySession();
    expect(importCookies(s1, storage)).toBe(2);
    expect(hasCredentials(s1)).toBe(true);

    const dict = JSON.stringify({
      csrftoken: "tok-d",
      _pinterest_sess: "sess-d",
    });
    const s2 = createEmptySession();
    expect(importCookies(s2, dict)).toBe(2);
    expect(s2.cookies["csrftoken"]).toBe("tok-d");
    expect(hasCredentials(s2)).toBe(true);
  });

  it("handles second-wave formats (Playwright/headers/Set-Cookie)", () => {
    const pw = createEmptySession();
    expect(
      importCookies(
        pw,
        JSON.stringify({
          cookies: [
            { name: "csrftoken", value: "pw-tok" },
            { name: "_pinterest_sess", value: "pw-sess" },
          ],
        }),
      ),
    ).toBe(2);
    expect(hasCredentials(pw)).toBe(true);

    const curl = createEmptySession();
    expect(
      importCookies(
        curl,
        "User-Agent: Mozilla/5.0\nCookie: csrftoken=c-tok; _pinterest_sess=c-sess\nAccept: */*",
      ),
    ).toBe(2);
    expect(hasCredentials(curl)).toBe(true);

    const sc = createEmptySession();
    expect(
      importCookies(
        sc,
        "csrftoken=s-tok; Path=/; HttpOnly, _pinterest_sess=s-sess; Path=/; Secure",
      ),
    ).toBe(2);
    expect(sc.cookies["Path"]).toBeUndefined();
    expect(hasCredentials(sc)).toBe(true);
  });
});

describe("facade setCookies / exportCookies / isAuthenticated", () => {
  it("round-trips cookies and skips anonymous bootstrap", async () => {
    const pinto = createPinto();
    expect(pinto.isAuthenticated()).toBe(false);
    await pinto.setCookies("_pinterest_sess=abc; csrftoken=tok");
    expect(pinto.isAuthenticated()).toBe(true);
    const exported = pinto.exportCookies();
    expect(exported).toContain("_pinterest_sess=abc");
    expect(exported).toContain("csrftoken=tok");

    const counter = { calls: 0 };
    configureTransport(pinto.session, { fetchImpl: counting(counter) });
    await ensureSession(pinto.session);
    expect(counter.calls).toBe(0);
  });
});

describe("media formats", () => {
  it("format helpers cover Pinterest image + video formats", async () => {
    const formats = await import("../Media/formats.js");
    expect([...formats.SUPPORTED_IMAGE_FORMATS]).toEqual([
      "jpg",
      "jpeg",
      "png",
      "webp",
    ]);
    expect([...formats.SUPPORTED_VIDEO_FORMATS]).toEqual(["mp4", "mov", "m4v"]);
    expect(formats.normalizeImageFormat("JPG")).toBe("jpg");
    expect(formats.normalizeImageFormat("jpeg")).toBe("jpg");
    expect(formats.normalizeImageFormat("gif")).toBe("");
    expect(formats.normalizeVideoFormat("MOV")).toBe("mov");
    expect(formats.normalizeVideoFormat("avi")).toBe("");
    expect(formats.mimeForExtension("jpg")).toBe("image/jpeg");
    expect(formats.mimeForExtension("png")).toBe("image/png");
    expect(formats.mimeForExtension("webp")).toBe("image/webp");
    expect(formats.mimeForExtension("mp4")).toBe("video/mp4");
    expect(formats.mimeForExtension("mov")).toBe("video/quicktime");
    expect(formats.mimeForExtension("m4v")).toBe("video/x-m4v");
    expect(formats.extensionForMime("image/jpeg")).toBe("jpg");
    expect(formats.extensionForMime("video/mp4")).toBe("mp4");
    expect(
      formats.imageFormatFromUrl("https://i.pinimg.com/564x/ab/cd/ef.jpg?x=1"),
    ).toBe("jpg");
    expect(
      formats.videoFormatFromUrl("https://v1.pinimg.com/videos/mc/720p/x.mp4"),
    ).toBe("mp4");
    expect(formats.filenameForPin("123", "https://x/y.png", "jpg")).toBe(
      "pin-123.png",
    );
    expect(formats.filenameForPin("123", "https://x/noext", "mp4")).toBe(
      "pin-123.mp4",
    );
  });

  it("detects all seven Pinterest formats via mime, url, and magic bytes", async () => {
    const {
      detectFormat,
      sniffFormat,
      isSupportedImageFormat,
      isSupportedVideoFormat,
    } = await import("../Media/index.js");
    expect(detectFormat("https://i.pinimg.com/564x/a.jpg", "image/jpeg")).toBe(
      "jpg",
    );
    expect(detectFormat("https://i.pinimg.com/564x/a.jpeg", "image/jpeg")).toBe(
      "jpg",
    );
    expect(detectFormat("https://i.pinimg.com/564x/a.png", "image/png")).toBe(
      "png",
    );
    expect(detectFormat("https://i.pinimg.com/564x/a.webp", "image/webp")).toBe(
      "webp",
    );
    expect(detectFormat("https://v.pinimg.com/videos/a.mp4", "video/mp4")).toBe(
      "mp4",
    );
    expect(
      detectFormat("https://v.pinimg.com/videos/a.mov", "video/quicktime"),
    ).toBe("mov");
    expect(
      detectFormat("https://v.pinimg.com/videos/a.m4v", "video/x-m4v"),
    ).toBe("m4v");
    expect(detectFormat("https://i.pinimg.com/564x/abc123", "image/jpeg")).toBe(
      "jpg",
    );
    expect(detectFormat("https://i.pinimg.com/564x/abc123", "video/mp4")).toBe(
      "mp4",
    );
    expect(sniffFormat(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("jpg");
    expect(
      sniffFormat(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("png");
    expect(
      detectFormat(
        "https://i.pinimg.com/564x/abc123",
        "",
        new Uint8Array([0xff, 0xd8, 0xff]),
      ),
    ).toBe("jpg");
    expect(isSupportedImageFormat("jpg")).toBe(true);
    expect(isSupportedImageFormat("gif")).toBe(false);
    expect(isSupportedVideoFormat("mov")).toBe(true);
    expect(isSupportedVideoFormat("webm")).toBe(false);
  });

  it("pins carry imageFormat/videoFormat from widget payloads", async () => {
    const widget = await import("../Harvest/widget.js");
    const imagePin = widget.toPinFromWidget(
      {
        id: "1",
        images: {
          "564x": {
            url: "https://i.pinimg.com/564x/a/b/c.webp",
            width: 564,
            height: 800,
          },
        },
      },
      "1",
    );
    expect(imagePin).not.toBeNull();
    expect(imagePin?.imageFormat).toBe("webp");
    expect(imagePin?.imageMime).toBe("image/webp");

    const storyPin = widget.toPinFromWidget(
      {
        id: "2",
        images: {
          "236x": {
            url: "https://i.pinimg.com/236x/a.jpg",
            width: 236,
            height: 400,
          },
        },
        story_pin_data: {
          pages: [
            {
              blocks: [
                {
                  type: "story_pin_video_block",
                  video: {
                    video_list: {
                      V_HLSV4: {
                        url: "https://v1.pinimg.com/videos/iht/hls/x.m3u8",
                      },
                      V_720P: {
                        url: "https://v1.pinimg.com/videos/mc/720p/x.mp4",
                      },
                    },
                  },
                },
              ],
            },
          ],
        },
      },
      "2",
    );
    expect(storyPin).not.toBeNull();
    expect(storyPin?.video).toBe("https://v1.pinimg.com/videos/mc/720p/x.mp4");
    expect(storyPin?.videoFormat).toBe("mp4");
    expect(storyPin?.videoMime).toBe("video/mp4");
    expect(storyPin?.isVideo).toBe(true);
  });
});

describe("per-session transport isolation", () => {
  it("each session uses its own injected fetch", async () => {
    const s1 = createEmptySession();
    const s2 = createEmptySession();
    const c1 = { calls: 0 };
    const c2 = { calls: 0 };
    configureTransport(s1, { fetchImpl: counting(c1) });
    configureTransport(s2, { fetchImpl: counting(c2) });

    const url =
      "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=1&sub=www";
    const a = await fetchWidgetJson(s1, url);
    const b = await fetchWidgetJson(s2, url);

    expect(c1.calls).toBe(1);
    expect(c2.calls).toBe(1);
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    expect(a).not.toBe(b);
  });

  it("serves a session+URL from cache on the second call", async () => {
    const session = createEmptySession();
    const counter = { calls: 0 };
    configureTransport(session, { fetchImpl: counting(counter) });

    const url =
      "https://widgets.pinterest.com/v3/pidgets/users/someone/pins/?w=5";
    const first = await fetchWidgetJson(session, url);
    const second = await fetchWidgetJson(session, url);

    expect(counter.calls).toBe(1);
    expect(first).toBe(second);
  });

  it("clearCache forces a fresh fetch", async () => {
    const session = createEmptySession();
    const counter = { calls: 0 };
    configureTransport(session, { fetchImpl: counting(counter) });

    const url =
      "https://widgets.pinterest.com/v3/pidgets/pins/info/?pin_ids=9&sub=www";
    await fetchWidgetJson(session, url);
    clearCache();
    await fetchWidgetJson(session, url);

    expect(counter.calls).toBe(2);
  });
});

describe("bootstrap behaviour", () => {
  it("anonymous session with no csrftoken still bootstraps", async () => {
    const session = createEmptySession();
    const counter = { calls: 0 };
    const bootstrapFetch = async function () {
      counter.calls = counter.calls + 1;
      return new Response("{}", {
        status: 200,
        headers: {
          "set-cookie":
            "csrftoken=boot123; Path=/, _pinterest_sess=anon; Path=/",
        },
      });
    } as typeof fetch;
    configureTransport(session, { fetchImpl: bootstrapFetch });
    await ensureSession(session);
    expect(counter.calls).toBe(1);
    expect(session.csrftoken).toBe("boot123");
  });
});
