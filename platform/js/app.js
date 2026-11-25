/* 不動產圖資平台（白牌版）
 * 純前端、免登入、免資料庫：所有圖資直接向公開來源（國土測繪中心、地方政府、開放資料）索取。
 * 品牌設定在 js/config.js，圖資目錄在 js/catalog.js。 */
(function () {
  'use strict'

  const BRAND = window.GIS_BRAND
  const CATALOG = window.GIS_CATALOG
  const $ = (sel, root = document) => root.querySelector(sel)
  const ic = (name, cls = '') => `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const refreshIcons = () => { if (window.lucide) window.lucide.createIcons() }
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem('wlgis:' + key); return v === null ? fallback : JSON.parse(v) } catch { return fallback } },
    set(key, value) { try { localStorage.setItem('wlgis:' + key, JSON.stringify(value)) } catch { /* 無痕模式存不進去就算了 */ } },
  }
  const isMobile = () => window.matchMedia('(max-width: 767px)').matches

  // ── 嵌入模式與外掛掛接點 ────────────────────────────────────────────────
  // ?embed=check 只留地圖＋地點體檢；?embed=map 只留地圖與圖層鈕。
  const EMBED = (() => { const v = new URLSearchParams(location.search).get('embed'); return v === 'check' || v === 'map' ? v : '' })()
  if (EMBED) document.body.classList.add('embed', 'embed-' + EMBED)
  // 其他功能檔（js/packs-ui.js、js/sitecheck.js、js/timeline.js）透過 window.APP 掛進來，這裡不認識它們。
  const APP = (window.APP = {
    embed: EMBED,
    pointActions: [], // 定位點 popup／卡片上的額外按鈕 {id, label, icon, on(lat, lng)}
    ctxItems: [], // 右鍵選單額外項目 {id, label, icon, on(lat, lng)}
    clickHandlers: [], // 地圖點擊 fn(e)，回傳 true 表示已處理
    tools: [], // 右上工具列額外按鈕 {id, label, icon, active(), on()}
    exitPickHooks: [], // 離開選點模式時通知
    layerExtra: null, // 圖層面板的額外區塊 {html(), bind(el)}
  })

  // ── 座標 ────────────────────────────────────────────────────────────────
  const TWD97 = '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs'
  const toTwd97 = (lat, lng) => { const [x, y] = proj4('EPSG:4326', TWD97, [lng, lat]); return { x, y } }
  const fromTwd97 = (x, y) => { const [lng, lat] = proj4(TWD97, 'EPSG:4326', [x, y]); return { lat, lng } }
  const fmtLL = (lat, lng) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  const fmtTwd = (lat, lng) => { const t = toTwd97(lat, lng); return `${Math.round(t.x)}, ${Math.round(t.y)}` }
  const streetViewUrl = (lat, lng) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`
  const gmapUrl = (lat, lng) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

  // ── 品牌 ────────────────────────────────────────────────────────────────
  function applyBrand() {
    document.title = BRAND.name
    document.documentElement.style.setProperty('--accent', BRAND.accent)
    document.documentElement.style.setProperty('--accent-soft', BRAND.accentSoft)
    $('#brandName').textContent = BRAND.name
    $('#brandSub').textContent = BRAND.subtitle
    $('#brandMark').innerHTML = BRAND.logoUrl ? `<img src="${esc(BRAND.logoUrl)}" alt="">` : esc(BRAND.mark)
  }

  // ── 地圖 ────────────────────────────────────────────────────────────────
  const hashView = (() => {
    const m = location.hash.match(/^#([\d.]+),([\d.]+),(\d+(?:\.\d+)?)/)
    return m ? { center: [Number(m[1]), Number(m[2])], zoom: Number(m[3]) } : null
  })()
  // 網址 # 後面：畫面位置，可再接「&check=緯度,經度」這類由功能檔管理的片段
  let hashSuffix = (location.hash.match(/(?:^#|&)(check=[\d.,-]+)/) || [])[1] || ''
  let lastView = null
  function writeHash() {
    const parts = []
    if (lastView) parts.push(`${lastView.center[0]},${lastView.center[1]},${lastView.zoom}`)
    if (hashSuffix) parts.push(hashSuffix)
    history.replaceState(null, '', location.pathname + location.search + (parts.length ? '#' + parts.join('&') : ''))
  }
  APP.setHashSuffix = (s) => { hashSuffix = s || ''; writeHash() }
  const startView = hashView || store.get('view', null) || BRAND.home
  const map = L.map('map', { zoomControl: false, maxZoom: 20, minZoom: 7, center: startView.center, zoom: startView.zoom, doubleClickZoom: true })
  map.attributionControl.setPrefix(false)
  map.createPane('overlays').style.zIndex = 350
  map.createPane('readjust').style.zIndex = 420

  map.on('moveend', () => {
    const c = map.getCenter(), z = map.getZoom()
    const v = { center: [Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))], zoom: z }
    if (!EMBED) store.set('view', v)
    lastView = v
    writeHash()
  })
  map.on('mousemove', (e) => {
    $('#coordBar').textContent = `WGS84 ${fmtLL(e.latlng.lat, e.latlng.lng)}　TWD97 ${fmtTwd(e.latlng.lat, e.latlng.lng)}`
  })

  // 底圖
  let basemapLayer = null
  let basemapId = store.get('basemap', 'vector')
  function localizeVectorLabels(gl) {
    const apply = () => {
      for (const layer of gl.getStyle().layers || []) {
        if (layer.type !== 'symbol' || !layer.layout || !layer.layout['text-field']) continue
        const tf = JSON.stringify(layer.layout['text-field'])
        if (!tf.includes('name')) continue
        try { gl.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:zh-Hant'], ['get', 'name:zh'], ['get', 'name']]) } catch { /* 個別圖層失敗不影響其他 */ }
      }
    }
    if (gl.isStyleLoaded()) apply(); else gl.once('styledata', apply)
  }
  function setBasemap(id) {
    const def = CATALOG.basemaps.find((b) => b.id === id) || CATALOG.basemaps[0]
    if (basemapLayer) map.removeLayer(basemapLayer)
    basemapLayer = null
    if (def.vector) {
      if (L.maplibreGL && window.maplibregl) {
        basemapLayer = L.maplibreGL({ style: 'https://tiles.openfreemap.org/styles/liberty', attribution: def.attribution })
        basemapLayer.addTo(map)
        try { localizeVectorLabels(basemapLayer.getMaplibreMap()) } catch { /* 標籤維持原文 */ }
      } else {
        return setBasemap('taiwan_emap')
      }
    } else {
      basemapLayer = L.tileLayer(def.url, { attribution: def.attribution, maxZoom: 20, maxNativeZoom: Math.min(def.maxZoom || 19, 19), subdomains: 'abc' }).addTo(map)
    }
    basemapId = def.id
    store.set('basemap', def.id)
    renderLayerPanel()
  }

  // 疊加圖層
  const overlays = new Map() // id → { layer, opacity }
  function makeOverlay(def, opacity) {
    const common = { pane: 'overlays', opacity, maxZoom: 20, attribution: '' }
    if (def.type === 'wms') {
      return L.tileLayer.wms(def.url, {
        ...common, layers: def.layerName, format: 'image/png', transparent: true, version: '1.1.1',
        ...(def.wmsSrs === 'EPSG:4326' ? { crs: L.CRS.EPSG4326 } : {}),
        ...(def.wmsSingleImage ? { tileSize: 512 } : {}),
      })
    }
    return L.tileLayer(def.url, { ...common, maxNativeZoom: 19 })
  }
  function toggleOverlay(id, on, opacity = 0.75) {
    const def = CATALOG.layers.find((l) => l.id === id)
    if (!def) return
    if (on && !overlays.has(id)) {
      const layer = makeOverlay(def, opacity).addTo(map)
      overlays.set(id, { layer, opacity })
    } else if (!on && overlays.has(id)) {
      map.removeLayer(overlays.get(id).layer)
      overlays.delete(id)
    }
    store.set('overlays', [...overlays.entries()].map(([k, v]) => [k, v.opacity]))
    renderLayerPanel()
  }
  function setOpacity(id, value) {
    const o = overlays.get(id)
    if (!o) return
    o.opacity = value
    o.layer.setOpacity(value)
    store.set('overlays', [...overlays.entries()].map(([k, v]) => [k, v.opacity]))
  }

  // 點選標記
  const pinIcon = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -26] })
  let pinMarker = null
  function placePin(lat, lng, title) {
    if (pinMarker) map.removeLayer(pinMarker)
    pinMarker = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
    pinMarker.bindPopup(pointPopupHtml(lat, lng, title), { maxWidth: 300 })
    return pinMarker
  }
  function pointPopupHtml(lat, lng, title) {
    return `<div class="pop-title">${esc(title || '定位點')}</div>
      <table class="kv"><tr><th>WGS84</th><td>${fmtLL(lat, lng)}</td></tr><tr><th>TWD97</th><td>${fmtTwd(lat, lng)}</td></tr></table>
      <div class="pop-actions">
        ${APP.pointActions.map((a) => `<button type="button" data-act="${a.id}" data-lat="${lat}" data-lng="${lng}">${esc(a.label)}</button>`).join('')}
        <button type="button" data-act="zone" data-lat="${lat}" data-lng="${lng}">查都市計畫分區</button>
        <a href="${streetViewUrl(lat, lng)}" target="_blank" rel="noopener">街景</a>
        <a href="${gmapUrl(lat, lng)}" target="_blank" rel="noopener">Google 地圖</a>
        <button type="button" data-act="copy" data-lat="${lat}" data-lng="${lng}">複製座標</button>
      </div>`
  }
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]')
    if (!btn) return
    const lat = Number(btn.dataset.lat), lng = Number(btn.dataset.lng)
    if (btn.dataset.act === 'zone') { openPanel('urbanplan'); queryZone(lat, lng) }
    if (btn.dataset.act === 'copy') copyText(fmtLL(lat, lng))
    const ext = APP.pointActions.find((a) => a.id === btn.dataset.act)
    if (ext) { map.closePopup(); ext.on(lat, lng) }
  })

  function copyText(text, doneMsg) {
    const done = () => toast(doneMsg || `已複製：${text}`)
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => toast('瀏覽器不允許複製，請手動選取'))
    else toast(text)
  }
  let toastTimer = null
  function toast(msg) {
    const el = $('#toast')
    el.textContent = msg
    el.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400)
  }

  // ── 左側選單 ────────────────────────────────────────────────────────────
  const NAV = [
    { label: '地圖查詢', items: [
      { id: 'locate', label: '快速定位', icon: 'map-pin' },
      { id: 'urbanplan', label: '都市計畫查詢', icon: 'landmark' },
      { id: 'readjust', label: '市地重劃範圍', icon: 'layout-grid' },
    ] },
    { label: '外部查詢', items: [
      { href: 'https://lvr.land.moi.gov.tw/', label: '實價登錄查詢', icon: 'receipt-text' },
      { href: 'https://easymap.land.moi.gov.tw/', label: '地籍便民查詢', icon: 'scan-search' },
      { href: 'https://luz.tcd.gov.tw/web/', label: '全國使用分區查詢', icon: 'map' },
    ] },
    { label: '系統', items: [
      { id: 'about', label: '關於與資料來源', icon: 'info' },
    ] },
  ]
  let activePanel = null
  let collapsed = isMobile() ? true : store.get('collapsed', false)

  function renderNav() {
    const nav = $('#nav')
    nav.innerHTML = NAV.map((g) => `
      <div class="nav-group">
        <div class="nav-group-label">${esc(g.label)}</div>
        ${g.items.map((it) => it.href
          ? `<a class="nav-item" href="${it.href}" target="_blank" rel="noopener" data-tip="${esc(it.label)}">${ic(it.icon)}<span class="nav-label">${esc(it.label)}</span><span class="nav-ext">${ic('external-link')}</span></a>`
          : it.on
          ? `<button type="button" class="nav-item${it.active && it.active() ? ' active' : ''}" data-navact="${it.id}" data-tip="${esc(it.label)}">${ic(it.icon)}<span class="nav-label">${esc(it.label)}</span></button>`
          : `<button type="button" class="nav-item${activePanel === it.id ? ' active' : ''}" data-panel="${it.id}" data-tip="${esc(it.label)}">${ic(it.icon)}<span class="nav-label">${esc(it.label)}</span>${it.id === 'urbanplan' && zoneResult && activePanel !== 'urbanplan' ? '<span class="nav-dot"></span>' : ''}</button>`
        ).join('')}
      </div>`).join('')
    nav.querySelectorAll('[data-panel]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.panel
      activePanel === id ? closePanel() : openPanel(id)
      if (isMobile()) setCollapsed(true)
    }))
    nav.querySelectorAll('[data-navact]').forEach((b) => b.addEventListener('click', () => {
      NAV.flatMap((g) => g.items).find((it) => it.id === b.dataset.navact).on()
      if (isMobile()) setCollapsed(true)
      renderNav()
    }))
    refreshIcons()
  }
  function setCollapsed(v) {
    collapsed = v
    $('#sidebar').classList.toggle('collapsed', v)
    $('#collapseBtn').title = v ? '展開選單' : '收合選單'
    if (!isMobile()) store.set('collapsed', v)
    setTimeout(() => map.invalidateSize(), 320)
  }
  // 收合時的提示文字
  const tip = document.createElement('div')
  tip.className = 'tip'
  tip.hidden = true
  document.body.appendChild(tip)
  $('#nav').addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]')
    if (!el || !collapsed || window.matchMedia('(hover: none)').matches) { tip.hidden = true; return }
    const r = el.getBoundingClientRect()
    tip.textContent = el.dataset.tip
    tip.style.top = `${r.top + r.height / 2}px`
    tip.style.left = `${$('#sidebar').getBoundingClientRect().right + 10}px`
    tip.hidden = false
  })
  $('#nav').addEventListener('mouseleave', () => { tip.hidden = true })
  $('#nav').addEventListener('click', () => { tip.hidden = true })

  // ── 左側面板 ────────────────────────────────────────────────────────────
  const PANELS = {
    locate: { title: '快速定位', icon: 'map-pin', render: renderLocate },
    urbanplan: { title: '都市計畫查詢', icon: 'landmark', render: renderUrbanPlan },
    readjust: { title: '市地重劃範圍', icon: 'layout-grid', render: renderReadjust },
    about: { title: '關於與資料來源', icon: 'info', render: renderAbout },
  }
  function openPanel(id) {
    activePanel = id
    const p = PANELS[id]
    $('#panel').hidden = false
    $('#panel .panel-title').innerHTML = `${ic(p.icon)}<span>${esc(p.title)}</span>`
    p.render($('#panelBody'))
    renderNav()
    refreshIcons()
    setTimeout(() => map.invalidateSize(), 240)
  }
  function closePanel() {
    activePanel = null
    $('#panel').hidden = true
    renderNav()
    exitPickMode()
    setTimeout(() => map.invalidateSize(), 50)
  }
  const rerender = (id) => { if (activePanel === id) PANELS[id].render($('#panelBody')), refreshIcons() }

  // 快速定位 ────────────────────────────────────────────────────────────
  let locateState = { query: '', results: [], error: '', loading: false, picked: null }
  function parseCoords(q) {
    const nums = q.replace(/[，、]/g, ',').match(/-?\d+(?:\.\d+)?/g)
    if (!nums || nums.length !== 2 || /[^\d\s.,\-()（）NnEe°]/.test(q.replace(/[，、]/g, ''))) return null
    let [a, b] = nums.map(Number)
    if (a > 100 && a < 130 && b > 20 && b < 27) [a, b] = [b, a]
    if (a > 20 && a < 27 && b > 116 && b < 124) return { lat: a, lng: b, label: `經緯度 ${a}, ${b}` }
    if (a > 2_400_000 && b < 400_000) [a, b] = [b, a]
    if (a > 100_000 && a < 400_000 && b > 2_400_000 && b < 2_800_000) {
      const p = fromTwd97(a, b)
      return { lat: p.lat, lng: p.lng, label: `TWD97 ${a}, ${b}` }
    }
    return null
  }
  async function runLocate(q) {
    q = q.trim()
    locateState = { query: q, results: [], error: '', loading: false, picked: null }
    if (!q) return rerender('locate')
    const coord = parseCoords(q)
    if (coord) { pickResult({ name: coord.label, sub: '座標定位', lat: coord.lat, lng: coord.lng }); return }
    locateState.loading = true
    rerender('locate')
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&limit=8&countrycodes=tw&accept-language=zh-TW&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      locateState.results = data.map((d) => ({
        name: d.name || d.display_name.split(',')[0],
        sub: d.display_name.split(',').map((s) => s.trim()).reverse().filter((s) => !/^\d{3,6}$/.test(s) && s !== '臺灣' && s !== '台灣').join(' '),
        lat: Number(d.lat), lng: Number(d.lon),
      }))
      if (!locateState.results.length) locateState.error = '找不到這個地點。可以改輸入路名加門牌、地標名稱，或直接貼經緯度／TWD97 座標。'
    } catch (err) {
      locateState.error = `地址查詢服務暫時連不上（${err.message}）。仍可直接輸入座標定位。`
    }
    locateState.loading = false
    rerender('locate')
  }
  function pickResult(r) {
    locateState.picked = r
    map.flyTo([r.lat, r.lng], Math.max(map.getZoom(), 18), { duration: 0.8 })
    placePin(r.lat, r.lng, r.name)
    rerender('locate')
  }
  function renderLocate(el) {
    const s = locateState
    el.innerHTML = `
      <label class="field-label" for="locQ">地址、地標或座標</label>
      <form class="search-row" id="locForm">
        <input class="input" id="locQ" autocomplete="off" placeholder="例：臺北市信義區市府路1號" value="${esc(s.query)}">
        <button class="btn" type="submit"${s.loading ? ' disabled' : ''}>${ic('search')}</button>
      </form>
      <p class="hint">可輸入<b>門牌地址</b>、<b>地標名稱</b>、<b>經緯度</b>（25.0330, 121.5654）或 <b>TWD97 座標</b>（306000, 2770000）。也可以在地圖上按右鍵直接定位。</p>
      ${s.loading ? '<div class="empty">查詢中…</div>' : ''}
      ${s.error ? `<div class="error">${esc(s.error)}</div>` : ''}
      ${s.results.length ? `<ul class="result-list">${s.results.map((r, i) => `
        <li><button type="button" class="result-item${s.picked === r ? ' active' : ''}" data-i="${i}">
          <div class="result-main">${esc(r.name)}</div><div class="result-sub">${esc(r.sub)}</div>
        </button></li>`).join('')}</ul>` : ''}
      ${s.picked ? `
        <div class="section"><div class="section-title">定位點</div>
          <div class="card">
            <div class="result-main">${esc(s.picked.name)}</div>
            <table class="kv" style="margin-top:8px">
              <tr><th>WGS84</th><td>${fmtLL(s.picked.lat, s.picked.lng)}</td></tr>
              <tr><th>TWD97</th><td>${fmtTwd(s.picked.lat, s.picked.lng)}</td></tr>
            </table>
            <div class="btn-row">
              ${APP.pointActions.map((a) => `<button class="btn btn-sm" type="button" data-act="${a.id}" data-lat="${s.picked.lat}" data-lng="${s.picked.lng}">${ic(a.icon)}${esc(a.label)}</button>`).join('')}
              <button class="btn btn-sm${APP.pointActions.length ? ' btn-ghost' : ''}" type="button" data-act="zone" data-lat="${s.picked.lat}" data-lng="${s.picked.lng}">${ic('landmark')}查分區</button>
              <a class="btn btn-sm btn-ghost" href="${streetViewUrl(s.picked.lat, s.picked.lng)}" target="_blank" rel="noopener">${ic('person-standing')}街景</a>
              <button class="btn btn-sm btn-ghost" type="button" data-act="copy" data-lat="${s.picked.lat}" data-lng="${s.picked.lng}">${ic('copy')}複製座標</button>
            </div>
          </div>
        </div>` : ''}
      <p class="hint" style="margin-top:18px">地址查詢使用 OpenStreetMap Nominatim，門牌精度依地區而異；需要精確門牌時，建議改用座標定位。</p>`
    $('#locForm', el).addEventListener('submit', (e) => { e.preventDefault(); runLocate($('#locQ', el).value) })
    el.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => pickResult(s.results[Number(b.dataset.i)])))
    if (!s.query && !isMobile()) setTimeout(() => $('#locQ', el)?.focus(), 50)
  }

  // 都市計畫查詢 ─────────────────────────────────────────────────────────
  // 臺北市：historygis ArcGIS 服務（layer 1 大比例尺分區，查不到再查 layer 0）。
  // ArcGIS 對錯誤請求回 HTTP 200 + {error}，一定要檢查 error 欄位，否則會誤判成查無資料。
  // 用 JSONP（callback 參數）呼叫，靜態網站不需要代理伺服器。
  const TAIPEI_PLAN = 'https://www.historygis.udd.gov.taipei/arcgis/rest/services/Urban/UrbanPlan/MapServer'
  let zoneResult = null
  let zoneMarker = null
  function jsonp(url, params, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const cb = `__jsonp_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
      const qs = new URLSearchParams({ ...params, callback: cb })
      const script = document.createElement('script')
      const timer = setTimeout(() => { cleanup(); reject(new Error('查詢逾時')) }, timeout)
      function cleanup() { clearTimeout(timer); delete window[cb]; script.remove() }
      window[cb] = (data) => { cleanup(); resolve(data) }
      script.onerror = () => { cleanup(); reject(new Error('服務連不上')) }
      script.src = `${url}?${qs}`
      document.head.appendChild(script)
    })
  }
  async function queryTaipeiLayer(layerId, lat, lng) {
    const data = await jsonp(`${TAIPEI_PLAN}/${layerId}/query`, {
      f: 'json', outFields: '*', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint',
      inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false',
    })
    if (data.error) throw new Error(`${data.error.message || '查詢失敗'}（code ${data.error.code}）`)
    return (data.features || []).map((f) => String(f.attributes?.NAME ?? '').trim()).filter(Boolean)
  }
  const inTaipeiBox = (lat, lng) => lat > 24.96 && lat < 25.22 && lng > 121.45 && lng < 121.67
  async function queryZone(lat, lng) {
    if (zoneMarker) map.removeLayer(zoneMarker)
    zoneMarker = L.circleMarker([lat, lng], { radius: 7, color: '#fff', weight: 2, fillColor: BRAND.accent, fillOpacity: 1 }).addTo(map)
    zoneResult = { lat, lng, loading: true, zones: [], error: '', taipei: inTaipeiBox(lat, lng) }
    rerender('urbanplan'); renderNav()
    if (zoneResult.taipei) {
      try {
        let zones = await queryTaipeiLayer(1, lat, lng)
        if (!zones.length) zones = await queryTaipeiLayer(0, lat, lng)
        zoneResult.zones = [...new Set(zones)]
      } catch (err) {
        zoneResult.error = `臺北市分區服務查詢失敗：${err.message}`
      }
    }
    zoneResult.loading = false
    rerender('urbanplan'); renderNav()
  }
  let pickMode = null // 'zone' | 'streetview'
  function exitPickMode() {
    pickMode = null
    APP.exitPickHooks.forEach((fn) => fn())
    map.getContainer().style.cursor = ''
    renderDock()
  }
  function renderUrbanPlan(el) {
    const r = zoneResult
    const zoningOn = overlays.has('urban_zoning_taipei')
    let body = ''
    if (!r) {
      body = '<div class="empty">在地圖上點一下要查詢的位置<br>（或按右鍵／手機長按 →「查詢都市計畫分區」）</div>'
    } else if (r.loading) {
      body = '<div class="empty">查詢中…</div>'
    } else {
      const coord = `<table class="kv" style="margin-top:8px"><tr><th>WGS84</th><td>${fmtLL(r.lat, r.lng)}</td></tr><tr><th>TWD97</th><td>${fmtTwd(r.lat, r.lng)}</td></tr></table>`
      if (r.error) body = `<div class="card"><div class="error" style="margin:0">${esc(r.error)}</div>${coord}</div>`
      else if (r.zones.length) body = `<div class="card"><div class="field-label">使用分區（臺北市）</div><div class="zone-badge">${r.zones.map(esc).join('、')}</div>${coord}
        <p class="hint">資料來源：臺北市政府都市發展局歷史圖資服務。實際分區與管制以都市計畫書圖及主管機關核發之分區證明為準。</p></div>`
      else body = `<div class="card"><div class="result-main">${r.taipei ? '這個位置查不到臺北市分區資料' : '這個位置不在臺北市'}</div>${coord}
        <p class="hint">目前可即時點查的是<b>臺北市</b>。其他縣市請用下方「全國土地使用分區資料查詢系統」，非都市土地可開啟圖層面板的「非都市計畫區使用分區圖」。</p>
        <div class="btn-row"><a class="btn btn-sm" href="https://luz.tcd.gov.tw/web/" target="_blank" rel="noopener">${ic('external-link')}全國使用分區查詢</a>
        <button class="btn btn-sm btn-ghost" type="button" id="nonUrbanBtn">${ic('layers')}非都市分區圖</button></div></div>`
    }
    el.innerHTML = `
      <div class="btn-row" style="margin-top:0">
        <button class="btn btn-sm${pickMode === 'zone' ? '' : ' btn-ghost'}" type="button" id="pickZone">${ic('crosshair')}${pickMode === 'zone' ? '請點地圖…' : '在地圖上選點'}</button>
        <button class="btn btn-sm btn-ghost" type="button" id="toggleZoning">${ic(zoningOn ? 'eye-off' : 'eye')}${zoningOn ? '隱藏' : '顯示'}臺北市分區圖</button>
      </div>
      <div class="section">${body}</div>
      ${zoningOn ? `<div class="section"><div class="section-title">分區圖例</div><div class="legend"><img alt="分區圖例" src="${CATALOG.layers.find((l) => l.id === 'urban_zoning_taipei').legendUrl}"></div></div>` : ''}`
    $('#pickZone', el).addEventListener('click', () => {
      pickMode = pickMode === 'zone' ? null : 'zone'
      map.getContainer().style.cursor = pickMode ? 'crosshair' : ''
      rerender('urbanplan')
    })
    $('#toggleZoning', el).addEventListener('click', () => { toggleOverlay('urban_zoning_taipei', !zoningOn, 0.6); rerender('urbanplan') })
    $('#nonUrbanBtn', el)?.addEventListener('click', () => { toggleOverlay('non_urban_zone', true, 0.7); toast('已開啟非都市計畫區使用分區圖') })
  }

  // 市地重劃 ─────────────────────────────────────────────────────────────
  let readjust = { data: null, loading: false, error: '', layer: null, visible: true, city: '全部', q: '', selected: null }
  const RJ_STYLE = {
    公辦: { color: '#1d4ed8', fillColor: '#3b82f6' },
    自辦: { color: '#b45309', fillColor: '#f59e0b' },
  }
  const rjStyle = (f, selected) => {
    const s = RJ_STYLE[f.properties.辦理方式] || { color: '#475569', fillColor: '#94a3b8' }
    return { ...s, weight: selected ? 3.5 : 1.4, fillOpacity: selected ? 0.38 : 0.18, opacity: 0.95, pane: 'readjust' }
  }
  const num = (v, d = 2) => (v === null || v === undefined || v === '' ? '—' : Number(v).toLocaleString('zh-TW', { maximumFractionDigits: d }))
  function rjPopup(p) {
    const row = (k, v) => (v === null || v === undefined || v === '' ? '' : `<tr><th>${k}</th><td>${esc(v)}</td></tr>`)
    return `<div class="pop-title">${esc(p.名稱)}</div>
      <table class="kv">
        ${row('縣市', p.縣市)}${row('辦理方式', p.辦理方式)}${row('進度', p.進度)}${row('年度', p.年度)}
        ${row('面積', p.面積_公頃 != null ? `${num(p.面積_公頃, 4)} 公頃` : '')}
        ${row('總負擔', p.總負擔比率 != null ? `${num(p.總負擔比率)}%` : '')}
        ${row('公設負擔', p.公設用地負擔比率 != null ? `${num(p.公設用地負擔比率)}%` : '')}
        ${row('費用負擔', p.費用負擔比率 != null ? `${num(p.費用負擔比率)}%` : '')}
        ${row('負擔性質', p.負擔性質)}${row('註記', p.核對註記)}
      </table>
      <p class="hint" style="font-size:11px">範圍：${esc(p.範圍來源 || '—')}<br>屬性：${esc(p.屬性來源 || '—')}</p>`
  }
  async function loadReadjust() {
    if (readjust.data || readjust.loading) return
    readjust.loading = true
    rerender('readjust')
    try {
      // 資料檔是 .js（GIS_DATA.readjust），直接雙擊 index.html（file://）也讀得到
      readjust.data = await window.GIS.loadDataset('readjust')
      readjust.data.features.forEach((f, i) => { f.properties.__i = i })
      readjust.layer = L.geoJSON(readjust.data, {
        style: (f) => rjStyle(f, false),
        onEachFeature: (f, layer) => {
          layer.bindPopup(rjPopup(f.properties), { maxWidth: 320 })
          layer.on('click', () => selectReadjust(f.properties.__i, false))
        },
      })
      if (readjust.visible) readjust.layer.addTo(map)
    } catch (err) {
      readjust.error = `重劃範圍資料讀取失敗（${err.message}）`
    }
    readjust.loading = false
    rerender('readjust')
  }
  function rjFiltered() {
    if (!readjust.data) return []
    const q = readjust.q.trim()
    return readjust.data.features.filter((f) => (readjust.city === '全部' || f.properties.縣市 === readjust.city) && (!q || f.properties.名稱.includes(q)))
  }
  function applyRjFilter() {
    if (!readjust.layer) return
    const keep = new Set(rjFiltered().map((f) => f.properties.__i))
    readjust.layer.eachLayer((l) => {
      const i = l.feature.properties.__i
      const show = keep.has(i)
      l.setStyle(show ? rjStyle(l.feature, i === readjust.selected) : { opacity: 0, fillOpacity: 0 })
      if (l.getElement()) l.getElement().style.pointerEvents = show ? '' : 'none'
    })
  }
  function selectReadjust(i, fly = true) {
    readjust.selected = i
    applyRjFilter()
    if (fly && readjust.layer) {
      const l = readjust.layer.getLayers().find((x) => x.feature.properties.__i === i)
      if (l) {
        if (!map.hasLayer(readjust.layer)) { readjust.visible = true; readjust.layer.addTo(map) }
        map.flyToBounds(l.getBounds(), { padding: [40, 40], maxZoom: 17, duration: 0.8 })
        setTimeout(() => l.openPopup(), 850)
      }
    }
    rerender('readjust')
  }
  function renderReadjust(el) {
    loadReadjust()
    const r = readjust
    if (!r.data) {
      el.innerHTML = r.error ? `<div class="error">${esc(r.error)}</div>` : '<div class="empty">載入重劃範圍中…</div>'
      return
    }
    const cities = ['全部', ...new Set(r.data.features.map((f) => f.properties.縣市))]
    const list = rjFiltered()
    const area = list.reduce((s, f) => s + (Number(f.properties.面積_公頃) || 0), 0)
    const burdens = list.map((f) => f.properties.總負擔比率).filter((v) => v !== null && v !== undefined && v !== '')
    const avgBurden = burdens.length ? burdens.reduce((s, v) => s + Number(v), 0) / burdens.length : null
    const shown = list.slice(0, 300)
    el.innerHTML = `
      <label class="layer-check" style="font-weight:600"><input type="checkbox" id="rjVisible"${r.visible ? ' checked' : ''}> 在地圖上顯示重劃範圍</label>
      <div class="chip-row" style="margin-top:12px">${cities.map((c) => `<button type="button" class="chip${r.city === c ? ' on' : ''}" data-city="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <input class="input" id="rjQ" style="margin-top:10px" placeholder="搜尋重劃區名稱" value="${esc(r.q)}">
      <div class="stat-row">
        <div class="stat"><div class="stat-k">重劃區</div><div class="stat-v">${list.length}</div></div>
        <div class="stat"><div class="stat-k">面積（公頃）</div><div class="stat-v">${num(area, 0)}</div></div>
        <div class="stat"><div class="stat-k">平均總負擔</div><div class="stat-v">${avgBurden === null ? '—' : num(avgBurden, 1) + '%'}</div></div>
      </div>
      <p class="hint">${ic('info')} 平均總負擔只計入有公布負擔比率的 ${burdens.length} 區。<span class="tag tag-pub">公辦</span><span class="tag tag-self">自辦</span>以顏色區分。桃園、臺南尚無公開範圍圖。</p>
      <ul class="result-list">${shown.map((f) => {
        const p = f.properties
        const tag = p.辦理方式 === '公辦' ? 'tag-pub' : p.辦理方式 === '自辦' ? 'tag-self' : 'tag-gray'
        return `<li><button type="button" class="result-item${r.selected === p.__i ? ' active' : ''}" data-rj="${p.__i}">
          <div class="result-main"><span class="tag ${tag}">${esc(p.辦理方式 || '—')}</span>${esc(p.名稱)}</div>
          <div class="result-sub">${esc(p.縣市)}・${p.面積_公頃 != null ? num(p.面積_公頃, 2) + ' 公頃' : '面積未載'}・總負擔 ${p.總負擔比率 != null ? num(p.總負擔比率) + '%' : '未公布'}${p.進度 ? '・' + esc(p.進度) : ''}</div>
        </button></li>`
      }).join('')}</ul>
      ${list.length > shown.length ? `<p class="hint">只列前 ${shown.length} 筆，請用縣市或名稱縮小範圍。</p>` : ''}
      ${!list.length ? '<div class="empty">沒有符合的重劃區</div>' : ''}`
    $('#rjVisible', el).addEventListener('change', (e) => {
      r.visible = e.target.checked
      if (r.layer) r.visible ? r.layer.addTo(map) : map.removeLayer(r.layer)
    })
    el.querySelectorAll('[data-city]').forEach((b) => b.addEventListener('click', () => { r.city = b.dataset.city; applyRjFilter(); rerender('readjust') }))
    const qi = $('#rjQ', el)
    let t = null
    qi.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { r.q = qi.value; applyRjFilter(); rerender('readjust'); const n = $('#rjQ'); n.focus(); n.setSelectionRange(n.value.length, n.value.length) }, 250) })
    el.querySelectorAll('[data-rj]').forEach((b) => b.addEventListener('click', () => selectReadjust(Number(b.dataset.rj))))
  }

  // 關於 ─────────────────────────────────────────────────────────────────
  function renderAbout(el) {
    const sources = [
      ['內政部國土測繪中心', '通用電子地圖、航照、地段圖、公有土地地籍、非都市分區與用地、地形與高程、土壤液化、海嘯、土石流'],
      ['臺北市政府都市發展局', '臺北市都市計畫使用分區、地籍圖、建物套繪、1/1000 地形圖'],
      ['經濟部地質調查及礦業管理中心', '斷層、順向坡'],
      ['經濟部水利署', '淹水潛勢'],
      ['各直轄市地政局／政府資料開放平臺', '市地重劃範圍與負擔比率'],
      ['OpenStreetMap、OpenFreeMap、Esri', '向量底圖、街道圖、衛星影像、地址查詢'],
    ]
    el.innerHTML = `
      <div class="card">
        <div class="result-main" style="font-size:16px">${esc(BRAND.name)}</div>
        <p class="hint">整合政府公開圖資的不動產查詢地圖。免登入、不蒐集個人資料，所有圖層都直接從資料提供機關的公開服務載入。</p>
        ${BRAND.contact ? `<p class="hint">${esc(BRAND.contact)}</p>` : ''}
      </div>
      <div class="section"><div class="section-title">資料來源</div>
        <table class="kv">${sources.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>
      </div>
      <div class="section"><div class="section-title">使用說明</div>
        <p class="hint">・右上工具列：圖層與底圖、量測距離面積、街景、回到預設位置、目前位置。<br>・地圖上按右鍵（手機長按）：顯示座標、查分區、開街景。<br>・畫面位置會記在網址上，可以直接複製網址分享。</p>
      </div>
      <div class="section"><div class="section-title">免責聲明</div>
        <p class="hint">本平台圖資僅供參考，不具法律效力。土地使用分區、地籍界線、災害潛勢等，請以主管機關公告及核發之文件為準。</p>
      </div>`
  }

  // ── 圖層面板 ────────────────────────────────────────────────────────────
  let layerPanelOpen = false
  const openCats = new Set(store.get('openCats', ['cadastral', 'urban_planning']))
  let layerQ = ''
  function applyLayerFilter() {
    const el = $('#layerBody'), q = layerQ.trim().toLowerCase()
    el.classList.toggle('searching', !!q)
    let hit = 0
    el.querySelectorAll('.layer-row[data-name]').forEach((r) => { const ok = !q || r.dataset.name.toLowerCase().includes(q); r.hidden = !ok; if (ok) hit++ })
    el.querySelectorAll('.layer-grp').forEach((g) => { g.hidden = !g.querySelector('.layer-row:not([hidden])') })
    el.querySelectorAll('.cat').forEach((c) => { c.hidden = !c.querySelector('.layer-row:not([hidden])') })
    const none = $('#layerNone', el)
    if (none) none.hidden = hit > 0
  }
  function renderLayerPanel() {
    if (!layerPanelOpen) return
    const el = $('#layerBody')
    const scroll = el.scrollTop
    const byCat = {}
    for (const l of CATALOG.layers) (byCat[l.category || 'other'] ||= []).push(l)
    el.innerHTML = `
      <div class="section-title">底圖</div>
      <div class="basemap-grid">${CATALOG.basemaps.map((b) => `
        <button type="button" class="basemap-btn${basemapId === b.id ? ' on' : ''}" data-bm="${b.id}">
          <div class="basemap-name">${esc(b.name.replace(/\s*\(.*\)\s*$/, '').replace('（預設）', ''))}</div>
          <div class="basemap-desc">${esc(b.desc || '')}</div>
        </button>`).join('')}</div>
      <div class="section">
        <div class="section-title">疊加圖層</div>
        <div class="layer-search">${ic('search')}<input class="input" id="layerQ" type="search" autocomplete="off" placeholder="搜尋圖層名稱，例如：液化、捷運" value="${esc(layerQ)}"></div>
        ${CATALOG.categoryOrder.filter((c) => byCat[c]).map((c) => {
          const on = byCat[c].filter((l) => overlays.has(l.id)).length
          return `<div class="cat${openCats.has(c) ? ' open' : ''}" data-cat="${c}">
            <button type="button" class="cat-head">${ic('chevron-right', 'chev')}${esc(CATALOG.categoryLabels[c])}${on ? `<span class="count">${on}</span>` : ''}</button>
            <div class="cat-body">${byCat[c].map((l) => {
              const o = overlays.get(l.id)
              return `<div class="layer-row" data-name="${esc(l.name)}">
                <label class="layer-check"><input type="checkbox" data-layer="${l.id}"${o ? ' checked' : ''}>${esc(l.name)}</label>
                ${o ? `<div class="layer-extra">
                  <div class="opacity">透明度<input type="range" min="0.1" max="1" step="0.05" value="${o.opacity}" data-op="${l.id}"></div>
                  ${l.legendUrl ? `<div class="legend"><img alt="${esc(l.name)}圖例" src="${l.legendUrl}" loading="lazy"></div>` : ''}
                </div>` : ''}
              </div>`
            }).join('')}</div>
          </div>`
        }).join('')}
        ${APP.layerExtra ? APP.layerExtra.html() : ''}
        <div class="empty" id="layerNone" hidden>找不到符合的圖層</div>
      </div>
      <p class="hint">圖層直接向各機關公開服務索取，載入速度依對方伺服器而定；部分圖層只在放大到一定比例後才會顯示。</p>`
    el.querySelectorAll('[data-bm]').forEach((b) => b.addEventListener('click', () => setBasemap(b.dataset.bm)))
    $('#layerQ', el).addEventListener('input', (e) => { layerQ = e.target.value; applyLayerFilter() })
    el.querySelectorAll('.cat-head').forEach((b) => b.addEventListener('click', () => {
      const c = b.parentElement.dataset.cat
      openCats.has(c) ? openCats.delete(c) : openCats.add(c)
      store.set('openCats', [...openCats])
      b.parentElement.classList.toggle('open')
    }))
    el.querySelectorAll('[data-layer]').forEach((cb) => cb.addEventListener('change', () => toggleOverlay(cb.dataset.layer, cb.checked)))
    el.querySelectorAll('[data-op]').forEach((r) => r.addEventListener('input', () => setOpacity(r.dataset.op, Number(r.value))))
    if (APP.layerExtra) APP.layerExtra.bind(el)
    applyLayerFilter()
    refreshIcons()
    el.scrollTop = scroll
  }
  function setLayerPanel(open) {
    layerPanelOpen = open
    $('#layerPanel').hidden = !open
    $('#toolDock').classList.toggle('shift', open)
    renderLayerPanel()
    renderDock()
  }
  $('#layerClose').addEventListener('click', () => setLayerPanel(false))

  // ── 量測 ────────────────────────────────────────────────────────────────
  let measure = null // { mode, points, line, preview, labels }
  const measureGroup = L.layerGroup().addTo(map)
  function polygonArea(latlngs) {
    const R = 6378137, rad = Math.PI / 180
    let s = 0
    for (let i = 0; i < latlngs.length; i++) {
      const p1 = latlngs[i], p2 = latlngs[(i + 1) % latlngs.length]
      s += (p2.lng - p1.lng) * rad * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad))
    }
    return Math.abs(s * R * R / 2)
  }
  const fmtLen = (m) => (m >= 1000 ? `${(m / 1000).toFixed(3)} 公里` : `${m.toFixed(1)} 公尺`)
  const fmtArea = (m2) => `${m2.toLocaleString('zh-TW', { maximumFractionDigits: 1 })} ㎡｜${(m2 * 0.3025).toLocaleString('zh-TW', { maximumFractionDigits: 1 })} 坪${m2 >= 10000 ? `｜${(m2 / 10000).toFixed(3)} 公頃` : ''}`
  function measureValue(pts) {
    if (!measure) return ''
    if (measure.mode === 'distance') {
      let d = 0
      for (let i = 1; i < pts.length; i++) d += map.distance(pts[i - 1], pts[i])
      return pts.length < 2 ? '點地圖開始量測' : fmtLen(d)
    }
    return pts.length < 3 ? '至少點三個點' : fmtArea(polygonArea(pts))
  }
  function drawMeasure(extra) {
    measureGroup.clearLayers()
    if (!measure) return
    const pts = extra ? [...measure.points, extra] : measure.points
    const style = { color: BRAND.accent, weight: 3, dashArray: measure.done ? null : '6 6' }
    if (measure.mode === 'distance' && pts.length >= 2) L.polyline(pts, style).addTo(measureGroup)
    if (measure.mode === 'area' && pts.length >= 2) L.polygon(pts, { ...style, fillOpacity: 0.15 }).addTo(measureGroup)
    measure.points.forEach((p) => L.circleMarker(p, { radius: 4, color: '#fff', weight: 2, fillColor: BRAND.accent, fillOpacity: 1 }).addTo(measureGroup))
    renderMeasureBar(measureValue(pts))
  }
  function renderMeasureBar(value) {
    const bar = $('#measureBar')
    if (!measure) { bar.hidden = true; return }
    bar.hidden = false
    bar.innerHTML = `<span class="seg"><button type="button" data-mm="distance" class="${measure.mode === 'distance' ? 'on' : ''}">距離</button><button type="button" data-mm="area" class="${measure.mode === 'area' ? 'on' : ''}">面積</button></span>
      <span class="measure-val">${esc(value)}</span>
      ${measure.done ? '' : '<span style="color:var(--faint);font-weight:500">雙擊結束</span>'}
      <button type="button" class="icon-btn" data-mm="clear" title="清除重來">${ic('rotate-ccw')}</button>
      <button type="button" class="icon-btn" data-mm="close" title="關閉量測">${ic('x')}</button>`
    bar.querySelectorAll('[data-mm]').forEach((b) => b.addEventListener('click', () => {
      const v = b.dataset.mm
      if (v === 'close') return stopMeasure()
      startMeasure(v === 'clear' ? measure.mode : v)
    }))
    refreshIcons()
  }
  function startMeasure(mode) {
    exitPickMode()
    measure = { mode, points: [], done: false }
    map.doubleClickZoom.disable()
    map.getContainer().style.cursor = 'crosshair'
    drawMeasure()
    renderDock()
  }
  function stopMeasure() {
    measure = null
    measureGroup.clearLayers()
    map.doubleClickZoom.enable()
    map.getContainer().style.cursor = ''
    $('#measureBar').hidden = true
    renderDock()
  }

  // ── 地圖事件 ────────────────────────────────────────────────────────────
  map.on('click', (e) => {
    hideCtx()
    if (measure) {
      if (measure.done) measure = { mode: measure.mode, points: [], done: false }
      measure.points.push(e.latlng)
      drawMeasure()
      return
    }
    if (pickMode === 'streetview') {
      window.open(streetViewUrl(e.latlng.lat, e.latlng.lng), '_blank', 'noopener')
      exitPickMode()
      return
    }
    for (const h of APP.clickHandlers) if (h(e)) return
    if (pickMode === 'zone' || activePanel === 'urbanplan') {
      queryZone(e.latlng.lat, e.latlng.lng)
      if (pickMode === 'zone') exitPickMode()
    }
  })
  map.on('dblclick', () => {
    if (!measure || measure.done) return
    // 雙擊會先觸發兩次 click，最後一點重複，拿掉
    if (measure.points.length > 1) measure.points.pop()
    measure.done = true
    map.getContainer().style.cursor = ''
    drawMeasure()
  })
  map.on('mousemove', (e) => { if (measure && !measure.done && measure.points.length) drawMeasure(e.latlng) })
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    hideCtx()
    if (measure) stopMeasure()
    else if (pickMode) exitPickMode()
  })

  // ── 右鍵選單 ────────────────────────────────────────────────────────────
  function hideCtx() { $('#ctxMenu').hidden = true }
  map.on('contextmenu', (e) => {
    const { lat, lng } = e.latlng
    const menu = $('#ctxMenu')
    menu.innerHTML = `
      <div class="ctx-head">WGS84　${fmtLL(lat, lng)}<br>TWD97　${fmtTwd(lat, lng)}</div>
      <button class="ctx-item" data-ctx="pin">${ic('map-pin')}在這裡定位</button>
      ${APP.ctxItems.map((a) => `<button class="ctx-item" data-ctx="x:${a.id}">${ic(a.icon)}${esc(a.label)}</button>`).join('')}
      <button class="ctx-item" data-ctx="zone">${ic('landmark')}查詢都市計畫分區</button>
      <button class="ctx-item" data-ctx="sv">${ic('person-standing')}開啟 Google 街景</button>
      <button class="ctx-item" data-ctx="gmap">${ic('map')}在 Google 地圖開啟</button>
      <button class="ctx-item" data-ctx="copy">${ic('copy')}複製經緯度</button>
      <button class="ctx-item" data-ctx="copy97">${ic('copy')}複製 TWD97 座標</button>`
    const pt = e.originalEvent.touches?.[0] || e.originalEvent
    menu.hidden = false
    const w = menu.offsetWidth, h = menu.offsetHeight
    menu.style.left = `${Math.min(pt.clientX, window.innerWidth - w - 8)}px`
    menu.style.top = `${Math.min(pt.clientY, window.innerHeight - h - 8)}px`
    refreshIcons()
    menu.querySelectorAll('[data-ctx]').forEach((b) => b.addEventListener('click', () => {
      hideCtx()
      const a = b.dataset.ctx
      if (a === 'pin') { locateState = { query: '', results: [], error: '', loading: false, picked: { name: '地圖選點', lat, lng } }; placePin(lat, lng, '地圖選點').openPopup(); rerender('locate') }
      if (a === 'zone') { openPanel('urbanplan'); queryZone(lat, lng) }
      if (a === 'sv') window.open(streetViewUrl(lat, lng), '_blank', 'noopener')
      if (a === 'gmap') window.open(gmapUrl(lat, lng), '_blank', 'noopener')
      if (a === 'copy') copyText(fmtLL(lat, lng))
      if (a === 'copy97') copyText(fmtTwd(lat, lng))
      if (a.startsWith('x:')) APP.ctxItems.find((x) => 'x:' + x.id === a).on(lat, lng)
    }))
  })
  document.addEventListener('pointerdown', (e) => { if (!e.target.closest('#ctxMenu')) hideCtx() })
  map.on('movestart', hideCtx)

  // ── 右上工具列 ──────────────────────────────────────────────────────────
  let locating = false
  function locateMe() {
    if (!navigator.geolocation) return toast('這個瀏覽器不支援定位')
    locating = true; renderDock()
    navigator.geolocation.getCurrentPosition((pos) => {
      locating = false; renderDock()
      const { latitude: lat, longitude: lng, accuracy } = pos.coords
      map.flyTo([lat, lng], 17, { duration: 0.8 })
      placePin(lat, lng, '目前位置')
      toast(`定位完成（誤差約 ${Math.round(accuracy)} 公尺）`)
    }, (err) => {
      locating = false; renderDock()
      toast(err.code === 1 ? '定位權限被拒絕，請在瀏覽器設定中允許位置存取' : '無法取得目前位置')
    }, { enableHighAccuracy: true, timeout: 12000 })
  }
  function renderDock() {
    const groups = [
      [
        { id: 'layers', label: '圖層與底圖', icon: 'layers', active: layerPanelOpen, on: () => setLayerPanel(!layerPanelOpen) },
        { id: 'measure', label: '量測距離與面積', icon: 'ruler', active: !!measure, on: () => (measure ? stopMeasure() : startMeasure('distance')) },
        { id: 'sv', label: '街景（點地圖開啟）', icon: 'person-standing', active: pickMode === 'streetview', on: () => {
          if (pickMode === 'streetview') return exitPickMode()
          if (measure) stopMeasure()
          exitPickMode()
          pickMode = 'streetview'; map.getContainer().style.cursor = 'crosshair'; renderDock(); toast('點地圖上要看街景的位置')
        } },
        ...APP.tools.map((t) => ({ ...t, active: !!(t.active && t.active()) })),
      ],
      [
        { id: 'home', label: BRAND.home.label, icon: 'home', on: () => map.flyTo(BRAND.home.center, BRAND.home.zoom, { duration: 0.8 }) },
        { id: 'me', label: '到目前位置', icon: locating ? 'loader' : 'locate-fixed', on: locateMe },
      ],
      [
        { id: 'zin', label: '放大', icon: 'plus', on: () => map.zoomIn() },
        { id: 'zout', label: '縮小', icon: 'minus', on: () => map.zoomOut() },
      ],
    ]
    const dock = $('#toolDock')
    dock.innerHTML = groups.map((g) => `<div class="tool-group">${g.map((t) => `
      <button type="button" class="tool${t.active ? ' active' : ''}" data-tool="${t.id}" aria-label="${esc(t.label)}">${ic(t.icon)}<span class="tool-tip">${esc(t.label)}</span></button>`).join('')}</div>`).join('')
    const all = groups.flat()
    dock.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => all.find((t) => t.id === b.dataset.tool).on()))
    refreshIcons()
  }

  // ── 啟動 ────────────────────────────────────────────────────────────────
  applyBrand()
  $('#collapseBtn').addEventListener('click', () => setCollapsed(true))
  $('#brandMark').addEventListener('click', () => { if (collapsed) setCollapsed(false) })
  $('#panelClose').addEventListener('click', closePanel)
  setCollapsed(collapsed)
  renderNav()
  renderDock()
  setBasemap(basemapId)
  for (const [id, op] of store.get('overlays', [])) toggleOverlay(id, true, op)
  // 重劃範圍資料集：planning 圖資包也會宣告同一份，這裡保險補上
  if (window.GIS && !window.GIS.datasets.readjust) window.GIS.datasets.readjust = { id: 'readjust', name: '市地重劃範圍', file: 'data/land-readjustment.js', geometry: 'polygon', showAsLayer: false }
  // 開啟時預設展開的面板：config.js 的 defaultPanel，網址 ?panel=<id> 可覆寫（?panel=none 不展開）
  const startPanel = new URLSearchParams(location.search).get('panel') || BRAND.defaultPanel || 'sitecheck'
  // 其他功能檔（sitecheck.js 等）在 app.js 之後才載入並註冊面板，所以等整頁載完再展開
  const openStart = () => { if (!activePanel && PANELS[startPanel]) openPanel(startPanel) }
  if (!isMobile() && !EMBED && !hashSuffix) (document.readyState === 'complete' ? setTimeout(openStart, 0) : window.addEventListener('load', openStart))
  window.addEventListener('resize', () => map.invalidateSize())

  Object.assign(APP, {
    map, BRAND, CATALOG, NAV, PANELS, $, ic, esc, store, isMobile, refreshIcons, toast, copyText,
    fmtLL, fmtTwd, toTwd97, streetViewUrl, gmapUrl, placePin,
    openPanel, closePanel, rerender, renderNav, renderDock, renderLayerPanel, setLayerPanel, setCollapsed,
    exitPickMode, stopMeasure, toggleOverlay,
    activePanel: () => activePanel,
    isMeasuring: () => !!measure,
    hasOverlay: (id) => overlays.has(id),
  })
})()
