import * as Comlink from 'comlink'

/**
 * Wraps an already-constructed Worker with a typed Comlink proxy.
 * Workers must be instantiated with the `?worker` suffix in Vite so they
 * are compiled and bundled correctly as separate JS entry points.
 */
export function wrapWorker<T extends object>(worker: Worker): Comlink.Remote<T> {
  return Comlink.wrap<T>(worker)
}

export async function terminateProxy<T extends object>(proxy: Comlink.Remote<T>): Promise<void> {
  await proxy[Comlink.releaseProxy]()
}
