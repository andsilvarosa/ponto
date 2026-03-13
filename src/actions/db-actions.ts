'use server';

import { getRequestContext } from '@cloudflare/next-on-pages';
import { drizzle } from 'drizzle-orm/d1';
import { users, monthlySummaries, dailyEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

let localDb: any = null;

async function getDb() {
  // 1. Try Cloudflare Request Context (Edge Runtime)
  try {
    // getRequestContext can throw if not in a request context or if the library is not initialized
    const context = getRequestContext();
    if (context?.env?.DB) {
      return drizzle(context.env.DB);
    }
  } catch (e) {
    // Not in Cloudflare Edge environment or context not available
  }

  // 2. Try process.env.DB (Cloudflare Node.js runtime or local emulation)
  const env = process.env as any;
  if (env.DB && typeof env.DB.prepare === 'function') {
    return drizzle(env.DB);
  }

  // 3. Local Fallback for AI Studio Preview / Development
  if (process.env.NODE_ENV === 'development' || !process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME === 'nodejs') {
    if (!localDb) {
      try {
        const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
        const Database = (await import('better-sqlite3')).default;
        const sqlite = new Database('local.db');
        localDb = drizzleSqlite(sqlite);
        
        // Basic initialization for local development
        // In a real app, you'd use migrations
        sqlite.exec(`
          CREATE TABLE IF NOT EXISTS users (
            matricula TEXT PRIMARY KEY,
            uid TEXT UNIQUE,
            is_admin INTEGER DEFAULT 0,
            auth_version INTEGER DEFAULT 0,
            previous_balance TEXT DEFAULT '00:00',
            previous_balance_month INTEGER,
            previous_balance_year INTEGER,
            balance_adjustment TEXT DEFAULT '00:00',
            previous_holiday_balance INTEGER DEFAULT 0,
            fixed_dsr_days TEXT,
            reference_dsr_sunday TEXT,
            daily_workload INTEGER DEFAULT 440,
            holidays TEXT,
            registration_number TEXT,
            updated_at TEXT
          );
          CREATE TABLE IF NOT EXISTS monthly_summaries (
            id TEXT PRIMARY KEY,
            user_profile_id TEXT REFERENCES users(matricula) ON DELETE CASCADE,
            year INTEGER,
            month INTEGER,
            scraped_at TEXT
          );
          CREATE TABLE IF NOT EXISTS daily_entries (
            id TEXT PRIMARY KEY,
            monthly_point_summary_id TEXT REFERENCES monthly_summaries(id) ON DELETE CASCADE,
            user_profile_id TEXT REFERENCES users(matricula) ON DELETE CASCADE,
            date TEXT,
            times TEXT,
            is_manual_dsr INTEGER DEFAULT 0,
            is_manual_work INTEGER DEFAULT 0,
            is_holiday INTEGER DEFAULT 0,
            is_compensation INTEGER DEFAULT 0,
            is_bank_off INTEGER DEFAULT 0
          );
        `);
      } catch (e) {
        console.error("Failed to initialize local SQLite fallback:", e);
      }
    }
    return localDb;
  }

  return null;
}

export async function getUserProfile(matricula: string) {
  try {
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
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
    const db = await getDb();
    if (!db) return [];
    return await db.select().from(users).all();
  } catch (e) {
    console.error("Error fetching all users:", e);
    return [];
  }
}

export async function resetUserAuthVersion(matricula: string) {
  try {
    const db = await getDb();
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
