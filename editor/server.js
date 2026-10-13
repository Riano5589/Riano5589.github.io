const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const postsFile = path.join(root, "data", "posts.json");
const postsJs = path.join(root, "js", "posts.js");
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
  ".mov": "video/quicktime",
  ".bat": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

const mediaKinds = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".mp4": "video",
  ".webm": "video",
  ".mov": "video"
};

fs.mkdirSync(path.dirname(postsFile), { recursive: true });
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

function readPosts() {
  if (!fs.existsSync(postsFile)) return [];
  const data = JSON.parse(fs.readFileSync(postsFile, "utf8"));
  return Array.isArray(data) ? data.map(normalizePost) : [];
}

function writePosts(posts) {
  const json = JSON.stringify(posts, null, 2) + "\n";
  const js = "/* 由写作台自动生成，请在本机写作台里修改。 */\nwindow.POSTS = " +
    JSON.stringify(posts, null, 2) + ";\n";
  fs.writeFileSync(postsFile, json);
  fs.writeFileSync(postsJs, js);
}

function normalizePost(post) {
  const blocks = Array.isArray(post.blocks) && post.blocks.length
    ? post.blocks
    : (post.paragraphs || []).map((text) => ({ type: "text", text }));
  return {
    id: String(post.id || "").trim(),
    title: String(post.title || "").trim(),
    category: String(post.category || "碎碎念").trim() || "碎碎念",
    date: String(post.date || "").trim(),
    excerpt: String(post.excerpt || "").trim(),
    blocks: blocks.map(normalizeBlock).filter(Boolean)
  };
}

function normalizeBlock(block) {
  if (!block || typeof block !== "object") return null;
  if (block.type === "text") {
    return { type: "text", text: String(block.text || "") };
  }
  if ((block.type === "image" || block.type === "video") && safeMediaSrc(block.src)) {
    const next = { type: block.type, src: block.src };
    if (block.type === "image" && block.alt) next.alt = String(block.alt).slice(0, 200);
    return next;
  }
  return null;
}

function safeMediaSrc(src) {
  return typeof src === "string" && /^media\/[a-zA-Z0-9._-]+$/.test(src);
}

function mediaPath(src) {
  if (!safeMediaSrc(src)) return null;
  const file = path.resolve(root, src);
  if (file !== path.resolve(mediaDir) && !file.startsWith(path.resolve(mediaDir) + path.sep)) return null;
  return file;
}

function validate(post, posts, previousId) {
  if (!post.title) return "写个标题。";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return "日期要写成 2026-10-13 这样。";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.id)) return "编号只能用小写英文、数字和短横线。";
  if (posts.some((item) => item.id === post.id && item.id !== previousId)) return "这个编号已经有了，换一个。";
  const meaningful = post.blocks.some((block) => block.type !== "text" || block.text.trim());
  if (!meaningful) return "写一点内容，或放上一张图片、一段视频。";
  if (!post.excerpt) {
    const first = post.blocks.find((block) => block.type === "text" && block.text.trim());
    post.excerpt = first ? first.text.trim().slice(0, 80) : post.title;
  }
  return "";
}

function usedSources(posts) {
  const used = new Set();
  posts.forEach((post) => post.blocks.forEach((block) => {
    if (block.src) used.add(block.src);
  }));
  return used;
}

function removeUnused(before, after) {
  const still = usedSources(after);
  before.forEach((src) => {
    if (still.has(src)) return;
    const file = mediaPath(src);
    if (file && fs.existsSync(file)) fs.unlinkSync(file);
  });
}

function sourcesOf(post) {
  if (!post) return [];
  return post.blocks.map((block) => block.src).filter(Boolean);
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
  const decoded = decodeURIComponent(requestPath.split("?")[0]);
  let rel = decoded.replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  if (rel === "editor") rel = "editor/index.html";
  const file = path.resolve(root, rel);
  const rootResolved = path.resolve(root);
  if (file !== rootResolved && !file.startsWith(rootResolved + path.sep)) return null;
  if (rel.split("/").includes(".git")) return null;
  return file;
}

function serveStatic(req, res, file) {
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("没有这个页面");
      return;
    }
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    const range = req.headers.range;
    if (range && type.startsWith("video/")) {
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      if (!match) {
        res.writeHead(416);
        res.end();
        return;
      }
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (start >= stat.size || end >= stat.size) {
        res.writeHead(416);
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": "bytes " + start + "-" + end + "/" + stat.size,
        "Accept-Ranges": "bytes"
      });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store"
    });
    fs.createReadStream(file).pipe(res);
  });
}

async function handleApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);

  if (req.method === "GET" && url.pathname === "/api/posts") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    let posts = readPosts();
    if (q) {
      posts = posts.filter((post) => {
        const hay = [post.title, post.category, post.excerpt, post.date, post.id]
          .concat(post.blocks.map((block) => block.text || block.alt || ""))
          .join("\n")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    send(res, 200, { posts });
    return;
  }

  if (req.method === "GET" && parts[0] === "api" && parts[1] === "posts" && parts[2]) {
    const post = readPosts().find((item) => item.id === parts[2]);
    if (!post) return send(res, 404, { error: "没有找到这篇。" });
    send(res, 200, { post });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/posts") {
    const incoming = normalizePost(JSON.parse((await readBody(req, maxJson)).toString("utf8") || "{}"));
    if (!incoming.id) incoming.id = makeId(incoming.date);
    const posts = readPosts();
    const problem = validate(incoming, posts, "");
    if (problem) return send(res, 400, { error: problem });
    posts.unshift(incoming);
    writePosts(posts);
    send(res, 201, { post: incoming });
    return;
  }

  if (req.method === "PUT" && parts[0] === "api" && parts[1] === "posts" && parts[2]) {
    const incoming = normalizePost(JSON.parse((await readBody(req, maxJson)).toString("utf8") || "{}"));
    const posts = readPosts();
    const index = posts.findIndex((item) => item.id === parts[2]);
    if (index < 0) return send(res, 404, { error: "没有找到这篇。" });
    if (!incoming.id) incoming.id = parts[2];
    const problem = validate(incoming, posts, parts[2]);
    if (problem) return send(res, 400, { error: problem });
    const previous = sourcesOf(posts[index]);
    posts[index] = incoming;
    removeUnused(previous, posts);
    writePosts(posts);
    send(res, 200, { post: incoming });
    return;
  }

  if (req.method === "DELETE" && parts[0] === "api" && parts[1] === "posts" && parts[2]) {
    const posts = readPosts();
    const index = posts.findIndex((item) => item.id === parts[2]);
    if (index < 0) return send(res, 404, { error: "没有找到这篇。" });
    const previous = sourcesOf(posts[index]);
    posts.splice(index, 1);
    removeUnused(previous, posts);
    writePosts(posts);
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/media") {
    const ext = path.extname(url.searchParams.get("name") || "").toLowerCase();
    const kind = mediaKinds[ext];
    if (!kind) return send(res, 400, { error: "只能上传 jpg、png、gif、webp、mp4、webm、mov。" });
    const body = await readBody(req, maxMedia);
    if (!body.length) return send(res, 400, { error: "文件是空的。" });
    const filename = makeMediaName(ext);
    fs.writeFileSync(path.join(mediaDir, filename), body);
    send(res, 201, { src: "media/" + filename, type: kind });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/media") {
    const src = url.searchParams.get("src") || "";
    const file = mediaPath(src);
    if (!file) return send(res, 400, { error: "不能删除这个文件。" });
    if (usedSources(readPosts()).has(src)) return send(res, 200, { ok: true, kept: true });
    if (fs.existsSync(file)) fs.unlinkSync(file);
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/publish") {
    const payload = JSON.parse((await readBody(req, maxJson)).toString("utf8") || "{}");
    const message = String(payload.message || "更新碎碎念").replace(/[\r\n]+/g, " ").slice(0, 120);
    await runGit(["add", "--", "data/posts.json", "js/posts.js", "media"]);
    const pending = await runGit(["status", "--porcelain", "--", "data/posts.json", "js/posts.js", "media"]);
    if (!pending) return send(res, 200, { ok: true, message: "没有新的改动，不用发布。" });
    await runGit(["commit", "-m", message]);
    await runGit(["push"]);
    send(res, 200, { ok: true, message: "已发布。一两分钟后打开 https://riano5589.github.io/ 就能看到。" });
    return;
  }

  send(res, 404, { error: "没有这个接口。" });
}

function makeId(date) {
  const compact = (date || "note").replace(/-/g, "");
  return "note-" + compact + "-" + Math.random().toString(36).slice(2, 6);
}

function makeMediaName(ext) {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0")
  ].join("");
  return stamp + "-" + Math.random().toString(36).slice(2, 6) + ext;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
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
    send(res, status, { error: status === 413 ? "文件太大了，单个不超过 45MB。" : (error.message || "保存失败。") });
  }
});

server.listen(port, host, () => {
  const address = "http://" + host + ":" + port + "/editor/";
  console.log("写作台已打开：" + address);
  spawn("cmd", ["/c", "start", "", address], { windowsHide: true, detached: true, stdio: "ignore" }).unref();
});
