(function () {
  const page = document.body.dataset.page;
  if (!page || page === "edit") return;

  function empty(text) {
    return '<p class="empty">' + text + "</p>";
  }

  function renderHome(site) {
    const root = document.getElementById("project-list");
    if (!root) return;
    const projects = Site.byDate(site.projects);
    if (!projects.length) {
      root.innerHTML = empty("还没有项目。登录后可以添加。");
      return;
    }
    root.innerHTML = projects.map((item) => {
      const link = item.github
        ? '<p><a class="button" href="' + Site.escapeHtml(item.github) + '" rel="noopener noreferrer">GitHub</a></p>'
        : "";
      return '<article class="panel project" id="project-' + item.id + '">' +
        '<div class="meta"><time>' + Site.formatDate(item.date) + "</time></div>" +
        "<h2>" + Site.escapeHtml(item.title || "未命名项目") + "</h2>" +
        link +
        '<div class="body">' + (Site.renderBody(item.readme) || empty("还没有 README。")) + "</div>" +
        "</article>";
    }).join("");
  }

  function renderNotes(site) {
    const root = document.getElementById("note-list");
    if (!root) return;
    const notes = Site.byDate(site.notes);
    if (!notes.length) {
      root.innerHTML = empty("还没有碎碎念。登录后可以写。");
      return;
    }
    root.innerHTML = notes.map((item) => (
      '<article class="panel" id="note-' + item.id + '">' +
        '<div class="meta"><time>' + Site.formatDate(item.date) + "</time></div>" +
        "<h2>" + Site.escapeHtml(Site.labelOf(item)) + "</h2>" +
        '<div class="body">' + Site.renderBody(item.body) + "</div>" +
      "</article>"
    )).join("");
  }

  function renderAbout(site) {
    const contact = document.getElementById("about-contact");
    const intro = document.getElementById("about-intro");
    if (contact) contact.innerHTML = Site.renderBody(site.about.contact) || empty("还没写。登录后可以补上。");
    if (intro) intro.innerHTML = Site.renderBody(site.about.intro) || empty("还没写。登录后可以补上。");
  }

  function renderSearch(site) {
    const root = document.getElementById("search-results");
    const q = new URLSearchParams(location.search).get("q") || "";
    const title = document.getElementById("search-title");
    if (title) title.textContent = q ? "「" + q + "」" : "搜索";
    if (!root) return;
    if (!q.trim()) {
      root.innerHTML = empty("输入关键词，搜索项目、碎碎念和关于。");
      return;
    }
    const hits = Site.search(site, q);
    if (!hits.length) {
      root.innerHTML = empty("没有找到相关内容。");
      return;
    }
    root.innerHTML = hits.map((hit) => (
      '<a class="post-card" href="' + hit.href + '">' +
        '<div class="meta"><span class="cat">' + hit.kind + "</span></div>" +
        "<h2>" + Site.escapeHtml(hit.title) + "</h2>" +
      "</a>"
    )).join("");
  }

  Site.load().then((site) => {
    if (page === "home") renderHome(site);
    if (page === "notes") renderNotes(site);
    if (page === "about") renderAbout(site);
    if (page === "search") renderSearch(site);
  }).catch(() => {
    const main = document.getElementById("main");
    if (main) main.insertAdjacentHTML("beforeend", empty("内容没有加载出来。"));
  });
})();
