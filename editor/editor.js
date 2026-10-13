(function () {
  const state = {
    posts: [],
    currentId: null,
    draft: blankDraft(),
    dirty: false
  };

  const query = document.getElementById("query");
  const results = document.getElementById("results");
  const count = document.getElementById("count");
  const heading = document.getElementById("heading");
  const status = document.getElementById("status");
  const fields = {
    title: document.getElementById("title"),
    category: document.getElementById("category"),
    date: document.getElementById("date"),
    excerpt: document.getElementById("excerpt")
  };

  function today() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function blankDraft() {
    return {
      id: "",
      title: "",
      category: "碎碎念",
      date: today(),
      excerpt: "",
      blocks: [{ type: "text", text: "" }]
    };
  }

  function setStatus(message, isError) {
    status.textContent = message || "";
    status.classList.toggle("is-error", Boolean(isError));
  }

  async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "没有完成。");
    return data;
  }

  async function load() {
    const q = query.value.trim();
    const data = await api("/api/posts?q=" + encodeURIComponent(q));
    state.posts = data.posts;
    renderList();
  }

  function renderList() {
    results.replaceChildren();
    count.textContent = "找到 " + state.posts.length + " 篇";
    state.posts.forEach((post) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "result" + (post.id === state.currentId ? " is-current" : "");
      const title = document.createElement("strong");
      title.textContent = post.title;
      const meta = document.createElement("span");
      meta.textContent = post.category + " · " + post.date;
      button.append(title, meta);
      button.addEventListener("click", () => openPost(post.id));
      results.append(button);
    });
  }

  function confirmDiscard() {
    if (!state.dirty) return true;
    return window.confirm("这篇还有没保存的修改，确定离开吗？");
  }

  async function openPost(id) {
    if (id === state.currentId) return;
    if (!confirmDiscard()) return;
    const data = await api("/api/posts/" + encodeURIComponent(id));
    state.currentId = data.post.id;
    state.draft = data.post;
    state.dirty = false;
    fillForm();
    renderList();
    setStatus("");
  }

  function fillForm() {
    heading.textContent = state.currentId ? "修改这篇" : "新建碎碎念";
    fields.title.value = state.draft.title;
    fields.category.value = state.draft.category;
    fields.date.value = state.draft.date;
    fields.excerpt.value = state.draft.excerpt;
    document.getElementById("remove").disabled = !state.currentId;
    renderBlocks();
  }

  function renderBlocks() {
    const root = document.getElementById("blocks");
    root.replaceChildren();
    state.draft.blocks.forEach((block, index) => {
      const card = document.createElement("div");
      card.className = "block";
      const head = document.createElement("div");
      head.className = "block-head";
      const name = document.createElement("span");
      name.textContent = block.type === "text" ? "文字" : (block.type === "video" ? "视频" : "图片 / GIF");
      const actions = document.createElement("div");
      actions.className = "block-actions";
      actions.append(
        smallButton("上移", index === 0, () => moveBlock(index, -1)),
        smallButton("下移", index === state.draft.blocks.length - 1, () => moveBlock(index, 1)),
        smallButton("删除这段", false, () => removeBlock(index))
      );
      head.append(name, actions);
      card.append(head);

      if (block.type === "text") {
        const area = document.createElement("textarea");
        area.value = block.text;
        area.placeholder = "写下这一段";
        area.addEventListener("input", () => {
          block.text = area.value;
          state.dirty = true;
        });
        card.append(area);
      } else if (block.type === "image") {
        const image = document.createElement("img");
        image.src = "/" + block.src;
        image.alt = block.alt || "";
        const alt = document.createElement("input");
        alt.type = "text";
        alt.placeholder = "图片说明，可以留空";
        alt.value = block.alt || "";
        alt.addEventListener("input", () => {
          block.alt = alt.value;
          state.dirty = true;
        });
        card.append(image, alt);
      } else {
        const video = document.createElement("video");
        video.controls = true;
        video.playsInline = true;
        video.src = "/" + block.src;
        card.append(video);
      }
      root.append(card);
    });
  }

  function smallButton(label, disabled, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tool-btn";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", onClick);
    return button;
  }

  function moveBlock(index, step) {
    const next = index + step;
    const blocks = state.draft.blocks;
    const [item] = blocks.splice(index, 1);
    blocks.splice(next, 0, item);
    state.dirty = true;
    renderBlocks();
  }

  function removeBlock(index) {
    const block = state.draft.blocks[index];
    state.draft.blocks.splice(index, 1);
    if (!state.draft.blocks.length) state.draft.blocks.push({ type: "text", text: "" });
    state.dirty = true;
    renderBlocks();
    if (block && block.src && !state.draft.blocks.some((item) => item.src === block.src)) {
      api("/api/media?src=" + encodeURIComponent(block.src), { method: "DELETE" }).catch(() => {});
    }
  }

  function readForm() {
    state.draft.title = fields.title.value.trim();
    state.draft.category = fields.category.value.trim() || "碎碎念";
    state.draft.date = fields.date.value;
    state.draft.excerpt = fields.excerpt.value.trim();
    state.draft.blocks = state.draft.blocks.filter((block) => {
      if (block.type === "text") return block.text.trim();
      return Boolean(block.src);
    });
  }

  async function save() {
    readForm();
    if (!state.draft.blocks.length) state.draft.blocks = [{ type: "text", text: "" }];
    const creating = !state.currentId;
    const url = creating ? "/api/posts" : "/api/posts/" + encodeURIComponent(state.currentId);
    const data = await api(url, {
      method: creating ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.draft)
    });
    state.currentId = data.post.id;
    state.draft = data.post;
    state.dirty = false;
    fillForm();
    await load();
    setStatus("已保存。本机网站刷新后就能看到。");
  }

  async function removePost() {
    if (!state.currentId) return;
    if (!window.confirm("确定删除「" + state.draft.title + "」吗？里面单独使用的图片和视频也会一起删掉。")) return;
    await api("/api/posts/" + encodeURIComponent(state.currentId), { method: "DELETE" });
    state.currentId = null;
    state.draft = blankDraft();
    state.dirty = false;
    fillForm();
    await load();
    setStatus("已删除。");
  }

  async function upload(file, expected) {
    if (!file) return;
    const limit = 45 * 1024 * 1024;
    if (file.size > limit) {
      setStatus("文件太大了，单个不超过 45MB。", true);
      return;
    }
    setStatus("正在上传…");
    const data = await api("/api/media?name=" + encodeURIComponent(file.name), {
      method: "POST",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    if (expected === "image" && data.type !== "image") throw new Error("这不是图片或 GIF。");
    if (expected === "video" && data.type !== "video") throw new Error("这不是视频。");
    const block = { type: data.type, src: data.src };
    if (data.type === "image") block.alt = "";
    state.draft.blocks.push(block);
    state.dirty = true;
    renderBlocks();
    setStatus(data.type === "video" ? "视频已放进这篇。" : "图片已放进这篇。记得点保存。");
  }

  document.getElementById("create").addEventListener("click", () => {
    if (!confirmDiscard()) return;
    state.currentId = null;
    state.draft = blankDraft();
    state.dirty = false;
    fillForm();
    renderList();
    setStatus("");
    fields.title.focus();
  });

  document.getElementById("save").addEventListener("click", () => {
    save().catch((error) => setStatus(error.message, true));
  });

  document.getElementById("remove").addEventListener("click", () => {
    removePost().catch((error) => setStatus(error.message, true));
  });

  document.getElementById("add-text").addEventListener("click", () => {
    state.draft.blocks.push({ type: "text", text: "" });
    state.dirty = true;
    renderBlocks();
  });

  document.getElementById("add-image").addEventListener("click", () => {
    document.getElementById("image-file").click();
  });

  document.getElementById("add-video").addEventListener("click", () => {
    document.getElementById("video-file").click();
  });

  document.getElementById("image-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    upload(file, "image").catch((error) => setStatus(error.message, true));
  });

  document.getElementById("video-file").addEventListener("change", (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    upload(file, "video").catch((error) => setStatus(error.message, true));
  });

  query.addEventListener("input", () => {
    load().catch((error) => setStatus(error.message, true));
  });

  Object.values(fields).forEach((field) => {
    field.addEventListener("input", () => { state.dirty = true; });
  });

  document.getElementById("publish").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    if (state.dirty && !window.confirm("还有没保存的内容。发布只会带上已经保存的部分，继续吗？")) return;
    button.disabled = true;
    setStatus("正在发布…");
    try {
      const title = state.draft.title ? "更新碎碎念：" + state.draft.title : "更新碎碎念";
      const data = await api("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: title })
      });
      setStatus(data.message);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });

  fillForm();
  load().catch((error) => setStatus(error.message, true));
})();
