import {
  createPinto,
  downloadImageWithFormat,
  downloadVideoWithFormat,
} from "../src/index.js";
import type { Pin, UserProfile, Board } from "../src/index.js";

async function main(): Promise<void> {
  const pinto = createPinto();

  const pin: Pin = await pinto.getPin("https://pin.it/67v3VVvF2");
  console.log("Pin:", pin.id);
  console.log("  image :", pin.image);
  console.log("  saves :", pin.saves);

  const img = await downloadImageWithFormat(
    pinto.session,
    "https://pin.it/67v3VVvF2",
  );
  console.log(
    "Image bytes:",
    img.bytes.length,
    "format:",
    img.format,
    "type:",
    img.contentType,
  );

  const vpin: Pin = await pinto.getPin("https://pin.it/1MHcB3WGA");
  console.log("Video pin:", vpin.id, "isVideo:", vpin.isVideo);
  if (vpin.video !== undefined) {
    console.log("  video :", vpin.video);
  }
  const vid = await downloadVideoWithFormat(
    pinto.session,
    "https://pin.it/1MHcB3WGA",
  );
  console.log(
    "Video bytes:",
    vid.bytes.length,
    "format:",
    vid.format,
    "type:",
    vid.contentType,
  );

  const user: UserProfile = await pinto.getUser(
    "https://www.pinterest.com/Corex2410/",
  );
  console.log("User:", user.username, "followers:", user.followers);
  const board: Board = await pinto.getBoard("https://pin.it/1XGGDuEDn");
  console.log("Board:", board.name, "pins:", board.pinsCount);
}

main().catch(function (error) {
  console.error("Example failed:", error);
  process.exit(1);
});
