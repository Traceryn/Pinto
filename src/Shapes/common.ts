export interface Page<T> {
  results: T[];
  bookmark?: string;
  hasMore: boolean;
}

export interface PagingOptions {
  limit?: number;
  bookmark?: string;
  pageSize?: number;
}

export interface DeviceInfo {
  agent: string;
  acceptLanguage: string;
  secChUa: string;
  secChUaMobile: string;
  secChUaPlatform: string;
}

export interface SessionState {
  cookies: Record<string, string>;
  csrftoken?: string;
  createdAt: number;
  device?: DeviceInfo;
  deviceId?: string;
}
