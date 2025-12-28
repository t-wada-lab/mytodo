-- MyToDo Database Schema
-- セクション（カテゴリ）テーブル
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- タスクテーブル
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  section_id INTEGER,
  
  -- 状態管理
  is_completed INTEGER DEFAULT 0,
  is_important INTEGER DEFAULT 0,
  completed_at DATETIME,
  
  -- 期限・リマインダー
  due_date DATE,
  reminder_type TEXT, -- 'daily', 'weekly', 'monthly', 'monthly_date'
  reminder_day INTEGER, -- 曜日(0-6) or 日付(1-31)
  last_reminded_at DATETIME,
  
  -- ソフトデリート
  is_deleted INTEGER DEFAULT 0,
  deleted_at DATETIME,
  
  -- タイムスタンプ
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (section_id) REFERENCES sections(id)
);

-- 添付ファイルテーブル
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  type TEXT NOT NULL, -- 'image', 'pdf', 'url'
  name TEXT,
  url TEXT NOT NULL, -- R2のURLまたは外部URL
  thumbnail_url TEXT, -- サムネイル（画像用）
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_tasks_section ON tasks(section_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id);

-- 初期セクションを挿入
INSERT INTO sections (name, icon, sort_order) VALUES 
  ('todo（最重要）', '⭐', 1),
  ('todo', '📝', 2),
  ('AI開発タスク', '🤖', 3),
  ('研究リスト', '🔬', 4),
  ('書籍input', '📖', 5);
