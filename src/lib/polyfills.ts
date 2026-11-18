// Compatibilité avec les navigateurs un peu anciens (ex. Chrome Android non mis à jour depuis fin
// 2023, anciennes versions de Samsung Internet). Le moteur PDF utilise Promise.withResolvers
// (Chrome 119+) : sans elle, le lecteur restait bloqué sur « 1 / … » sans afficher aucune page.
// Le moteur lui-même (worker) utilise sa version « legacy », qui embarque ses propres compatibilités.
type WithResolvers<T> = { promise: Promise<T>; resolve: (v: T | PromiseLike<T>) => void; reject: (r?: unknown) => void };
const P = Promise as unknown as { withResolvers?: <T>() => WithResolvers<T> };
if (typeof P.withResolvers !== "function") {
  P.withResolvers = function <T>(): WithResolvers<T> {
    let resolve!: WithResolvers<T>["resolve"];
    let reject!: WithResolvers<T>["reject"];
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

export {};
