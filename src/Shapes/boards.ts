import type { PinnerBrief } from "./pins.js";

export interface Board {
  id: string;
  name: string;
  description: string;
  url: string;
  pinsCount?: number;
  followers?: number;
  owner?: PinnerBrief;
  image?: string;
  sections?: BoardSection[];
}

export interface BoardSection {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  pinCount?: number;
}
