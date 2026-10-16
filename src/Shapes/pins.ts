export interface PinImage {
  url: string;
  width?: number;
  height?: number;
}

export interface PinnerBrief {
  id?: string;
  username?: string;
  fullName?: string;
  image?: string;
}

export interface BoardBrief {
  id?: string;
  name?: string;
  url?: string;
}

export interface Pin {
  id: string;
  title: string;
  description: string;
  image: string;
  imageFormat?: string;
  imageMime?: string;
  images: PinImage[];
  video?: string;
  videoFormat?: string;
  videoMime?: string;
  isVideo?: boolean;
  link?: string;
  domain?: string;
  url: string;
  dominantColor?: string;
  saves?: number;
  comments?: number;
  altText?: string;
  createdAt?: number;
  pinner?: PinnerBrief;
  board?: BoardBrief;
}
