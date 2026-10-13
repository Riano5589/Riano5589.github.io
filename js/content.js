(function () {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatDate(value) {
    const parts = String(value || "").split("-");
    if (parts.length !== 3) return value || "";
    return parts[0] + "年" + Number(parts[1]) + "月" + Number(parts[2]) + "日";
  }

  function today() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return now.getFullYear() + "-" + month + "-" + day;
  }

  function makeId(prefix) {
    return prefix + "-" + today().replace(/-/g, "") + "-" + Math.random().toString(36).slice(2, 6);
  }

  function normalize(data) {
    const site = data && typeof data === "object" ? data : {};
    const about = site.about && typeof site.about === "object" ? site.about : {};
    return {
      about: {
        contact: String(about.contact || ""),
        intro: String(about.intro || "")
      },
      projects: (Array.isArray(site.projects) ? site.projects : []).map(normalizeProject).filter(Boolean),
      notes: (Array.isArray(site.notes) ? site.notes : []).map(normalizeNote).filter(Boolean)
    };
  }

  function normalizeProject(item) {
    if (!item || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "")) return null;
    const github = String(item.github || "").trim();
    return {
      id: item.id,
      title: String(item.title || "").trim(),
      github: /^https:\/\//.test(github) ? github : "",
      readme: String(item.readme || ""),
      date: String(item.date || "")
    };
  }

  function normalizeNote(item) {
    if (!item || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id || "")) return null;
    return {
      id: item.id,
      title: String(item.title || "").trim(),
      date: String(item.date || ""),
      body: String(item.body || "")
    };
  }

  function byDate(list) {
    return list.slice().sort((a, b) => {
      if (a.date === b.date) return 0;
      return a.date < b.date ? 1 : -1;
    });
  }

  function safeSrc(url) {
    const clean = String(url || "").trim().replace(/^<|>$/g, "");
    if (/^media\/[a-zA-Z0-9._-]+$/.test(clean)) return clean;
    if (/^https:\/\/[^\s)]+$/.test(clean)) return clean;
    return "";
  }

  function mediaTag(src, alt) {
    const safe = safeSrc(src);
    if (!safe) return "";
    if (/\.(mp4|webm|mov)$/i.test(safe)) {
      return '<video class="media" controls playsinline src="' + escapeHtml(safe) + '"></video>';
    }
    return '<img class="media" src="' + escapeHtml(safe) + '" alt="' + escapeHtml(alt || "") + '">';
  }

  function renderInline(text) {
    const pattern = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let html = "";
    let last = 0;
    let match;
    while ((match = pattern.exec(text))) {
      html += escapeHtml(text.slice(last, match.index)).replace(/\n/g, "<br>");
      if (match[2]) html += mediaTag(match[2], match[1]);
      else html += '<a href="' + escapeHtml(match[4]) + '" rel="noopener noreferrer">' + escapeHtml(match[3]) + "</a>";
      last = match.index + match[0].length;
    }
    html += escapeHtml(text.slice(last)).replace(/\n/g, "<br>");
    return html;
  }

  function safeHref(url) {
    const clean = String(url || "").trim().replace(/^<|>$/g, "");
    if (/^https:\/\/[^\s]+$/i.test(clean)) return clean;
    if (/^mailto:[^\s]+$/i.test(clean)) return clean;
    if (/^media\/[a-zA-Z0-9._-]+$/.test(clean)) return clean;
    if (/^#[A-Za-z0-9._:-]*$/.test(clean)) return clean;
    return "";
  }

  function sanitizeHtml(html) {
    if (typeof document === "undefined") return html;
    const root = document.createElement("div");
    root.innerHTML = html;
    root.querySelectorAll("script,style,iframe,object,embed,form,link,meta,base,svg").forEach((node) => node.remove());
    root.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        if (name.startsWith("on") || name === "srcdoc" || name === "style") {
          node.removeAttribute(attr.name);
          return;
        }
        if ((name === "href" || name === "src") && !safeHref(value) && !safeSrc(value)) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return root.innerHTML;
  }

  let markdownReady = false;

  function ensureMarkdown() {
    if (markdownReady || !window.marked || !window.marked.use) return;
    window.marked.use({
      gfm: true,
      breaks: false,
      renderer: {
        html({ text }) {
          return escapeHtml(text);
        },
        image({ href, text }) {
          return mediaTag(href, text) || escapeHtml(text || "");
        },
        link({ href, title, tokens }) {
          const label = this.parser.parseInline(tokens);
          const safe = safeHref(href);
          if (!safe) return label;
          const titleAttr = title ? ' title="' + escapeHtml(title) + '"' : "";
          return '<a href="' + escapeHtml(safe) + '"' + titleAttr + ' rel="noopener noreferrer">' + label + "</a>";
        }
      }
    });
    markdownReady = true;
  }

  function renderMarkdown(source) {
    ensureMarkdown();
    if (!window.marked || !window.marked.parse) return "";
    return sanitizeHtml(window.marked.parse(String(source || ""), { gfm: true, breaks: false }));
  }

  function renderBody(text) {
    const source = String(text || "").trim();
    if (!source) return "";
    return source.split(/\n{2,}/).map((part) => {
      const inner = renderInline(part.trim());
      return inner ? '<div class="para">' + inner + "</div>" : "";
    }).join("");
  }

  function preview(text) {
    const plain = String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#>*_`|-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return plain.length > 90 ? plain.slice(0, 90) + "…" : plain;
  }

  function labelOf(item) {
    return item.title || preview(item.readme || item.body || item.contact || "") || "未命名";
  }

  function search(site, query) {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return [];
    const hits = [];
    byDate(site.projects).forEach((item) => {
      const hay = [item.title, item.github, item.readme].join("\n").toLowerCase();
      if (hay.includes(q)) hits.push({ section: "home", id: item.id, kind: "HOME", title: labelOf(item), href: "read.html?kind=project&id=" + encodeURIComponent(item.id) });
    });
    byDate(site.notes).forEach((item) => {
      const hay = [item.title, item.body].join("\n").toLowerCase();
      if (hay.includes(q)) hits.push({ section: "notes", id: item.id, kind: "碎碎念", title: labelOf(item), href: "read.html?kind=note&id=" + encodeURIComponent(item.id) });
    });
    const aboutHay = [site.about.contact, site.about.intro].join("\n").toLowerCase();
    if (aboutHay.includes(q)) hits.push({ section: "about", id: "", kind: "关于", title: "关于", href: "about.html" });
    return hits;
  }

  async function load() {
    const response = await fetch("data/site.json", { cache: "no-store" });
    if (!response.ok) throw new Error("没有读到网站内容");
    return normalize(await response.json());
  }

  window.Site = {
    escapeHtml: escapeHtml,
    formatDate: formatDate,
    today: today,
    makeId: makeId,
    normalize: normalize,
    byDate: byDate,
    renderBody: renderBody,
    renderMarkdown: renderMarkdown,
    preview: preview,
    labelOf: labelOf,
    search: search,
    load: load
  };
})();
