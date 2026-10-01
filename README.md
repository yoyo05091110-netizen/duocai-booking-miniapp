# GitHub Pages V2

正式預約前端。LINE 身份由 LIFF 取得，所有 API 經 Cloudflare Worker 轉送到 Apps Script。

## 必改
`config.js` 的 `API_URL` 改成 Worker URL，例如：

```js
API_URL: 'https://duocai-mini-api.<你的子網域>.workers.dev'
```

LIFF ID 已預設：`2011797895-i60dUwYm`

## GitHub Pages
把 01_GITHUB_PAGES 內 6 個檔案放在 repository 根目錄，再 Commit。Pages 會自動更新。
