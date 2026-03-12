CREATE TABLE IF NOT EXISTS user_profiles (
  matricula TEXT PRIMARY KEY,
  uid TEXT UNIQUE,
  registration_number TEXT NOT NULL,
  previous_balance TEXT DEFAULT '00:00',
  previous_balance_month INTEGER,
  previous_balance_year INTEGER,
  balance_adjustment TEXT DEFAULT '00:00',
  previous_holiday_balance INTEGER DEFAULT 0,
  daily_workload INTEGER DEFAULT 440,
  fixed_dsr_days TEXT DEFAULT '[0]',
  reference_dsr_sunday TEXT,
  auth_version INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monthly_summaries (
  id TEXT PRIMARY KEY,
  user_profile_id TEXT NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  scraped_at DATETIME,
  FOREIGN KEY (user_profile_id) REFERENCES user_profiles(matricula) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS daily_entries (
  id TEXT PRIMARY KEY,
  monthly_summary_id TEXT NOT NULL,
  user_profile_id TEXT NOT NULL,
  date TEXT NOT NULL,
  times TEXT DEFAULT '[]',
  is_manual_dsr BOOLEAN DEFAULT FALSE,
  is_manual_work BOOLEAN DEFAULT FALSE,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_compensation BOOLEAN DEFAULT FALSE,
  is_bank_off BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (monthly_summary_id) REFERENCES monthly_summaries(id) ON DELETE CASCADE,
  FOREIGN KEY (user_profile_id) REFERENCES user_profiles(matricula) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS custom_holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_profile_id TEXT NOT NULL,
  holiday_date TEXT NOT NULL,
  description TEXT,
  FOREIGN KEY (user_profile_id) REFERENCES user_profiles(matricula) ON DELETE CASCADE,
  UNIQUE(user_profile_id, holiday_date)
);