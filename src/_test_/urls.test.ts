import {
  PRIMARY_HOST,
  isPinterestHost,
  canonicalizeUrl,
  extractPinId,
  extractUsername,
  extractBoardSlug,
  cleanUsername,
  cleanSlug,
  pinPageUrl,
  userPageUrl,
  boardPageUrl,
  resourceEndpointUrl,
  widgetBase,
  widgetPinInfoUrl,
  widgetUserPinsUrl,
  widgetBoardPinsUrl,
  searchSourceUrl,
  parsePinterestRef,
} from "../../Pinth/urls.js";

describe("isPinterestHost", () => {
  it("accepts canonical and locale hosts", () => {
    expect(isPinterestHost("www.pinterest.com")).toBe(true);
    expect(isPinterestHost("pinterest.com")).toBe(true);
    expect(isPinterestHost("br.pinterest.com")).toBe(true);
    expect(isPinterestHost("in.pinterest.jp")).toBe(true);
    expect(isPinterestHost("br.pinterest.co.uk")).toBe(true);
  });

  it("rejects lookalikes", () => {
    expect(isPinterestHost("evil-pinterest.com")).toBe(false);
    expect(isPinterestHost("pinterest.evil.com")).toBe(false);
    expect(isPinterestHost("example.com")).toBe(false);
    expect(isPinterestHost("")).toBe(false);
  });
});

describe("canonicalizeUrl", () => {
  it("strips locale, query and fragment", () => {
    expect(canonicalizeUrl("https://br.pinterest.com/pin/123/?x=1#frag")).toBe(
      "https://www.pinterest.com/pin/123",
    );
    expect(canonicalizeUrl("https://www.pinterest.com/user/")).toBe(
      "https://www.pinterest.com/user",
    );
    expect(canonicalizeUrl("https://www.pinterest.com/")).toBe(
      "https://www.pinterest.com/",
    );
  });

  it("leaves external links untouched", () => {
    expect(canonicalizeUrl("https://example.com/a?b=1")).toBe(
      "https://example.com/a?b=1",
    );
    expect(canonicalizeUrl("https://evil-pinterest.com/x")).toBe(
      "https://evil-pinterest.com/x",
    );
    expect(canonicalizeUrl("")).toBe("");
  });
});

describe("extractPinId", () => {
  it("reads id from many URL shapes", () => {
    expect(extractPinId("459156124515639652")).toBe("459156124515639652");
    expect(
      extractPinId("https://www.pinterest.com/pin/459156124515639652/"),
    ).toBe("459156124515639652");
    expect(
      extractPinId("https://br.pinterest.com/pin/459156124515639652/?x=1"),
    ).toBe("459156124515639652");
    expect(extractPinId("pinterest.com/pin/459156124515639652")).toBe(
      "459156124515639652",
    );
    expect(extractPinId("/pin/459156124515639652/")).toBe("459156124515639652");
    expect(extractPinId("https://www.pinterest.com/")).toBe("");
    expect(extractPinId("")).toBe("");
  });
});

describe("extractUsername", () => {
  it("pulls a username and skips reserved pages", () => {
    expect(extractUsername("pinterest")).toBe("pinterest");
    expect(extractUsername("https://www.pinterest.com/Corex2410/")).toBe(
      "Corex2410",
    );
    expect(extractUsername("https://www.pinterest.com/Corex2410/pins/")).toBe(
      "Corex2410",
    );
    expect(
      extractUsername("https://www.pinterest.com/search/pins/?q=cats"),
    ).toBe("");
    expect(extractUsername("https://www.pinterest.com/pin/123/")).toBe("");
    expect(extractUsername("")).toBe("");
  });
});

describe("cleanUsername", () => {
  it("accepts bare names and URLs alike", () => {
    expect(cleanUsername("  Corex2410 ")).toBe("Corex2410");
    expect(cleanUsername("https://www.pinterest.com/Corex2410/")).toBe(
      "Corex2410",
    );
    expect(cleanUsername("pinterest.com/Corex2410")).toBe("Corex2410");
  });
});

describe("extractBoardSlug", () => {
  it("reduces URLs to owner/slug", () => {
    expect(extractBoardSlug("user/board")).toBe("user/board");
    expect(extractBoardSlug("https://www.pinterest.com/user/board/")).toBe(
      "user/board",
    );
    expect(extractBoardSlug("https://www.pinterest.com/user/board/pins/")).toBe(
      "user/board",
    );
    expect(extractBoardSlug("br.pinterest.com/user/board?x=1")).toBe(
      "user/board",
    );
    expect(extractBoardSlug("")).toBe("");
  });
});

describe("cleanSlug", () => {
  it("normalizes slashes and URLs", () => {
    expect(cleanSlug("/user/board/")).toBe("user/board");
    expect(cleanSlug("user/board/extra")).toBe("user/board");
    expect(cleanSlug("https://www.pinterest.com/user/board/")).toBe(
      "user/board",
    );
  });
});

describe("page URL builders", () => {
  it("produce canonical https URLs", () => {
    expect(pinPageUrl("123")).toBe("https://www.pinterest.com/pin/123/");
    expect(userPageUrl("Corex2410")).toBe(
      "https://www.pinterest.com/Corex2410/",
    );
    expect(boardPageUrl("user", "board")).toBe(
      "https://www.pinterest.com/user/board/",
    );
    expect(PRIMARY_HOST).toBe("www.pinterest.com");
  });
});

describe("endpoint URL builders", () => {
  it("resourceEndpointUrl normalizes handler names", () => {
    expect(resourceEndpointUrl("BaseSearchResource/get")).toBe(
      "https://www.pinterest.com/resource/BaseSearchResource/get/",
    );
    expect(resourceEndpointUrl("/BaseSearchResource/get/")).toBe(
      "https://www.pinterest.com/resource/BaseSearchResource/get/",
    );
  });

  it("widget URL builders encode params and clamp sizes", () => {
    expect(widgetBase()).toBe("https://widgets.pinterest.com");

    const pinInfo = widgetPinInfoUrl(["1", "2"]);
    expect(
      pinInfo.startsWith(
        "https://widgets.pinterest.com/v3/pidgets/pins/info/?",
      ),
    ).toBe(true);
    expect(pinInfo).toContain("pin_ids=1%2C2");

    const userUrl = widgetUserPinsUrl("Corex2410", 25);
    expect(userUrl).toContain("/v3/pidgets/users/Corex2410/pins/");
    expect(userUrl).toContain("w=25");

    expect(widgetUserPinsUrl("u", 9999)).toContain("w=100");
    expect(widgetUserPinsUrl("u", 0)).toContain("w=1");
    expect(widgetUserPinsUrl("u", Number.NaN)).toContain("w=25");

    const boardUrl = widgetBoardPinsUrl("user", "board", 10);
    expect(boardUrl).toContain("/v3/pidgets/boards/user/board/pins/");
    expect(boardUrl).toContain("w=10");

    const oddUrl = widgetBoardPinsUrl("a b", "c d", 5);
    expect(oddUrl).toContain("a%20b");
    expect(oddUrl).toContain("c%20d");
  });
});

describe("parsePinterestRef", () => {
  it("returns null for empty input", () => {
    expect(parsePinterestRef("")).toBeNull();
    expect(parsePinterestRef("   ")).toBeNull();
  });

  it("detects pins", () => {
    const ref = parsePinterestRef(
      "https://www.pinterest.com/pin/459156124515639652/",
    );
    expect(ref).not.toBeNull();
    expect(ref?.kind).toBe("pin");
    if (ref?.kind === "pin") {
      expect(ref.id).toBe("459156124515639652");
      expect(ref.url.startsWith("https://")).toBe(true);
    }
    const bare = parsePinterestRef("pinterest.com/pin/999");
    expect(bare).not.toBeNull();
    expect(bare?.kind).toBe("pin");
  });

  it("detects users", () => {
    const ref = parsePinterestRef("https://www.pinterest.com/Corex2410/");
    expect(ref).not.toBeNull();
    expect(ref?.kind).toBe("user");
    if (ref?.kind === "user") {
      expect(ref.username).toBe("Corex2410");
    }
  });

  it("detects boards", () => {
    const ref = parsePinterestRef("https://br.pinterest.com/user/board/");
    expect(ref).not.toBeNull();
    expect(ref?.kind).toBe("board");
    if (ref?.kind === "board") {
      expect(ref.username).toBe("user");
      expect(ref.slug).toBe("board");
    }
  });

  it("reports unknown for foreign URLs", () => {
    const ref = parsePinterestRef("https://example.com/some/page");
    expect(ref).not.toBeNull();
    expect(ref?.kind).toBe("unknown");
  });
});

describe("searchSourceUrl", () => {
  it("builds the page-hit path per scope", () => {
    expect(searchSourceUrl("pins", "cats")).toBe("/search/pins/?q=cats");
    expect(searchSourceUrl("boards", "cats & dogs")).toBe(
      "/search/boards/?q=cats%20%26%20dogs",
    );
    expect(searchSourceUrl("users", "x")).toBe("/search/users/?q=x");
    expect(searchSourceUrl("videos", "x")).toBe("/search/videos/?q=x");
  });
});
