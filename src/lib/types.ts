export interface Org {
  id: number;
  /** Some endpoints return orgId instead of id */
  orgId?: number;
  name?: string;
  [key: string]: any;
}

export interface User {
  id: number;
  [key: string]: any;
}

export interface Patient {
  id: number;
  [key: string]: any;
}

export interface AuthResponse {
  token: string;
  payload?: {
    orgs?: Org[];
  };
}

export interface PropertiesResponse {
  payload: {
    properties: Record<string, unknown>;
  };
}

export interface ListOrgsResponse {
  payload: {
    orgs: Org[];
  };
}
