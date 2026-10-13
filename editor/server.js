const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const siteFile = path.join(root, "data", "site.json");
const mediaDir = path.join(root, "media");
const host = "127.0.0.1";
const port = 8787;
const maxJson = 2 * 1024 * 1024;
const maxMedia = 45 * 1024 * 1024;

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime"
};

const mediaKinds = {
  ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image",
  ".mp4": "video", ".webm": "video", ".mov": "video"
};

fs.mkdirSync(path.dirname(siteFile), { recursive: true });
fs.mkdirSync(mediaDir, { recursive: true });

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
  });
  res.end(body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("too-large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function normalizeSite(data) {
  const site = data && typeof data === "object" ? data : {};
  const about = site.about && typeof site.about === "object" ? site.about : {};
  return {
    about: { contact: String(about.contact || ""), intro: String(about.intro || "") },
    projects: (Array.isArray(site.projects) ? site.projects : []).map(normalizeProject).filter(Boolean),
    notes: (Array.isArray(site.notes) ? site.notes : []).map(normalizeNote).filter(Boolean)
  };
}

function validId(id) { return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id || ""); }

function normalizeProject(item) {
  if (!item || !validId(item.id)) return null;
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
  if (!item || !validId(item.id)) return null;
  return {
    id: item.id,
    title: String(item.title || "").trim(),
    date: String(item.date || ""),
    body: String(item.body || "")
  };
}

function readSite() {
  if (!fs.existsSync(siteFile)) return normalizeSite({});
  return normalizeSite(JSON.parse(fs.readFileSync(siteFile, "utf8")));
}

function writeSite(site) {
  fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + "\n");
}

function runGit(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd: root, windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error((stderr || stdout || "git 失败").trim()));
    });
  });
}

function resolveStatic(requestPath) {
  let rel = decodeURIComponent(requestPath.split("?")[0]).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  if (rel === "editor") rel = "edit.html";
  const file = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) return null;
  if (rel.split(/[\\/]/).includes(".git")) return null;
  return file;
}

function serveStatic(req, res, file) {
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      const missing = path.join(root, "404.html");
      if (fs.existsSync(missing) && file !== missing) return serveStatic(req, res, missing);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("没有这个页面");
      return;
    }
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  try {
    if (req.method === "GET" && url.pathname === "/api/site") {
      return send(res, 200, { site: readSite() });
    }
    if (req.method === "PUT" && url.pathname === "/api/site") {
      const site = normalizeSite(JSON.parse((await readBody(req, maxJson)).toString("utf8") || "{}"));
      writeSite(site);
      return send(res, 200, { site: site });
    }
    if (req.method === "POST" && url.pathname === "/api/media") {
      const ext = path.extname(url.searchParams.get("name") || "").toLowerCase();
      const kind = mediaKinds[ext];
      if (!kind) return send(res, 400, { error: "只能上传 jpg、png、gif、webp、mp4、webm、mov。" });
      const body = await readBody(req, maxMedia);
      if (!body.length) return send(res, 400, { error: "文件是空的。" });
      const now = new Date();
      const filename = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
        String(now.getHours()).padStart(2, "0"),
        String(now.getMinutes()).padStart(2, "0"),
        String(now.getSeconds()).padStart(2, "0")
      ].join("") + "-" + Math.random().toString(36).slice(2, 6) + ext;
      fs.writeFileSync(path.join(mediaDir, filename), body);
      return send(res, 201, { src: "media/" + filename, type: kind });
    }
    if (req.method === "POST" && url.pathname === "/api/publish") {
      await readBody(req, maxJson);
      await runGit(["add", "--", "data/site.json", "media"]);
      const pending = await runGit(["status", "--porcelain", "--", "data/site.json", "media"]);
      if (!pending) return send(res, 200, { ok: true, message: "没有新的改动，不用发布。" });
      await runGit(["commit", "-m", "更新网站内容"]);
      await runGit(["push"]);
      return send(res, 200, { ok: true, message: "已发布。一两分钟后打开 https://riano5589.github.io/ 就能看到。" });
    }
    if (url.pathname.startsWith("/api/")) return send(res, 404, { error: "没有这个接口。" });
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end();
      return;
    }
    const file = resolveStatic(url.pathname);
    if (!file) {
      res.writeHead(403);
      res.end();
      return;
    }
    serveStatic(req, res, file);
  } catch (error) {
    const status = error.status || 500;
    send(res, status, { error: status === 413 ? "文件太大了，单个不超过 45MB。" : (error.message || "没有完成。") });
  }
});

server.listen(port, host, () => {
  const address = "http://" + host + ":" + port + "/edit.html";
  console.log("编辑页：" + address);
  spawn("cmd", ["/c", "start", "", address], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
});
