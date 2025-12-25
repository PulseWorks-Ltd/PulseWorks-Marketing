import { prisma } from '../db/client';
import { EventType } from '@prisma/client';

export interface AuditEventData {
  accountId: string;
  userId?: string;
  eventType: EventType;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(data: AuditEventData): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        accountId: data.accountId,
        userId: data.userId,
        eventType: data.eventType,
        entityType: data.entityType,
        entityId: data.entityId,
        metadata: data.metadata || {},
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
    // Don't throw - audit logging should not break the main flow
  }
}
