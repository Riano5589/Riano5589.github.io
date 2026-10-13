(function () {
  const page = document.body.dataset.page || "";
  const local = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  const authed = local || !!localStorage.getItem("riano-github-app");
  const root = document.getElementById("nav-root");
  if (!root) return;

  const links = [
    ["home", "index.html", "HOME"],
    ["notes", "notes.html", "碎碎念"],
    ["about", "about.html", "关于"],
    ["friends", "friends.html", "友链"]
  ];

  const nav = document.createElement("header");
  nav.className = "nav";
  const brand = document.createElement("a");
  brand.className = "brand";
  brand.href = "index.html";
  brand.innerHTML = '<span class="brand-mark"></span>Riano';
  const menu = document.createElement("nav");
  menu.className = "nav-links";
  menu.setAttribute("aria-label", "站点");
  links.forEach((item) => {
    const link = document.createElement("a");
    link.href = item[1];
    link.textContent = item[2];
    if (item[0] === page) link.className = "is-current";
    link.setAttribute("data-nav", item[1]);
    menu.append(link);
  });
  const edit = document.createElement("a");
  edit.href = "edit.html";
  edit.textContent = authed ? "编辑" : "登录";
  if (page === "edit") edit.className = "is-current";
  menu.append(edit);

  const form = document.createElement("form");
  form.className = "nav-search";
  form.action = "search.html";
  form.method = "get";
  const input = document.createElement("input");
  input.type = "search";
  input.name = "q";
  input.placeholder = "搜索全部内容";
  input.setAttribute("aria-label", "搜索全部内容");
  input.enterKeyHint = "search";
  const params = new URLSearchParams(location.search);
  if (page === "search" && params.get("q")) input.value = params.get("q");
  form.append(input);
  nav.append(brand, menu, form);
  root.replaceWith(nav);
})();
