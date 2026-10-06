import { validateBackup } from "./data.js";

// Private data is encrypted before it leaves memory or is persisted.
const DB = 'mdk-private-v1';
const CONFIG = 'mdk-cloud-config-v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
let key, salt, payload, database;
let writes = Promise.resolve();
export const isUnlocked = () => Boolean(key && payload);
export const privateData = () => { if (!isUnlocked()) throw new Error('Unlock Customers & Backups first.'); return payload; };
export function toBase64(bytes) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(text);
}
export const fromBase64 = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
async function db() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('vault');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Private storage is unavailable in this browser.'));
  });
  return database;
}
async function storage(mode, value) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('vault', mode);
    const request = mode === 'readwrite' ? tx.objectStore('vault').put(value, 'current') : tx.objectStore('vault').get('current');
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(new Error('Could not save the private backup. Free device storage and try again.'));
    tx.onabort = tx.onerror;
  });
}
export const hasVault = async () => Boolean(await storage('readonly'));
async function derive(password, saltBytes) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltBytes, iterations: 310000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encrypt(data, secret = key, saltBytes = salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secret, encoder.encode(JSON.stringify(data)));
  return { format: 'mdk-private-v1', salt: toBase64(saltBytes), iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) };
}
async function decryptRaw(envelope, password) {
  if (envelope?.format !== 'mdk-private-v1' || !envelope.salt || !envelope.iv || !envelope.ciphertext) throw new Error('This is not an encrypted MDK backup.');
  const saltBytes = fromBase64(envelope.salt);
  const secret = await derive(password, saltBytes);
  let data;
  try {
    data = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(envelope.iv) }, secret, fromBase64(envelope.ciphertext))));
  } catch { throw new Error('Incorrect backup password or damaged backup.'); }
  return { secret, saltBytes, data };
}
export async function decryptEnvelope(envelope, password) {
  const result = await decryptRaw(envelope, password);
  if (!Array.isArray(result.data.customers) || !Array.isArray(result.data.pdfs) || !result.data.state) throw new Error('The backup contents are invalid.');
  validateBackup(result.data.state);
  return result;
}
export async function unlockVault(password, initialState) {
  const envelope = await storage('readonly');
  if (envelope) {
    const result = await decryptEnvelope(envelope, password);
    key = result.secret; salt = result.saltBytes; payload = result.data;
  } else {
    if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
    salt = crypto.getRandomValues(new Uint8Array(16));
    key = await derive(password, salt);
    payload = { customers: [], pdfs: [], history: [], state: structuredClone(initialState), modifiedAt: new Date().toISOString() };
    try { await saveVault(initialState); } catch (error) { lockVault(); throw error; }
  }
}
export function lockVault() { key = null; salt = null; payload = null; }
export async function restoreEnvelope(envelope, password, fromCloud = false) {
  const result = await decryptEnvelope(envelope, password);
  for (const pdf of result.data.pdfs) {
    if (pdf.content) continue;
    if (!fromCloud || !session || !pdf.cloudPath?.startsWith(`${session.user.id}/`)) throw new Error('This backup needs its cloud PDF files. Restore it while signed in.');
    const blob = await api(`/storage/v1/object/authenticated/mdk-private/${objectPath(pdf.cloudPath)}`, { binary: true });
    const file = await decryptRaw(JSON.parse(await blob.text()), password);
    if (typeof file.data.content !== 'string') throw new Error('A cloud PDF is damaged. Current data was kept.');
    pdf.content = file.data.content;
  }
  await writes.catch(() => {});
  await storage('readwrite', await encrypt(result.data, result.secret, result.saltBytes));
  key = result.secret; salt = result.saltBytes; payload = result.data;
  return structuredClone(payload.state);
}
export function saveVault(state) {
  const data = privateData();
  data.state = structuredClone(state);
  data.modifiedAt = new Date().toISOString();
  const snapshot = structuredClone(data), secret = key, saltBytes = salt;
  const task = writes.catch(() => {}).then(async () => {
    const envelope = await encrypt(snapshot, secret, saltBytes);
    await storage('readwrite', envelope);
    return envelope;
  });
  writes = task;
  return task;
}
export async function archivePdf(type, doc, blob, filename) {
  const data = privateData();
  data.pdfs.push({ id: crypto.randomUUID(), type, documentId: doc.id, number: doc.number, filename, createdAt: new Date().toISOString(), content: toBase64(new Uint8Array(await blob.arrayBuffer())) });
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const downloadEnvelope = envelope => downloadBlob(new Blob([JSON.stringify(envelope)], { type: 'application/json' }), `MDK_Private_Backup_${new Date().toISOString().replace(/[:.]/g, '-')}.mdkbackup`);
export function cloudConfig() {
  const defaults = {
    url: 'https://dwtzbxuwxcyhavisiubm.supabase.co',
    publicKey: 'sb_publishable_ngw9wbVyJmu5EGzcREvy0A_6UHZYFPa',
  };
  try { return JSON.parse(localStorage.getItem(CONFIG)) || defaults; } catch { return defaults; }
}
export function configureCloud(url, publicKey) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(parsed.hostname) || parsed.pathname !== '/') throw new Error('Use your HTTPS Supabase project URL.');
  if (!publicKey.startsWith('sb_publishable_')) {
    try { if (JSON.parse(atob(publicKey.split('.')[1])).role !== 'anon') throw new Error(); }
    catch { throw new Error('Use the publishable or anon key, never a secret/service-role key.'); }
  }
  localStorage.setItem(CONFIG, JSON.stringify({ url: parsed.origin, publicKey }));
  cloudLogout();
}
let session = null;
let cloudWrites = Promise.resolve();
export const cloudConnected = () => Boolean(session);
async function api(path, options = {}, authenticated = true) {
  const config = cloudConfig();
  if (!config.url || !config.publicKey) throw new Error('Connect a Supabase project in Backups first.');
  if (authenticated) {
    if (!session) throw new Error('Sign in to cloud backups first.');
    if (Date.now() > session.expiresAt - 30000) {
      const result = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: session.refresh_token }) }, false);
      session = { ...result, expiresAt: Date.now() + result.expires_in * 1000 };
    }
  }
  const headers = new Headers(options.headers);
  headers.set('apikey', config.publicKey);
  if (authenticated) headers.set('Authorization', `Bearer ${session.access_token}`);
  if (typeof options.body === 'string' && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(config.url + path, { ...options, headers, cache: 'no-store' });
  if (!response.ok) {
    let details; try { details = await response.json(); } catch { /* non JSON error */ }
    const error = new Error(details?.msg || details?.message || details?.error_description || `Cloud request failed (${response.status}).`);
    error.status = response.status; error.duplicate = details?.error === 'Duplicate' || details?.statusCode === '409';
    throw error;
  }
  if (options.binary) return response.blob();
  if (response.status === 204 || response.headers.get('content-length') === '0') return null;
  const text = await response.text(); return text ? JSON.parse(text) : null;
}
export async function cloudLogin(email, password) {
  const result = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  session = { ...result, expiresAt: Date.now() + result.expires_in * 1000 };
  try {
    const owners = await api('/rest/v1/mdk_owners?select=user_id');
    if (!owners?.some(owner => owner.user_id === session.user.id)) throw new Error('This account is not the MDK owner.');
  } catch (error) { cloudLogout(); throw error; }
}
export function cloudLogout() { session = null; }
const objectPath = path => path.split('/').map(encodeURIComponent).join('/');
export function uploadBackup() {
  if (!session) return Promise.reject(new Error('Sign in to cloud backups first.'));
  const ownerId = session.user.id;
  const snapshot = structuredClone(privateData()), secret = key, saltBytes = salt;
  const task = cloudWrites.catch(() => {}).then(async () => {
    for (const pdf of snapshot.pdfs) {
      const path = `${ownerId}/${pdf.type}/${pdf.documentId}/${pdf.id}.mdkpdf`;
      const envelope = await encrypt({ filename: pdf.filename, content: pdf.content }, secret, saltBytes);
      try {
        await api(`/storage/v1/object/mdk-private/${objectPath(path)}`, { method: 'POST', body: JSON.stringify(envelope), headers: { 'Content-Type': 'application/json' } });
      } catch (error) { if (error.status !== 409 && !error.duplicate) throw error; }
      pdf.cloudPath = path; delete pdf.content;
    }
    const envelope = await encrypt(snapshot, secret, saltBytes);
    const name = `${ownerId}/backups/${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID()}.mdkbackup`;
    return api(`/storage/v1/object/mdk-private/${objectPath(name)}`, { method: 'POST', body: JSON.stringify(envelope), headers: { 'Content-Type': 'application/json' } });
  });
  cloudWrites = task;
  return task;
}
export async function listCloudBackups() {
  const results = []; let offset = 0;
  while (true) {
    const batch = await api('/storage/v1/object/list/mdk-private', { method: 'POST', body: JSON.stringify({ prefix: `${session?.user.id}/backups`, limit: 100, offset, sortBy: { column: 'name', order: 'desc' } }) });
    results.push(...batch); if (batch.length < 100) break; offset += 100;
  }
  return results;
}
export async function readCloudBackup(name) {
  if (!name || name.includes('/') || !name.endsWith('.mdkbackup')) throw new Error('Invalid backup name.');
  const blob = await api(`/storage/v1/object/authenticated/mdk-private/${objectPath(`${session?.user.id}/backups/${name}`)}`, { binary: true });
  return JSON.parse(await blob.text());
}
export async function uploadCloudRecord(type, doc) {
  const envelope = await encrypt(doc);
  const path = `${session?.user.id}/${type}/${doc.id}/${Date.now()}-${crypto.randomUUID()}.mdkrecord`;
  await api(`/storage/v1/object/mdk-private/${objectPath(path)}`, { method: 'POST', body: JSON.stringify(envelope), headers: { 'Content-Type': 'application/json' } });
}

export function archiveRecord(type, doc) {
  const data = privateData();
  data.history ||= [];
  data.history.push({ id: crypto.randomUUID(), type, document: structuredClone(doc), createdAt: new Date().toISOString() });
}
