'use server';

import { getRequestContext } from '@cloudflare/next-on-pages';
import { drizzle } from 'drizzle-orm/d1';
import { users, monthlySummaries, dailyEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

function getDb() {
  const env = getRequestContext().env as CloudflareEnv;
  if (!env?.DB) {
    throw new Error("D1 Database binding 'DB' not found. Ensure you are running via Wrangler or deployed on Cloudflare Pages.");
  }
  return drizzle(env.DB);
}

export async function getUserProfile(matricula: string) {
  try {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.matricula, matricula)).get();
    return result || null;
  } catch (e) {
    console.error("Error fetching user profile:", e);
    return null;
  }
}

export async function saveUserProfile(matricula: string, data: any) {
  const db = getDb();
  const existing = await getUserProfile(matricula);
  if (existing) {
    await db.update(users).set(data).where(eq(users.matricula, matricula)).run();
  } else {
    await db.insert(users).values({ matricula, ...data }).run();
  }
  return { success: true };
}

export async function getMonthlyEntries(matricula: string, month: number, year: number) {
  try {
    const db = getDb();
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
  const db = getDb();
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
}

export async function saveSingleEntry(matricula: string, month: number, year: number, entryId: string, data: any) {
  const db = getDb();
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
}

export async function getAllUsers() {
  try {
    const db = getDb();
    return await db.select().from(users).all();
  } catch (e) {
    console.error("Error fetching all users:", e);
    return [];
  }
}

export async function resetUserAuthVersion(matricula: string) {
  const db = getDb();
  const user = await getUserProfile(matricula);
  if (!user) throw new Error("User not found");
  const newVersion = (user.authVersion || 0) + 1;
  await db.update(users).set({ authVersion: newVersion, uid: null, updatedAt: new Date().toISOString() }).where(eq(users.matricula, matricula)).run();
  return { success: true };
}
