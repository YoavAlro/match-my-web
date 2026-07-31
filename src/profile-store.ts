import type { ProviderConfig, SiteProfile } from "./types";
import { validatePatch } from "./validation";

const PROFILE_KEY = "profiles.v1";
const PROVIDER_KEY = "provider.v1";
const PAUSED_KEY = "paused-origins.v1";

export async function getProfiles(): Promise<Record<string, SiteProfile>> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  const value = stored[PROFILE_KEY];
  if (!value || typeof value !== "object") return {};
  const profiles = value as Record<string, SiteProfile>;
  return Object.fromEntries(Object.entries(profiles).map(([origin, profile]) => [origin, {
    ...profile,
    patch: validatePatch(profile.patch),
  }]));
}

export async function getProfile(origin: string): Promise<SiteProfile | null> {
  return (await getProfiles())[origin] ?? null;
}

export async function saveProfile(profile: SiteProfile): Promise<void> {
  const profiles = await getProfiles();
  profiles[profile.origin] = profile;
  await chrome.storage.local.set({ [PROFILE_KEY]: profiles });
}

export async function getProviderConfig(): Promise<ProviderConfig | null> {
  const stored = await chrome.storage.local.get(PROVIDER_KEY);
  return (stored[PROVIDER_KEY] as ProviderConfig | undefined) ?? null;
}

export async function saveProviderConfig(config: ProviderConfig): Promise<void> {
  await chrome.storage.local.set({ [PROVIDER_KEY]: config });
}

export async function isOriginPaused(origin: string): Promise<boolean> {
  const stored = await chrome.storage.local.get(PAUSED_KEY);
  const paused = stored[PAUSED_KEY];
  return !!(paused && typeof paused === "object" && (paused as Record<string, boolean>)[origin]);
}

export async function setOriginPaused(origin: string, value: boolean): Promise<void> {
  const stored = await chrome.storage.local.get(PAUSED_KEY);
  const paused = stored[PAUSED_KEY] && typeof stored[PAUSED_KEY] === "object"
    ? stored[PAUSED_KEY] as Record<string, boolean>
    : {};
  if (value) paused[origin] = true;
  else delete paused[origin];
  await chrome.storage.local.set({ [PAUSED_KEY]: paused });
}
