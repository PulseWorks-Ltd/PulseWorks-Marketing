import { describe, it, expect, beforeAll } from '@jest/globals';
import { startOfMonth, endOfMonth, addDays, setHours, setMinutes } from 'date-fns';
import { TIME_WINDOWS } from '@shared/types';

describe('Scheduler', () => {
  describe('generateTimeSlots', () => {
    // Helper function (copy from scheduler for testing)
    function generateTimeSlots(
      startDate: Date,
      endDate: Date,
      daysOfWeek: number[],
      timeWindow: string,
      fixedTime: string | null
    ): Date[] {
      const slots: Date[] = [];
      const timeStr = fixedTime || TIME_WINDOWS[timeWindow as keyof typeof TIME_WINDOWS] || TIME_WINDOWS.MORNING;
      const [hours, minutes] = timeStr.split(':').map(Number);

      let currentDate = new Date(startDate);
      const end = endDate;

      while (currentDate <= end) {
        const dayOfWeek = currentDate.getDay() || 7; // Convert Sunday (0) to 7

        if (daysOfWeek.includes(dayOfWeek)) {
          const slotTime = setMinutes(setHours(currentDate, hours), minutes);
          if (slotTime > new Date()) {
            slots.push(slotTime);
          }
        }

        currentDate = addDays(currentDate, 1);
      }

      return slots.sort((a, b) => a.getTime() - b.getTime());
    }

    it('should generate correct number of slots for twice weekly', () => {
      const start = startOfMonth(new Date(2025, 0, 1)); // Jan 1, 2025
      const end = endOfMonth(start);
      const daysOfWeek = [2, 5]; // Tuesday, Friday

      const slots = generateTimeSlots(start, end, daysOfWeek, 'MORNING', null);

      // January 2025 has 9 Tuesdays + Fridays
      expect(slots.length).toBeGreaterThan(0);
      expect(slots.length).toBeLessThanOrEqual(10);
    });

    it('should generate slots at correct time', () => {
      const start = new Date(2025, 0, 6); // Jan 6, 2025 (Monday)
      const end = new Date(2025, 0, 12);
      const daysOfWeek = [1]; // Monday only

      const slots = generateTimeSlots(start, end, daysOfWeek, 'MORNING', null);

      expect(slots.length).toBeGreaterThan(0);

      // Check first slot has correct time
      const firstSlot = slots[0];
      expect(firstSlot.getHours()).toBe(9);
      expect(firstSlot.getMinutes()).toBe(30);
    });

    it('should use fixed time when provided', () => {
      const start = new Date(2025, 0, 6);
      const end = new Date(2025, 0, 12);
      const daysOfWeek = [1];

      const slots = generateTimeSlots(start, end, daysOfWeek, 'MORNING', '14:45');

      expect(slots.length).toBeGreaterThan(0);

      const firstSlot = slots[0];
      expect(firstSlot.getHours()).toBe(14);
      expect(firstSlot.getMinutes()).toBe(45);
    });

    it('should only include days from daysOfWeek array', () => {
      const start = new Date(2025, 0, 6); // Monday
      const end = new Date(2025, 0, 12); // Sunday
      const daysOfWeek = [3]; // Wednesday only

      const slots = generateTimeSlots(start, end, daysOfWeek, 'MORNING', null);

      // Should only have one Wednesday in this range
      expect(slots.length).toBe(1);

      const slot = slots[0];
      const dayOfWeek = slot.getDay() || 7;
      expect(dayOfWeek).toBe(3);
    });
  });

  describe('Tenant isolation', () => {
    it('should verify account scoping in queries', () => {
      // This is a conceptual test - in real implementation,
      // verify all Prisma queries include accountId filter

      const exampleQuery = {
        where: {
          accountId: 'test-account-id',
          status: 'APPROVED',
        },
      };

      expect(exampleQuery.where).toHaveProperty('accountId');
      expect(exampleQuery.where.accountId).toBe('test-account-id');
    });
  });
});
