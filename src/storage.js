import { VesselProfile, validateProfileJSON } from './geometry/profile.js';

const DB_NAME = 'llenado-library';
const DB_VERSION = 1;
const STORE_NAME = 'designs';
const MAX_DESIGN_BYTES = 1024 * 1024;

/** Error with a stable code for callers that need to explain storage failures. */
export class DesignStorageError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = 'DesignStorageError';
    this.code = code;
  }
}

function fail(code, message, cause) {
  return new DesignStorageError(code, message, cause ? { cause } : undefined);
}

function requireName(name) {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw fail('INVALID_NAME', 'El nombre debe contener entre 1 y 120 caracteres.');
  }
  return name.trim();
}

function validateDesign(design) {
  if (!design || typeof design !== 'object' || Array.isArray(design) || design.format !== 'llenado-design' || design.version !== 1) {
    throw fail('INVALID_DESIGN', 'Se esperaba un diseño llenado-design versión 1.');
  }
  try {
    validateProfileJSON(design.profile);
  } catch (error) {
    throw fail('INVALID_DESIGN', `El perfil del diseño no es válido: ${error.message}`, error);
  }
  if (design.flowRate !== undefined && (!Number.isFinite(design.flowRate) || design.flowRate < 0)) {
    throw fail('INVALID_DESIGN', 'El caudal debe ser finito y no negativo.');
  }
  if (design.initialVolume !== undefined) {
    if (!Number.isFinite(design.initialVolume) || design.initialVolume < 0) throw fail('INVALID_DESIGN', 'El volumen inicial debe ser finito y no negativo.');
    try {
      const profile = VesselProfile.fromJSON(design.profile);
      if (design.initialVolume > profile.capacity) throw fail('INVALID_DESIGN', 'El volumen inicial excede la capacidad del perfil.');
    } catch (error) {
      if (error instanceof DesignStorageError) throw error;
      throw fail('INVALID_DESIGN', `No se pudo validar el volumen inicial: ${error.message}`, error);
    }
  }
  let encoded;
  try { encoded = JSON.stringify(design); }
  catch (error) { throw fail('INVALID_DESIGN', 'El diseño no se puede serializar como JSON.', error); }
  if (typeof encoded !== 'string') throw fail('INVALID_DESIGN', 'El diseño no se puede serializar como JSON.');
  const bytes = typeof TextEncoder === 'function' ? new TextEncoder().encode(encoded).byteLength : unescape(encodeURIComponent(encoded)).length;
  if (bytes > MAX_DESIGN_BYTES) throw fail('DESIGN_TOO_LARGE', 'El diseño supera el límite de 1 MiB.');
  return JSON.parse(encoded);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const indexedDB = globalThis.indexedDB;
    if (!indexedDB || typeof indexedDB.open !== 'function') {
      reject(fail('INDEXEDDB_UNAVAILABLE', 'IndexedDB no está disponible en este entorno.'));
      return;
    }
    let request;
    try { request = indexedDB.open(DB_NAME, DB_VERSION); }
    catch (error) { reject(fail('INDEXEDDB_OPEN_FAILED', 'No se pudo abrir la biblioteca IndexedDB.', error)); return; }
    let settled = false;
    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        const store = db.objectStoreNames.contains(STORE_NAME)
          ? request.transaction.objectStore(STORE_NAME)
          : db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        if (!store.indexNames.contains('name')) store.createIndex('name', 'name', { unique: false });
        if (!store.indexNames.contains('createdAt')) store.createIndex('createdAt', 'createdAt', { unique: false });
        if (!store.indexNames.contains('updatedAt')) store.createIndex('updatedAt', 'updatedAt', { unique: false });
      } catch (error) {
        try { request.transaction?.abort(); } catch { /* transaction may already be inactive */ }
        if (!settled) { settled = true; reject(fail('INDEXEDDB_UPGRADE_FAILED', 'No se pudo actualizar el esquema de la biblioteca.', error)); }
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      settled = true;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      const error = request.error;
      const code = error?.name === 'VersionError' ? 'INDEXEDDB_VERSION' : 'INDEXEDDB_OPEN_FAILED';
      reject(fail(code, error?.name === 'VersionError' ? 'La biblioteca fue creada por una versión posterior.' : 'No se pudo abrir la biblioteca IndexedDB.', error));
    };
    request.onblocked = () => {
      if (settled) return;
      settled = true;
      reject(fail('INDEXEDDB_BLOCKED', 'La actualización está bloqueada por otra pestaña con la biblioteca abierta.')); 
    };
  });
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
    return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return `design-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

async function runTransaction(mode, operation) {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      let tx;
      try { tx = db.transaction(STORE_NAME, mode); }
      catch (error) { reject(fail('INDEXEDDB_TRANSACTION_FAILED', 'No se pudo iniciar la operación de almacenamiento.', error)); return; }
      let result;
      let requestError;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(fail('INDEXEDDB_TRANSACTION_FAILED', 'La operación de almacenamiento fue cancelada.', requestError || tx.error));
      tx.onerror = () => { requestError = tx.error || requestError; };
      try { operation(tx.objectStore(STORE_NAME), value => { result = value; }, error => { requestError = error; }); }
      catch (error) { try { tx.abort(); } catch { /* transaction may be inactive */ } reject(fail('INDEXEDDB_TRANSACTION_FAILED', 'Falló la operación de almacenamiento.', error)); }
    });
  } finally { db.close(); }
}

/** Return all saved designs, newest update first. */
export function listDesigns() {
  return runTransaction('readonly', (store, setResult) => {
    const request = store.getAll();
    request.onsuccess = () => setResult(request.result.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  });
}

/** Save a validated version-1 design wrapper; creates a stable id when omitted. */
export async function saveDesign({ id, name, design } = {}) {
  const safeName = requireName(name);
  const safeDesign = validateDesign(design);
  const safeId = id === undefined ? makeId() : String(id);
  if (!safeId || safeId.length > 200) throw fail('INVALID_ID', 'El identificador no es válido.');
  const now = new Date().toISOString();
  return runTransaction('readwrite', (store, setResult, setRequestError) => {
    const get = store.get(safeId);
    get.onerror = () => setRequestError(get.error);
    get.onsuccess = () => {
      const old = get.result;
      const record = { id: safeId, name: safeName, design: safeDesign, createdAt: old?.createdAt || now, updatedAt: now };
      const put = store.put(record);
      put.onsuccess = () => setResult(record);
      put.onerror = () => setRequestError(put.error);
    };
  });
}

/** Get a design by id, returning null if it does not exist. */
export function getDesign(id) {
  return runTransaction('readonly', (store, setResult, setRequestError) => {
    const request = store.get(String(id));
    request.onsuccess = () => setResult(request.result || null);
    request.onerror = () => setRequestError(request.error);
  });
}

/** Change a saved design's name and updatedAt timestamp. */
export function renameDesign(id, name) {
  const safeName = requireName(name);
  return runTransaction('readwrite', (store, setResult, setRequestError) => {
    const request = store.get(String(id));
    request.onerror = () => setRequestError(request.error);
    request.onsuccess = () => {
      if (!request.result) { setResult(null); return; }
      const record = { ...request.result, name: safeName, updatedAt: new Date().toISOString() };
      const put = store.put(record);
      put.onsuccess = () => setResult(record);
      put.onerror = () => setRequestError(put.error);
    };
  });
}

/** Delete a saved design by id; returns true if a record existed. */
export function deleteDesign(id) {
  return runTransaction('readwrite', (store, setResult, setRequestError) => {
    const request = store.get(String(id));
    request.onerror = () => setRequestError(request.error);
    request.onsuccess = () => {
      const existed = Boolean(request.result);
      const deletion = store.delete(String(id));
      deletion.onsuccess = () => setResult(existed);
      deletion.onerror = () => setRequestError(deletion.error);
    };
  });
}
