# MyToDo

シンプルで強力なToDo管理アプリ（Things3風）

## 機能

### 完成済み
- ✅ タスクの作成・編集・削除・完了
- ✅ セクション分け（仕事/塾関連/プライベート）
- ✅ 期限設定と期限切れ表示
- ✅ 重要フラグ（星マーク）
- ✅ リマインダー設定（毎日/毎週/毎月/毎月○日）
- ✅ 写真・PDF・URL添付機能
- ✅ ゴミ箱機能（30日間保持後自動削除）
- ✅ PWA対応（ホーム画面追加可能）
- ✅ アプリ内バッジ表示（今日/期限切れ/重要）

### スマートリスト
- **今日**: 今日が期限のタスク + 期限切れタスク
- **予定**: 今後の予定タスク
- **重要**: 星マーク付きタスク
- **すべて**: 全タスク一覧

## 技術スタック
- **Backend**: Hono (TypeScript)
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare R2 (ファイル保存)
- **Frontend**: Vanilla JS + Tailwind CSS
- **Deploy**: Cloudflare Pages

## URL
- **Production**: (デプロイ後に追加)
- **GitHub**: (連携後に追加)

## 開発

```bash
# ビルド
npm run build

# ローカル起動（D1 + R2）
npm run dev:sandbox

# DBマイグレーション
npm run db:migrate:local

# デプロイ
npm run deploy
```

## データモデル

### tasks
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| title | TEXT | タスク名 |
| description | TEXT | メモ |
| section_id | INTEGER | セクション |
| is_completed | INTEGER | 完了フラグ |
| is_important | INTEGER | 重要フラグ |
| due_date | DATE | 期限 |
| reminder_type | TEXT | リマインダー種別 |
| is_deleted | INTEGER | 削除フラグ |

### attachments
| カラム | 型 | 説明 |
|--------|-----|------|
| id | INTEGER | 主キー |
| task_id | INTEGER | タスクID |
| type | TEXT | image/pdf/url |
| url | TEXT | ファイルURL |

## ライセンス
Private - Personal Use Only
