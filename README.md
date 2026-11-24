# 历史地图绘图台

公开地图站：https://ukimafunado152036.github.io/historical-map-studio/

在真实地理底图上绘制历史道路、水系、区域、建筑与地名。支持圆角半径、节点编辑、撤销重做、现代地图/卫星对照。

## 保存位置

- main 分支：网页源码，GitHub Pages 从仓库根目录发布，无需构建。
- map-data 分支：可编辑地图 JSON，默认 default.history-map.json。不同区域可另存为不同文件。
- 地图与访问令牌均不会自动写入 localStorage、IndexedDB 或本机文件。未提交的修改仅存在当前页面内存。
- 浏览器的一般网络缓存与地图项目保存是两回事。

## 编辑

公开浏览不需要授权。要保存，请打开网页右上角“GitHub 项目”，用仓库所有者的细粒度访问令牌连接：仅选择 historical-map-studio 仓库，Contents 权限为 Read and write。令牌仅在本次页面会话中使用，请勿提交进仓库或贴到聊天里。

完成编辑后约 20 秒自动提交；关闭页面前可点“保存到 GitHub”。每次保存产生 Git 提交，遇到版本冲突不会覆盖他人的更新，可将当前地图另存为新项目。

## 旧项目

旧浏览器地图仍在原网站域名中，无法跨域自动读取。请在原站新版的“GitHub 项目”中点“搬入此浏览器原有地图”；上传并读取确认成功后，才移除旧浏览器项目副本。以前存在磁盘上的 JSON 可通过“从旧 JSON / GeoJSON 搬入”保存成新的 GitHub 项目。原磁盘文件不会被删除。

## 源码与归属

根目录 .mjs / CSS / HTML 即网页源码，可直接在 GitHub 编辑。自然底图由 OpenFreeMap 提供，现代参考由 OpenStreetMap / Esri 提供。MapLibre 的第三方授权文件随项目一并保留。
