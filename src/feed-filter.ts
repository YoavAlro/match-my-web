const SPONSORED_LABELS = [
  "ad",
  "advertisement",
  "promoted",
  "sponsored",
  "sponsored post",
  "paid partnership",
  "paid for by",
  "ממומן",
  "ממומנת",
  "إعلان",
  "ممول",
  "patrocinado",
  "patrocinada",
  "sponsorisé",
  "sponsorisée",
  "gesponsert",
  "anzeige",
  "sponsorizzato",
  "gesponsord",
  "реклама",
  "広告",
  "광고",
];

export function normalizeFeedMarker(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

const NORMALIZED_SPONSORED_LABELS = new Set(SPONSORED_LABELS.map(normalizeFeedMarker));

export function isSponsoredMarker(value: string | null | undefined): boolean {
  if (!value) return false;
  return NORMALIZED_SPONSORED_LABELS.has(normalizeFeedMarker(value));
}

export function isSponsoredMetadata(value: string | null | undefined): boolean {
  if (!value) return false;
  const normalized = normalizeFeedMarker(value);
  if (NORMALIZED_SPONSORED_LABELS.has(normalized)) return true;
  return [...NORMALIZED_SPONSORED_LABELS].some((label) => normalized.startsWith(label) && normalized.length <= label.length + 32);
}

export function domSignalRelevance(name: string, request = ""): "request-match" | "content-marker" | "structural" {
  const tokens = name.normalize("NFKC").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/gu).filter(Boolean);
  const requestTokens = (request.normalize("NFKC").toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? [])
    .flatMap((token) => token.length >= 3 && token.endsWith("s") ? [token, token.slice(0, -1)] : [token]);
  if (tokens.some((token) => requestTokens.includes(token))) return "request-match";
  if (tokens.some((token) => isSponsoredMarker(token))) return "content-marker";
  return "structural";
}
