import type { RequestHandler } from 'express';
import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../services/storage.service';
import { AppError } from '../utils/errors';

// Memory storage with a hard size cap; the file is validated by content, then written to private storage by the service.
const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5 } }).single('file');

export const singleFileUpload: RequestHandler = (req, res, next) => {
  parser(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return next(new AppError(413, 'PAYLOAD_TOO_LARGE', `That file is too large. The maximum size is ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`));
      return next(AppError.validation('Upload exactly one file in the "file" field.'));
    }
    next(err);
  });
};
