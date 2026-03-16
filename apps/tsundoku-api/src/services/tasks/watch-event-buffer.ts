export class WatchEventBuffer {
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  public schedule(key: string, delayMs: number, callback: () => Promise<void> | void): void {
    const existingTimer = this.pending.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.pending.delete(key);
      void callback();
    }, delayMs);

    this.pending.set(key, timer);
  }

  public dispose(): void {
    for (const timer of this.pending.values()) {
      clearTimeout(timer);
    }
    this.pending.clear();
  }
}
