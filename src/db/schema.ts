import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  matricula: text('matricula').primaryKey(),
  uid: text('uid').unique(),
  isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
  authVersion: integer('auth_version').default(0),
  previousBalance: text('previous_balance').default('00:00'),
  previousBalanceMonth: integer('previous_balance_month'),
  previousBalanceYear: integer('previous_balance_year'),
  balanceAdjustment: text('balance_adjustment').default('00:00'),
  previousHolidayBalance: integer('previous_holiday_balance').default(0),
  fixedDsrDays: text('fixed_dsr_days', { mode: 'json' }).$type<number[]>(),
  referenceDsrSunday: text('reference_dsr_sunday'),
  dailyWorkload: integer('daily_workload').default(440),
  holidays: text('holidays', { mode: 'json' }).$type<string[]>(),
  registrationNumber: text('registration_number'),
  updatedAt: text('updated_at'),
});

export const monthlySummaries = sqliteTable('monthly_summaries', {
  id: text('id').primaryKey(), // Format: "matricula_YYYY-MM"
  userProfileId: text('user_profile_id').references(() => users.matricula, { onDelete: 'cascade' }),
  year: integer('year'),
  month: integer('month'),
  scrapedAt: text('scraped_at'),
});

export const dailyEntries = sqliteTable('daily_entries', {
  id: text('id').primaryKey(), // Format: "matricula_DD-MM-YYYY"
  monthlyPointSummaryId: text('monthly_point_summary_id').references(() => monthlySummaries.id, { onDelete: 'cascade' }),
  userProfileId: text('user_profile_id').references(() => users.matricula, { onDelete: 'cascade' }),
  date: text('date'),
  times: text('times', { mode: 'json' }).$type<string[]>(),
  isManualDsr: integer('is_manual_dsr', { mode: 'boolean' }).default(false),
  isManualWork: integer('is_manual_work', { mode: 'boolean' }).default(false),
  isHoliday: integer('is_holiday', { mode: 'boolean' }).default(false),
  isCompensation: integer('is_compensation', { mode: 'boolean' }).default(false),
  isBankOff: integer('is_bank_off', { mode: 'boolean' }).default(false),
});
