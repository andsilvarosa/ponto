'use server';

import { users, monthlySummaries, dailyEntries } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Cache para as instâncias do banco
let cachedDb: any = null;

async function getDb() {
  if (cachedDb) return cachedDb;

  const isEdge = process.env.NEXT_RUNTIME === 'edge';
  const isProd = process.env.NODE_ENV === 'production';

  // 1. AMBIENTE CLOUDFLARE (EDGE) - PRODUÇÃO
  if (isEdge || isProd) {
    try {
      console.log("[DB] Iniciando busca exaustiva de binding D1...");
      
      let dbBinding: any = null;

      // Estratégia A: process.env.DB (Padrão Nodejs Compat)
      if (typeof process !== 'undefined' && (process.env as any).DB) {
        dbBinding = (process.env as any).DB;
        console.log("[DB] Binding encontrado em process.env.DB");
      }

      // Estratégia B: getRequestContext (Padrão Cloudflare Pages)
      if (!dbBinding) {
        try {
          const { getRequestContext } = await import('@cloudflare/next-on-pages');
          const context = getRequestContext();
          dbBinding = context?.env?.DB;
          if (dbBinding) console.log("[DB] Binding encontrado em getRequestContext().env.DB");
        } catch (e) {
          console.log("[DB] getRequestContext não disponível ou falhou");
        }
      }

      // Estratégia C: Global env (Fallback extremo)
      if (!dbBinding && typeof (globalThis as any).__env__ !== 'undefined') {
        dbBinding = (globalThis as any).__env__?.DB;
        if (dbBinding) console.log("[DB] Binding encontrado em globalThis.__env__.DB");
      }

      if (dbBinding) {
        const { drizzle: drizzleD1 } = await import('drizzle-orm/d1');
        cachedDb = drizzleD1(dbBinding);
        return cachedDb;
      }
      
      console.error("[DB] ERRO: Binding 'DB' não encontrado em nenhuma das estratégias (A, B, C).");
      return null;
    } catch (e) {
      console.error("[DB] Exceção crítica ao inicializar D1:", e);
      return null;
    }
  }

  // 2. AMBIENTE DESENVOLVIMENTO / NODE.JS (AI Studio)
  if (!isProd && !isEdge) {
    try {
      // Usamos uma string dinâmica para o require para impedir que o Webpack tente resolver o módulo durante o build do Cloudflare
      const moduleName = 'better-sqlite3';
      const drizzleModuleName = 'drizzle-orm/better-sqlite3';
      
      const Database = eval('require')(moduleName);
      const { drizzle: drizzleSqlite } = eval('require')(drizzleModuleName);
      
      const sqlite = new Database('local.db');
      cachedDb = drizzleSqlite(sqlite);
      
      // Inicialização básica das tabelas se não existirem (apenas local)
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
      return cachedDb;
    } catch (e) {
      console.error("Erro ao inicializar SQLite local:", e);
    }
  }

  return null;
}

export async function getUserProfile(matricula: string) {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[DB] Banco de dados não disponível para getUserProfile");
      return null;
    }
    const result = await db.select().from(users).where(eq(users.matricula, matricula)).get();
    return result ? JSON.parse(JSON.stringify(result)) : null;
  } catch (e: any) {
    if (e?.message?.includes("no such table")) {
      console.error(`[DB] ERRO CRÍTICO: A tabela 'users' não existe no banco D1. Execute as migrações.`);
    } else {
      console.error("[DB] Erro ao buscar perfil do usuário:", e);
    }
    return null;
  }
}

export async function saveUserProfile(matricula: string, data: any) {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[DB] Falha ao salvar perfil: Banco de dados não disponível.");
      return { success: false, error: "Banco de dados não disponível" };
    }
    const existing = await getUserProfile(matricula);
    if (existing) {
      await db.update(users).set(data).where(eq(users.matricula, matricula)).run();
    } else {
      await db.insert(users).values({ matricula, ...data }).run();
    }
    return { success: true };
  } catch (e: any) {
    console.error("[DB] Erro ao salvar perfil do usuário:", e);
    return { success: false, error: e.message };
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
      
    return entries ? JSON.parse(JSON.stringify(entries)) : [];
  } catch (e) {
    console.error("Error fetching monthly entries:", e);
    return [];
  }
}

export async function saveDailyEntriesBatch(matricula: string, month: number, year: number, entries: any[]) {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[DB] Falha ao salvar lote de entradas: Banco de dados não disponível.");
      return { success: false, error: "Banco de dados não disponível" };
    }
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
    console.error("[DB] Erro ao salvar lote de entradas diárias:", e);
    return { success: false, error: e.message };
  }
}

export async function saveSingleEntry(matricula: string, month: number, year: number, entryId: string, data: any) {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[DB] Falha ao salvar entrada única: Banco de dados não disponível.");
      return { success: false, error: "Banco de dados não disponível" };
    }
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
    console.error("[DB] Erro ao salvar entrada única:", e);
    return { success: false, error: e.message };
  }
}

export async function getAllUsers() {
  try {
    const db = await getDb();
    if (!db) return [];
    const result = await db.select().from(users).all();
    return result ? JSON.parse(JSON.stringify(result)) : [];
  } catch (e) {
    console.error("Error fetching all users:", e);
    return [];
  }
}

export async function resetUserAuthVersion(matricula: string) {
  try {
    const db = await getDb();
    if (!db) {
      console.error("[DB] Falha ao resetar versão de auth: Banco de dados não disponível.");
      return { success: false, error: "Banco de dados não disponível" };
    }
    const user = await getUserProfile(matricula);
    if (!user) {
      return { success: false, error: "Usuário não encontrado" };
    }
    const newVersion = (user.authVersion || 0) + 1;
    await db.update(users).set({ authVersion: newVersion, uid: null, updatedAt: new Date().toISOString() }).where(eq(users.matricula, matricula)).run();
    return { success: true };
  } catch (e: any) {
    console.error("[DB] Erro ao resetar versão de auth:", e);
    return { success: false, error: e.message };
  }
}
