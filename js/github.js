(function () {
  const REPO = "Riano5589/Riano5589.github.io";
  const OWNER = "Riano5589";
  const STORAGE = "riano-github-app";
  let cachedToken = "";
  let tokenExpires = 0;

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE) || "null"); }
    catch (error) { return null; }
  }

  function writeStore(value) {
    localStorage.setItem(STORAGE, JSON.stringify(value));
  }

  function clearStore() {
    localStorage.removeItem(STORAGE);
    cachedToken = "";
    tokenExpires = 0;
  }

  function base64url(input) {
    const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
    let binary = "";
    bytes.forEach((item) => { binary += String.fromCharCode(item); });
    return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  }

  function appJwt(appId, pem) {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." +
      base64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: String(appId) }));
    const key = forge.pki.privateKeyFromPem(pem);
    const digest = forge.md.sha256.create();
    digest.update(unsigned, "utf8");
    const signature = key.sign(digest);
    const bytes = Uint8Array.from(signature, (char) => char.charCodeAt(0));
    return unsigned + "." + base64url(bytes);
  }

  async function github(url, token, options) {
    const headers = Object.assign({
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }, (options && options.headers) || {});
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(url, {
      method: (options && options.method) || "GET",
      headers: headers,
      body: options && options.body
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); }
      catch (error) { data = { message: text }; }
    }
    if (!response.ok) throw new Error(data.message || "GitHub 没有完成这个请求");
    return data;
  }

  async function installationToken(store) {
    if (cachedToken && Date.now() < tokenExpires) return cachedToken;
    const jwt = appJwt(store.id, store.pem);
    let installationId = store.installationId;
    if (!installationId) {
      const list = await github("https://api.github.com/app/installations", jwt);
      const mine = (Array.isArray(list) ? list : []).find((item) => item.account && item.account.login === OWNER);
      if (!mine) throw new Error("还没有把应用安装到 " + OWNER + "。");
      installationId = mine.id;
      store.installationId = installationId;
      writeStore(store);
    }
    const token = await github(
      "https://api.github.com/app/installations/" + installationId + "/access_tokens",
      jwt,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repositories: [REPO.split("/")[1]] })
      }
    );
    cachedToken = token.token;
    tokenExpires = Date.now() + 45 * 60 * 1000;
    return cachedToken;
  }

  async function putFile(path, contentBase64, message) {
    const store = readStore();
    if (!store || !store.pem) throw new Error("请先用 GitHub 登录。");
    const token = await installationToken(store);
    const endpoint = "https://api.github.com/repos/" + REPO + "/contents/" + path;
    let sha = "";
    try {
      const current = await github(endpoint, token);
      sha = current.sha;
    } catch (error) {
      if (!/not found/i.test(error.message)) throw error;
    }
    const body = { message: message, content: contentBase64 };
    if (sha) body.sha = sha;
    await github(endpoint, token, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  }

  function textToBase64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    bytes.forEach((item) => { binary += String.fromCharCode(item); });
    return btoa(binary);
  }

  async function saveSite(site) {
    await putFile("data/site.json", textToBase64(JSON.stringify(site, null, 2) + "\n"), "更新网站内容");
  }

  async function uploadMedia(file) {
    const ext = (file.name.match(/\.[a-zA-Z0-9]+$/) || [""])[0].toLowerCase();
    const allowed = { ".jpg": "image", ".jpeg": "image", ".png": "image", ".gif": "image", ".webp": "image", ".mp4": "video", ".webm": "video", ".mov": "video" };
    if (!allowed[ext]) throw new Error("只能上传 jpg、png、gif、webp、mp4、webm、mov。");
    if (file.size > 45 * 1024 * 1024) throw new Error("文件太大了，单个不超过 45MB。");
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("没有读到文件。"));
      reader.readAsDataURL(file);
    });
    const content = dataUrl.split(",")[1];
    const stamp = new Date();
    const name = [
      stamp.getFullYear(),
      String(stamp.getMonth() + 1).padStart(2, "0"),
      String(stamp.getDate()).padStart(2, "0"),
      String(stamp.getHours()).padStart(2, "0"),
      String(stamp.getMinutes()).padStart(2, "0"),
      String(stamp.getSeconds()).padStart(2, "0")
    ].join("") + "-" + Math.random().toString(36).slice(2, 6) + ext;
    await putFile("media/" + name, content, "上传 " + name);
    return { src: "media/" + name, type: allowed[ext] };
  }

  function startLogin() {
    const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    sessionStorage.setItem("riano-oauth-state", state);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "https://github.com/settings/apps/new?state=" + encodeURIComponent(state);
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = "manifest";
    input.value = JSON.stringify({
      name: "Riano Site",
      url: "https://riano5589.github.io/",
      redirect_url: "https://riano5589.github.io/edit.html",
      setup_url: "https://riano5589.github.io/edit.html",
      callback_urls: ["https://riano5589.github.io/edit.html"],
      public: false,
      default_permissions: { contents: "write" },
      request_oauth_on_install: false,
      description: "只用来编辑 Riano 的个人网站"
    });
    form.append(input);
    document.body.append(form);
    form.submit();
  }

  async function finishRedirect() {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const installationId = params.get("installation_id");
    if (installationId) {
      const store = readStore() || {};
      store.installationId = Number(installationId);
      writeStore(store);
      history.replaceState({}, "", "edit.html");
      return "installed";
    }
    if (!code) return "";
    const expected = sessionStorage.getItem("riano-oauth-state");
    if (expected && params.get("state") && params.get("state") !== expected) {
      throw new Error("登录状态对不上，请再试一次。");
    }
    const created = await github("https://api.github.com/app-manifests/" + encodeURIComponent(code) + "/conversions", "", { method: "POST" });
    writeStore({
      id: created.id,
      slug: created.slug,
      pem: created.pem
    });
    sessionStorage.removeItem("riano-oauth-state");
    location.replace("https://github.com/apps/" + created.slug + "/installations/new");
    return "installing";
  }

  window.RianoAuth = {
    loggedIn: function () { return !!readStore(); },
    logout: clearStore,
    startLogin: startLogin,
    finishRedirect: finishRedirect,
    saveSite: saveSite,
    uploadMedia: uploadMedia
  };
})();
