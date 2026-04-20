"use client";

import { useUser } from "./useUser";

export interface RoleHelpers {
  isHost: boolean;
  isNeighbor: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoaded: boolean;
}

/**
 * Convenience helper. Wraps useUser and exposes boolean role guards.
 * `isLoaded` is false until the profile has returned from Supabase.
 */
export function useRole(): RoleHelpers {
  const profile = useUser();
  const role = profile?.role;

  return {
    isHost: role === "host",
    isNeighbor: role === "neighbor",
    isAdmin: role === "admin",
    isSuperAdmin: role === "super_admin",
    isLoaded: profile !== null,
  };
}
