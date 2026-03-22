import type { SessionCameraRecording } from "../../../lib/voice-feedback/contracts";

const CAMERA_DB_NAME = "voiceforge-session-camera";
const CAMERA_DB_VERSION = 1;
const CAMERA_STORE_NAME = "recordings";

type StoredCameraRecordingValue = {
  blob: Blob;
  recording: SessionCameraRecording;
  savedAt: string;
};

function openCameraDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(CAMERA_DB_NAME, CAMERA_DB_VERSION);

    request.onerror = () => {
      reject(request.error ?? new Error("Failed to open camera recording storage."));
    };

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(CAMERA_STORE_NAME)) {
        database.createObjectStore(CAMERA_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
}

function withStore<T>(
  mode: IDBTransactionMode,
  handler: (store: IDBObjectStore) => IDBRequest<T>,
) {
  return new Promise<T>((resolve, reject) => {
    const requestPromise = openCameraDatabase();

    void requestPromise
      .then((database) => {
        const transaction = database.transaction(CAMERA_STORE_NAME, mode);
        const store = transaction.objectStore(CAMERA_STORE_NAME);
        const request = handler(store);

        request.onerror = () => {
          reject(request.error ?? new Error("Camera recording storage request failed."));
        };

        request.onsuccess = () => {
          resolve(request.result);
        };

        transaction.oncomplete = () => {
          database.close();
        };

        transaction.onerror = () => {
          reject(
            transaction.error ?? new Error("Camera recording storage transaction failed."),
          );
          database.close();
        };
      })
      .catch(reject);
  });
}

export async function saveSessionCameraRecording(
  recording: SessionCameraRecording,
  blob: Blob,
) {
  await withStore<IDBValidKey>("readwrite", (store) =>
    store.put({
      blob,
      id: recording.id,
      recording,
      savedAt: new Date().toISOString(),
    } satisfies StoredCameraRecordingValue & { id: string }),
  );

  return recording;
}

export function loadSessionCameraRecording(recordingId: string) {
  return withStore<StoredCameraRecordingValue | undefined>("readonly", (store) =>
    store.get(recordingId),
  ).then((value) => value ?? null);
}

export async function removeSessionCameraRecording(recordingId: string) {
  await withStore<undefined>("readwrite", (store) => store.delete(recordingId));
}
