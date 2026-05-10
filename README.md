# 书山

书山是一个可以添加到 iPhone 主屏幕的藏书登记小应用。

## 放到 iPhone 主屏幕

1. 把这个文件夹部署到一个 HTTPS 网站，例如 GitHub Pages、Netlify、Vercel 或 Cloudflare Pages。
2. 用 iPhone 的 Safari 打开部署后的网址。
3. 点 Safari 底部的分享按钮。
4. 选择“添加到主屏幕”。
5. 桌面上会出现“书山”图标，之后点图标即可运行。

## 注意

- 直接用 `file://` 打开可以看页面，但不能完整启用主屏幕应用、离线缓存和摄像头扫码。
- ISBN 扫码需要 HTTPS 页面，并且要在 Safari 里允许摄像头权限。
- 藏书数据目前保存在当前浏览器本地，换设备前需要另做导入导出功能。
