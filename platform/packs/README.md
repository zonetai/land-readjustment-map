# 圖資包（packs）

每一類圖資是一個獨立的「圖資包」，放在 `packs/<id>/`，可以單獨拿掉或搬到別的平台。

```
packs/<id>/pack.js        註冊這個圖資包（圖層、資料集、體檢項目）
packs/<id>/data/*.js      靜態資料：window.GIS_DATA['<資料集 id>'] = { "type":"FeatureCollection", ... }
packs/<id>/NOTES.md       資料來源、查證紀錄、沒取得的資料與原因
```

資料檔用 `.js`（不是 `.geojson`）是為了雙擊 index.html（file://）也能載入。座標一律 WGS84 經緯度，小數 5～6 位，屬性只留用得到的欄位。

## pack.js 規格

```js
GIS.registerPack({
  id: 'risk',                 // 與資料夾同名
  name: '災害風險',
  icon: 'shield-alert',       // lucide 圖示名
  order: 2,
  // 1) 圖磚圖層：直接連政府公開服務，出現在右側圖層面板
  layers: [{
    id: 'geo_sensitive', name: '地質敏感區',
    type: 'xyz',              // 'xyz' | 'wms'
    url: 'https://wmts.nlsc.gov.tw/wmts/GeoSensitive/default/GoogleMapsCompatible/{z}/{y}/{x}',
    layerName: '',            // type 為 wms 時的 LAYERS
    wmsVersion: '1.1.1', wmsFormat: 'image/png',   // 選填
    group: '地質',            // 選填，面板內的小標
    opacity: 0.7, minZoom: 0, maxNativeZoom: 18,   // 選填
    legend: [{ color: '#e11d48', label: '高潛勢' }], // 選填，或 legendUrl
    source: '經濟部地質調查及礦業管理中心', sourceUrl: 'https://...',
    note: '',                 // 選填，一句使用提醒
  }],
  // 2) 靜態資料集：隨網站發布的點線面資料，可當圖層顯示，也給體檢項目用
  datasets: [{
    id: 'rail_stations', name: '軌道車站', file: 'packs/living/data/rail_stations.js',
    geometry: 'point',        // 'point' | 'line' | 'polygon'
    count: 1234, showAsLayer: true, group: '交通',
    style: { color: '#2563eb', radius: 5, weight: 2, fillOpacity: 0.3 },
    styleBy: { field: 'type', map: { 捷運: '#2563eb', 臺鐵: '#0f766e' } }, // 選填，依欄位分色（同時當圖例）
    labelField: 'name',
    popupFields: [['name', '站名'], ['line', '路線']],
    minZoom: 11,              // 選填，點很多時避免全臺一次畫
    source: '交通部 TDX', sourceUrl: 'https://...', updated: '2026-11-25',
  }],
  // 3) 地點體檢項目：使用者點一個位置，每個項目回一張結果卡
  checks: [{
    id: 'risk_liquefaction', name: '土壤液化潛勢', order: 10,
    source: '地質調查及礦業管理中心',
    timeout: 25000,           // 選填，毫秒
    run: async (pt, ctx) => { // pt = {lat, lng, twd97:{x,y}}
      return {
        level: 'warn',        // 'good' 綠｜'info' 中性｜'warn' 黃｜'bad' 紅｜'na' 查無或不適用
        headline: '中潛勢',    // 卡片上的一句結論（短）
        detail: '補充說明，可省略',
        items: [{ label: '大安站', value: '捷運淡水信義線', dist: 320, lat: 25.03, lng: 121.54 }], // 選填，清單；有座標會畫在地圖上
        reportText: '勘估標的位於土壤液化中潛勢區。', // 可直接貼進估價報告的完整句子
      }
    },
  }],
})
```

`run` 拋出錯誤或逾時，介面會顯示「暫時查不到」，不影響其他項目。查不到資料請回 `level:'na'`，不要猜。

## ctx 工具（js/gis-core.js）

| 工具 | 用途 |
|---|---|
| `ctx.fetchJSON(url, {timeout})`、`ctx.fetchText` | 跨來源抓取（服務要有 CORS） |
| `ctx.jsonp(url, params)` | 沒有 CORS 但支援 callback 的服務（ArcGIS 多半可用） |
| `ctx.wmsFeatureInfo({url, layers, lat, lng, infoFormat, version})` | WMS 點查，回文字 |
| `ctx.arcgisQuery(layerUrl, pt, {distance, outFields, where, returnGeometry, jsonp})` | ArcGIS 圖層點查／環域，回 features |
| `ctx.arcgisIdentify(serviceUrl, pt, {layers, tolerance, jsonp})` | ArcGIS identify，回 results |
| `ctx.admin(pt)` | 國土測繪中心：縣市、鄉鎮、村里、地段（含代碼） |
| `ctx.data(id)` | 載入靜態資料集，回 FeatureCollection |
| `ctx.nearest(fc, pt, n, filter)`、`ctx.within(fc, pt, 半徑, filter)` | 最近 n 個／半徑內，回 `[{feature, dist}]`（點線面皆可，面內距離為 0） |
| `ctx.containing(fc, pt)` | 包含該點的面 |
| `ctx.dist(a, b)`、`ctx.distTo(pt, geometry)`、`ctx.fmtDist(m)`、`ctx.walkMin(m)` | 距離與格式 |
| `ctx.cached(key, fn)` | 同一次瀏覽內快取 Promise |

## 介面另外支援的選填欄位（js/packs-ui.js、js/sitecheck.js）

| 位置 | 欄位 | 作用 |
|---|---|---|
| layers[] | `type: 'arcgis'` | ArcGIS MapServer 動態出圖：`url` 填 MapServer 網址，`layerName` 填 `show:1,2`，介面自己組 `export?bbox=…` |
| datasets[] | `themes: [{field, label, unit, valueField, breaks, colors, classes, period, source}]` | 主題圖：圖層列下方出現指標下拉，依 `valueField`（沒填就用 `field`）的數值與 `breaks` 分級上色；`colors` 要比 `breaks` 多一個；有 `classes`（各級文字）就拿來當圖例 |
| datasets[] | `styleBy.other` | `styleBy.map` 沒列到的值用這個顏色 |
| checks[] | `layer: '<圖層或資料集 id>'` | 結果卡上多一顆「顯示圖層」開關（也可以填 js/catalog.js 裡原有圖層的 id） |
| pack | `icon` | lucide 圖示名；這一版 vendor/lucide 沒有的名稱會自動改用通用圖示 |

測試用的假資料包在 `packs/_demo/`，網址加 `?packs=_demo` 載入；`node tests/smoke.js` 會用它跑完整流程。
