# Riano 碎碎念

星空背景的个人小站。栏目和常见个人博客一样：碎碎念列表、关于、友链、联系。

## 本地预览

在这个目录打开终端，运行：

```powershell
python -m http.server 8765
```

浏览器访问 http://127.0.0.1:8765

## 写一篇新的碎碎念

编辑 `js/posts.js`，复制现有的一篇，改掉这些字段：

- `id`：小写英文和短横线，不能重复
- `title`：标题
- `category`：分类，比如「碎碎念」
- `date`：`YYYY-MM-DD`
- `excerpt`：列表里显示的摘要
- `paragraphs`：正文，一句引号是一段

友链写在 `js/friends.js`。

## 发布

仓库名使用 `Riano5589.github.io`，推到 `main` 分支后，在 GitHub 仓库的 Settings → Pages 里把来源设为 `main` 分支的根目录。站点地址是 https://riano5589.github.io/
