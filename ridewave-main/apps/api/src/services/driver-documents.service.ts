import path from 'node:path';
import { driversRepository as drivers } from '../repositories/drivers.repository';
import type { UserRecord } from '../types/auth';
import type { DocumentRow } from '../types/admin';
import { AppError } from '../utils/errors';
import { requireDriver } from './driver.service';
import { documentPath, openDocument, removeDocument, saveDocument, sniffFileType } from './storage.service';
import fs from 'node:fs/promises';

const MAX_DOCUMENTS_PER_DRIVER = 20;

/** Documents are returned without their storage key: clients can only fetch a file through an authorised endpoint. */
export const toDocumentDto = ({ storageKey: _k, ...rest }: DocumentRow) => (void _k, rest);

const cleanName = (name: string) => path.basename(name).replace(/[^\p{L}\p{N} ._()-]/gu, '_').slice(0, 100) || 'document';

export async function uploadDocument(user: UserRecord, input: { type: string; file?: { buffer: Buffer; originalname: string } }) {
  const ctx = await requireDriver(user);
  if (!input.file || input.file.buffer.length === 0) throw AppError.validation('Choose a file to upload.');
  const kind = sniffFileType(input.file.buffer); // decided from the file contents, not the declared type or extension
  if (!kind) throw AppError.validation('Only PDF, PNG or JPEG files are accepted.');
  if ((await drivers.countDocuments(ctx.id)) >= MAX_DOCUMENTS_PER_DRIVER) throw AppError.conflict('You have reached the document limit. Contact support to remove old files.');
  const saved = await saveDocument(input.file.buffer, kind);
  try {
    return toDocumentDto(await drivers.createDocument(ctx.id, { type: input.type, originalName: cleanName(input.file.originalname), ...saved }));
  } catch (e) {
    await removeDocument(saved.storageKey); // do not leave an orphan file behind
    throw e;
  }
}

export async function listOwnDocuments(user: UserRecord) {
  const ctx = await requireDriver(user);
  return (await drivers.listDocuments(ctx.id)).map(toDocumentDto);
}

export async function openOwnDocument(user: UserRecord, documentId: string) {
  const ctx = await requireDriver(user);
  const doc = await drivers.getOwnDocument(ctx.id, documentId); // scoped to the owner: other drivers' ids give 404
  if (!doc) throw AppError.notFound('Document not found.');
  try { await fs.access(documentPath(doc.storageKey)); } catch { throw AppError.notFound('The stored file is missing.'); }
  return { doc, stream: openDocument(doc.storageKey) };
}
