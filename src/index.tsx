import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  DB: D1Database
  R2: R2Bucket
}

const app = new Hono<{ Bindings: Bindings }>()

// CORS設定
app.use('/api/*', cors())

// 静的ファイル配信
app.use('/static/*', serveStatic())

// ============================================
// API: セクション管理
// ============================================
app.get('/api/sections', async (c) => {
  const { DB } = c.env
  const sections = await DB.prepare(`
    SELECT s.*, COUNT(t.id) as task_count
    FROM sections s
    LEFT JOIN tasks t ON s.id = t.section_id AND t.is_deleted = 0 AND t.is_completed = 0
    GROUP BY s.id
    ORDER BY s.sort_order
  `).all()
  return c.json(sections.results)
})

app.post('/api/sections', async (c) => {
  const { DB } = c.env
  const { name, icon } = await c.req.json()
  const result = await DB.prepare(
    'INSERT INTO sections (name, icon) VALUES (?, ?)'
  ).bind(name, icon || '📁').run()
  return c.json({ id: result.meta.last_row_id, name, icon })
})

app.put('/api/sections/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  const fields: string[] = []
  const values: any[] = []
  
  if (body.sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(body.sort_order)
  }
  
  if (fields.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  values.push(id)
  await DB.prepare(`
    UPDATE sections SET ${fields.join(', ')} WHERE id = ?
  `).bind(...values).run()
  
  return c.json({ success: true })
})

app.put('/api/sections/reorder', async (c) => {
  const { DB } = c.env
  const { sectionIds } = await c.req.json()
  
  if (!Array.isArray(sectionIds)) {
    return c.json({ error: 'sectionIds must be an array' }, 400)
  }
  
  // トランザクションで順番を更新
  for (let i = 0; i < sectionIds.length; i++) {
    await DB.prepare('UPDATE sections SET sort_order = ? WHERE id = ?')
      .bind(i + 1, sectionIds[i])
      .run()
  }
  
  return c.json({ success: true })
})

app.delete('/api/sections/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  // セクションに紐づくタスクがあるか確認
  const tasks = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE section_id = ? AND is_deleted = 0
  `).bind(id).first()
  
  const taskCount = (tasks as any)?.count || 0
  if (taskCount > 0) {
    // タスクがある場合は、セクションIDをNULLに更新
    await DB.prepare('UPDATE tasks SET section_id = NULL WHERE section_id = ?').bind(id).run()
  }
  
  // セクションを削除
  await DB.prepare('DELETE FROM sections WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// ============================================
// API: タスク管理
// ============================================

// タスク一覧取得
app.get('/api/tasks', async (c) => {
  const { DB } = c.env
  const view = c.req.query('view') || 'all'
  const sectionId = c.req.query('section_id')
  
  let whereClause = 'WHERE t.is_deleted = 0'
  const params: any[] = []
  
  if (view === 'today') {
    whereClause += " AND t.due_date = date('now', 'localtime') AND t.is_completed = 0"
  } else if (view === 'upcoming') {
    whereClause += " AND t.due_date > date('now', 'localtime') AND t.is_completed = 0"
  } else if (view === 'important') {
    whereClause += ' AND t.is_important = 1 AND t.is_completed = 0'
  } else if (view === 'trash') {
    whereClause = 'WHERE t.is_deleted = 1'
  } else if (view === 'logbox') {
    // ログボックス: 完了したタスクで6ヶ月以内のもの
    whereClause += " AND t.is_completed = 1 AND t.completed_at >= datetime('now', '-6 months', 'localtime')"
  } else if (sectionId) {
    whereClause += ' AND t.section_id = ? AND t.is_completed = 0'
    params.push(sectionId)
  } else if (view === 'all') {
    // すべてのビューでは未完了タスクのみ表示
    whereClause += ' AND t.is_completed = 0'
  }
  
  const tasks = await DB.prepare(`
    SELECT t.*, s.name as section_name, s.icon as section_icon
    FROM tasks t
    LEFT JOIN sections s ON t.section_id = s.id
    ${whereClause}
    ORDER BY t.is_completed ASC, t.due_date ASC NULLS LAST, t.created_at DESC
  `).bind(...params).all()
  
  // 各タスクの添付ファイル数を取得
  const taskIds = tasks.results?.map((t: any) => t.id) || []
  if (taskIds.length > 0) {
    const attachments = await DB.prepare(`
      SELECT task_id, COUNT(*) as count
      FROM attachments
      WHERE task_id IN (${taskIds.join(',')})
      GROUP BY task_id
    `).all()
    
    const attachmentCounts = new Map(
      attachments.results?.map((a: any) => [a.task_id, a.count]) || []
    )
    
    tasks.results?.forEach((t: any) => {
      t.attachment_count = attachmentCounts.get(t.id) || 0
    })
  }
  
  return c.json(tasks.results)
})

// タスク作成
app.post('/api/tasks', async (c) => {
  const { DB } = c.env
  const body = await c.req.json()
  const { title, description, section_id, due_date, is_important, reminder_type, reminder_day } = body
  
  const result = await DB.prepare(`
    INSERT INTO tasks (title, description, section_id, due_date, is_important, reminder_type, reminder_day)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    title,
    description || null,
    section_id || null,
    due_date || null,
    is_important ? 1 : 0,
    reminder_type || null,
    reminder_day || null
  ).run()
  
  return c.json({ id: result.meta.last_row_id, ...body })
})

// タスク更新
app.put('/api/tasks/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const body = await c.req.json()
  
  const fields: string[] = []
  const values: any[] = []
  
  const allowedFields = ['title', 'description', 'section_id', 'due_date', 'is_important', 'is_completed', 'reminder_type', 'reminder_day']
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      fields.push(`${field} = ?`)
      if (field === 'is_important' || field === 'is_completed') {
        values.push(body[field] ? 1 : 0)
      } else {
        values.push(body[field])
      }
    }
  }
  
  // 完了時にcompleted_atを設定
  if (body.is_completed !== undefined) {
    if (body.is_completed) {
      fields.push('completed_at = CURRENT_TIMESTAMP')
    } else {
      fields.push('completed_at = NULL')
    }
  }
  
  fields.push('updated_at = CURRENT_TIMESTAMP')
  values.push(id)
  
  await DB.prepare(`
    UPDATE tasks SET ${fields.join(', ')} WHERE id = ?
  `).bind(...values).run()
  
  return c.json({ success: true })
})

// タスク削除（ソフトデリート）
app.delete('/api/tasks/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  const permanent = c.req.query('permanent') === 'true'
  
  if (permanent) {
    // 添付ファイルも削除
    await DB.prepare('DELETE FROM attachments WHERE task_id = ?').bind(id).run()
    await DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run()
  } else {
    await DB.prepare(`
      UPDATE tasks SET is_deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(id).run()
  }
  
  return c.json({ success: true })
})

// タスク復元
app.post('/api/tasks/:id/restore', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare(`
    UPDATE tasks SET is_deleted = 0, deleted_at = NULL WHERE id = ?
  `).bind(id).run()
  
  return c.json({ success: true })
})

// ============================================
// API: 添付ファイル管理
// ============================================

// 添付ファイル一覧
app.get('/api/tasks/:id/attachments', async (c) => {
  const { DB } = c.env
  const taskId = c.req.param('id')
  
  const attachments = await DB.prepare(`
    SELECT * FROM attachments WHERE task_id = ? ORDER BY created_at DESC
  `).bind(taskId).all()
  
  return c.json(attachments.results)
})

// ファイルアップロード
app.post('/api/tasks/:id/attachments', async (c) => {
  const { DB, R2 } = c.env
  const taskId = c.req.param('id')
  
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const urlInput = formData.get('url') as string | null
    
    if (urlInput) {
      // URL添付
      const result = await DB.prepare(`
        INSERT INTO attachments (task_id, type, name, url) VALUES (?, 'url', ?, ?)
      `).bind(taskId, urlInput, urlInput).run()
      
      return c.json({ id: result.meta.last_row_id, type: 'url', url: urlInput })
    }
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400)
    }
    
    // ファイルサイズチェック（10MB制限）
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return c.json({ error: 'File size exceeds 10MB limit' }, 400)
    }
    
    // ファイルタイプ判定（写真またはPDFのみ許可）
    const isImage = file.type.startsWith('image/')
    const isPdf = file.type === 'application/pdf'
    
    if (!isImage && !isPdf) {
      return c.json({ error: 'Only image and PDF files are allowed' }, 400)
    }
    
    const type = isImage ? 'image' : 'pdf'
    
    // R2にアップロード
    const key = `attachments/${taskId}/${Date.now()}-${file.name}`
    await R2.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    })
    
    const url = `/api/files/${key}`
    
    const result = await DB.prepare(`
      INSERT INTO attachments (task_id, type, name, url) VALUES (?, ?, ?, ?)
    `).bind(taskId, type, file.name, url).run()
    
    return c.json({ id: result.meta.last_row_id, type, name: file.name, url })
  } catch (error) {
    console.error('Upload error:', error)
    return c.json({ error: 'Failed to upload file' }, 500)
  }
})

// 添付ファイル削除
app.delete('/api/attachments/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  
  await DB.prepare('DELETE FROM attachments WHERE id = ?').bind(id).run()
  
  return c.json({ success: true })
})

// R2ファイル配信
app.get('/api/files/*', async (c) => {
  const { R2 } = c.env
  const key = c.req.path.replace('/api/files/', '')
  
  const object = await R2.get(key)
  if (!object) {
    return c.notFound()
  }
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000'
    }
  })
})

// ============================================
// API: 統計・バッジ情報
// ============================================
app.get('/api/stats', async (c) => {
  const { DB } = c.env
  
  const today = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 0 AND due_date = date('now', 'localtime')
  `).first()
  
  const overdue = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 0 AND due_date < date('now', 'localtime')
  `).first()
  
  const upcoming = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 0 AND due_date > date('now', 'localtime')
  `).first()
  
  const important = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 0 AND is_important = 1
  `).first()
  
  const trash = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE is_deleted = 1
  `).first()
  
  // リマインダーチェック（今日リマインドすべきタスク）
  const reminders = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 0 AND reminder_type IS NOT NULL
    AND (last_reminded_at IS NULL OR last_reminded_at < date('now', 'localtime'))
  `).first()
  
  const logbox = await DB.prepare(`
    SELECT COUNT(*) as count FROM tasks 
    WHERE is_deleted = 0 AND is_completed = 1 
    AND completed_at >= datetime('now', '-6 months', 'localtime')
  `).first()
  
  return c.json({
    today: (today as any)?.count || 0,
    overdue: (overdue as any)?.count || 0,
    upcoming: (upcoming as any)?.count || 0,
    important: (important as any)?.count || 0,
    trash: (trash as any)?.count || 0,
    reminders: (reminders as any)?.count || 0,
    logbox: (logbox as any)?.count || 0
  })
})

// ============================================
// API: クリーンアップ（ゴミ箱とログボックスの自動削除）
// ============================================
app.post('/api/cleanup', async (c) => {
  const { DB } = c.env
  
  // 30日以上前に削除されたタスクを完全削除
  await DB.prepare(`
    DELETE FROM tasks 
    WHERE is_deleted = 1 AND deleted_at < datetime('now', '-30 days')
  `).run()
  
  // 6ヶ月以上前に完了したタスクを完全削除
  await DB.prepare(`
    DELETE FROM tasks 
    WHERE is_completed = 1 AND completed_at < datetime('now', '-6 months', 'localtime')
  `).run()
  
  return c.json({ success: true })
})

// ============================================
// メインページ
// ============================================
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" content="#1a1a2e">
  <title>MyToDo</title>
  <link rel="manifest" href="/static/manifest.json">
  <link rel="apple-touch-icon" href="/static/icon-192.png">
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/styles.css" rel="stylesheet">
</head>
<body class="bg-gray-900 text-white min-h-screen">
  <div id="app"></div>
  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
