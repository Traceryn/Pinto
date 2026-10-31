import { decodeEntities, firstText, toPin } from "../Harvest/normalize.js";

describe("decodeEntities", () => {
  it("decodes the five named entities", () => {
    expect(
      decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&apos;"),
    ).toBe("a & b <c> \"d\" 'e'");
  });

  it("decodes decimal and hex numeric references", () => {
    expect(decodeEntities("x &#8212; y &#x2014; z &#72;&#0073;")).toBe(
      "x — y — z HI",
    );
  });

  it("returns clean text untouched and keeps malformed references", () => {
    expect(decodeEntities("plain text")).toBe("plain text");
    expect(decodeEntities("10 &lt 20 &amp 30 &#; &#xZZ;")).toBe(
      "10 &lt 20 &amp 30 &#; &#xZZ;",
    );
  });

  it("decodes a lone ampersand-free value with zero cost", () => {
    expect(decodeEntities("https://example.com/a?b=1&c=2".slice(0, 20))).toBe(
      "https://example.com/",
    );
  });
});

describe("shape normalization decodes entities", () => {
  it("unescapes board name and pin title inside toPin", () => {
    const pin = toPin({
      id: "42",
      title: "Cats &amp; Dogs",
      description: "a &quot;fine&quot; board",
      board: {
        name: "Black &amp; White Symbols",
        url: "/Corex2410/black-white-symbols/",
      },
    });
    expect(pin).not.toBeNull();
    if (pin === null) {
      return;
    }
    expect(pin.title).toBe("Cats & Dogs");
    expect(pin.description).toBe('a "fine" board');
    expect(pin.board).not.toBeUndefined();
    if (pin.board !== undefined) {
      expect(pin.board.name).toBe("Black & White Symbols");
      expect(pin.board.url).toBe(
        "https://www.pinterest.com/Corex2410/black-white-symbols/",
      );
    }
  });

  it("decodes query separators that arrived escaped", () => {
    const pin = toPin({
      id: "7",
      image_url: "https://i.pinimg.com/564x/a.jpg?x=1&amp;y=2",
    });
    expect(pin).not.toBeNull();
    if (pin === null) {
      return;
    }
    expect(pin.image).toBe("https://i.pinimg.com/564x/a.jpg?x=1&y=2");
  });

  it("firstText decodes after skipping empties", () => {
    expect(firstText(["", "&amp;", "raw"])).toBe("&");
    expect(firstText([123, "&lt;ok&gt;"])).toBe("<ok>");
  });
});
