export interface Org {
  readonly id: number;
  /** Some endpoints return orgId instead of id */
  readonly orgId?: number;
  readonly name?: string;
  readonly [key: string]: unknown;
}

export interface User {
  readonly id: number;
  readonly [key: string]: unknown;
}

export interface Patient {
  readonly id: number;
  readonly [key: string]: unknown;
}

export interface AuthResponse {
  readonly token: string;
  readonly payload?: {
    readonly orgs?: Org[];
  };
}

export interface PropertiesResponse {
  readonly payload: {
    readonly properties: Record<string, unknown>;
  };
}

export interface ListOrgsResponse {
  readonly payload: {
    readonly orgs: Org[];
  };
}
