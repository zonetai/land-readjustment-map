# 體檢地圖

給一般民眾查自己家狀況的公開地圖：輸入地址或在地圖上點一下，一次看到災害風險、生活機能、都市計畫與開發計畫，市地重劃只是其中一個圖層。

參考內部圖台的版面與操作重做的公開版本：左側功能選單＋滑出面板、右上工具列、右側圖層面板、右鍵選單。
純靜態網頁，免登入、免資料庫、免伺服器，所有函式庫都放在 `vendor/`，不依賴外部 CDN。

## 換牌

只改 `js/config.js`：名稱、副標、標誌字或 logo 圖檔、主色、預設位置。其他檔案沒有寫死任何品牌。

## 功能

| 功能 | 資料來源 |
|---|---|
| **地點體檢**：點一個位置，同時檢查各圖資包的項目，每項一張紅黃綠結果卡；可複製成報告文字、列印／存成 PDF、複製連結（`#check=緯度,經度`） | 各圖資包（`packs/`）；行政區與地段查國土測繪中心 |
| **主題圖資**：圖資包的圖磚圖層與靜態資料集（點、線、面、分級設色主題圖），圖層面板可搜尋 | `packs/<id>/pack.js`，規格見 `packs/README.md` |
| **歷年航照比對**：左右兩個年份、中間拖曳分隔線（2003–05、2014～2025、最新） | 國土測繪中心 WMTS 正射影像 |
| 快速定位（地址、地標、經緯度、TWD97） | OpenStreetMap Nominatim；座標換算在瀏覽器內完成 |
| 都市計畫分區點查（臺北市） | 臺北市都發局 historygis ArcGIS（JSONP，免代理） |
| 市地重劃範圍（六都 406 區，含負擔比率） | `data/land-readjustment.js`（與 `.geojson` 內容相同），整理自各市地政局與政府資料開放平臺 |
| 20 個疊加圖層：地籍、分區、地形、航照、災害潛勢 | 國土測繪中心、臺北市、地調中心、水利署公開圖磚／WMS |
| 8 種底圖（預設向量地圖） | OpenFreeMap、國土測繪中心、OSM、Esri |
| 量測距離／面積（㎡、坪、公頃）、街景、目前位置、右鍵座標 | 瀏覽器內計算，街景開 Google 地圖 |

刻意**不包含**：實價登錄購入資料（授權不能公開再散布）、案件、業務紀錄簿、勘估筆記、AI 助理、登入。實價登錄改成連到內政部官方查詢。

## 程式結構

| 檔案 | 內容 |
|---|---|
| `js/config.js` | 品牌設定 |
| `js/catalog.js` | 原有的 20 個疊加圖層與底圖 |
| `js/gis-core.js` | 圖資包核心（不含介面）：註冊、資料集載入、空間運算、對外查詢、執行體檢 |
| `js/app.js` | 地圖、選單、面板、工具列；其他功能檔透過 `window.APP` 掛進來 |
| `js/packs-ui.js` | 圖資包的圖層面板與資料集繪製（`window.PACKUI`） |
| `js/sitecheck.js` | 地點體檢面板（`window.SITECHECK`） |
| `js/timeline.js` | 歷年航照比對（`window.TIMELINE`） |
| `packs/<id>/` | 圖資包：`living` 生活機能、`risk` 災害風險、`economy` 地價與人口、`planning` 規劃開發；`_demo` 是測試用假資料 |
| `tests/smoke.js` | 介面煙霧測試 |

要增減圖資包，改 `index.html` 裡那一行清單（`living,risk,economy,planning`）。少了哪一包只是那一包不出現，不影響其他功能。

## 網址參數

| 寫法 | 效果 |
|---|---|
| `#25.04,121.54,15` | 開在指定位置與縮放層級 |
| `#check=25.033,121.5436` | 直接對這個位置做地點體檢（可分享） |
| `?embed=check` | 嵌入模式：只有地圖＋地點體檢面板，沒有選單與品牌列，適合用 iframe 放進官網 |
| `?embed=map` | 嵌入模式：只有地圖與圖層鈕 |
| `?packs=living,risk` | 只載入指定的圖資包（測試用：`?packs=_demo`） |

嵌入範例：`<iframe src="https://你的網址/platform/?embed=check" style="width:100%;height:640px;border:0" allow="clipboard-write"></iframe>`

## 測試

```
node tests/smoke.js            # 需要 playwright；所有對外連線都會被攔截，不需要網路
SHOTS=/tmp/shots node tests/smoke.js   # 同時輸出截圖
```

## 部署

把整個資料夾放到任何靜態主機即可（GitHub Pages、Netlify、Cloudflare Pages、公司網站子目錄）。
直接雙擊 `index.html` 也能用（資料檔都是 `.js`，不受 file:// 限制）；要用網頁伺服器預覽的話：

```
python -m http.server 8000
```

然後開 http://localhost:8000 。
