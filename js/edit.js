(function () {
  const local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const gate = document.getElementById("gate");
  const studio = document.getElementById("studio");
  const status = document.getElementById("status");
  const state = { site: null, section: "notes", currentId: null, dirty: false };

  function setStatus(message, isError) {
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  function field(id) { return document.getElementById(id); }

  function confirmDiscard() {
    if (!state.dirty) return true;
    return window.confirm("还有没保存的修改，确定离开吗？");
  }

  function blank() {
    if (state.section === "home") return { id: "", title: "", github: "", readme: "", date: Site.today() };
    return { id: "", title: "", body: "", date: Site.today() };
  }

  function listForSection() {
    return state.section === "home" ? state.site.projects : state.site.notes;
  }

  function showEditor() {
    gate.hidden = true;
    studio.hidden = false;
    document.getElementById("publish").hidden = !local;
    document.getElementById("save").textContent = local ? "保存" : "保存并更新网站";
  }

  function renderPicker() {
    document.querySelectorAll("[data-section]").forEach((button) => {
      button.classList.toggle("primary", button.getAttribute("data-section") === state.section);
    });
    const homeFields = document.getElementById("home-fields");
    const textFields = document.getElementById("text-fields");
    const aboutFields = document.getElementById("about-fields");
    const listTools = document.getElementById("list-tools");
    homeFields.hidden = state.section !== "home";
    textFields.hidden = state.section === "about";
    aboutFields.hidden = state.section !== "about";
    listTools.hidden = state.section === "about";
    field("heading").textContent = state.section === "about" ? "关于" : (state.currentId ? "修改" : "新的一篇");
  }

  function renderList() {
    const root = document.getElementById("results");
    root.replaceChildren();
    if (state.section === "about") {
      document.getElementById("count").textContent = "这一页只有一段联系方式和一段介绍";
      return;
    }
    const items = Site.byDate(listForSection());
    document.getElementById("count").textContent = "这一页 " + items.length + " 篇";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result" + (item.id === state.currentId ? " is-current" : "");
      const title = document.createElement("strong");
      title.textContent = Site.labelOf(item);
      const meta = document.createElement("span");
      meta.textContent = item.date || "";
      button.append(title, meta);
      button.addEventListener("click", () => openItem(item.id));
      root.append(button);
    });
  }

  function renderSearch(query) {
    const root = document.getElementById("search-hits");
    root.replaceChildren();
    const hits = Site.search(state.site, query);
    if (!query.trim()) return;
    const note = document.createElement("p");
    note.className = "count";
    note.textContent = hits.length ? "全部内容里找到 " + hits.length + " 条" : "全部内容里没有找到";
    root.append(note);
    hits.forEach((hit) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result";
      const title = document.createElement("strong");
      title.textContent = hit.title;
      const meta = document.createElement("span");
      meta.textContent = hit.kind;
      button.append(title, meta);
      button.addEventListener("click", () => {
        if (!confirmDiscard()) return;
        state.section = hit.section === "home" ? "home" : (hit.section === "notes" ? "notes" : "about");
        state.currentId = hit.id || null;
        state.dirty = false;
        fillForm();
        field("query").value = "";
        root.replaceChildren();
      });
      root.append(button);
    });
  }

  function fillForm() {
    renderPicker();
    renderList();
    field("remove").disabled = state.section === "about" || !state.currentId;
    field("body-label").textContent = state.section === "home" ? "README" : "正文";
    if (state.section === "about") {
      field("contact").value = state.site.about.contact;
      field("intro").value = state.site.about.intro;
      return;
    }
    const item = listForSection().find((entry) => entry.id === state.currentId) || blank();
    field("title").value = item.title || "";
    field("date").value = item.date || Site.today();
    if (state.section === "home") {
      field("github").value = item.github || "";
      field("body").value = item.readme || "";
      field("body").placeholder = "可以用 Markdown。也可以上传一份 .md，把里面的图片一起选上。";
    } else {
      field("body").value = item.body || "";
      field("body").placeholder = "直接写。换行就是换行，空一行就是新的一段。";
    }
    refreshPreview();
  }

  function refreshPreview() {
    const box = field("md-preview");
    const upload = field("add-md");
    const show = state.section === "home";
    if (upload) upload.hidden = !show;
    if (!box) return;
    box.hidden = !show;
    if (!show) return;
    box.innerHTML = Site.renderMarkdown(field("body").value) || '<p class="empty">预览会显示在这里。</p>';
  }

  function rewriteMarkdown(text, map) {
    return String(text).replace(/(!\[[^\]]*\]\()([^)\s]+)([^)]*\))/g, (all, open, url, rest) => {
      if (/^https?:\/\//i.test(url) || /^media\//.test(url)) return all;
      let clean = url.split("?")[0].split("#")[0].replace(/^<|>$/g, "");
      try { clean = decodeURIComponent(clean); } catch (error) { /* keep the raw path */ }
      const base = (clean.split("/").pop() || "").toLowerCase();
      return map[base] ? open + map[base] + rest : all;
    });
  }

  function openItem(id) {
    if (id === state.currentId) return;
    if (!confirmDiscard()) return;
    state.currentId = id;
    state.dirty = false;
    fillForm();
    setStatus("");
  }

  function readForm() {
    if (state.section === "about") {
      state.site.about.contact = field("contact").value;
      state.site.about.intro = field("intro").value;
      return true;
    }
    const title = field("title").value.trim();
    const date = field("date").value;
    const body = field("body").value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setStatus("日期要选在日历里。", true);
      return false;
    }
    if (state.section === "home") {
      const github = field("github").value.trim();
      if (!title) { setStatus("写个项目名。", true); return false; }
      if (github && !/^https:\/\//.test(github)) { setStatus("GitHub 链接要以 https:// 开头。", true); return false; }
      const item = { id: state.currentId || Site.makeId("project"), title: title, github: github, readme: body, date: date };
      upsert(state.site.projects, item);
      state.currentId = item.id;
      return true;
    }
    if (!title && !body.trim()) { setStatus("写一点内容。", true); return false; }
    const item = { id: state.currentId || Site.makeId("note"), title: title, date: date, body: body };
    upsert(state.site.notes, item);
    state.currentId = item.id;
    return true;
  }

  function upsert(list, item) {
    const index = list.findIndex((entry) => entry.id === item.id);
    if (index >= 0) list[index] = item;
    else list.unshift(item);
  }

  async function persist() {
    const site = Site.normalize(state.site);
    if (local) {
      const response = await fetch("/api/site", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(site)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "没有保存。");
      state.site = data.site;
    } else {
      await RianoAuth.saveSite(site);
      state.site = site;
    }
    state.dirty = false;
    fillForm();
  }

  let lastArea = "body";
  ["body", "contact", "intro"].forEach((id) => {
    field(id).addEventListener("focus", () => { lastArea = id; });
  });

  function insertMedia(src) {
    const area = field(state.section === "about" ? lastArea : "body");
    const start = area.selectionStart == null ? area.value.length : area.selectionStart;
    const end = area.selectionEnd == null ? start : area.selectionEnd;
    const chunk = (area.value.slice(0, start).endsWith("\n\n") || start === 0 ? "" : "\n\n") +
      "![](" + src + ")\n\n";
    area.value = area.value.slice(0, start) + chunk + area.value.slice(end);
    area.focus();
    state.dirty = true;
    refreshPreview();
  }

  async function uploadRaw(file) {
    if (local) {
      const response = await fetch("/api/media?name=" + encodeURIComponent(file.name), {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "没有上传成功。");
      return data.src;
    }
    const data = await RianoAuth.uploadMedia(file);
    return data.src;
  }

  async function upload(file) {
    if (!file) return;
    setStatus("正在上传…");
    insertMedia(await uploadRaw(file));
    setStatus("已插入到光标处。记得保存。");
  }

  async function importMarkdown(files) {
    const list = Array.from(files || []);
    const md = list.find((file) => /\.(md|markdown)$/i.test(file.name));
    if (!md) {
      setStatus("请选择一个 .md 文件。图片和视频可以和它一起选。", true);
      return;
    }
    setStatus("正在读入…");
    let text = await md.text();
    const assets = list.filter((file) => file !== md && /\.(png|jpe?g|gif|webp|mp4|webm|mov)$/i.test(file.name));
    const map = {};
    for (const file of assets) map[file.name.toLowerCase()] = await uploadRaw(file);
    field("body").value = rewriteMarkdown(text, map);
    state.dirty = true;
    refreshPreview();
    setStatus(assets.length ? "已读入 Markdown，图片和视频也放进来了。记得保存。" : "已读入 Markdown。记得保存。");
  }

  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.getAttribute("data-section");
      if (next === state.section) return;
      if (!confirmDiscard()) return;
      state.section = next;
      state.currentId = null;
      state.dirty = false;
      lastArea = next === "about" ? "contact" : "body";
      fillForm();
      setStatus("");
    });
  });

  field("composer").addEventListener("submit", (event) => event.preventDefault());

  field("create").addEventListener("click", () => {
    if (!confirmDiscard()) return;
    state.currentId = null;
    state.dirty = false;
    fillForm();
    field("title").focus();
  });

  ["title", "github", "date", "body", "contact", "intro"].forEach((id) => {
    field(id).addEventListener("input", () => {
      state.dirty = true;
      if (id === "body") refreshPreview();
    });
  });

  field("save").addEventListener("click", () => {
    if (!readForm()) return;
    persist().then(() => setStatus(local ? "已保存在这台电脑。要上网请点发布。" : "已更新。一两分钟后刷新网站就能看到。"))
      .catch((error) => setStatus(error.message, true));
  });

  field("remove").addEventListener("click", () => {
    if (!state.currentId) return;
    if (!window.confirm("确定删除这篇吗？")) return;
    const list = listForSection();
    const index = list.findIndex((item) => item.id === state.currentId);
    if (index >= 0) list.splice(index, 1);
    state.currentId = null;
    state.dirty = true;
    persist().then(() => setStatus("已删除。")).catch((error) => setStatus(error.message, true));
  });

  field("query").addEventListener("input", () => renderSearch(field("query").value));

  field("add-md").addEventListener("click", () => field("md-file").click());
  field("md-file").addEventListener("change", (event) => {
    const files = event.target.files;
    event.target.value = "";
    importMarkdown(files).catch((error) => setStatus(error.message, true));
  });
  field("add-image").addEventListener("click", () => field("image-file").click());
  field("add-video").addEventListener("click", () => field("video-file").click());
  field("image-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    upload(file).catch((error) => setStatus(error.message, true));
  });
  field("video-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    upload(file).catch((error) => setStatus(error.message, true));
  });

  field("publish").addEventListener("click", async () => {
    if (state.dirty && !window.confirm("还有没保存的修改。发布只带已经保存的内容，继续吗？")) return;
    field("publish").disabled = true;
    setStatus("正在发布…");
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "没有发布。");
      setStatus(data.message);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      field("publish").disabled = false;
    }
  });

  field("logout").addEventListener("click", () => {
    if (!local) RianoAuth.logout();
    location.href = "index.html";
  });

  function showGate() {
    gate.hidden = false;
    studio.hidden = true;
    field("login").onclick = () => RianoAuth.startLogin();
  }

  async function boot() {
    if (!local) {
      const phase = await RianoAuth.finishRedirect();
      if (phase === "installing") return;
      if (!RianoAuth.loggedIn()) {
        showGate();
        return;
      }
    }
    showEditor();
    state.site = await Site.load();
    fillForm();
  }

  boot().catch((error) => {
    showGate();
    setStatus(error.message, true);
  });
})();
