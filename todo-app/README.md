# 오늘의 할 일

순수 HTML/CSS/JavaScript로 만든 한 페이지짜리 할 일 관리 앱입니다. 프레임워크, 외부 라이브러리, 빌드 도구, 서버가 필요 없습니다.

## 실행 방법

`index.html`을 더블클릭해 브라우저에서 엽니다. 설치나 빌드 과정은 없습니다.

## 사용법

| 하고 싶은 일 | 방법 |
| --- | --- |
| 할 일 추가 | 내용을 입력하고 카테고리(업무/개인/공부)를 고른 뒤 Enter 또는 **추가** 버튼. 내용은 최대 100자이며 빈 내용은 추가되지 않습니다. |
| 완료 표시 | 항목 왼쪽 체크박스를 클릭. 완료 항목은 취소선이 그어지고 목록 아래쪽으로 내려갑니다. |
| 수정 | 항목을 더블클릭하거나 ✎ 버튼. Enter 또는 ✓ 버튼으로 저장, Esc 또는 × 버튼으로 취소. |
| 삭제 | 항목의 × 버튼 → 확인 창에서 **확인**. |
| 완료 항목 한꺼번에 삭제 | 목록 아래 **완료 항목 지우기** 버튼 → 확인. 완료 항목이 없으면 비활성화됩니다. |
| 카테고리별로 보기 | 전체/업무/개인/공부 탭 클릭. 탭 옆 숫자는 미완료 개수입니다. |

진행률 영역은 선택한 탭과 관계없이 항상 모든 할 일을 기준으로 "완료 수/전체 수 · 퍼센트"를 보여 주고, 그 아래에 카테고리별 완료 수와 막대를 표시합니다. 모두 완료하면 "오늘 할 일을 모두 끝냈어요!"가 나타납니다.

### 키보드로 사용하기

- **Tab / Shift+Tab**: 입력창, 버튼, 탭, 각 항목의 체크박스·수정·삭제 버튼 사이를 이동
- **Enter**: 할 일 추가, 버튼·탭 실행, 수정 내용 저장, 체크박스 전환
- **Space**: 체크박스 전환, 버튼·탭 실행
- **Esc**: 수정 취소

## 데이터 저장

할 일은 브라우저의 localStorage에 저장되어 새로고침하거나 브라우저를 닫아도 남습니다. 같은 컴퓨터의 같은 브라우저에서만 보이며, 다른 기기와 동기화되지 않습니다.

| 키 | 내용 |
| --- | --- |
| `todoApp.todos` | 할 일 배열(JSON) |
| `todoApp.filter` | 선택한 탭: `all` / `work` / `personal` / `study` |
| `todoApp.version` | 데이터 형식 버전 (`1`) |

할 일 하나의 형태:

```js
{ id: string, text: string, category: "work" | "personal" | "study", completed: boolean, createdAt: number }
```

- 저장된 데이터가 깨져 있으면 빈 목록으로 시작하고 콘솔에 경고를 남깁니다.
- localStorage를 쓸 수 없는 환경(일부 시크릿 모드, 저장소 차단 설정 등)에서는 화면 위쪽에 "저장되지 않습니다" 안내가 뜨고, 창을 닫을 때까지만 메모리로 동작합니다.
- 모든 데이터를 지우려면 브라우저 개발자 도구(F12) → Application → Local Storage에서 위 세 키를 삭제합니다.

## 파일 구조

```
todo-app/
├── index.html   화면 구조 (헤더, 입력 줄, 진행률, 필터 탭, 목록)
├── style.css    스타일과 반응형 규칙 (360px ~ 1440px)
├── app.js       상태 관리, 저장, 렌더링, 이벤트 처리
└── README.md    이 문서
```

### app.js 구성

상태는 `todos` 배열과 `filter` 값 하나이며, 모든 변경은 **상태 변경 → `save()` → `render()`** 순서로 처리합니다.

| 구역 | 함수 |
| --- | --- |
| 저장소 | `load()`, `save()`, `commit()`(save 후 render) |
| 상태 변경 | `addTodo(text, category)`, `toggleTodo(id)`, `updateTodo(id, changes)`, `deleteTodo(id)`, `clearCompleted()`, `setFilter(value)` |
| 진행률 | `getProgress(todos)` → `{ total, done, percent, byCategory }` |
| 수정 모드 | `startEdit(id)`, `cancelEdit()`, `submitEdit(li)` |
| 렌더링 | `render()`가 `renderList()`, `renderFilters()`, `renderProgress()`를 호출 |

- 목록의 클릭·체크·더블클릭·키 입력은 `ul` 하나에 이벤트 위임으로 처리합니다.
- 사용자가 입력한 글자는 `textContent`/`value`로만 화면에 넣어 HTML로 해석되지 않습니다.
