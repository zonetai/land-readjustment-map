// 測試用圖資包：只給 tests/smoke.js 用（網址加 ?packs=_demo 載入），正式頁面不會載入。
// 內容全部是假資料，用來驗證介面的各種狀況：四種圖層型態、資料集、主題圖、各種燈號、錯誤與逾時。
GIS.registerPack({
  id: '_demo',
  name: '測試圖資',
  icon: 'flask-conical',
  order: 90,
  layers: [
    { id: 'demo_xyz', name: '測試圖磚（xyz）', type: 'xyz', url: 'https://tiles.example.test/xyz/{z}/{y}/{x}', group: '圖磚', opacity: 0.6, maxNativeZoom: 18,
      legend: [{ color: '#e11d48', label: '高' }, { color: '#f59e0b', label: '中' }, { color: '#16a34a', label: '低' }], source: '測試機關', sourceUrl: 'https://example.test/', note: '這是測試用的說明文字。' },
    { id: 'demo_wms', name: '測試圖磚（wms）', type: 'wms', url: 'https://tiles.example.test/wms', layerName: 'DEMO', group: '圖磚', minZoom: 15 },
    { id: 'demo_arcgis', name: '測試動態出圖（arcgis）', type: 'arcgis', url: 'https://tiles.example.test/arcgis/rest/services/Demo/MapServer', layerName: 'show:1,2', group: '動態出圖', source: '測試機關' },
  ],
  datasets: [
    { id: 'demo_points', name: '測試點位', file: 'packs/_demo/data/demo_points.js', geometry: 'point', count: 2400, group: '資料集',
      style: { color: '#2563eb', radius: 5 }, styleBy: { field: 'type', map: { 捷運: '#2563eb', 臺鐵: '#0f766e', 公車: '#f59e0b' } },
      labelField: 'name', popupFields: [['name', '名稱'], ['type', '種類']], source: '測試資料', updated: '2026-11-25' },
    { id: 'demo_far', name: '測試點位（放大才顯示）', file: 'packs/_demo/data/demo_points.js', geometry: 'point', group: '資料集', minZoom: 16, showAsLayer: true },
    { id: 'demo_towns', name: '測試統計區', file: 'packs/_demo/data/demo_towns.js', geometry: 'polygon', count: 9, group: '資料集',
      labelField: 'name', popupFields: [['name', '名稱'], ['pop', '人口']],
      themes: [
        { field: 'pop', label: '人口數', unit: '人', breaks: [10000, 50000, 100000], colors: ['#eff6ff', '#93c5fd', '#3b82f6', '#1e3a8a'] },
        { field: 'price', label: '公告土地現值', unit: '元/㎡', valueField: 'landprice', breaks: [50000, 200000], colors: ['#fef3c7', '#f59e0b', '#b45309'] },
      ], source: '測試資料' },
    { id: 'demo_hidden', name: '不顯示的資料集', file: 'packs/_demo/data/demo_towns.js', geometry: 'polygon', showAsLayer: false },
  ],
  checks: [
    { id: 'demo_good', name: '最近的測試點', order: 1, source: '測試資料', layer: 'demo_points',
      run: async (pt, ctx) => {
        const fc = await ctx.data('demo_points')
        const near = ctx.nearest(fc, pt, 3)
        return { level: 'good', headline: `${near[0].feature.properties.name}，${ctx.fmtDist(near[0].dist)}`, detail: '500 公尺內算近。',
          items: near.map((n) => ({ label: n.feature.properties.name, value: n.feature.properties.type, dist: n.dist, lat: n.feature.geometry.coordinates[1], lng: n.feature.geometry.coordinates[0] })),
          reportText: `勘估標的距${near[0].feature.properties.name}約 ${ctx.fmtDist(near[0].dist)}。` }
      } },
    { id: 'demo_info', name: '所在統計區', order: 2, source: '測試資料', layer: 'demo_towns',
      run: async (pt, ctx) => {
        const hit = ctx.containing(await ctx.data('demo_towns'), pt)
        return hit.length ? { level: 'info', headline: hit[0].properties.name, reportText: `勘估標的位於${hit[0].properties.name}。` } : { level: 'na', headline: '不在測試範圍內' }
      } },
    { id: 'demo_warn', name: '黃燈項目', order: 3, source: '測試機關', layer: 'demo_xyz',
      run: async () => { await new Promise((r) => setTimeout(r, 300)); return { level: 'warn', headline: '中潛勢', detail: '這是黃燈的補充說明。', reportText: '勘估標的位於測試中潛勢區。' } } },
    { id: 'demo_bad', name: '紅燈項目', order: 4, source: '測試機關',
      run: async () => { await new Promise((r) => setTimeout(r, 600)); return { level: 'bad', headline: '高潛勢', items: [{ label: '沒有座標的項目', value: '說明' }], reportText: '勘估標的位於測試高潛勢區。' } } },
    { id: 'demo_na', name: '查無資料項目', order: 5, run: async () => ({ level: 'na', headline: '這個位置沒有資料' }) },
    { id: 'demo_throw', name: '會出錯的項目', order: 6, run: async () => { throw new Error('測試錯誤') } },
    { id: 'demo_timeout', name: '會逾時的項目', order: 7, timeout: 1500, run: () => new Promise(() => {}) },
  ],
})
