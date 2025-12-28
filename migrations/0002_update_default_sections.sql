-- 既存のセクションを削除して新しいデフォルトセクションを追加
DELETE FROM sections WHERE name IN ('仕事', '塾関連', 'プライベート', '買い物', '学習', '健康');

-- 新しいデフォルトセクションを挿入（既に存在しない場合のみ）
INSERT OR IGNORE INTO sections (name, icon, sort_order) VALUES 
  ('todo（最重要）', '⭐', 1),
  ('todo', '📝', 2),
  ('AI開発タスク', '🤖', 3),
  ('研究リスト', '🔬', 4),
  ('書籍input', '📖', 5);

