'use server';

import { getRequestContext } from '@cloudflare/next-on-pages';
import { drizzle } from 'drizzle-orm/d1';
import { users, monthlySummaries, dailyEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

function getDb() {
  try {
    const context = getRequestContext();
    if (!context) {
      console.error("No request context found. This might happen during SSR or build time.");
      return null;
    }
    const env = context.env as CloudflareEnv;
    if (!env?.DB) {
      console.error("D1 Database binding 'DB' not found in environment.");
      return null;
    }
    return drizzle(env.DB);
  } catch (e) {
    console.error("Error getting database context:", e);
    return null;
  }
}

export async function getUserProfile(matricula: string) {
  try {
    const db = getDb();
    if (!db) {
      console.warn("Database not available for getUserProfile");
      return null;
    }
    const result = await db.select().from(users).where(eq(users.matricula, matricula)).get();
    return result || null;
  } catch (e) {
    console.error("Error fetching user profile:", e);
    return null;
  }
}

export async function saveUserProfile(matricula: string, data: any) {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not available");
    const existing = await getUserProfile(matricula);
    if (existing) {
      await db.update(users).set(data).where(eq(users.matricula, matricula)).run();
    } else {
      await db.insert(users).values({ matricula, ...data }).run();
    }
    return { success: true };
  } catch (e: any) {
    console.error("Error saving user profile:", e);
    throw e;
  }
}

export async function getMonthlyEntries(matricula: string, month: number, year: number) {
  try {
    const db = getDb();
    if (!db) return [];
    const mYear = `${year}-${month.toString().padStart(2, '0')}`;
    const summaryId = `${matricula}_${mYear}`;
    
    const entries = await db.select().from(dailyEntries)
      .where(and(
        eq(dailyEntries.userProfileId, matricula),
        eq(dailyEntries.monthlyPointSummaryId, summaryId)
      )).all();
      
    return entries;
  } catch (e) {
    console.error("Error fetching monthly entries:", e);
    return [];
  }
}

export async function saveDailyEntriesBatch(matricula: string, month: number, year: number, entries: any[]) {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not available");
    const mYear = `${year}-${month.toString().padStart(2, '0')}`;
    const summaryId = `${matricula}_${mYear}`;

    // Ensure summary exists
    const existingSummary = await db.select().from(monthlySummaries).where(eq(monthlySummaries.id, summaryId)).get();
    if (!existingSummary) {
      await db.insert(monthlySummaries).values({
        id: summaryId,
        userProfileId: matricula,
        year,
        month,
        scrapedAt: new Date().toISOString()
      }).run();
    }

    // Insert or update entries
    for (const entry of entries) {
      const entryId = `${matricula}_${entry.id}`;
      const existing = await db.select().from(dailyEntries).where(eq(dailyEntries.id, entryId)).get();
      
      const data = {
        monthlyPointSummaryId: summaryId,
        userProfileId: matricula,
        date: entry.date,
        times: entry.times || [],
        isManualDsr: entry.isManualDsr || false,
        isManualWork: entry.isManualWork || false,
        isHoliday: entry.isHoliday || false,
        isCompensation: entry.isCompensation || false,
        isBankOff: entry.isBankOff || false,
      };

      if (existing) {
        await db.update(dailyEntries).set(data).where(eq(dailyEntries.id, entryId)).run();
      } else {
        await db.insert(dailyEntries).values({ id: entryId, ...data }).run();
      }
    }
    return { success: true };
  } catch (e: any) {
    console.error("Error saving daily entries batch:", e);
    throw e;
  }
}

export async function saveSingleEntry(matricula: string, month: number, year: number, entryId: string, data: any) {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not available");
    const fullEntryId = `${matricula}_${entryId}`;
    const mYear = `${year}-${month.toString().padStart(2, '0')}`;
    const summaryId = `${matricula}_${mYear}`;

    // Ensure summary exists
    const existingSummary = await db.select().from(monthlySummaries).where(eq(monthlySummaries.id, summaryId)).get();
    if (!existingSummary) {
      await db.insert(monthlySummaries).values({
        id: summaryId,
        userProfileId: matricula,
        year,
        month,
        scrapedAt: new Date().toISOString()
      }).run();
    }

    const existing = await db.select().from(dailyEntries).where(eq(dailyEntries.id, fullEntryId)).get();
    if (existing) {
      await db.update(dailyEntries).set(data).where(eq(dailyEntries.id, fullEntryId)).run();
    } else {
      await db.insert(dailyEntries).values({ 
        id: fullEntryId, 
        monthlyPointSummaryId: summaryId,
        userProfileId: matricula,
        ...data 
      }).run();
    }
    return { success: true };
  } catch (e: any) {
    console.error("Error saving single entry:", e);
    throw e;
  }
}

export async function getAllUsers() {
  try {
    const db = getDb();
    if (!db) return [];
    return await db.select().from(users).all();
  } catch (e) {
    console.error("Error fetching all users:", e);
    return [];
  }
}

export async function resetUserAuthVersion(matricula: string) {
  try {
    const db = getDb();
    if (!db) throw new Error("Database not available");
    const user = await getUserProfile(matricula);
    if (!user) throw new Error("User not found");
    const newVersion = (user.authVersion || 0) + 1;
    await db.update(users).set({ authVersion: newVersion, uid: null, updatedAt: new Date().toISOString() }).where(eq(users.matricula, matricula)).run();
    return { success: true };
  } catch (e: any) {
    console.error("Error resetting user auth version:", e);
    throw e;
  }
}
