# 多采多姿頭皮管理－GitHub Pages MINI App 前端 V1

此版本的目的只有一個：先確認「GitHub Pages + LINE MINI App + LIFF」可以正常取得 LINE ID Token / User ID。

## 已預設
- Developing LIFF ID: `2011797895-i60dUwYm`
- 不含任何 Channel Secret
- 不含 INTERNAL_API_KEY
- 不會真的建立預約

## GitHub 建立方式
1. 建立一個新的 GitHub repository，例如：`duocai-booking-miniapp`
2. 把本資料夾內的檔案全部上傳到 repository 根目錄。
3. 到 repository → Settings → Pages。
4. Build and deployment 選：Deploy from a branch。
5. Branch 選：`main`，資料夾選：`/(root)`。
6. 儲存後等待 GitHub Pages 建立 HTTPS 網址。

網址通常會是：
`https://你的GitHub帳號.github.io/duocai-booking-miniapp/`

## LINE MINI App 設定
到 LINE Developers → MINI App → Web app settings → Developing → Endpoint URL，改成上面的 GitHub Pages URL。

測試入口仍使用 LINE 提供的 Developing MINI App URL，而不是直接使用 GitHub Pages URL：
`https://miniapp.line.me/2011797895-i60dUwYm`

## 成功判斷
畫面顯示：
- LINE 身份取得成功
- ID Token：已取得
- LINE User ID：U...（一串 LINE User ID）

如果成功，下一版才會接正式預約 API。
