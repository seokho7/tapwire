import type { InterceptContext, InterceptorFn } from "./types.js";

export class InterceptorChain {
  private fns: InterceptorFn[] = [];

  use(fn: InterceptorFn): this {
    this.fns.push(fn);
    return this;
  }

  async run(ctx: InterceptContext): Promise<void> {
    for (const fn of this.fns) {
      if (ctx.dropped) break;
      await fn(ctx);
    }
  }
}

// Intercept pause/edit system
interface PauseEntry {
  resolve: (ctx: InterceptContext) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class PauseRegistry {
  private pending = new Map<string, PauseEntry>();

  pause(ctx: InterceptContext, timeoutMs = 30000): Promise<InterceptContext> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(ctx.request.id);
        resolve(ctx); // auto-forward original on timeout
      }, timeoutMs);

      this.pending.set(ctx.request.id, { resolve, reject, timer });
    });
  }

  resume(id: string, ctx: InterceptContext): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolve(ctx);
    return true;
  }

  drop(id: string): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.reject(new Error("Request dropped"));
    return true;
  }

  has(id: string): boolean {
    return this.pending.has(id);
  }

  getIds(): string[] {
    return [...this.pending.keys()];
  }
}
