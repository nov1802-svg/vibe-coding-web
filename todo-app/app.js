// 오늘의 할 일 — 상태(todos, filter) 하나를 바꾸고 → save() → render() 하는 구조.

const STORAGE_KEYS = { todos: "todoApp.todos", filter: "todoApp.filter", version: "todoApp.version" };
const STORAGE_VERSION = 1;
const CATEGORIES = ["work", "personal", "study"];
const CATEGORY_LABELS = { work: "업무", personal: "개인", study: "공부" };
const FILTERS = ["all", ...CATEGORIES];
const MAX_TEXT_LENGTH = 100;

// ===== 상태 =====
let todos = [];
let filter = "all";
let storageAvailable = true; // localStorage를 못 쓰면 false (메모리로만 동작)
// 화면 전용 상태 (저장하지 않음)
let editingId = null; // 수정 중인 항목의 id
let pendingFocus = null; // 다음 render() 뒤 포커스를 줄 곳: { id, role }

const $ = (id) => document.getElementById(id);
const els = {
  date: $("today-date"),
  notice: $("storage-notice"),
  form: $("todo-form"),
  input: $("todo-input"),
  inputError: $("input-error"),
  category: $("todo-category"),
  list: $("todo-list"),
  empty: $("empty-message"),
  clearDone: $("clear-done-btn"),
  filters: document.querySelector(".filters"),
  filterTabs: document.querySelectorAll(".filter-tab"),
  progressComplete: $("progress-complete"),
};

// ===== 저장소 =====
function isValidTodo(item) {
  return item !== null && typeof item === "object" &&
    typeof item.id === "string" && typeof item.text === "string" &&
    CATEGORIES.includes(item.category) &&
    typeof item.completed === "boolean" && typeof item.createdAt === "number";
}

// 저장소를 쓸 수 없게 되면 메모리 모드로 전환한다 (안내는 render()가 표시).
function disableStorage(err) {
  storageAvailable = false;
  console.warn("localStorage를 사용할 수 없어 메모리로만 동작합니다.", err);
}

// 저장된 todos와 filter를 읽는다. 깨진 데이터는 버리고 빈 목록으로 시작한다.
function load() {
  let rawTodos = null;
  let rawFilter = null;
  try {
    rawTodos = localStorage.getItem(STORAGE_KEYS.todos);
    rawFilter = localStorage.getItem(STORAGE_KEYS.filter);
  } catch (err) {
    disableStorage(err);
  }

  todos = [];
  if (rawTodos !== null) {
    try {
      const parsed = JSON.parse(rawTodos);
      if (!Array.isArray(parsed)) throw new Error("todos가 배열이 아닙니다.");
      todos = parsed.filter(isValidTodo);
    } catch (err) {
      console.warn("저장된 할 일을 읽지 못해 빈 목록으로 시작합니다.", err);
    }
  }
  filter = FILTERS.includes(rawFilter) ? rawFilter : "all";
}

function save() {
  if (!storageAvailable) return;
  try {
    localStorage.setItem(STORAGE_KEYS.todos, JSON.stringify(todos));
    localStorage.setItem(STORAGE_KEYS.filter, filter);
    localStorage.setItem(STORAGE_KEYS.version, String(STORAGE_VERSION));
  } catch (err) {
    disableStorage(err);
  }
}

// 상태를 바꾼 뒤 항상 이 순서로 마무리한다.
function commit() {
  save();
  render();
}

// ===== 상태 변경 =====
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const findTodo = (id) => todos.find((todo) => todo.id === id);

// 추가되면 true, 빈 입력이면 false.
function addTodo(text, category) {
  const trimmed = String(text).trim();
  if (trimmed === "") return false;
  todos.push({
    id: createId(),
    text: trimmed,
    category: CATEGORIES.includes(category) ? category : "work",
    completed: false,
    createdAt: Date.now(),
  });
  commit();
  return true;
}

function toggleTodo(id) {
  const todo = findTodo(id);
  if (!todo) return;
  todo.completed = !todo.completed;
  commit();
}

// changes: { text?, category? }. 저장되면 true, 내용이 비었거나 대상이 없으면 false.
function updateTodo(id, changes) {
  const todo = findTodo(id);
  if (!todo) return false;
  if (changes.text !== undefined) {
    const text = String(changes.text).trim().slice(0, MAX_TEXT_LENGTH);
    if (text === "") return false;
    todo.text = text;
  }
  if (CATEGORIES.includes(changes.category)) todo.category = changes.category;
  commit();
  return true;
}

function deleteTodo(id) {
  if (!findTodo(id)) return;
  todos = todos.filter((todo) => todo.id !== id);
  if (editingId === id) editingId = null;
  commit();
}

function clearCompleted() {
  todos = todos.filter((todo) => !todo.completed);
  if (editingId !== null && !findTodo(editingId)) editingId = null;
  commit();
}

function setFilter(value) {
  if (!FILTERS.includes(value) || value === filter) return;
  filter = value;
  editingId = null; // 수정 중이던 항목이 필터에서 사라질 수 있다.
  commit();
}

// ===== 진행률 =====
// 할 일이 0개면 0으로 나누지 않고 0%로 둔다.
function summarize(items) {
  const total = items.length;
  const done = items.filter((todo) => todo.completed).length;
  return { total, done, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

// { total, done, percent, byCategory: { work, personal, study } } — byCategory 값도 같은 형태.
function getProgress(todos) {
  const byCategory = {};
  CATEGORIES.forEach((category) => {
    byCategory[category] = summarize(todos.filter((todo) => todo.category === category));
  });
  return { ...summarize(todos), byCategory };
}

// ===== 수정 모드 (화면 전용 상태라 save 없이 render만 한다) =====
function startEdit(id) {
  if (!findTodo(id)) return;
  editingId = id;
  pendingFocus = { id, role: "edit-input" };
  render();
}

function cancelEdit() {
  if (editingId === null) return;
  pendingFocus = { id: editingId, role: "edit" };
  editingId = null;
  render();
}

// 수정 폼의 값을 저장한다. 빈 내용이면 저장하지 않고 수정 모드를 유지한다.
function submitEdit(li) {
  const input = li.querySelector('[data-role="edit-input"]');
  if (input.value.trim() === "") {
    setInvalid(input, li.querySelector(".form-error"), true);
    input.focus();
    return;
  }
  const id = li.dataset.id;
  editingId = null;
  pendingFocus = { id, role: "edit" };
  updateTodo(id, { text: input.value, category: li.querySelector('[data-role="edit-category"]').value });
}

// 빈 입력 오류를 테두리 색 + 문구 + aria-invalid로 함께 알린다.
function setInvalid(input, errorEl, invalid) {
  input.classList.toggle("is-invalid", invalid);
  input.setAttribute("aria-invalid", String(invalid));
  errorEl.hidden = !invalid;
}

// ===== 렌더링 =====
// 요소 생성 도우미. role은 data-role, label은 aria-label로 들어간다.
// 사용자 입력은 textContent/value로만 넣는다 (innerHTML 금지, XSS 방지).
function el(tag, { role, label, ...props } = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  if (role) node.dataset.role = role;
  if (label) node.setAttribute("aria-label", label);
  node.append(...children);
  return node;
}

const iconButton = (role, label, symbol, type = "button") =>
  el("button", { className: `btn-icon todo-${role}`, type, role, label, textContent: symbol });

function createViewElements(todo) {
  return [
    el("input", { className: "todo-check", type: "checkbox", checked: todo.completed, role: "check", label: `완료 표시: ${todo.text}` }),
    el("span", { className: `badge badge-${todo.category}`, textContent: CATEGORY_LABELS[todo.category] }),
    el("span", { className: "todo-text", title: "더블클릭하여 수정", textContent: todo.text }),
    iconButton("edit", `수정: ${todo.text}`, "✎"),
    iconButton("delete", `삭제: ${todo.text}`, "×"),
  ];
}

function createEditForm(todo) {
  const options = CATEGORIES.map((value) => el("option", { value, textContent: CATEGORY_LABELS[value] }));
  const select = el("select", { className: "todo-category todo-edit-category", role: "edit-category", label: "카테고리 수정" }, ...options);
  select.value = todo.category;

  return el("form", { className: "todo-edit-form", noValidate: true },
    el("input", { className: "todo-input todo-edit-input", type: "text", maxLength: MAX_TEXT_LENGTH, value: todo.text, role: "edit-input", label: "할 일 내용 수정" }),
    select,
    iconButton("save", "수정 내용 저장", "✓", "submit"),
    iconButton("cancel", "수정 취소", "×"),
    el("p", { className: "form-error", hidden: true, textContent: "내용을 입력해 주세요." }),
  );
}

function createTodoElement(todo) {
  const editing = todo.id === editingId;
  const li = el("li", { className: "todo-item" });
  li.classList.toggle("is-done", todo.completed);
  li.classList.toggle("is-editing", editing);
  li.dataset.id = todo.id;
  li.append(...(editing ? [createEditForm(todo)] : createViewElements(todo)));
  return li;
}

// 미완료가 위, 완료가 아래. 각 그룹 안에서는 createdAt 오름차순.
function compareTodos(a, b) {
  if (a.completed !== b.completed) return a.completed ? 1 : -1;
  return a.createdAt - b.createdAt;
}

function renderList() {
  const visible = todos.filter((todo) => filter === "all" || todo.category === filter).sort(compareTodos);
  els.list.replaceChildren(...visible.map(createTodoElement));
  els.empty.hidden = visible.length > 0;
  els.clearDone.disabled = !todos.some((todo) => todo.completed);
}

function renderBar(key, { total, done, percent }, showPercent) {
  const fill = $(`progress-${key}-bar`);
  $(`progress-${key}-text`).textContent = showPercent ? `${done}/${total} · ${percent}%` : `${done}/${total}`;
  fill.style.width = `${percent}%`;
  fill.parentElement.setAttribute("aria-valuenow", String(percent));
}

// 전체 진행률은 필터와 관계없이 항상 모든 할 일 기준이다.
function renderProgress(progress) {
  renderBar("total", progress, true);
  CATEGORIES.forEach((category) => renderBar(category, progress.byCategory[category], false));
  els.progressComplete.hidden = !(progress.total > 0 && progress.done === progress.total);
}

// 선택된 탭 강조 + 탭마다 미완료 개수 표시.
function renderFilters(progress) {
  els.filterTabs.forEach((tab) => {
    const value = tab.dataset.filter;
    const stats = value === "all" ? progress : progress.byCategory[value];
    const remaining = stats.total - stats.done;
    const name = value === "all" ? "전체" : CATEGORY_LABELS[value];
    tab.classList.toggle("is-active", value === filter);
    tab.setAttribute("aria-pressed", String(value === filter));
    tab.setAttribute("aria-label", `${name} 보기, 미완료 ${remaining}개`);
    tab.querySelector(".filter-count").textContent = String(remaining);
  });
}

function renderDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  els.date.dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  els.date.textContent = now.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "long" });
}

// 목록을 통째로 다시 그리므로, 목록 안의 포커스는 같은 항목의 같은 컨트롤로 되돌린다.
function getFocusedControl() {
  const active = document.activeElement;
  const li = active && els.list.contains(active) ? active.closest(".todo-item") : null;
  return li ? { id: li.dataset.id, role: active.dataset.role } : null;
}

function restoreFocus(target) {
  if (!target) return;
  const li = [...els.list.children].find((item) => item.dataset.id === target.id);
  const control = li ? li.querySelector(`[data-role="${target.role}"]`) : null;
  if (!control) {
    els.input.focus(); // 항목이 삭제되었거나 필터에서 사라진 경우
    return;
  }
  control.focus();
  if (target.role === "edit-input") control.select();
}

// 현재 상태를 화면 전체에 반영한다.
function render() {
  const focusTarget = pendingFocus || getFocusedControl();
  pendingFocus = null;
  const progress = getProgress(todos);

  els.notice.hidden = storageAvailable;
  renderList();
  renderFilters(progress);
  renderProgress(progress);
  restoreFocus(focusTarget);
}

// ===== 이벤트 =====
// Enter와 추가 버튼 모두 form의 submit으로 들어온다.
els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const added = addTodo(els.input.value, els.category.value);
  if (added) els.input.value = "";
  setInvalid(els.input, els.inputError, !added);
  els.input.focus();
});

els.input.addEventListener("input", () => setInvalid(els.input, els.inputError, false));

els.filters.addEventListener("click", (event) => {
  const tab = event.target.closest(".filter-tab");
  if (tab) setFilter(tab.dataset.filter);
});

function confirmDelete(id) {
  const todo = findTodo(id);
  if (todo && confirm(`"${todo.text}" 항목을 삭제할까요?`)) deleteTodo(id);
}

// 목록의 이벤트는 모두 ul 하나에 위임한다 (항목마다 리스너를 붙이지 않음).
els.list.addEventListener("click", (event) => {
  const li = event.target.closest(".todo-item");
  const button = event.target.closest("button[data-role]");
  if (!li || !button) return;
  const role = button.dataset.role;
  if (role === "edit") startEdit(li.dataset.id);
  else if (role === "delete") confirmDelete(li.dataset.id);
  else if (role === "cancel") cancelEdit();
});

// 수정 폼의 Enter와 저장(✓) 버튼은 submit으로 들어온다.
els.list.addEventListener("submit", (event) => {
  event.preventDefault();
  submitEdit(event.target.closest(".todo-item"));
});

els.list.addEventListener("change", (event) => {
  if (event.target.dataset.role === "check") toggleTodo(event.target.closest(".todo-item").dataset.id);
});

els.list.addEventListener("dblclick", (event) => {
  const li = event.target.closest(".todo-item");
  if (!li || li.classList.contains("is-editing") || event.target.closest("button, input")) return;
  startEdit(li.dataset.id);
});

els.list.addEventListener("keydown", (event) => {
  const li = event.target.closest(".todo-item");
  const role = event.target.dataset.role;
  if (!li) return;
  if (event.key === "Escape" && li.classList.contains("is-editing")) {
    event.preventDefault();
    cancelEdit();
  } else if (event.key === "Enter" && role === "edit-category") {
    event.preventDefault(); // select 위의 Enter는 폼을 제출하지 않으므로 직접 저장
    submitEdit(li);
  } else if (event.key === "Enter" && role === "check") {
    event.preventDefault(); // 체크박스는 기본적으로 Space만 받는다
    toggleTodo(li.dataset.id);
  }
});

els.list.addEventListener("input", (event) => {
  if (event.target.dataset.role !== "edit-input") return;
  setInvalid(event.target, event.target.closest(".todo-item").querySelector(".form-error"), false);
});

els.clearDone.addEventListener("click", () => {
  const count = todos.filter((todo) => todo.completed).length;
  if (count === 0 || !confirm(`완료된 항목 ${count}개를 모두 삭제할까요?`)) return;
  clearCompleted();
  els.input.focus();
});

// ===== 시작 =====
load();
renderDate();
render();
