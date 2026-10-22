(() => {
  "use strict";

  const STORAGE_KEY = "kendama-log-data-v1";
  const emptyState = () => ({ version: 1, techniques: [], records: [] });
  let state = emptyState();
  let selectedTechniqueId = null;
  let storageUnavailable = false;

  const elements = {
    list: document.querySelector("#trick-list"),
    count: document.querySelector("#trick-count"),
    today: document.querySelector("#today-date"),
    message: document.querySelector("#app-message"),
    trickDialog: document.querySelector("#trick-dialog"),
    trickForm: document.querySelector("#trick-form"),
    trickName: document.querySelector("#trick-name"),
    trickGoal: document.querySelector("#trick-goal"),
    trickId: document.querySelector("#trick-id"),
    trickTitle: document.querySelector("#trick-dialog-title"),
    formError: document.querySelector("#trick-form-error"),
    deleteButton: document.querySelector("#delete-trick-button"),
    detailDialog: document.querySelector("#detail-dialog"),
    detailTitle: document.querySelector("#detail-title"),
    detailContent: document.querySelector("#detail-content")
  };

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function readState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === null) return emptyState();

    const parsed = JSON.parse(stored);
    if (
      parsed === null ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.techniques) ||
      !Array.isArray(parsed.records) ||
      !parsed.techniques.every((item) =>
        item &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        Number.isSafeInteger(item.goal) &&
        item.goal > 0
      ) ||
      !parsed.records.every((item) =>
        item &&
        typeof item.techniqueId === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
        Number.isSafeInteger(item.count) &&
        item.count > 0
      )
    ) {
      throw new Error("保存データの形式が正しくありません。ブラウザーの保存領域を確認してください。");
    }
    return parsed;
  }

  function showMessage(message) {
    elements.message.textContent = message;
    elements.message.hidden = false;
  }

  function saveState(nextState) {
    if (storageUnavailable) {
      throw new Error("端末への保存が利用できないため、変更を保存できません。");
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch (error) {
      const detail = error instanceof Error ? error.message : "不明なエラー";
      throw new Error(`端末への保存に失敗しました。空き容量やブラウザーの設定を確認してください。（${detail}）`);
    }
    state = nextState;
    elements.message.hidden = true;
    render();
    if (elements.detailDialog.open && selectedTechniqueId) renderDetail();
  }

  function persistChange(change) {
    try {
      saveState(change(state));
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "保存に失敗しました。");
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function techniqueRecords(techniqueId) {
    return state.records.filter((record) => record.techniqueId === techniqueId);
  }

  function totalFor(techniqueId) {
    return techniqueRecords(techniqueId).reduce((total, record) => total + record.count, 0);
  }

  function countFor(techniqueId, date) {
    return state.records.find((record) => record.techniqueId === techniqueId && record.date === date)?.count ?? 0;
  }

  function render() {
    const today = localDateKey();
    elements.today.dateTime = today;
    elements.today.textContent = new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short"
    }).format(new Date(`${today}T12:00:00`));
    elements.count.textContent = String(state.techniques.length);

    if (state.techniques.length === 0) {
      elements.list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">＋</div>
          <h3>最初の技を登録しよう</h3>
          <p>目標を決めて、今日から練習を記録できます。</p>
          <button class="button button-dark" type="button" data-action="add">技を追加する</button>
        </div>`;
      return;
    }

    elements.list.innerHTML = state.techniques.map((technique) => {
      const total = totalFor(technique.id);
      const todayCount = countFor(technique.id, today);
      const complete = total >= technique.goal;
      const progress = Math.min(100, (total / technique.goal) * 100);
      return `
        <article class="trick-card">
          <div class="card-top">
            <h3 class="trick-name">${escapeHtml(technique.name)}</h3>
            ${complete ? '<span class="clear-badge">✓ クリア</span>' : ""}
          </div>
          <div class="card-count">
            <span class="count-current">${total.toLocaleString("ja-JP")}</span>
            <span class="count-goal">/ ${technique.goal.toLocaleString("ja-JP")} 回</span>
          </div>
          <div class="progress-track" role="progressbar" aria-label="${escapeHtml(technique.name)}の目標達成率" aria-valuemin="0" aria-valuemax="${technique.goal}" aria-valuenow="${Math.min(total, technique.goal)}">
            <div class="progress-fill${complete ? " is-complete" : ""}" style="width: ${progress}%"></div>
          </div>
          <div class="card-meta">
            <span>${complete ? "目標達成！さらに積み上げよう" : `あと ${(technique.goal - total).toLocaleString("ja-JP")} 回`}</span>
            <span class="today-count">今日 ${todayCount} 回</span>
          </div>
          <div class="card-actions">
            <button class="success-button" type="button" data-action="increment" data-id="${escapeHtml(technique.id)}" aria-label="${escapeHtml(technique.name)}の成功を1回記録">成功！ ＋1</button>
            <button class="history-button" type="button" data-action="details" data-id="${escapeHtml(technique.id)}" aria-label="${escapeHtml(technique.name)}の履歴を見る">履歴</button>
            <button class="edit-button" type="button" data-action="edit" data-id="${escapeHtml(technique.id)}" aria-label="${escapeHtml(technique.name)}を編集">編集</button>
          </div>
        </article>`;
    }).join("");
  }

  function currentTechnique() {
    return state.techniques.find((item) => item.id === selectedTechniqueId) ?? null;
  }

  function renderDetail() {
    const technique = currentTechnique();
    if (!technique) {
      elements.detailDialog.close();
      return;
    }
    const today = localDateKey();
    const todayCount = countFor(technique.id, today);
    const total = totalFor(technique.id);
    const records = techniqueRecords(technique.id).sort((a, b) => b.date.localeCompare(a.date));

    elements.detailTitle.textContent = technique.name;
    elements.detailContent.innerHTML = `
      <div class="detail-summary">
        <div class="detail-total"><strong>${total.toLocaleString("ja-JP")} <small>/ ${technique.goal.toLocaleString("ja-JP")}</small></strong><span>累計の成功回数</span></div>
        <div class="detail-today"><span>今日の記録</span><strong>${todayCount} 回</strong></div>
      </div>
      <div class="detail-count-actions">
        <button class="success-button" type="button" data-action="increment" data-id="${escapeHtml(technique.id)}">成功！ ＋1</button>
        <button class="undo-button" type="button" data-action="undo" data-id="${escapeHtml(technique.id)}"${todayCount === 0 ? " disabled" : ""}>今日の分を −1</button>
      </div>
      <div class="history-header"><h3>日別の記録</h3><span>${records.length} 日分</span></div>
      <form class="history-add" data-technique-id="${escapeHtml(technique.id)}">
        <label>
          <span class="history-add-label">日付</span>
          <input type="date" name="date" value="${today}" required>
        </label>
        <label>
          <span class="history-add-label">回数</span>
          <input type="number" name="count" min="0" max="1000000" step="1" value="1" required>
        </label>
        <button class="history-save" type="submit">記録する</button>
      </form>
      <div class="history-list">
        ${records.length === 0
          ? '<p class="history-empty">まだ記録はありません。最初の成功を記録してみましょう。</p>'
          : records.map((record) => `
            <div class="history-row">
              <time datetime="${record.date}">${formatDate(record.date)}</time>
              <label class="history-edit">
                <input type="number" min="0" max="1000000" step="1" value="${record.count}" aria-label="${formatDate(record.date)}の回数" data-history-date="${record.date}">
                <span>回</span>
              </label>
              <button class="history-save" type="button" data-action="save-day" data-date="${record.date}" data-id="${escapeHtml(technique.id)}">保存</button>
            </div>`).join("")}
      </div>`;
  }

  function formatDate(date) {
    const parsed = new Date(`${date}T12:00:00`);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short"
    }).format(parsed);
  }

  function openTechniqueDialog(technique = null) {
    elements.trickForm.reset();
    elements.formError.textContent = "";
    elements.trickId.value = technique?.id ?? "";
    elements.trickName.value = technique?.name ?? "";
    elements.trickGoal.value = String(technique?.goal ?? 100);
    elements.trickTitle.textContent = technique ? "技を編集" : "技を追加";
    elements.deleteButton.hidden = !technique;
    elements.trickDialog.showModal();
    elements.trickName.focus();
  }

  function recordCount(techniqueId, date, nextCount) {
    const existing = state.records.find((record) => record.techniqueId === techniqueId && record.date === date);
    const records = state.records.filter((record) => !(record.techniqueId === techniqueId && record.date === date));
    if (nextCount > 0) records.push({ techniqueId, date, count: nextCount });
    if (!existing && nextCount === 0) return;
    persistChange((current) => ({ ...current, records }));
  }

  elements.trickForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.trickName.value.trim();
    const goal = Number(elements.trickGoal.value);
    if (!name) {
      elements.formError.textContent = "技の名前を入力してください。";
      elements.trickName.focus();
      return;
    }
    if (!Number.isSafeInteger(goal) || goal < 1 || goal > 1000000) {
      elements.formError.textContent = "目標回数は1〜1,000,000の整数で入力してください。";
      elements.trickGoal.focus();
      return;
    }

    const id = elements.trickId.value;
    if (id) {
      const techniques = state.techniques.map((item) => item.id === id ? { ...item, name, goal } : item);
      persistChange((current) => ({ ...current, techniques }));
    } else {
      const technique = { id: crypto.randomUUID(), name, goal };
      persistChange((current) => ({ ...current, techniques: [...current.techniques, technique] }));
    }
    if (!elements.message.hidden) return;
    elements.trickDialog.close();
  });

  elements.deleteButton.addEventListener("click", () => {
    const id = elements.trickId.value;
    const technique = state.techniques.find((item) => item.id === id);
    if (!technique || !window.confirm(`「${technique.name}」とその練習記録をすべて削除します。この操作は取り消せません。削除しますか？`)) return;
    persistChange((current) => ({
      ...current,
      techniques: current.techniques.filter((item) => item.id !== id),
      records: current.records.filter((record) => record.techniqueId !== id)
    }));
    if (elements.message.hidden) elements.trickDialog.close();
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.close) {
      document.getElementById(button.dataset.close).close();
      return;
    }
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (action === "add") openTechniqueDialog();
    if (action === "edit") {
      const technique = state.techniques.find((item) => item.id === id);
      if (technique) openTechniqueDialog(technique);
    }
    if (action === "details") {
      selectedTechniqueId = id;
      renderDetail();
      elements.detailDialog.showModal();
    }
    if (action === "increment" && state.techniques.some((item) => item.id === id)) {
      recordCount(id, localDateKey(), countFor(id, localDateKey()) + 1);
    }
    if (action === "undo") {
      recordCount(id, localDateKey(), Math.max(0, countFor(id, localDateKey()) - 1));
    }
    if (action === "save-day") {
      const input = elements.detailContent.querySelector(`[data-history-date="${button.dataset.date}"]`);
      const value = Number(input.value);
      if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) {
        showMessage("日別の回数は0〜1,000,000の整数で入力してください。");
        input.focus();
        return;
      }
      recordCount(id, button.dataset.date, value);
    }
  });

  elements.detailContent.addEventListener("submit", (event) => {
    const form = event.target.closest(".history-add");
    if (!form) return;
    event.preventDefault();
    const date = form.elements.date.value;
    const value = Number(form.elements.count.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isSafeInteger(value) || value < 0 || value > 1000000) {
      showMessage("日付を選び、回数は0〜1,000,000の整数で入力してください。");
      return;
    }
    recordCount(form.dataset.techniqueId, date, value);
  });

  document.querySelector("#add-trick-button").addEventListener("click", () => openTechniqueDialog());
  elements.trickDialog.addEventListener("click", (event) => {
    if (event.target === elements.trickDialog) elements.trickDialog.close();
  });
  elements.detailDialog.addEventListener("click", (event) => {
    if (event.target === elements.detailDialog) elements.detailDialog.close();
  });

  try {
    state = readState();
  } catch (error) {
    storageUnavailable = true;
    showMessage(error instanceof Error ? error.message : "端末の保存データを読み込めませんでした。");
  }
  render();

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.error("オフライン利用の準備に失敗しました。", error);
      });
    });
  }
})();
