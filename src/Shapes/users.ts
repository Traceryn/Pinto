export interface UserProfile {
  id?: string;
  username: string;
  fullName?: string;
  bio?: string;
  followers?: number;
  following?: number;
  boardsCount?: number;
  pinsCount?: number;
  image?: string;
}
