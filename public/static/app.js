// MyToDo - Things3風ToDoアプリ

const API = {
  async get(url) {
    const res = await fetch(url);
    return res.json();
  },
  async post(url, data) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async put(url, data) {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },
  async delete(url) {
    const res = await fetch(url, { method: "DELETE" });
    return res.json();
  },
  async upload(url, formData) {
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || "Upload failed");
    }
    return data;
  },
};

// 状態管理
const state = {
  currentView: "today",
  currentSectionId: null,
  tasks: [],
  sections: [],
  stats: {},
  sidebarOpen: false,
  editingTask: null,
  newTaskAttachments: [], // 新規タスク作成時の添付ファイル
};

// 日付フォーマット
function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  const diff = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "今日";
  if (diff === 1) return "明日";
  if (diff === -1) return "昨日";
  if (diff < -1) return `${Math.abs(diff)}日前`;
  if (diff < 7) return `${diff}日後`;

  // 「25/12/28」形式（YY/MM/DD）
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}/${month}/${day}`;
}

function getDueBadgeClass(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(date);
  taskDate.setHours(0, 0, 0, 0);

  if (taskDate < today) return "overdue";
  if (taskDate.getTime() === today.getTime()) return "today";
  return "upcoming";
}

// リマインダータイプの表示名
function getReminderLabel(type, day) {
  switch (type) {
    case "daily":
      return "毎日";
    case "weekly":
      return `毎週${["日", "月", "火", "水", "木", "金", "土"][day]}曜`;
    case "monthly":
      return "毎月";
    case "monthly_date":
      return `毎月${day}日`;
    default:
      return "";
  }
}

// メインレンダリング
async function render() {
  const app = document.getElementById("app");
  app.innerHTML = `
    <!-- モバイルヘッダー -->
    <div class="mobile-header bg-gray-800 p-4 flex items-center justify-between sticky top-0 z-50">
      <button onclick="toggleSidebar()" class="text-xl">
        <i class="fas fa-bars"></i>
      </button>
      <h1 class="font-bold text-lg">MyToDo</h1>
      <div class="w-8"></div>
    </div>
    
    <!-- サイドバーオーバーレイ -->
    <div class="sidebar-overlay fixed inset-0 bg-black/50 z-90 ${
      state.sidebarOpen ? "" : "hidden"
    }" 
         onclick="toggleSidebar()"></div>
    
    <!-- サイドバー -->
    <aside class="sidebar ${state.sidebarOpen ? "open" : ""}">
      <div class="px-5 pb-4 mb-2">
        <h1 class="text-2xl font-bold flex items-center gap-2">
          <i class="fas fa-check-circle text-indigo-500"></i>
          MyToDo
        </h1>
      </div>
      
      <nav>
        <!-- スマートリスト -->
        <div class="sidebar-item ${
          state.currentView === "today" ? "active" : ""
        }" 
             onclick="setView('today')">
          <i class="fas fa-sun text-yellow-400"></i>
          <span>今日</span>
          ${
            state.stats.today
              ? `<span class="badge">${state.stats.today}</span>`
              : ""
          }
          ${
            state.stats.overdue
              ? `<span class="badge bg-red-500/50">${state.stats.overdue}</span>`
              : ""
          }
        </div>
        
        <div class="sidebar-item ${
          state.currentView === "upcoming" ? "active" : ""
        }" 
             onclick="setView('upcoming')">
          <i class="fas fa-calendar text-blue-400"></i>
          <span>予定</span>
          ${
            state.stats.upcoming
              ? `<span class="badge">${state.stats.upcoming}</span>`
              : ""
          }
        </div>
        
        <div class="sidebar-item ${
          state.currentView === "important" ? "active" : ""
        }" 
             onclick="setView('important')">
          <i class="fas fa-star text-yellow-500"></i>
          <span>重要</span>
          ${
            state.stats.important
              ? `<span class="badge">${state.stats.important}</span>`
              : ""
          }
        </div>
        
        <div class="sidebar-item ${
          state.currentView === "all" ? "active" : ""
        }" 
             onclick="setView('all')">
          <i class="fas fa-inbox text-gray-400"></i>
          <span>すべて</span>
        </div>
        
        <!-- セクション区切り -->
        <div class="px-5 py-3 mt-4 mb-2 flex items-center justify-between">
          <span class="text-xs text-gray-500 uppercase font-semibold">セクション</span>
          <button onclick="showAddSectionModal()" class="text-gray-500 hover:text-white">
            <i class="fas fa-plus text-sm"></i>
          </button>
        </div>
        
        ${state.sections
          .map(
            (s) => `
          <div class="sidebar-item ${
            state.currentView === "section" && state.currentSectionId == s.id
              ? "active"
              : ""
          }" 
               onclick="setSection(${s.id})">
            <span>${s.icon}</span>
            <span>${s.name}</span>
            ${s.task_count ? `<span class="badge">${s.task_count}</span>` : ""}
          </div>
        `
          )
          .join("")}
        
        <!-- ゴミ箱 -->
        <div class="mt-4 border-t border-gray-700 pt-4">
          <div class="sidebar-item ${
            state.currentView === "trash" ? "active" : ""
          }" 
               onclick="setView('trash')">
            <i class="fas fa-trash text-gray-500"></i>
            <span>ゴミ箱</span>
            ${
              state.stats.trash
                ? `<span class="badge">${state.stats.trash}</span>`
                : ""
            }
          </div>
        </div>
      </nav>
    </aside>
    
    <!-- メインコンテンツ -->
    <main class="main-content">
      <header class="mb-6">
        <h2 class="text-2xl font-bold">${getViewTitle()}</h2>
      </header>
      
      <div id="task-list">
        ${renderTasks()}
      </div>
    </main>
    
    <!-- FAB -->
    ${
      state.currentView !== "trash"
        ? `
      <button class="fab" onclick="showAddTaskModal()">
        <i class="fas fa-plus"></i>
      </button>
    `
        : ""
    }
    
    <!-- モーダル -->
    <div id="modal-container"></div>
  `;
}

function getViewTitle() {
  switch (state.currentView) {
    case "today":
      return "📅 今日";
    case "upcoming":
      return "📆 予定";
    case "important":
      return "⭐ 重要";
    case "all":
      return "📥 すべて";
    case "trash":
      return "🗑️ ゴミ箱";
    case "section":
      const section = state.sections.find(
        (s) => s.id == state.currentSectionId
      );
      return section ? `${section.icon} ${section.name}` : "セクション";
    default:
      return "タスク";
  }
}

function renderTasks() {
  if (state.tasks.length === 0) {
    return `
      <div class="empty-state">
        <i class="fas fa-${
          state.currentView === "trash" ? "trash" : "check-circle"
        }"></i>
        <p>${
          state.currentView === "trash"
            ? "ゴミ箱は空です"
            : "タスクがありません"
        }</p>
      </div>
    `;
  }

  return state.tasks
    .map((task) => {
      const dueClass = task.due_date ? getDueBadgeClass(task.due_date) : "";
      const isOverdue = dueClass === "overdue" && !task.is_completed;
      const isToday = dueClass === "today" && !task.is_completed;

      return `
      <div class="task-card ${task.is_completed ? "completed" : ""} ${
        isOverdue ? "overdue" : ""
      } ${isToday ? "today" : ""}"
           onclick="showTaskDetail(${task.id})">
        <div class="flex items-start gap-3">
          ${
            state.currentView !== "trash"
              ? `
            <div class="checkbox ${task.is_completed ? "checked" : ""} ${
                  task.is_important ? "important" : ""
                }"
                 onclick="event.stopPropagation(); toggleComplete(${
                   task.id
                 }, ${!task.is_completed})">
              ${
                task.is_completed
                  ? '<i class="fas fa-check text-white text-sm"></i>'
                  : ""
              }
            </div>
          `
              : ""
          }
          
          <div class="flex-1 min-w-0">
            <h3 class="font-medium ${
              task.is_completed ? "line-through text-gray-500" : ""
            }">${escapeHtml(task.title)}</h3>
            
            <div class="flex items-center gap-2 mt-2 flex-wrap">
              ${
                task.section_name
                  ? `
                <span class="text-xs text-gray-400">
                  ${task.section_icon} ${task.section_name}
                </span>
              `
                  : ""
              }
              
              ${
                task.due_date
                  ? `
                <span class="due-badge ${dueClass}">
                  <i class="fas fa-calendar-alt mr-1"></i>${formatDate(
                    task.due_date
                  )}
                </span>
              `
                  : ""
              }
              
              ${
                task.reminder_type
                  ? `
                <span class="text-xs text-yellow-400">
                  <i class="fas fa-bell reminder-icon"></i>
                  ${getReminderLabel(task.reminder_type, task.reminder_day)}
                </span>
              `
                  : ""
              }
              
              ${
                task.attachment_count > 0
                  ? `
                <span class="attachment-indicator">
                  <i class="fas fa-paperclip"></i> ${task.attachment_count}
                </span>
              `
                  : ""
              }
            </div>
          </div>
          
          ${
            task.is_important && !task.is_completed
              ? `
            <i class="fas fa-star text-yellow-500"></i>
          `
              : ""
          }
        </div>
      </div>
    `;
    })
    .join("");
}

// エスケープ処理
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// サイドバートグル
function toggleSidebar() {
  state.sidebarOpen = !state.sidebarOpen;
  render();
}

// ビュー切り替え
async function setView(view) {
  state.currentView = view;
  state.currentSectionId = null;
  state.sidebarOpen = false;
  await loadTasks();
  render();
}

async function setSection(sectionId) {
  state.currentView = "section";
  state.currentSectionId = sectionId;
  state.sidebarOpen = false;
  await loadTasks();
  render();
}

// データ読み込み
async function loadData() {
  const [sections, stats] = await Promise.all([
    API.get("/api/sections"),
    API.get("/api/stats"),
  ]);
  state.sections = sections;
  state.stats = stats;
}

async function loadTasks() {
  let url = "/api/tasks?view=" + state.currentView;
  if (state.currentView === "section" && state.currentSectionId) {
    url = "/api/tasks?section_id=" + state.currentSectionId;
  }
  state.tasks = await API.get(url);
}

// タスク完了トグル
async function toggleComplete(id, completed) {
  await API.put(`/api/tasks/${id}`, { is_completed: completed });
  await loadData();
  await loadTasks();
  render();
  showToast(completed ? "タスクを完了しました" : "タスクを未完了に戻しました");
}

// タスク追加モーダル
function showAddTaskModal() {
  // 添付ファイルをリセット
  state.newTaskAttachments = [];

  const modal = document.getElementById("modal-container");
  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="text-lg font-bold">新しいタスク</h3>
          <button onclick="closeModal()" class="text-gray-400 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <form onsubmit="createTask(event)">
            <div class="mb-4">
              <input type="text" id="task-title" class="input" placeholder="タスク名" required autofocus>
            </div>
            
            <div class="mb-4">
              <textarea id="task-desc" class="input" rows="2" placeholder="メモ（任意）"></textarea>
            </div>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">セクション</label>
                <select id="task-section" class="input">
                  <option value="">なし</option>
                  ${state.sections
                    .map(
                      (s) => `
                    <option value="${s.id}" ${
                        state.currentSectionId == s.id ? "selected" : ""
                      }>
                      ${s.icon} ${s.name}
                    </option>
                  `
                    )
                    .join("")}
                </select>
              </div>
              <div>
                <label class="block text-sm text-gray-400 mb-1">期限</label>
                <input type="date" id="task-due" class="input" 
                       value="${
                         state.currentView === "today"
                           ? new Date().toISOString().split("T")[0]
                           : ""
                       }">
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label class="block text-sm text-gray-400 mb-1">リマインダー</label>
                <select id="task-reminder" class="input" onchange="updateReminderDay()">
                  <option value="">なし</option>
                  <option value="daily">毎日</option>
                  <option value="weekly">毎週</option>
                  <option value="monthly">毎月</option>
                  <option value="monthly_date">毎月○日</option>
                </select>
              </div>
              <div id="reminder-day-container" class="hidden">
                <label class="block text-sm text-gray-400 mb-1">日/曜日</label>
                <select id="task-reminder-day" class="input"></select>
              </div>
            </div>
            
            <div class="flex items-center gap-2 mb-4">
              <input type="checkbox" id="task-important" class="w-5 h-5 accent-yellow-500">
              <label for="task-important" class="text-sm">
                <i class="fas fa-star text-yellow-500 mr-1"></i>重要
              </label>
            </div>
            
            <!-- 添付ファイル -->
            <div class="mb-4">
              <label class="block text-sm text-gray-400 mb-2">添付ファイル</label>
              <div class="attachment-preview" id="new-task-attachments-list"></div>
              
              <div class="quick-attach-bar">
                <label class="quick-attach-btn cursor-pointer">
                  <i class="fas fa-image text-blue-400"></i>
                  <span>写真</span>
                  <input type="file" accept="image/*" class="hidden" id="new-task-image-input" onchange="handleNewTaskFile(this)">
                </label>
                <label class="quick-attach-btn cursor-pointer">
                  <i class="fas fa-file-pdf text-red-400"></i>
                  <span>PDF</span>
                  <input type="file" accept=".pdf" class="hidden" id="new-task-pdf-input" onchange="handleNewTaskFile(this)">
                </label>
                <button type="button" class="quick-attach-btn" onclick="showNewTaskUrlInput()">
                  <i class="fas fa-link text-green-400"></i>
                  <span>URL</span>
                </button>
              </div>
            </div>
            
            <div class="flex gap-3">
              <button type="button" class="btn btn-secondary flex-1" onclick="closeModal()">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary flex-1">
                追加
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
}

function updateReminderDay() {
  const type = document.getElementById("task-reminder").value;
  const container = document.getElementById("reminder-day-container");
  const select = document.getElementById("task-reminder-day");

  if (type === "weekly") {
    container.classList.remove("hidden");
    select.innerHTML = ["日", "月", "火", "水", "木", "金", "土"]
      .map((d, i) => `<option value="${i}">${d}曜日</option>`)
      .join("");
  } else if (type === "monthly_date") {
    container.classList.remove("hidden");
    select.innerHTML = Array.from(
      { length: 31 },
      (_, i) => `<option value="${i + 1}">${i + 1}日</option>`
    ).join("");
  } else {
    container.classList.add("hidden");
  }
}

async function createTask(e) {
  e.preventDefault();

  const data = {
    title: document.getElementById("task-title").value,
    description: document.getElementById("task-desc").value || null,
    section_id: document.getElementById("task-section").value || null,
    due_date: document.getElementById("task-due").value || null,
    is_important: document.getElementById("task-important").checked,
    reminder_type: document.getElementById("task-reminder").value || null,
    reminder_day: document.getElementById("task-reminder-day")?.value || null,
  };

  const result = await API.post("/api/tasks", data);
  const taskId = result.id;

  // 添付ファイルをアップロード
  if (state.newTaskAttachments.length > 0) {
    for (const attachment of state.newTaskAttachments) {
      try {
        if (attachment.type === "file") {
          const formData = new FormData();
          formData.append("file", attachment.file);
          await API.upload(`/api/tasks/${taskId}/attachments`, formData);
        } else if (attachment.type === "url") {
          const formData = new FormData();
          formData.append("url", attachment.url);
          await API.upload(`/api/tasks/${taskId}/attachments`, formData);
        }
      } catch (error) {
        console.error("Failed to upload attachment:", error);
      }
    }
    state.newTaskAttachments = [];
  }

  closeModal();
  await loadData();
  await loadTasks();
  render();
  showToast("タスクを追加しました");
}

// タスク詳細モーダル
async function showTaskDetail(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;

  const attachments = await API.get(`/api/tasks/${id}/attachments`);
  state.editingTask = { ...task, attachments };

  const modal = document.getElementById("modal-container");
  const isTrash = state.currentView === "trash";

  modal.innerHTML = `
    <div class="modal-overlay" onclick="closeModal()">
      <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h3 class="text-lg font-bold">${
            isTrash ? "ゴミ箱のタスク" : "タスク詳細"
          }</h3>
          <button onclick="closeModal()" class="text-gray-400 hover:text-white">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          ${
            isTrash
              ? `
            <div class="mb-4">
              <h4 class="font-medium text-lg">${escapeHtml(task.title)}</h4>
              ${
                task.description
                  ? `<p class="text-gray-400 mt-2">${escapeHtml(
                      task.description
                    )}</p>`
                  : ""
              }
            </div>
            <div class="flex gap-3">
              <button class="btn btn-secondary flex-1" onclick="restoreTask(${id})">
                <i class="fas fa-undo mr-2"></i>復元
              </button>
              <button class="btn btn-danger flex-1" onclick="permanentDelete(${id})">
                <i class="fas fa-trash mr-2"></i>完全削除
              </button>
            </div>
          `
              : `
            <form onsubmit="updateTask(event, ${id})">
              <div class="mb-4">
                <input type="text" id="edit-title" class="input" value="${escapeHtml(
                  task.title
                )}" required>
              </div>
              
              <div class="mb-4">
                <textarea id="edit-desc" class="input" rows="2" placeholder="メモ">${
                  task.description || ""
                }</textarea>
              </div>
              
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-1">セクション</label>
                  <select id="edit-section" class="input">
                    <option value="">なし</option>
                    ${state.sections
                      .map(
                        (s) => `
                      <option value="${s.id}" ${
                          task.section_id == s.id ? "selected" : ""
                        }>
                        ${s.icon} ${s.name}
                      </option>
                    `
                      )
                      .join("")}
                  </select>
                </div>
                <div>
                  <label class="block text-sm text-gray-400 mb-1">期限</label>
                  <input type="date" id="edit-due" class="input" value="${
                    task.due_date || ""
                  }">
                </div>
              </div>
              
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <label class="block text-sm text-gray-400 mb-1">リマインダー</label>
                  <select id="edit-reminder" class="input" onchange="updateEditReminderDay()">
                    <option value="">なし</option>
                    <option value="daily" ${
                      task.reminder_type === "daily" ? "selected" : ""
                    }>毎日</option>
                    <option value="weekly" ${
                      task.reminder_type === "weekly" ? "selected" : ""
                    }>毎週</option>
                    <option value="monthly" ${
                      task.reminder_type === "monthly" ? "selected" : ""
                    }>毎月</option>
                    <option value="monthly_date" ${
                      task.reminder_type === "monthly_date" ? "selected" : ""
                    }>毎月○日</option>
                  </select>
                </div>
                <div id="edit-reminder-day-container" class="${
                  task.reminder_type === "weekly" ||
                  task.reminder_type === "monthly_date"
                    ? ""
                    : "hidden"
                }">
                  <label class="block text-sm text-gray-400 mb-1">日/曜日</label>
                  <select id="edit-reminder-day" class="input">
                    ${
                      task.reminder_type === "weekly"
                        ? ["日", "月", "火", "水", "木", "金", "土"]
                            .map(
                              (d, i) =>
                                `<option value="${i}" ${
                                  task.reminder_day == i ? "selected" : ""
                                }>${d}曜日</option>`
                            )
                            .join("")
                        : task.reminder_type === "monthly_date"
                        ? Array.from(
                            { length: 31 },
                            (_, i) =>
                              `<option value="${i + 1}" ${
                                task.reminder_day == i + 1 ? "selected" : ""
                              }>${i + 1}日</option>`
                          ).join("")
                        : ""
                    }
                  </select>
                </div>
              </div>
              
              <div class="flex items-center gap-4 mb-4">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="edit-important" class="w-5 h-5 accent-yellow-500" ${
                    task.is_important ? "checked" : ""
                  }>
                  <span class="text-sm"><i class="fas fa-star text-yellow-500 mr-1"></i>重要</span>
                </label>
              </div>
              
              <!-- 添付ファイル -->
              <div class="mb-4">
                <label class="block text-sm text-gray-400 mb-2">添付ファイル</label>
                <div class="attachment-preview" id="attachments-list">
                  ${attachments.map((a) => renderAttachment(a)).join("")}
                </div>
                
                <div class="quick-attach-bar">
                  <label class="quick-attach-btn cursor-pointer">
                    <i class="fas fa-image text-blue-400"></i>
                    <span>写真</span>
                    <input type="file" accept="image/*" class="hidden" onchange="uploadFile(${id}, this)">
                  </label>
                  <label class="quick-attach-btn cursor-pointer">
                    <i class="fas fa-file-pdf text-red-400"></i>
                    <span>PDF</span>
                    <input type="file" accept=".pdf" class="hidden" onchange="uploadFile(${id}, this)">
                  </label>
                  <button type="button" class="quick-attach-btn" onclick="showUrlInput(${id})">
                    <i class="fas fa-link text-green-400"></i>
                    <span>URL</span>
                  </button>
                </div>
              </div>
              
              <div class="flex gap-3">
                <button type="button" class="btn btn-danger" onclick="deleteTask(${id})">
                  <i class="fas fa-trash"></i>
                </button>
                <button type="button" class="btn btn-secondary flex-1" onclick="closeModal()">
                  キャンセル
                </button>
                <button type="submit" class="btn btn-primary flex-1">
                  保存
                </button>
              </div>
            </form>
          `
          }
        </div>
      </div>
    </div>
  `;
}

function renderAttachment(a) {
  const icon =
    a.type === "image"
      ? "fa-image text-blue-400"
      : a.type === "pdf"
      ? "fa-file-pdf text-red-400"
      : "fa-link text-green-400";

  return `
    <div class="attachment-item">
      ${
        a.type === "image"
          ? `<img src="${a.url}" alt="">`
          : `<i class="fas ${icon}"></i>`
      }
      <a href="${
        a.url
      }" target="_blank" class="truncate flex-1 hover:text-indigo-400">${
    a.name || a.url
  }</a>
      <button onclick="deleteAttachment(${
        a.id
      })" class="text-gray-500 hover:text-red-400">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
}

function updateEditReminderDay() {
  const type = document.getElementById("edit-reminder").value;
  const container = document.getElementById("edit-reminder-day-container");
  const select = document.getElementById("edit-reminder-day");

  if (type === "weekly") {
    container.classList.remove("hidden");
    select.innerHTML = ["日", "月", "火", "水", "木", "金", "土"]
      .map((d, i) => `<option value="${i}">${d}曜日</option>`)
      .join("");
  } else if (type === "monthly_date") {
    container.classList.remove("hidden");
    select.innerHTML = Array.from(
      { length: 31 },
      (_, i) => `<option value="${i + 1}">${i + 1}日</option>`
    ).join("");
  } else {
    container.classList.add("hidden");
  }
}

async function updateTask(e, id) {
  e.preventDefault();

  const data = {
    title: document.getElementById("edit-title").value,
    description: document.getElementById("edit-desc").value || null,
    section_id: document.getElementById("edit-section").value || null,
    due_date: document.getElementById("edit-due").value || null,
    is_important: document.getElementById("edit-important").checked,
    reminder_type: document.getElementById("edit-reminder").value || null,
    reminder_day: document.getElementById("edit-reminder-day")?.value || null,
  };

  await API.put(`/api/tasks/${id}`, data);
  closeModal();
  await loadData();
  await loadTasks();
  render();
  showToast("タスクを更新しました");
}

async function deleteTask(id) {
  if (confirm("タスクをゴミ箱に移動しますか？")) {
    await API.delete(`/api/tasks/${id}`);
    closeModal();
    await loadData();
    await loadTasks();
    render();
    showToast("ゴミ箱に移動しました");
  }
}

async function restoreTask(id) {
  await API.post(`/api/tasks/${id}/restore`);
  closeModal();
  await loadData();
  await loadTasks();
  render();
  showToast("タスクを復元しました");
}

async function permanentDelete(id) {
  if (confirm("完全に削除しますか？この操作は取り消せません。")) {
    await API.delete(`/api/tasks/${id}?permanent=true`);
    closeModal();
    await loadData();
    await loadTasks();
    render();
    showToast("完全に削除しました");
  }
}

// ファイルアップロード
async function uploadFile(taskId, input) {
  const file = input.files[0];
  if (!file) return;

  // ファイルサイズチェック（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast("ファイルサイズが大きすぎます（最大10MB）", "error");
    input.value = "";
    return;
  }

  // ファイルタイプチェック（写真またはPDFのみ）
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    showToast("写真またはPDFファイルを選択してください", "error");
    input.value = "";
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  showToast("アップロード中...");

  try {
    const result = await API.upload(
      `/api/tasks/${taskId}/attachments`,
      formData
    );

    if (result.error) {
      showToast(`アップロードに失敗しました: ${result.error}`, "error");
      input.value = "";
      return;
    }

    const list = document.getElementById("attachments-list");
    if (list) {
      list.innerHTML += renderAttachment(result);
      showToast("ファイルを添付しました");
    }
  } catch (error) {
    console.error("Upload error:", error);
    showToast("アップロードに失敗しました", "error");
  } finally {
    input.value = "";
  }
}

function showUrlInput(taskId) {
  const url = prompt("URLを入力してください:");
  if (url) {
    addUrlAttachment(taskId, url);
  }
}

async function addUrlAttachment(taskId, url) {
  const formData = new FormData();
  formData.append("url", url);

  const result = await API.upload(`/api/tasks/${taskId}/attachments`, formData);

  const list = document.getElementById("attachments-list");
  list.innerHTML += renderAttachment(result);

  showToast("URLを添付しました");
}

async function deleteAttachment(id) {
  try {
    await API.delete(`/api/attachments/${id}`);
    if (state.editingTask) {
      await showTaskDetail(state.editingTask.id);
    }
    showToast("添付を削除しました");
  } catch (error) {
    console.error("Delete attachment error:", error);
    showToast("添付の削除に失敗しました", "error");
  }
}

// 新規タスク作成時のファイル添付処理
function handleNewTaskFile(input) {
  const file = input.files[0];
  if (!file) return;

  // ファイルサイズチェック（10MB制限）
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    showToast("ファイルサイズが大きすぎます（最大10MB）", "error");
    input.value = "";
    return;
  }

  // ファイルタイプチェック（写真またはPDFのみ）
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    showToast("写真またはPDFファイルを選択してください", "error");
    input.value = "";
    return;
  }

  // 添付ファイルを状態に追加
  const attachment = {
    type: "file",
    file: file,
    name: file.name,
    id: Date.now(), // 一時ID
  };
  state.newTaskAttachments.push(attachment);

  // プレビューに表示
  const list = document.getElementById("new-task-attachments-list");
  if (list) {
    const preview = isImage
      ? `<img src="${URL.createObjectURL(
          file
        )}" alt="" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;">`
      : `<i class="fas fa-file-pdf text-red-400"></i>`;

    list.innerHTML += `
      <div class="attachment-item" data-id="${attachment.id}">
        ${preview}
        <span class="truncate flex-1">${file.name}</span>
        <button onclick="removeNewTaskAttachment(${attachment.id})" class="text-gray-500 hover:text-red-400">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  }

  input.value = "";
  showToast("ファイルを追加しました");
}

function removeNewTaskAttachment(id) {
  state.newTaskAttachments = state.newTaskAttachments.filter(
    (a) => a.id !== id
  );

  const list = document.getElementById("new-task-attachments-list");
  if (list) {
    const item = list.querySelector(`[data-id="${id}"]`);
    if (item) {
      item.remove();
    }
  }
}

function showNewTaskUrlInput() {
  const url = prompt("URLを入力してください:");
  if (url) {
    const attachment = {
      type: "url",
      url: url,
      name: url,
      id: Date.now(),
    };
    state.newTaskAttachments.push(attachment);

    const list = document.getElementById("new-task-attachments-list");
    if (list) {
      list.innerHTML += `
        <div class="attachment-item" data-id="${attachment.id}">
          <i class="fas fa-link text-green-400"></i>
          <span class="truncate flex-1">${url}</span>
          <button onclick="removeNewTaskAttachment(${attachment.id})" class="text-gray-500 hover:text-red-400">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
    }
    showToast("URLを追加しました");
  }
}

// セクション追加
function showAddSectionModal() {
  const name = prompt("セクション名を入力:");
  if (name) {
    const icon = prompt("アイコン（絵文字）を入力:", "📁");
    addSection(name, icon);
  }
}

async function addSection(name, icon) {
  await API.post("/api/sections", { name, icon });
  await loadData();
  render();
  showToast("セクションを追加しました");
}

// モーダル閉じる
function closeModal() {
  document.getElementById("modal-container").innerHTML = "";
  state.editingTask = null;
  state.newTaskAttachments = [];
}

// トースト通知
function showToast(message, type = "success") {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;

  if (type === "error") {
    toast.style.background = "var(--danger)";
  }

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 3000);
}

// Service Worker登録
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js").catch(() => {});
}

// 初期化
async function init() {
  await loadData();
  await loadTasks();
  render();

  // 30日以上前のゴミ箱を自動クリーンアップ
  API.post("/api/cleanup");
}

init();
