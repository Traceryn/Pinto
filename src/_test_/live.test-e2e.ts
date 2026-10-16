import { jest } from "@jest/globals";
import { createPinto, downloadPinImage, downloadPinVideo } from "../index.js";
import { importCookies } from "../Vault/index.js";
import { isShortLink, resolveShortLink } from "../../Pinth/index.js";

async function headSize(url: string): Promise<number> {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  const len = res.headers.get("content-length");
  return len !== null ? Number(len) : -1;
}

describe("live endpoints against Pinterest (anonymous unless COOKIES_FILE)", () => {
  jest.setTimeout(60000);
  let pinto: ReturnType<typeof createPinto>;

  beforeAll(async () => {
    pinto = createPinto();
    const cookiesFile = process.env.COOKIES_FILE;
    if (cookiesFile !== undefined && cookiesFile.length > 0) {
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(cookiesFile, "utf8");
      const n = importCookies(pinto.session, text);
      console.log("cookies imported=" + n + " auth=" + pinto.isAuthenticated());
    } else {
      console.log("anonymous mode (set COOKIES_FILE for authenticated run)");
    }
  });

  const imageShort = "https://pin.it/67v3VVvF2";
  const videoShort = "https://pin.it/1MHcB3WGA";
  const boardShort = "https://pin.it/1XGGDuEDn";
  const deadShort = "https://pin.it/3Kl6XTbym";
  const userUrl = "https://www.pinterest.com/Corex2410/";

  it("detects and resolves short links", async () => {
    expect(isShortLink(imageShort)).toBe(true);
    const imageUrl = await resolveShortLink(imageShort);
    const videoUrl = await resolveShortLink(videoShort);
    const boardUrl = await resolveShortLink(boardShort);
    console.log("resolved image=" + imageUrl);
    console.log("resolved video=" + videoUrl);
    console.log("resolved board=" + boardUrl);
    expect(imageUrl.length).toBeGreaterThan(0);
  });

  it("getPin reads an image pin (short link)", async () => {
    const pin = await pinto.getPin(imageShort);
    expect(pin.id).toBe("1060738518503398158");
    expect(pin.image.length).toBeGreaterThan(0);
  });

  it("getPin reads a video pin (short link)", async () => {
    const vpin = await pinto.getPin(videoShort);
    expect(vpin.id).toBe("7810999348465683");
    expect(
      vpin.isVideo === true ||
      (vpin.video !== undefined && vpin.video.length > 0),
    ).toBe(true);
  });

  it("getUser + userPins work", async () => {
    const user = await pinto.getUser(userUrl);
    expect(user.username.toLowerCase()).toBe("corex2410");
    const upins = await pinto.userPins(userUrl, { pageSize: 5 });
    expect(upins.results.length).toBeGreaterThan(0);
  });

  it("getBoard + boardPins work (short link)", async () => {
    const board = await pinto.getBoard(boardShort);
    expect(board.url).toContain("Corex2410");
    expect(board.url).toContain("black-white-symbols");
    const bpins = await pinto.boardPins(boardShort, { pageSize: 5 });
    expect(bpins.results.length).toBeGreaterThan(0);
  });

  it("dead pin throws NotFoundError", async () => {
    await expect(pinto.getPin(deadShort)).rejects.toMatchObject({
      name: "NotFoundError",
    });
  });

  it("regional URL canonicalizes + still resolves", async () => {
    const regional = await pinto.getBoard(
      "https://br.pinterest.com/Corex2410/black-white-symbols/",
    );
    expect(regional.url).toContain("black-white-symbols");
  });

  it("media downloads fetch real bytes", async () => {
    const pin = await pinto.getPin(imageShort);
    const imgBytes = await headSize(pin.image);
    expect(imgBytes).toBeGreaterThan(1000);

    const buf = await downloadPinImage(pinto.session, imageShort);
    expect(buf.length).toBeGreaterThan(1000);

    const vpin = await pinto.getPin(videoShort);
    if (
      vpin.video !== undefined &&
      vpin.video.length > 0 &&
      process.env.SKIP_VIDEO_DL === undefined
    ) {
      const vbuf = await downloadPinVideo(pinto.session, videoShort);
      expect(vbuf.length).toBeGreaterThan(1000);
    }
  });
});
