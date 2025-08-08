import { MemoryStore, Store } from "express-rate-limit";

export function createStore(): Store {
    let rateLimitStore: Store = new MemoryStore();
    return rateLimitStore;
}
