(function () {
  const posts = (window.POSTS || []).slice().sort((a, b) => {
    if (a.date === b.date) return 0;
    return a.date < b.date ? 1 : -1;
  });

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    const [year, month, day] = value.split("-");
    return year + "年" + Number(month) + "月" + Number(day) + "日";
  }

  function currentNav() {
    const file = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    const key = file === "" || file === "index.html" || file === "post.html" ? "index.html" : file;
    document.querySelectorAll("[data-nav]").forEach((link) => {
      if (link.getAttribute("data-nav") === key) link.classList.add("is-current");
    });
  }

  function renderList() {
    const root = document.getElementById("post-list");
    if (!root) return;
    if (!posts.length) {
      root.innerHTML = '<p class="empty">还没有碎碎念。打开 js/posts.js 写下第一篇。</p>';
      return;
    }
    root.innerHTML = posts.map((post) => (
      '<a class="post-card" href="post.html?id=' + encodeURIComponent(post.id) + '">' +
        '<div class="meta"><span class="cat">' + escapeHtml(post.category) + '</span><time>' + formatDate(post.date) + '</time></div>' +
        '<h2>' + escapeHtml(post.title) + '</h2>' +
        '<p class="excerpt">' + escapeHtml(post.excerpt) + '</p>' +
      '</a>'
    )).join("");
  }

  function renderPost() {
    const root = document.getElementById("article");
    if (!root) return;
    const id = new URLSearchParams(location.search).get("id");
    const post = posts.find((item) => item.id === id);
    if (!post) {
      document.title = "没有找到这篇 · Riano";
      root.innerHTML = '<a class="back" href="index.html">← 回到碎碎念</a><h1>没有找到这篇</h1><p class="excerpt">链接可能写错了，或者这篇已经被拿掉。</p>';
      return;
    }
    document.title = post.title + " · Riano";
    root.innerHTML =
      '<a class="back" href="index.html">← 回到碎碎念</a>' +
      '<div class="meta"><span class="cat">' + escapeHtml(post.category) + '</span><time>' + formatDate(post.date) + '</time></div>' +
      '<h1>' + escapeHtml(post.title) + '</h1>' +
      '<div class="body">' + post.paragraphs.map((paragraph) => '<p>' + escapeHtml(paragraph) + '</p>').join("") + '</div>';
  }

  function renderQuote() {
    const node = document.getElementById("quote");
    if (!node) return;
    const local = [
      "星星在，句子也可以在。",
      "今天先写一句，明天再补也没关系。",
      "短一点也好，只要是自己的。"
    ];
    node.textContent = local[Math.floor(Math.random() * local.length)];
    fetch("https://v1.hitokoto.cn/?c=d&c=i&c=k")
      .then((response) => response.json())
      .then((data) => {
        if (data && data.hitokoto) node.textContent = data.hitokoto;
      })
      .catch(() => {});
  }

  currentNav();
  renderList();
  renderPost();
  renderQuote();
})();
