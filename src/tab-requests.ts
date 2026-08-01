export class TabRequestRegistry {
  private readonly controllers = new Map<number, AbortController>();

  start(tabId: number): AbortController {
    this.abort(tabId);
    const controller = new AbortController();
    this.controllers.set(tabId, controller);
    return controller;
  }

  abort(tabId: number): void {
    this.controllers.get(tabId)?.abort();
    this.controllers.delete(tabId);
  }

  finish(tabId: number, controller: AbortController): void {
    if (this.controllers.get(tabId) === controller) this.controllers.delete(tabId);
  }

  abortAll(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }
}
