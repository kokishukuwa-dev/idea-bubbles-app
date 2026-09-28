(function () {
  "use strict";

  const STORAGE_KEY = "idea-bubbles:v1";
  const DAY = 86400000;

  function rand(min, max) { return min + Math.random() * (max - min); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  const CATS = {
    none: { label: "💭 未分類", hue: 210 },
    idea: { label: "💡 アイデア", hue: 205 },
    design: { label: "🎨 デザイン", hue: 330 },
    ai: { label: "🤖 AI", hue: 265 },
    research: { label: "📚 研究", hue: 150 },
  };
  function tintFor(ageDays, cat) {
    const hue0 = (CATS[cat] || CATS.none).hue;
    const t = clamp(ageDays / 30, 0, 1);
    const sat = 68 - t * 8, light = 58 + t * 10, hue = hue0 + t * 30;
    return `radial-gradient(circle at 30% 26%, hsla(${hue},${sat}%,${light + 18}%,.68), hsla(${hue},${sat}%,${light}%,.3))`;
  }
  function relDate(days) {
    if (days <= 0.02) return "たった今";
    if (days < 1) return "今日";
    if (days < 2) return "昨日";
    if (days < 7) return Math.floor(days) + "日前";
    if (days < 30) return Math.floor(days / 7) + "週間前";
    return Math.floor(days / 30) + "か月前";
  }

  // ---- persistence ----
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (err) { /* 壊れたデータは無視して初期状態から始める */ }
    const now = Date.now();
    return [
      { id: 1, label: "これがアイデアの泡", cat: "none", detail: "タップすると開いて、中身の確認・カテゴリの変更・削除ができる。ドラッグでどこへでも動かせる。", createdAt: now },
      { id: 2, label: "下から追加してみて", cat: "none", detail: "画面下の欄に書いて→を押すと、新しい泡が生まれる。", createdAt: now - 0.01 * DAY },
    ];
  }
  let items = loadItems();
  let idCounter = items.reduce((max, it) => Math.max(max, it.id), 0) + 1;
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (err) { /* 保存領域が無い場合は諦める */ }
  }

  const field = document.getElementById("field");
  const listEl = document.getElementById("listEl");

  for (let i = 0; i < 14; i++) {
    const s = document.createElement("div");
    s.className = "star";
    s.style.width = s.style.height = rand(1, 2.4) + "px";
    s.style.left = rand(2, 98) + "%";
    s.style.top = rand(2, 45) + "%";
    s.style.opacity = rand(.25, .8);
    field.appendChild(s);
  }

  // ---- bubble physics ----
  const state = [];
  function makeBubbleEl(item) {
    const el = document.createElement("div");
    el.className = "bubble";
    const r = 28 + Math.min(item.label.length, 10);
    el.style.width = el.style.height = r * 2 + "px";
    el.style.background = tintFor((Date.now() - item.createdAt) / DAY, item.cat);
    const span = document.createElement("div");
    span.className = "txt";
    span.textContent = item.label.length > 9 ? item.label.slice(0, 8) + "…" : item.label;
    el.appendChild(span);
    field.appendChild(el);
    return { el, r };
  }
  function addToField(item, spawn) {
    const { el, r } = makeBubbleEl(item);
    const w = field.clientWidth || 320, h = field.clientHeight || 480;
    let b;
    if (spawn) {
      el.style.width = el.style.height = "0px";
      el.style.opacity = "0";
      b = { item, el, r, x: w / 2, y: h - 40, vx: rand(-0.6, 0.6), vy: -3, dragging: false, _fling: true };
      requestAnimationFrame(() => {
        el.style.transition = "width 320ms cubic-bezier(.34,1.56,.64,1), height 320ms cubic-bezier(.34,1.56,.64,1), opacity 200ms ease";
        el.style.width = el.style.height = r * 2 + "px";
        el.style.opacity = "1";
      });
    } else {
      b = { item, el, r, x: rand(r, w - r), y: rand(r + 10, h - r - 10), vx: rand(-1, 1), vy: rand(-1, 1), dragging: false, _fling: false };
    }
    state.push(b);
    attachDrag(b);
    return b;
  }
  items.forEach(item => addToField(item, false));

  function attachDrag(b) {
    let startX = 0, startY = 0, startBX = 0, startBY = 0, startT = 0, lastX = 0, lastY = 0, lastT = 0;
    b.el.addEventListener("pointerdown", e => {
      try { b.el.setPointerCapture(e.pointerId); } catch (err) { /* 合成イベント等では失敗することがある。追跡は継続する */ }
      b.dragging = true; b._fling = false;
      b.el.style.transition = "none";
      startX = e.clientX; startY = e.clientY; startBX = b.x; startBY = b.y; startT = performance.now();
      lastX = e.clientX; lastY = e.clientY; lastT = startT; b.vx = 0; b.vy = 0;
    });
    b.el.addEventListener("pointermove", e => {
      if (!b.dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      b.x = startBX + dx; b.y = startBY + dy;
      b.el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`;
      const now2 = performance.now(); const dt = Math.max(now2 - lastT, 1);
      b.vx = (e.clientX - lastX) / dt * 7; b.vy = (e.clientY - lastY) / dt * 7;
      lastX = e.clientX; lastY = e.clientY; lastT = now2;
    });
    function end(e) {
      if (!b.dragging) return;
      b.dragging = false;
      b.el.style.transition = "";
      const dx = e.clientX - startX, dy = e.clientY - startY;
      const moved = Math.hypot(dx, dy);
      const dt = performance.now() - startT;
      if (moved < 6 && dt < 300) openSheet(b.item);
      else b._fling = true;
    }
    b.el.addEventListener("pointerup", end);
    b.el.addEventListener("pointercancel", end);
  }

  function tick() {
    const w = field.clientWidth, h = field.clientHeight;
    // リストタブを表示中は泡の画面の大きさが0になるので、位置を崩さないよう動かさない
    if (!w || !h) { requestAnimationFrame(tick); return; }
    for (const b of state) {
      if (b.dragging || b.removed) continue;
      b.vx += rand(-0.08, 0.08);
      b.vy += rand(-0.08, 0.08);
      const speed = Math.hypot(b.vx, b.vy);
      const maxSpeed = b._fling ? 9 : 0.9;
      if (speed > maxSpeed) { b.vx = b.vx / speed * maxSpeed; b.vy = b.vy / speed * maxSpeed; }
      b.x += b.vx; b.y += b.vy;
      if (b._fling) { b.vx *= 0.92; b.vy *= 0.92; if (Math.hypot(b.vx, b.vy) < 1) b._fling = false; }
      if (b.x - b.r < 0) { b.x = b.r; b.vx *= -0.4; }
      if (b.x + b.r > w) { b.x = w - b.r; b.vx *= -0.4; }
      if (b.y - b.r < 4) { b.y = 4 + b.r; b.vy *= -0.4; }
      if (b.y + b.r > h - 4) { b.y = h - 4 - b.r; b.vy *= -0.4; }
    }
    for (let i = 0; i < state.length; i++) {
      for (let j = i + 1; j < state.length; j++) {
        const a = state[i], b = state[j];
        if (a.removed || b.removed) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy) || 0.01, minDist = a.r + b.r - 4;
        if (dist < minDist) {
          const overlap = (minDist - dist) / 2, nx = dx / dist, ny = dy / dist;
          if (!a.dragging) { a.x -= nx * overlap; a.y -= ny * overlap; }
          if (!b.dragging) { b.x += nx * overlap; b.y += ny * overlap; }
        }
      }
    }
    for (const b of state) { if (!b.removed) b.el.style.transform = `translate3d(${b.x - b.r}px, ${b.y - b.r}px, 0)`; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---- list view ----
  function renderList() {
    listEl.innerHTML = "";
    if (!items.length) {
      listEl.innerHTML = `<div class="list-empty">まだ何も浮かんでいない。下から思いついたことを書いてみて。</div>`;
      return;
    }
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    sorted.forEach(item => {
      const row = document.createElement("div");
      row.className = "list-row";
      const ageDays = (Date.now() - item.createdAt) / DAY;
      row.innerHTML = `<span class="dot" style="background:${tintFor(ageDays, item.cat)}"></span>
        <span class="body"><span class="label"></span><time></time></span>
        <span class="chev">›</span>`;
      row.querySelector(".label").textContent = item.label;
      row.querySelector("time").textContent = CATS[item.cat].label + " ・ " + relDate(ageDays);
      row.addEventListener("click", () => openSheet(item));
      listEl.appendChild(row);
    });
  }

  // ---- capture ----
  const captureInput = document.getElementById("captureInput");
  document.getElementById("captureSend").addEventListener("click", doCapture);
  captureInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) doCapture();
  });
  function doCapture() {
    const text = captureInput.value.trim();
    if (!text) return;
    const item = { id: idCounter++, label: text, cat: "none", detail: text, createdAt: Date.now() };
    items.push(item);
    save();
    addToField(item, true);
    renderList();
    captureInput.value = "";
  }

  // ---- detail sheet ----
  const sheetBackdrop = document.getElementById("sheetBackdrop");
  const sheetTime = document.getElementById("sheetTime");
  const sheetCats = document.getElementById("sheetCats");
  const sheetBody = document.getElementById("sheetBody");
  let current = null;
  function openSheet(item) {
    current = item;
    sheetTime.textContent = relDate((Date.now() - item.createdAt) / DAY);
    sheetBody.value = item.detail || item.label;
    sheetBody.readOnly = true;
    sheetCats.innerHTML = "";
    Object.entries(CATS).forEach(([key, val]) => {
      const chip = document.createElement("div");
      chip.className = "cat-chip" + (item.cat === key ? " selected" : "");
      chip.textContent = val.label;
      chip.style.background = `hsla(${val.hue},60%,45%,.35)`;
      chip.addEventListener("click", () => {
        item.cat = key;
        save();
        [...sheetCats.children].forEach(c => c.classList.remove("selected"));
        chip.classList.add("selected");
        const match = state.find(b => b.item === item);
        if (match) match.el.style.background = tintFor((Date.now() - item.createdAt) / DAY, item.cat);
        renderList();
      });
      sheetCats.appendChild(chip);
    });
    sheetBackdrop.classList.add("open");
  }
  function closeSheet() { sheetBackdrop.classList.remove("open"); current = null; }
  sheetBackdrop.addEventListener("click", e => { if (e.target === sheetBackdrop) closeSheet(); });
  document.getElementById("sheetClose").addEventListener("click", closeSheet);
  document.getElementById("sheetEdit").addEventListener("click", () => {
    if (sheetBody.readOnly) { sheetBody.readOnly = false; sheetBody.focus(); }
    else { sheetBody.readOnly = true; if (current) { current.detail = sheetBody.value; save(); renderList(); } }
  });
  document.getElementById("sheetDel").addEventListener("click", () => {
    if (!current) return;
    const idx = items.indexOf(current);
    if (idx >= 0) items.splice(idx, 1);
    save();
    const match = state.find(b => b.item === current);
    if (match) {
      match.removed = true;
      match.el.style.transition = "width 220ms ease, height 220ms ease, opacity 220ms ease";
      match.el.style.width = match.el.style.height = "0px";
      match.el.style.opacity = "0";
      setTimeout(() => match.el.remove(), 230);
    }
    renderList();
    closeSheet();
  });

  // ---- tabs ----
  const tabBubbleBtn = document.getElementById("tabBubbleBtn");
  const tabListBtn = document.getElementById("tabListBtn");
  const viewBubble = document.getElementById("viewBubble");
  const viewList = document.getElementById("viewList");
  tabBubbleBtn.addEventListener("click", () => {
    tabBubbleBtn.classList.add("active"); tabListBtn.classList.remove("active");
    viewBubble.hidden = false; viewList.hidden = true;
  });
  tabListBtn.addEventListener("click", () => {
    tabListBtn.classList.add("active"); tabBubbleBtn.classList.remove("active");
    viewList.hidden = false; viewBubble.hidden = true;
    renderList();
  });

  // 右クリック（長押し）で起動時のタブと並び順、ドラッグで並び替え
  {
    const TAB_KEY = "idea-bubbles:tabs";
    const tabs = { bubble: tabBubbleBtn, list: tabListBtn };
    const ids = Object.keys(tabs);
    const box = tabBubbleBtn.parentElement;
    const arrange = () => TabPrefs.arrange(TAB_KEY, box, tabs);
    ids.forEach(id => TabPrefs.bind(TAB_KEY, tabs[id], id, ids, arrange));
    arrange();
    if (TabPrefs.getDefault(TAB_KEY, ids, "bubble") === "list") tabListBtn.click();
  }

  renderList();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => { /* オフライン表示は無くても本体は動く */ });
    });
  }
})();
