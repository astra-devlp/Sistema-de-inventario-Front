export interface Location {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LocationCreatePayload {
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
}

/** `PATCH /locations` es cerrado: solo estos campos. */
export type LocationUpdatePayload = Partial<LocationCreatePayload> & { is_default?: boolean };

export interface CashRegister {
  id: number;
  location_id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CashRegisterCreatePayload {
  location_id: number;
  code: string;
  name: string;
  is_active: boolean;
}

export type CashRegisterUpdatePayload = Partial<CashRegisterCreatePayload>;

export interface UserLocations {
  user_id: number;
  location_ids: number[];
}
