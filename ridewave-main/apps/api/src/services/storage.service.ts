import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';
import { AppError } from '../utils/errors';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type FileKind = { ext: 'pdf' | 'png' | 'jpg'; mime: string };

/** Identify a file by its leading bytes. The client-declared type and file name are never trusted. */
export function sniffFileType(buf: Buffer): FileKind | null {
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png', mime: 'image/png' };
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg' };
  return null;
}

const KEY_PATTERN = /^[a-f0-9]{32}\.(pdf|png|jpg)$/;
const root = () => path.resolve(env.STORAGE_DIR, 'documents');

/** Resolve a storage key to a file path, refusing anything that is not exactly a key we generated (no path traversal). */
export function documentPath(storageKey: string): string {
  if (!KEY_PATTERN.test(storageKey)) throw AppError.notFound('Document not found.');
  return path.join(root(), storageKey);
}

export async function saveDocument(buf: Buffer, kind: FileKind): Promise<{ storageKey: string; mimeType: string; sizeBytes: number }> {
  await fs.mkdir(root(), { recursive: true });
  const storageKey = `${crypto.randomBytes(16).toString('hex')}.${kind.ext}`;
  await fs.writeFile(documentPath(storageKey), buf, { flag: 'wx', mode: 0o600 });
  return { storageKey, mimeType: kind.mime, sizeBytes: buf.length };
}

export const openDocument = (storageKey: string) => createReadStream(documentPath(storageKey));
export const removeDocument = (storageKey: string) => fs.rm(documentPath(storageKey), { force: true });
