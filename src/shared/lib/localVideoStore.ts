const databaseName = 'video-slide-web'
const storeName = 'local-videos'
const databaseVersion = 1

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion)

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName)
      }
    }

    request.onerror = () => reject(request.error ?? new Error('Falha ao abrir IndexedDB.'))
    request.onsuccess = () => resolve(request.result)
  })
}

async function runStoreOperation<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const database = await openDatabase()

  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const store = transaction.objectStore(storeName)
    const request = operation(store)

    request.onerror = () => reject(request.error ?? new Error('Falha ao acessar video local.'))
    request.onsuccess = () => resolve(request.result)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('Falha na transacao local.'))
    }
  })
}

export async function saveLocalVideo(storagePath: string, file: File) {
  await runStoreOperation('readwrite', (store) => store.put(file, storagePath))
}

export async function deleteLocalVideo(storagePath: string) {
  await runStoreOperation('readwrite', (store) => store.delete(storagePath))
}

export async function getLocalVideoUrl(storagePath: string) {
  const blob = await runStoreOperation<Blob | undefined>('readonly', (store) => store.get(storagePath))

  return blob ? URL.createObjectURL(blob) : ''
}
