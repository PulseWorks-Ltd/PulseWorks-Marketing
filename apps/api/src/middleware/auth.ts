import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';

// Use NEXTAUTH_SECRET as the single source of truth
// This is the same secret used by NextAuth for session tokens
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';

export interface AuthRequest extends Request {
  userId?: string;
  accountId?: string;
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    accountId: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      accountId: string;
    };

    // Load user to verify account still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        account: {
          select: {
            id: true,
            name: true,
            plan: true,
            postingAddon: true,
          },
        },
      },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Set auth context
    req.userId = user.id;
    req.accountId = user.accountId;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      accountId: user.accountId,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    res.status(500).json({ error: 'Authentication error' });
  }
};

// Middleware to check posting addon
export const requirePostingAddon = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.accountId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const account = await prisma.account.findUnique({
    where: { id: req.accountId },
    select: { postingAddon: true },
  });

  if (!account?.postingAddon) {
    res.status(403).json({
      error: 'Posting addon required',
      message: 'This feature requires the Posting & Scheduling add-on',
    });
    return;
  }

  next();
};
