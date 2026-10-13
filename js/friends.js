/**
 * 加一条友链：复制一块，改 name、url、note。
 */
window.FRIENDS = [
  {
    name: "GitHub",
    url: "https://github.com/Riano5589",
    note: "我的代码和这个小站的仓库。"
  }
];

(function () {
  const root = document.getElementById("friend-list");
  if (!root || !window.FRIENDS) return;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  root.innerHTML = window.FRIENDS.filter((friend) => /^https?:\/\//.test(friend.url)).map((friend) => (
    '<a class="friend" href="' + escapeHtml(friend.url) + '" rel="noopener noreferrer">' +
      '<strong>' + escapeHtml(friend.name) + '</strong>' +
      '<span>' + escapeHtml(friend.note) + '</span>' +
    '</a>'
  )).join("");
})();
