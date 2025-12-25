import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/client';
import { signUpSchema, signInSchema } from '@shared/types';
import { logAuditEvent } from '../utils/audit';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';

// Sign up
router.post('/signup', async (req, res, next) => {
  try {
    const body = signUpSchema.parse(req.body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email: body.email },
    });

    if (existingUser) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(body.password, 10);

    // Create account and user in transaction
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.account.create({
        data: {
          name: body.businessName,
          plan: 'ESSENTIAL',
          postingAddon: false,
        },
      });

      const user = await tx.user.create({
        data: {
          email: body.email,
          name: body.name,
          passwordHash,
          role: 'OWNER',
          accountId: account.id,
        },
      });

      return { account, user };
    });

    // Log audit event
    await logAuditEvent({
      accountId: result.account.id,
      userId: result.user.id,
      eventType: 'ACCOUNT_CREATED',
      entityType: 'Account',
      entityId: result.account.id,
    });

    await logAuditEvent({
      accountId: result.account.id,
      userId: result.user.id,
      eventType: 'USER_CREATED',
      entityType: 'User',
      entityId: result.user.id,
    });

    // Generate token
    const token = jwt.sign(
      {
        userId: result.user.id,
        accountId: result.account.id,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      account: {
        id: result.account.id,
        name: result.account.name,
        plan: result.account.plan,
        postingAddon: result.account.postingAddon,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Sign in
router.post('/signin', async (req, res, next) => {
  try {
    const body = signInSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: body.email },
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

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const validPassword = await bcrypt.compare(body.password, user.passwordHash);

    if (!validPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Log login
    await logAuditEvent({
      accountId: user.accountId,
      userId: user.id,
      eventType: 'USER_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });

    const token = jwt.sign(
      {
        userId: user.id,
        accountId: user.accountId,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      account: {
        id: user.account.id,
        name: user.account.name,
        plan: user.account.plan,
        postingAddon: user.account.postingAddon,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
