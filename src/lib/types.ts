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

/* ---------------------------------------------------------------------------------------------
 * Patient-creation helper types
 * -------------------------------------------------------------------------------------------*/

export interface Address {
  country?: string;
  state?: string;
  city?: string;
  street?: string;
  street2?: string;
  postal?: string;
  /** defaults to "Home" when omitted */
  type?: string;
}

export interface CreatePatientPayload {
  /* Required */
  firstName: string;
  lastName: string;
  birthDate: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNSPECIFIED';
  email: string;

  /* Optional */
  mobile?: string;
  country?: string;
  state?: string;
  street?: string;
  street2?: string;
  city?: string;
  postal?: string;
  language?: string;
  orgId?: number;
  contact?: string;
  addresses?: Address[];
  sendInvite?: boolean;

  /**
   * Force flag added automatically by the SDK when caller specifies `force=true`.
   * Do not set manually.
   */
  force?: 1;
}

/* ---------------------------------------------------------------------------------------------
 * Appointment-creation helper types
 * -------------------------------------------------------------------------------------------*/

export interface AppointmentPayload {
  /* Required */
  patientId: number;
  providerId: number;
  appointmentTypeId: number;
  startDate: string; // UTC – "YYYY-MM-DD HH:mm:ss"
  endDate: string; // UTC – "YYYY-MM-DD HH:mm:ss"

  /* Optional but common */
  optimized?: 1; // Injected by SDK
  notify?: 0 | 1;
  approved?: 0 | 1;
  symptoms?: { content: string }[];
  wardId?: number;
  addressId?: number;
  assessmentIds?: number[];
  checkInDate?: string;
  appointmentStatusId?: number;
  canceled?: 0 | 1;
  noShow?: 0 | 1;
  appointmentEmrId?: string;
  externalEmrId?: string;
}

/* ---------------------------------------------------------------------------------------------
 * Provider Availability helper types
 * -------------------------------------------------------------------------------------------*/

export interface ProviderEvent {
  /** Event ID */
  id: number;
  /** UTC – "YYYY-MM-DD HH:mm:ss" */
  startDate: string;
  /** UTC – "YYYY-MM-DD HH:mm:ss" */
  endDate: string;
  /** Event label, usually "Available" */
  type?: string;
  /** Additional unknown props (API is flexible) */
  [key: string]: unknown;
}

/** Partial Provider object returned by /provider endpoints */
export interface Provider {
  id: number;
  firstName?: string;
  lastName?: string;
  /** Events array is only included when querying with startDate/endDate */
  events?: ProviderEvent[];
  /** Other dynamic keys */
  [key: string]: unknown;
}

export interface Slot {
  /** UTC – ISO string */
  startDate: string;
  /** UTC – ISO string */
  endDate: string;
}

export interface ProviderAvailabilityOptions {
  /** ISO string (UTC) */
  startDate: string;
  /** ISO string (UTC) */
  endDate: string;
  /** Optional – additional filtering */
  appointmentTypeId?: number;
  patientAge?: number;
  locationId?: number;
  /** When true include `forceRestrictProviders=1` query */
  restrictPreviousProviders?: boolean;
  /** Optional abort controller */
  signal?: AbortSignal;
}

export interface ProviderAvailabilityResult {
  providerId: number;
  slots: Slot[];
}
