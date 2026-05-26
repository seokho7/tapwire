import type { HostCert } from "./cert.js";
import { createCertForHost } from "./cert.js";
import type { CA } from "./ca.js";

export class CertCache {
  private cache = new Map<string, HostCert>();
  private order: string[] = [];
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  async getOrCreate(host: string, ca: CA): Promise<HostCert> {
    const cached = this.cache.get(host);
    if (cached) {
      this.hits++;
      return cached;
    }

    this.misses++;
    const cert = await createCertForHost(host, ca);
    this.set(host, cert);
    return cert;
  }

  private set(host: string, cert: HostCert): void {
    if (this.cache.size >= this.maxSize) {
      const oldest = this.order.shift();
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(host, cert);
    this.order.push(host);
  }

  get stats() {
    return { hits: this.hits, misses: this.misses, size: this.cache.size };
  }
}
