import * as Comlink from 'comlink'

/**
 * Creates a typed Comlink proxy for a Web Worker.
 * The worker file must use `Comlink.expose(new WorkerClass())`.
 */
export function createWorkerProxy<T extends object>(workerUrl: URL): Comlink.Remote<T> {
  const worker = new Worker(workerUrl, { type: 'module' })
  return Comlink.wrap<T>(worker)
}

/**
 * Terminates a Comlink proxy's underlying worker.
 */
export async function terminateProxy<T extends object>(proxy: Comlink.Remote<T>): Promise<void> {
  await proxy[Comlink.releaseProxy]()
}
