import { hasAdaptationChanges, type AdaptationPatch } from "../types";
import { validatePatch } from "../validation";

export interface ApprovedDesignStorage {
  readonly persistence: "local" | "memory";
  load(): AdaptationPatch | null;
  save(patch: AdaptationPatch): void;
  clear(): void;
}

const STORAGE_KEY = "tweaksy-live:approved-design:v1";

function withoutHiddenSelectors(patch: AdaptationPatch): AdaptationPatch {
  return { ...patch, hideSelectors: [] };
}

export class LocalApprovedDesignStorage implements ApprovedDesignStorage {
  readonly persistence = "local" as const;

  constructor(private readonly storage: Storage) {}

  load(): AdaptationPatch | null {
    try {
      const stored = this.storage.getItem(STORAGE_KEY);
      if (!stored) return null;
      const patch = withoutHiddenSelectors(validatePatch(JSON.parse(stored)));
      return hasAdaptationChanges(patch) ? patch : null;
    } catch {
      try {
        this.clear();
      } catch {
        // Storage may be blocked. The caller can continue with an original design.
      }
      return null;
    }
  }

  save(patch: AdaptationPatch): void {
    this.storage.setItem(STORAGE_KEY, JSON.stringify(withoutHiddenSelectors(patch)));
  }

  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
  }
}

export class MemoryApprovedDesignStorage implements ApprovedDesignStorage {
  readonly persistence = "memory" as const;
  private patch: AdaptationPatch | null = null;

  load(): AdaptationPatch | null {
    return this.patch ? { ...this.patch, hideSelectors: [] } : null;
  }

  save(patch: AdaptationPatch): void {
    this.patch = { ...patch, hideSelectors: [] };
  }

  clear(): void {
    this.patch = null;
  }
}

export function createApprovedDesignStorage(target: Pick<Window, "localStorage"> = window): ApprovedDesignStorage {
  try {
    const storage = target.localStorage;
    const probeKey = "tweaksy-live:storage-probe";
    storage.setItem(probeKey, "1");
    storage.removeItem(probeKey);
    return new LocalApprovedDesignStorage(storage);
  } catch {
    return new MemoryApprovedDesignStorage();
  }
}
