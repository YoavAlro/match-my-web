import type { ProviderConfig, SiteProfile } from "./types";

const PROFILE_KEY = "profiles.v1";
const PROVIDER_KEY = "provider.v1";

export async function getProfiles(): Promise<Record<string, SiteProfile>> {
  const stored = await chrome.storage.local.get(PROFILE_KEY);
  const value = stored[PROFILE_KEY];
  return value && typeof value === "object" ? (value as Record<string, SiteProfile>) : {};
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
