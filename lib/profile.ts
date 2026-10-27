"use client";
import { EMPTY_PROFILE } from "@/lib/data";
import { usePersisted } from "@/lib/store";

/** Avatar and bio are stored per account so members sharing a browser don't see each other's profile. */
export const useProfile = (codename: string) => usePersisted(`profile:${codename}`, EMPTY_PROFILE);
