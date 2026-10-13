# Riano

星空背景的个人网站。页面、文章和图片都以这个仓库为准，GitHub Pages 直接从 `main` 分支发布。

线上地址：https://riano5589.github.io/

仓库地址：https://github.com/Riano5589/Riano5589.github.io

## 页面

| 页面 | 地址 | 做什么 |
| --- | --- | --- |
| HOME | `/` | 项目卡片。每篇有标题、日期、README 摘要，可以带 GitHub 链接 |
| 阅读 | `/read.html?kind=project&id=…` 或 `kind=note` | 点进一篇后的全文。项目 README 按 GitHub 风格 Markdown 显示，右上角可以全屏 |
| 碎碎念 | `/notes.html` | 短记。空行分段，单行换行 |
| 关于 | `/about.html` | 联系方式和介绍，登录后自己写 |
| 友链 | `/friends.html` | 朋友站点。名单在 `js/friends.js`，只接受 `https` 链接 |
| 搜索 | `/search.html?q=` | 按关键词搜项目、碎碎念和关于 |
| 编辑 | `/edit.html` | 新建、修改、删除、上传 |

手机浏览器打开线上地址即可。需要的话可以加到主屏幕。

## 内容放在哪里

网站没有数据库。读者看到的文字来自 `data/site.json`：

- `projects`：HOME 上的项目。字段是 `id`、`title`、`github`、`readme`、`date`
- `notes`：碎碎念。字段是 `id`、`title`、`date`、`body`
- `about.contact`、`about.intro`：关于页的两段

图片和视频在 `media/`。文件名由写作台生成，例如 `20261013200337-i4nc.png`。允许的格式是 jpg、jpeg、png、gif、webp、mp4、webm、mov，单个不超过 45MB。

改完内容要出现在线上，必须把 `data/site.json` 和 `media/` 提交并推到这个仓库的 `main`。只留在自己电脑上，别人打开网站看不到。

## Markdown

HOME 的 README，以及编辑页里的预览，使用 [marked](https://github.com/markedjs/marked) 解析 GitHub 风格 Markdown（GFM）。支持：

- 标题、段落、换行、分隔线
- 加粗、斜体、删除线、行内代码
- 围栏代码块
- 链接、自动链接、邮箱链接
- 图片，以及 mp4 / webm / mov 视频
- 有序、无序、嵌套列表和任务列表
- 引用
- 表格，包含对齐

原文里的 HTML 会转义，不会执行脚本、内嵌框架或事件属性。图片和视频地址只允许站内 `media/` 和 `https://`。

上传一份 `.md` 时，可以同时带上它引用的图片和视频。相对路径会按文件名改写成 `media/...`。编辑页切到 HOME 或碎碎念后，把文件拖进标题和正文那一块，或点「上传 Markdown」一起选。

碎碎念和关于页仍按空行分段，不走上面这套 Markdown。

## 编辑

有两条路，写的是同一份 `data/site.json`。

### 在网站上登录

打开 https://riano5589.github.io/edit.html ，用 GitHub 账号 **Riano5589** 登录。

第一次会跳到 GitHub 创建应用「Riano Site」。安装时只勾选仓库 **Riano5589.github.io**。应用的私钥只留在这台浏览器里，不会写进仓库。清掉浏览器数据后要重新登录。

登录后可以改 HOME、碎碎念和关于，也可以搜索。保存会直接写入这个 GitHub 仓库，一两分钟后刷新网站就能看到。

### 在自己电脑上写

需要已安装 Node.js，并且 `gh` 已登录为 Riano5589。

双击 `启动写作台.bat`，或在项目目录执行：

```powershell
npm start
```

浏览器会打开 http://127.0.0.1:8787/edit.html 。这个地址只在本机可进，不需要再登录 GitHub。

- 「保存」只写到本机的 `data/site.json` 和 `media/`
- 「发布到 GitHub」才会 `git add`、提交并 `git push` 到 `main`

本机没点发布之前，线上网站不会变。

## 目录

```text
index.html          HOME
notes.html          碎碎念
about.html          关于
friends.html        友链
search.html         搜索
read.html           阅读页
edit.html           编辑页
data/site.json      全部文字
media/              图片和视频
js/content.js       读取、搜索、Markdown
js/marked.umd.js    Markdown 解析器
js/pages.js         各页怎么排
js/edit.js          编辑、上传、拖拽
js/github.js        用 GitHub 登录后写仓库
js/shell.js         导航和搜索框
editor/server.js    本机写作台
css/style.css       样式
启动写作台.bat
```

## 本地预览和发布

写作台已经在跑时，再开一次会提示端口占用，用已经打开的 http://127.0.0.1:8787/ 即可。

自己改了页面代码之后，提交并推送：

```powershell
git push origin main
```

GitHub Pages 的来源是 `main` 分支根目录。推上去之后等一两分钟，再强制刷新 https://riano5589.github.io/ 。
