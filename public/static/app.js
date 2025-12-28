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
  isSubmitting: false, // 送信中のフラグ
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
          state.currentView === "all" ? "active" : ""
        }" 
             onclick="setView('all')">
          <i class="fas fa-inbox text-gray-400"></i>
          <span>すべて</span>
        </div>
        
        <div class="sidebar-item ${
          state.currentView === "logbox" ? "active" : ""
        }" 
             onclick="setView('logbox')">
          <i class="fas fa-archive text-purple-400"></i>
          <span>ログボックス</span>
          ${
            state.stats.logbox
              ? `<span class="badge">${state.stats.logbox}</span>`
              : ""
          }
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
               onclick="if (!dragState.isDragging) setSection(${s.id})"
               data-section-id="${s.id}">
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
        state.currentView !== "trash" && state.currentView !== "logbox"
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
    case "logbox":
      return "📦 ログボックス";
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
          state.currentView === "trash"
            ? "trash"
            : state.currentView === "logbox"
            ? "archive"
            : "check-circle"
        }"></i>
        <p>${
          state.currentView === "trash"
            ? "ゴミ箱は空です"
            : state.currentView === "logbox"
            ? "ログボックスは空です"
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
            state.currentView !== "trash" && state.currentView !== "logbox"
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
              : state.currentView === "logbox"
              ? `
            <div class="checkbox checked" style="opacity: 0.6;">
              <i class="fas fa-check text-white text-sm"></i>
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
  // サイドバーの表示/非表示はCSSクラスの変更のみで対応（再レンダリング不要）
  const sidebar = document.querySelector(".sidebar");
  const overlay = document.querySelector(".sidebar-overlay");
  if (sidebar) {
    if (state.sidebarOpen) {
      sidebar.classList.add("open");
      if (overlay) overlay.classList.remove("hidden");
    } else {
      sidebar.classList.remove("open");
      if (overlay) overlay.classList.add("hidden");
    }
  }
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
  // 即座にUIを更新（楽観的更新）
  const task = state.tasks.find((t) => t.id === id);
  if (task) {
    task.is_completed = completed ? 1 : 0;
    if (completed) {
      task.completed_at = new Date().toISOString();
    }
    render();
  }

  try {
    await API.put(`/api/tasks/${id}`, { is_completed: completed });

    // 完了した場合はログボックスへ移動するメッセージを表示
    if (completed) {
      showToast("タスクを完了しました。ログボックスへ移動しました");
    } else {
      showToast("タスクを未完了に戻しました");
    }

    // バックグラウンドでデータを更新
    Promise.all([loadData(), loadTasks()]).then(() => {
      render();
    });
  } catch (error) {
    console.error("Toggle complete error:", error);
    // エラー時は元に戻す
    if (task) {
      task.is_completed = completed ? 0 : 1;
      render();
    }
    showToast("タスクの更新に失敗しました", "error");
  }
}

// タスク追加モーダル
function showAddTaskModal() {
  // 添付ファイルをリセット
  state.newTaskAttachments = [];

  // モバイルでキーボードを確実に表示させるため、一時的な入力フィールドを作成
  const tempInput = document.createElement("input");
  tempInput.type = "text";
  tempInput.style.position = "fixed";
  tempInput.style.top = "-1000px";
  tempInput.style.left = "-1000px";
  tempInput.style.opacity = "0";
  tempInput.style.pointerEvents = "none";
  document.body.appendChild(tempInput);
  tempInput.focus();

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
            
            <!-- Things3風のコンパクトなUI -->
            <div class="mb-4">
              <div class="flex items-center gap-2 flex-wrap">
                <!-- セクション -->
                <button type="button" onclick="showSectionPicker()" class="compact-btn" id="section-btn">
                  <i class="fas fa-folder text-gray-400"></i>
                  <span id="selected-section-text">セクション</span>
                  <i class="fas fa-chevron-down text-xs text-gray-500"></i>
                </button>
                
                <!-- 期限 -->
                <button type="button" onclick="showDatePicker()" class="compact-btn" id="date-btn">
                  <i class="fas fa-calendar text-gray-400"></i>
                  <span id="selected-date-text">期限</span>
                  <i class="fas fa-chevron-down text-xs text-gray-500"></i>
                </button>
                
                <!-- リマインダー -->
                <button type="button" onclick="showReminderPicker()" class="compact-btn" id="reminder-btn">
                  <i class="fas fa-bell text-gray-400"></i>
                  <span id="selected-reminder-text">リマインダー</span>
                  <i class="fas fa-chevron-down text-xs text-gray-500"></i>
                </button>
                
                <!-- 重要 -->
                <button type="button" id="important-btn" onclick="toggleImportantBtn()" class="compact-btn">
                  <i class="fas fa-star text-gray-400"></i>
                </button>
              </div>
              
              <!-- リマインダーの日/曜日選択（表示時のみ） -->
              <div id="reminder-day-container" class="hidden mt-2">
                <select id="task-reminder-day" class="input text-sm">
                  <option value="">選択してください</option>
                </select>
              </div>
              
              <!-- 隠しフィールド -->
              <input type="hidden" id="task-section" value="${
                state.currentSectionId || ""
              }">
              <input type="hidden" id="task-due" value="${
                state.currentView === "today"
                  ? new Date().toISOString().split("T")[0]
                  : ""
              }">
              <input type="hidden" id="task-reminder" value="">
              <input type="hidden" id="task-important" value="false">
            </div>
            
            <!-- 添付ファイル -->
            <div class="mb-4">
              <label class="block text-sm text-gray-400 mb-2">添付ファイル</label>
              <div class="attachment-preview" id="new-task-attachments-list"></div>
              
              <!-- アップロード進捗表示 -->
              <div id="upload-progress" class="hidden mb-2">
                <div class="flex items-center gap-2 text-sm text-gray-400 bg-gray-800 p-2 rounded">
                  <i class="fas fa-spinner fa-spin"></i>
                  <span id="upload-progress-text">添付ファイルをアップロード中...</span>
                </div>
              </div>
              
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
              <button type="button" class="btn btn-secondary flex-1" onclick="closeModal()" id="cancel-task-btn">
                キャンセル
              </button>
              <button type="submit" class="btn btn-primary flex-1" id="submit-task-btn">
                <span id="submit-task-text">追加</span>
                <span id="submit-task-loading" class="hidden">
                  <i class="fas fa-spinner fa-spin mr-2"></i>追加中...
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;

  // モーダル表示後にタスク名入力欄に即座にフォーカス（キーボードを確実に表示）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const taskTitleInput = document.getElementById("task-title");
      if (taskTitleInput) {
        // 一時的な入力フィールドを削除
        if (document.body.contains(tempInput)) {
          document.body.removeChild(tempInput);
        }

        // 入力フィールドを可視領域にスクロール
        taskTitleInput.scrollIntoView({ behavior: "smooth", block: "center" });

        // フォーカスとクリックの両方を試す（モバイルブラウザ対応）
        taskTitleInput.focus();

        // モバイルブラウザによってはclick()も必要
        setTimeout(() => {
          taskTitleInput.click();
          taskTitleInput.focus();
        }, 50);

        // さらに確実にするため、もう一度フォーカス
        setTimeout(() => {
          taskTitleInput.focus();
        }, 150);
      }

      // Things3風UIの初期状態を設定
      const sectionId = document.getElementById("task-section").value;
      if (sectionId) {
        const section = state.sections.find((s) => s.id == sectionId);
        if (section) {
          document.getElementById("selected-section-text").textContent =
            section.name;
          document.getElementById("section-btn").classList.add("active");
        }
      }

      const dueDate = document.getElementById("task-due").value;
      if (dueDate) {
        const date = new Date(dueDate);
        const month = date.getMonth() + 1;
        const day = date.getDate();
        document.getElementById(
          "selected-date-text"
        ).textContent = `${month}/${day}`;
        document.getElementById("date-btn").classList.add("active");
      }
    });
  });
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

// Things3風のコンパクトUI用の関数
function showSectionPicker() {
  // 既存のドロップダウンがあれば削除
  const existing = document.getElementById("section-dropdown-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const sectionBtn = document.getElementById("section-btn");
  const rect = sectionBtn.getBoundingClientRect();
  const currentSectionId = document.getElementById("task-section").value;
  const currentSection = state.sections.find((s) => s.id == currentSectionId);

  // オーバーレイとドロップダウンを作成
  const overlay = document.createElement("div");
  overlay.id = "section-dropdown-overlay";
  overlay.className = "dropdown-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };

  const dropdown = document.createElement("div");
  dropdown.className = "dropdown-menu";
  dropdown.style.position = "fixed";
  dropdown.style.top = `${rect.bottom + 8}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.minWidth = `${rect.width}px`;
  dropdown.style.maxHeight = "300px";
  dropdown.style.overflowY = "auto";
  dropdown.onclick = (e) => e.stopPropagation();

  // 「なし」オプション
  const noneOption = document.createElement("div");
  noneOption.className = "dropdown-item";
  if (!currentSectionId) {
    noneOption.classList.add("selected");
  }
  noneOption.innerHTML =
    '<i class="fas fa-folder text-gray-400"></i><span>なし</span>';
  noneOption.onclick = () => {
    document.getElementById("task-section").value = "";
    document.getElementById("selected-section-text").textContent = "セクション";
    document.getElementById("section-btn").classList.remove("active");
    overlay.remove();
  };
  dropdown.appendChild(noneOption);

  // セクション一覧
  state.sections.forEach((section) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    if (currentSectionId == section.id) {
      item.classList.add("selected");
    }
    item.innerHTML = `<span>${section.icon}</span><span>${escapeHtml(
      section.name
    )}</span>`;
    item.onclick = () => {
      document.getElementById("task-section").value = section.id;
      document.getElementById("selected-section-text").textContent =
        section.name;
      document.getElementById("section-btn").classList.add("active");
      overlay.remove();
    };
    dropdown.appendChild(item);
  });

  overlay.appendChild(dropdown);
  document.body.appendChild(overlay);

  // アニメーション
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    dropdown.style.transform = "translateY(0)";
    dropdown.style.opacity = "1";
  });
}

function showDatePicker() {
  // 既存のカレンダーがあれば削除
  const existing = document.getElementById("calendar-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const currentValue = document.getElementById("task-due").value;
  const selectedDate = currentValue
    ? new Date(currentValue + "T00:00:00")
    : null;
  let currentMonth = selectedDate ? new Date(selectedDate) : new Date();
  currentMonth.setDate(1); // 月の最初の日

  // オーバーレイを作成
  const overlay = document.createElement("div");
  overlay.id = "calendar-overlay";
  overlay.className = "calendar-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };

  // カレンダーコンテナを作成
  const calendar = document.createElement("div");
  calendar.className = "calendar-picker";
  calendar.onclick = (e) => e.stopPropagation();

  // ヘッダー（月切り替え）
  const header = document.createElement("div");
  header.className = "calendar-header";

  const prevBtn = document.createElement("button");
  prevBtn.className = "calendar-nav-btn";
  prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  prevBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  };

  const monthYear = document.createElement("div");
  monthYear.className = "calendar-month-year";

  const nextBtn = document.createElement("button");
  nextBtn.className = "calendar-nav-btn";
  nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  nextBtn.onclick = () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  };

  header.appendChild(prevBtn);
  header.appendChild(monthYear);
  header.appendChild(nextBtn);

  // 曜日ヘッダー
  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays";
  ["日", "月", "火", "水", "木", "金", "土"].forEach((day) => {
    const dayCell = document.createElement("div");
    dayCell.className = "calendar-weekday";
    dayCell.textContent = day;
    weekdays.appendChild(dayCell);
  });

  // 日付グリッド
  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  // カレンダーをレンダリングする関数
  function renderCalendar() {
    // 現在の選択値を再取得
    const currentValue = document.getElementById("task-due").value;
    const currentSelectedDate = currentValue
      ? new Date(currentValue + "T00:00:00")
      : null;

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    monthYear.textContent = `${year}年${month + 1}月`;

    // グリッドをクリア
    grid.innerHTML = "";

    // 月の最初の日の曜日を取得（0=日曜日）
    const firstDay = new Date(year, month, 1).getDay();

    // 月の日数を取得
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // 前月の最後の日を取得
    const prevMonthDays = new Date(year, month, 0).getDate();

    // 今日の日付
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 前月の日付を表示
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const dateCell = document.createElement("div");
      dateCell.className = "calendar-day other-month";
      dateCell.textContent = day;
      grid.appendChild(dateCell);
    }

    // 今月の日付を表示
    for (let day = 1; day <= daysInMonth; day++) {
      const dateCell = document.createElement("div");
      const cellDate = new Date(year, month, day);
      cellDate.setHours(0, 0, 0, 0);

      dateCell.className = "calendar-day";

      // 今日の日付を強調
      if (cellDate.getTime() === today.getTime()) {
        dateCell.classList.add("today");
      }

      // 選択された日付をハイライト
      if (
        currentSelectedDate &&
        cellDate.getTime() === currentSelectedDate.getTime()
      ) {
        dateCell.classList.add("selected");
      }

      dateCell.textContent = day;
      dateCell.onclick = () => {
        const selectedDateStr = `${year}-${String(month + 1).padStart(
          2,
          "0"
        )}-${String(day).padStart(2, "0")}`;
        document.getElementById("task-due").value = selectedDateStr;

        const monthDisplay = month + 1;
        const dayDisplay = day;
        document.getElementById(
          "selected-date-text"
        ).textContent = `${monthDisplay}/${dayDisplay}`;
        document.getElementById("date-btn").classList.add("active");

        overlay.remove();
      };

      grid.appendChild(dateCell);
    }

    // 次月の日付を表示（グリッドを埋めるため）
    const totalCells = firstDay + daysInMonth;
    const remainingCells = 42 - totalCells; // 6週間分
    for (let day = 1; day <= remainingCells && day <= 14; day++) {
      const dateCell = document.createElement("div");
      dateCell.className = "calendar-day other-month";
      dateCell.textContent = day;
      grid.appendChild(dateCell);
    }
  }

  // 初期レンダリング
  renderCalendar();

  // 「なし」ボタン
  const clearBtn = document.createElement("button");
  clearBtn.className = "calendar-clear-btn";
  clearBtn.textContent = "なし";
  clearBtn.onclick = () => {
    document.getElementById("task-due").value = "";
    document.getElementById("selected-date-text").textContent = "期限";
    document.getElementById("date-btn").classList.remove("active");
    overlay.remove();
  };

  calendar.appendChild(header);
  calendar.appendChild(weekdays);
  calendar.appendChild(grid);
  calendar.appendChild(clearBtn);
  overlay.appendChild(calendar);
  document.body.appendChild(overlay);

  // アニメーション
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    calendar.style.transform = "scale(1)";
    calendar.style.opacity = "1";
  });
}

function showReminderPicker() {
  // 既存のドロップダウンがあれば削除
  const existing = document.getElementById("reminder-dropdown-overlay");
  if (existing) {
    existing.remove();
    return;
  }

  const reminderBtn = document.getElementById("reminder-btn");
  const rect = reminderBtn.getBoundingClientRect();
  const reminderType = document.getElementById("task-reminder").value;

  const reminderTypes = [
    { value: "", label: "なし" },
    { value: "daily", label: "毎日" },
    { value: "weekly", label: "毎週" },
    { value: "monthly", label: "毎月" },
    { value: "monthly_date", label: "毎月○日" },
  ];

  // オーバーレイとドロップダウンを作成
  const overlay = document.createElement("div");
  overlay.id = "reminder-dropdown-overlay";
  overlay.className = "dropdown-overlay";
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  };

  const dropdown = document.createElement("div");
  dropdown.className = "dropdown-menu";
  dropdown.style.position = "fixed";
  dropdown.style.top = `${rect.bottom + 8}px`;
  dropdown.style.left = `${rect.left}px`;
  dropdown.style.minWidth = `${rect.width}px`;
  dropdown.onclick = (e) => e.stopPropagation();

  // リマインダーオプション
  reminderTypes.forEach((type) => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    if (reminderType === type.value) {
      item.classList.add("selected");
    }
    item.innerHTML = `<i class="fas fa-bell text-gray-400"></i><span>${escapeHtml(
      type.label
    )}</span>`;
    item.onclick = () => {
      document.getElementById("task-reminder").value = type.value;

      if (type.value) {
        document.getElementById("selected-reminder-text").textContent =
          type.label;
        document.getElementById("reminder-btn").classList.add("active");
        updateReminderDay();
      } else {
        document.getElementById("selected-reminder-text").textContent =
          "リマインダー";
        document.getElementById("reminder-btn").classList.remove("active");
        document
          .getElementById("reminder-day-container")
          .classList.add("hidden");
      }
      overlay.remove();
    };
    dropdown.appendChild(item);
  });

  overlay.appendChild(dropdown);
  document.body.appendChild(overlay);

  // アニメーション
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    dropdown.style.transform = "translateY(0)";
    dropdown.style.opacity = "1";
  });
}

function toggleImportantBtn() {
  const importantBtn = document.getElementById("important-btn");
  const importantInput = document.getElementById("task-important");
  const isImportant = importantInput.value === "true";

  if (isImportant) {
    importantInput.value = "false";
    importantBtn.classList.remove("active");
    const icon = importantBtn.querySelector("i");
    if (icon) {
      icon.classList.remove("text-yellow-500");
      icon.classList.add("text-gray-400");
    }
  } else {
    importantInput.value = "true";
    importantBtn.classList.add("active");
    const icon = importantBtn.querySelector("i");
    if (icon) {
      icon.classList.remove("text-gray-400");
      icon.classList.add("text-yellow-500");
    }
  }
}

async function createTask(e) {
  e.preventDefault();

  // 重複送信を防止
  if (state.isSubmitting) {
    return;
  }

  state.isSubmitting = true;

  // ボタンを無効化
  const submitBtn = document.getElementById("submit-task-btn");
  const cancelBtn = document.getElementById("cancel-task-btn");
  const submitText = document.getElementById("submit-task-text");
  const submitLoading = document.getElementById("submit-task-loading");

  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  if (submitText) submitText.classList.add("hidden");
  if (submitLoading) submitLoading.classList.remove("hidden");

  try {
    const data = {
      title: document.getElementById("task-title").value,
      description: document.getElementById("task-desc").value || null,
      section_id: document.getElementById("task-section").value || null,
      due_date: document.getElementById("task-due").value || null,
      is_important: document.getElementById("task-important").value === "true",
      reminder_type: document.getElementById("task-reminder").value || null,
      reminder_day: document.getElementById("task-reminder-day")?.value || null,
    };

    const result = await API.post("/api/tasks", data);
    const taskId = result.id;

    // 添付ファイルをアップロード（進捗表示付き）
    if (state.newTaskAttachments.length > 0) {
      const uploadProgress = document.getElementById("upload-progress");
      const uploadProgressText = document.getElementById(
        "upload-progress-text"
      );

      if (uploadProgress) {
        uploadProgress.classList.remove("hidden");
        if (uploadProgressText) {
          uploadProgressText.textContent = `添付ファイルをアップロード中... (0/${state.newTaskAttachments.length})`;
        }
      }

      for (let i = 0; i < state.newTaskAttachments.length; i++) {
        const attachment = state.newTaskAttachments[i];
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

          // 進捗を更新
          if (uploadProgressText) {
            uploadProgressText.textContent = `添付ファイルをアップロード中... (${
              i + 1
            }/${state.newTaskAttachments.length})`;
          }
        } catch (error) {
          console.error("Failed to upload attachment:", error);
        }
      }

      if (uploadProgress) {
        uploadProgress.classList.add("hidden");
      }
      state.newTaskAttachments = [];
    }

    closeModal();
    // 楽観的更新: タスクを即座に追加
    const newTask = {
      ...result,
      attachment_count: state.newTaskAttachments.length,
      section_name:
        state.sections.find((s) => s.id == data.section_id)?.name || null,
      section_icon:
        state.sections.find((s) => s.id == data.section_id)?.icon || null,
    };
    state.tasks.unshift(newTask);
    render();
    showToast("タスクを追加しました");

    // バックグラウンドでデータを更新（統計情報のみ）
    Promise.all([loadData()]).then(() => {
      render();
    });
  } catch (error) {
    console.error("Create task error:", error);
    showToast("タスクの追加に失敗しました", "error");
  } finally {
    // ボタンを再有効化
    state.isSubmitting = false;
    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (submitText) submitText.classList.remove("hidden");
    if (submitLoading) submitLoading.classList.add("hidden");
  }
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
                <button type="button" class="btn btn-danger" onclick="deleteTask(${id})" id="delete-task-btn-${id}">
                  <i class="fas fa-trash"></i>
                </button>
                <button type="button" class="btn btn-secondary flex-1" onclick="closeModal()" id="cancel-edit-btn-${id}">
                  キャンセル
                </button>
                <button type="submit" class="btn btn-primary flex-1" id="submit-edit-btn-${id}">
                  <span id="submit-edit-text-${id}">保存</span>
                  <span id="submit-edit-loading-${id}" class="hidden">
                    <i class="fas fa-spinner fa-spin mr-2"></i>保存中...
                  </span>
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

  // 重複送信を防止
  if (state.isSubmitting) {
    return;
  }

  state.isSubmitting = true;

  // ボタンを無効化
  const submitBtn = document.getElementById(`submit-edit-btn-${id}`);
  const cancelBtn = document.getElementById(`cancel-edit-btn-${id}`);
  const deleteBtn = document.getElementById(`delete-task-btn-${id}`);
  const submitText = document.getElementById(`submit-edit-text-${id}`);
  const submitLoading = document.getElementById(`submit-edit-loading-${id}`);

  if (submitBtn) submitBtn.disabled = true;
  if (cancelBtn) cancelBtn.disabled = true;
  if (deleteBtn) deleteBtn.disabled = true;
  if (submitText) submitText.classList.add("hidden");
  if (submitLoading) submitLoading.classList.remove("hidden");

  try {
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

    // 楽観的更新: タスクを即座に更新
    const task = state.tasks.find((t) => t.id === id);
    if (task) {
      Object.assign(task, data);
      if (data.section_id) {
        const section = state.sections.find((s) => s.id == data.section_id);
        if (section) {
          task.section_name = section.name;
          task.section_icon = section.icon;
        }
      }
    }

    closeModal();
    render();
    showToast("タスクを更新しました");

    // バックグラウンドでデータを更新（統計情報のみ）
    Promise.all([loadData()]).then(() => {
      render();
    });
  } catch (error) {
    console.error("Update task error:", error);
    showToast("タスクの更新に失敗しました", "error");
  } finally {
    // ボタンを再有効化
    state.isSubmitting = false;
    if (submitBtn) submitBtn.disabled = false;
    if (cancelBtn) cancelBtn.disabled = false;
    if (deleteBtn) deleteBtn.disabled = false;
    if (submitText) submitText.classList.remove("hidden");
    if (submitLoading) submitLoading.classList.add("hidden");
  }
}

async function deleteTask(id) {
  if (confirm("タスクをゴミ箱に移動しますか？")) {
    // 楽観的更新: タスクを即座に削除
    state.tasks = state.tasks.filter((t) => t.id !== id);
    closeModal();
    render();
    showToast("ゴミ箱に移動しました");

    // バックグラウンドでAPI呼び出しとデータ更新
    Promise.all([API.delete(`/api/tasks/${id}`), loadData()])
      .then(() => {
        render();
      })
      .catch((error) => {
        console.error("Delete task error:", error);
        // エラー時は再取得
        loadTasks().then(() => render());
      });
  }
}

async function restoreTask(id) {
  await API.post(`/api/tasks/${id}/restore`);
  closeModal();
  // 復元後はゴミ箱ビューから離れるので、データを再取得
  await Promise.all([loadData(), loadTasks()]);
  render();
  showToast("タスクを復元しました");
}

async function permanentDelete(id) {
  if (confirm("完全に削除しますか？この操作は取り消せません。")) {
    // 楽観的更新: タスクを即座に削除
    state.tasks = state.tasks.filter((t) => t.id !== id);
    closeModal();
    render();
    showToast("完全に削除しました");

    // バックグラウンドでAPI呼び出しとデータ更新
    Promise.all([API.delete(`/api/tasks/${id}?permanent=true`), loadData()])
      .then(() => {
        render();
      })
      .catch((error) => {
        console.error("Permanent delete error:", error);
        // エラー時は再取得
        loadTasks().then(() => render());
      });
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
  const result = await API.post("/api/sections", { name, icon });
  // 楽観的更新: セクションを即座に追加
  state.sections.push({ ...result, task_count: 0 });
  render();
  showToast("セクションを追加しました");

  // バックグラウンドでデータを更新
  loadData().then(() => render());
}

async function deleteSection(id, name) {
  if (
    confirm(
      `セクション「${name}」を削除しますか？\nこのセクションに紐づくタスクはセクションなしに移動されます。`
    )
  ) {
    try {
      // 楽観的更新: セクションを即座に削除
      state.sections = state.sections.filter((s) => s.id != id);
      // セクションが選択されている場合は、ビューを変更
      if (state.currentView === "section" && state.currentSectionId == id) {
        state.currentView = "all";
        state.currentSectionId = null;
      }
      render();
      showToast("セクションを削除しました");

      // バックグラウンドでAPI呼び出しとデータ更新
      Promise.all([API.delete(`/api/sections/${id}`), loadData(), loadTasks()])
        .then(() => {
          render();
        })
        .catch((error) => {
          console.error("Delete section error:", error);
          // エラー時は再取得
          Promise.all([loadData(), loadTasks()]).then(() => render());
        });
    } catch (error) {
      console.error("Delete section error:", error);
      showToast("セクションの削除に失敗しました", "error");
    }
  }
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

// 長押し・ドラッグ検出用の変数
let longPressTimer = null;
let longPressTarget = null;
let dragState = {
  isDragging: false,
  draggedElement: null,
  startY: 0,
  startX: 0,
  currentY: 0,
  placeholder: null,
  sectionId: null,
};
let touchStartPos = { x: 0, y: 0 };

// 長押しイベントハンドラ
function setupLongPressHandlers() {
  document.addEventListener("touchstart", handleTouchStart, {
    passive: false,
  });
  document.addEventListener("touchmove", handleTouchMove, { passive: false });
  document.addEventListener("touchend", handleTouchEnd, { passive: true });
  document.addEventListener("touchcancel", handleTouchEnd, {
    passive: true,
  });
  document.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);
}

function handleTouchStart(e) {
  const sectionItem = e.target.closest(".sidebar-item[data-section-id]");
  if (!sectionItem) return;

  const sectionId = sectionItem.getAttribute("data-section-id");
  if (!sectionId) return;

  const touch = e.touches[0];
  touchStartPos.x = touch.clientX;
  touchStartPos.y = touch.clientY;
  longPressTarget = sectionItem;

  longPressTimer = setTimeout(() => {
    // 長押し検出 - ドラッグモード開始
    startDragMode(sectionItem, sectionId, touch.clientX, touch.clientY);
    longPressTimer = null;
  }, 500);
}

function handleTouchMove(e) {
  if (longPressTimer && longPressTarget) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartPos.x;
    const deltaY = touch.clientY - touchStartPos.y;

    // 左スワイプ検出（長押し中に左に50px以上移動）
    if (deltaX < -50 && Math.abs(deltaY) < 30) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      const sectionId = longPressTarget.getAttribute("data-section-id");
      const section = state.sections.find((s) => s.id == sectionId);
      if (section) {
        e.preventDefault();
        deleteSection(section.id, section.name);
      }
      longPressTarget = null;
      return;
    }
  }

  if (dragState.isDragging) {
    e.preventDefault();
    const touch = e.touches[0];
    handleDrag(touch.clientX, touch.clientY);
  }
}

function handleTouchEnd(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;

  if (dragState.isDragging) {
    endDragMode();
  }
}

function handleMouseDown(e) {
  const sectionItem = e.target.closest(".sidebar-item[data-section-id]");
  if (!sectionItem) return;

  const sectionId = sectionItem.getAttribute("data-section-id");
  if (!sectionId) return;

  touchStartPos.x = e.clientX;
  touchStartPos.y = e.clientY;
  longPressTarget = sectionItem;

  longPressTimer = setTimeout(() => {
    startDragMode(sectionItem, sectionId, e.clientX, e.clientY);
    longPressTimer = null;
  }, 500);
}

function handleMouseMove(e) {
  if (longPressTimer && longPressTarget) {
    const deltaX = e.clientX - touchStartPos.x;
    const deltaY = e.clientY - touchStartPos.y;

    // 左スワイプ検出
    if (deltaX < -50 && Math.abs(deltaY) < 30) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      const sectionId = longPressTarget.getAttribute("data-section-id");
      const section = state.sections.find((s) => s.id == sectionId);
      if (section) {
        e.preventDefault();
        deleteSection(section.id, section.name);
      }
      longPressTarget = null;
      return;
    }
  }

  if (dragState.isDragging) {
    e.preventDefault();
    handleDrag(e.clientX, e.clientY);
  }
}

function handleMouseUp(e) {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
  longPressTarget = null;

  if (dragState.isDragging) {
    endDragMode();
  }
}

function startDragMode(element, sectionId, startX, startY) {
  dragState.isDragging = true;
  dragState.draggedElement = element;
  dragState.startY = startY;
  dragState.startX = startX;
  dragState.currentY = startY;
  dragState.sectionId = sectionId;

  element.style.opacity = "0.5";
  element.style.cursor = "grabbing";

  // プレースホルダーを作成
  const placeholder = document.createElement("div");
  placeholder.className = "sidebar-item";
  placeholder.style.height = element.offsetHeight + "px";
  placeholder.style.border = "2px dashed var(--primary)";
  placeholder.style.borderRadius = "8px";
  placeholder.style.margin = "4px 0";
  dragState.placeholder = placeholder;
  element.parentNode.insertBefore(placeholder, element.nextSibling);
}

function handleDrag(clientX, clientY) {
  if (!dragState.isDragging || !dragState.draggedElement) return;

  dragState.currentY = clientY;
  const draggedElement = dragState.draggedElement;
  const allItems = Array.from(
    document.querySelectorAll(".sidebar-item[data-section-id]")
  );

  draggedElement.style.transform = `translateY(${
    clientY - dragState.startY
  }px)`;
  draggedElement.style.position = "relative";
  draggedElement.style.zIndex = "1000";

  // ドロップ位置を計算
  let targetIndex = -1;
  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    if (item === draggedElement) continue;

    const rect = item.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;

    if (clientY < centerY) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex === -1) {
    targetIndex = allItems.length;
  }

  // プレースホルダーの位置を更新
  const placeholder = dragState.placeholder;
  if (placeholder && targetIndex < allItems.length) {
    const targetItem = allItems[targetIndex];
    if (targetItem !== draggedElement) {
      targetItem.parentNode.insertBefore(placeholder, targetItem);
    }
  } else if (placeholder && allItems.length > 0) {
    const lastItem = allItems[allItems.length - 1];
    if (lastItem !== draggedElement) {
      lastItem.parentNode.insertBefore(placeholder, lastItem.nextSibling);
    }
  }
}

async function endDragMode() {
  if (!dragState.isDragging) return;

  const draggedElement = dragState.draggedElement;
  const placeholder = dragState.placeholder;

  if (draggedElement && placeholder) {
    // 新しい位置に要素を移動
    placeholder.parentNode.insertBefore(draggedElement, placeholder);
    placeholder.remove();

    // スタイルをリセット
    draggedElement.style.opacity = "";
    draggedElement.style.cursor = "";
    draggedElement.style.transform = "";
    draggedElement.style.position = "";
    draggedElement.style.zIndex = "";

    // 新しい順番を取得
    const allItems = Array.from(
      document.querySelectorAll(".sidebar-item[data-section-id]")
    );
    const newOrder = allItems.map((item) =>
      parseInt(item.getAttribute("data-section-id"))
    );

    // APIで順番を更新
    try {
      // 楽観的更新: セクションの順番を即座に更新
      const sortedSections = newOrder
        .map((id) => state.sections.find((s) => s.id == id))
        .filter(Boolean);
      state.sections = sortedSections;
      render();
      showToast("セクションの順番を更新しました");

      // バックグラウンドでAPI呼び出し
      API.put("/api/sections/reorder", { sectionIds: newOrder }).catch(
        (error) => {
          console.error("Reorder error:", error);
          showToast("順番の更新に失敗しました", "error");
          // エラー時は再取得
          loadData().then(() => render());
        }
      );
    } catch (error) {
      console.error("Reorder error:", error);
      showToast("順番の更新に失敗しました", "error");
      // エラー時は再取得
      await loadData();
      render();
    }
  }

  // 状態をリセット
  dragState = {
    isDragging: false,
    draggedElement: null,
    startY: 0,
    startX: 0,
    currentY: 0,
    placeholder: null,
    sectionId: null,
  };
}

// 初期化
async function init() {
  await loadData();
  await loadTasks();
  render();
  setupLongPressHandlers();

  // 30日以上前のゴミ箱を自動クリーンアップ
  API.post("/api/cleanup");
}

init();
