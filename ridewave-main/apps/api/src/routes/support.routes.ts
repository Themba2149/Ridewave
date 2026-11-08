import { Router } from 'express';
import { prisma } from '../config/database';
import { contactLimiter } from '../middleware/rate-limit';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../utils/async-handler';
import { contactSchema, type ContactInput } from '../validators/support.validators';

export const supportRouter = Router();

// Public contact form. Stores a SupportTicket; no email is sent in development mode.
supportRouter.post(
  '/contact',
  contactLimiter,
  validate({ body: contactSchema }),
  asyncHandler(async (req, res) => {
    const input = req.body as ContactInput;
    const ticket = await prisma.supportTicket.create({ data: input, select: { id: true } });
    res.status(201).json({
      success: true,
      data: { ticketId: ticket.id, message: 'Your message has been saved. In development mode no confirmation email is sent.' },
    });
  }),
);
