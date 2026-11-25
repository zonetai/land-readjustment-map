/* 圖資包的圖層介面：把 GIS.packs 裡的圖磚圖層與靜態資料集放進右側圖層面板。
 * 掛在 window.APP（js/app.js）上；對外提供 window.PACKUI 給其他功能檔開關圖層。 */
(function () {
  'use strict'
  const APP = window.APP, GIS = window.GIS
  if (!APP || !GIS) return
  const { map, $, ic, esc, store, toast } = APP
  // 圖資包指定的圖示名稱如果這一版 lucide 沒有，改用相近的或通用圖示，不要留一個空白
  const ICON_ALIAS = { 'chart-column': 'bar-chart-3', 'chart-bar': 'bar-chart', 'house': 'home' }
  const hasIcon = (name) => !window.lucide || !window.lucide.icons || !!window.lucide.icons[String(name).replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())]
  const packIcon = (name) => (name && hasIcon(name) ? name : name && ICON_ALIAS[name] && hasIcon(ICON_ALIAS[name]) ? ICON_ALIAS[name] : 'package')

  // 資料集畫在圖磚之上、其他向量（重劃範圍、量測、體檢標記）之下，才不會擋住它們的點擊
  map.createPane('packdata').style.zIndex = 390
  const canvas = L.canvas({ pane: 'packdata', padding: 0.3, tolerance: 4 })
  const DEFAULT_COLOR = '#2563eb'
  const GRAY = '#cbd5e1'

  const on = new Map() // id → { kind:'tile'|'data', def, layer, opacity, theme, loading, error }
  const openPacks = new Set(store.get('openPacks', GIS.packs.map((p) => p.id)))
  const save = () => store.set('packLayers', [...on.entries()].filter(([, v]) => !v.error).map(([id, v]) => [id, v.opacity, v.theme || '']))

  // ── 圖磚圖層 ───────────────────────────────────────────────────────────
  const HALF = 20037508.342789244
  const ArcGISExport = L.TileLayer.extend({
    getTileUrl(c) {
      const span = (2 * HALF) / Math.pow(2, c.z)
      const x0 = -HALF + c.x * span, y1 = HALF - c.y * span
      const q = new URLSearchParams({ bbox: [x0, y1 - span, x0 + span, y1].join(','), bboxSR: '3857', imageSR: '3857', size: '256,256', format: 'png32', transparent: 'true', f: 'image' })
      if (this.options.layersParam) q.set('layers', this.options.layersParam)
      return this._url.replace(/\/$/, '') + '/export?' + q
    },
  })
  function makeTile(def, opacity) {
    const common = { pane: 'overlays', opacity, maxZoom: 20, minZoom: def.minZoom || 0, attribution: def.source ? esc(def.source) : '' }
    if (def.type === 'wms') {
      return L.tileLayer.wms(def.url, { ...common, layers: def.layerName, format: def.wmsFormat || 'image/png', transparent: true, version: def.wmsVersion || '1.1.1', ...(def.wmsStyles ? { styles: def.wmsStyles } : {}) })
    }
    if (def.type === 'arcgis') return new ArcGISExport(def.url, { ...common, layersParam: def.layerName || '' })
    return L.tileLayer(def.url, { ...common, maxNativeZoom: def.maxNativeZoom || 19 })
  }

  // ── 靜態資料集 ─────────────────────────────────────────────────────────
  const themeOf = (def, st) => (def.themes || []).find((t) => t.field === st.theme) || null
  const themeValue = (t, props) => { const v = props[t.valueField || t.field]; return v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v) }
  function themeColor(t, v) {
    if (v === null) return GRAY
    let i = 0
    while (i < t.breaks.length && v >= t.breaks[i]) i++
    return t.colors[Math.min(i, t.colors.length - 1)]
  }
  const fmtNum = (v) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' || /^-?\d+(\.\d+)?$/.test(String(v)) ? Number(v).toLocaleString('zh-TW', { maximumFractionDigits: 2 }) : String(v))
  function themeLegend(t) {
    const u = t.unit ? ' ' + t.unit : ''
    // 圖資包自己寫好各級文字（classes）就照用，單位另外標在指標名稱旁
    if (Array.isArray(t.classes) && t.classes.length === t.colors.length) return t.colors.map((color, i) => ({ color, label: String(t.classes[i]) })).concat([{ color: GRAY, label: '沒有資料' }])
    return t.colors.map((color, i) => ({
      color,
      label: i === 0 ? `低於 ${fmtNum(t.breaks[0])}${u}` : i >= t.breaks.length ? `${fmtNum(t.breaks[t.breaks.length - 1])}${u} 以上` : `${fmtNum(t.breaks[i - 1])}～${fmtNum(t.breaks[i])}${u}`,
    })).concat([{ color: GRAY, label: '沒有資料' }])
  }
  function featureStyle(def, st, f) {
    const s = def.style || {}
    const t = themeOf(def, st)
    let color = s.color || DEFAULT_COLOR
    if (t) color = themeColor(t, themeValue(t, f.properties || {}))
    else if (def.styleBy && def.styleBy.map) color = def.styleBy.map[(f.properties || {})[def.styleBy.field]] || def.styleBy.other || s.color || '#64748b'
    const geom = def.geometry || (f.geometry && /Point/.test(f.geometry.type) ? 'point' : /Line/.test(f.geometry.type) ? 'line' : 'polygon')
    const o = st.opacity
    // 點一律畫成白邊實心圓點，任何底圖上都看得清楚
    if (geom === 'point') return { radius: s.radius || 5, color: '#fff', weight: 1, opacity: o, fillColor: color, fillOpacity: o * Math.max(0.75, s.fillOpacity || 0.9) }
    if (geom === 'line') return { color, weight: s.weight || 3, opacity: o }
    return t
      ? { color: '#fff', weight: 0.8, opacity: o, fillColor: color, fillOpacity: o * 0.85 }
      : { color, weight: s.weight || 1.5, opacity: o, fillColor: s.fillColor || color, fillOpacity: o * (s.fillOpacity ?? 0.25) }
  }
  function popupHtml(def, st, f) {
    const p = f.properties || {}
    const t = themeOf(def, st)
    const title = def.labelField && p[def.labelField] ? p[def.labelField] : def.name
    const rows = []
    if (t) rows.push([t.label, themeValue(t, p) === null ? '沒有資料' : fmtNum(themeValue(t, p)) + (t.unit ? ' ' + t.unit : '')])
    for (const [field, label] of def.popupFields || []) {
      if (field === def.labelField || (t && field === (t.valueField || t.field)) || p[field] === null || p[field] === undefined || p[field] === '') continue
      rows.push([label || field, p[field]])
    }
    return `<div class="pop-title">${esc(title)}</div>
      ${rows.length ? `<table class="kv">${rows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>` : ''}
      <p class="hint" style="font-size:11px">${esc(def.name)}${def.source ? '・' + esc(def.source) : ''}${def.updated ? '・' + esc(def.updated) : ''}</p>`
  }
  function makeData(def, st, fc) {
    return L.geoJSON(fc, {
      renderer: canvas, pane: 'packdata', bubblingMouseEvents: false,
      pointToLayer: (f, latlng) => L.circleMarker(latlng, { renderer: canvas, pane: 'packdata', bubblingMouseEvents: false }),
      style: (f) => featureStyle(def, st, f),
      onEachFeature: (f, layer) => {
        if (def.labelField && f.properties && f.properties[def.labelField]) layer.bindTooltip(() => esc(f.properties[def.labelField]), { sticky: true, direction: 'top', className: 'data-tip' })
        layer.bindPopup(() => popupHtml(def, st, f), { maxWidth: 320 })
      },
    })
  }
  const tooFar = (def) => !!def.minZoom && map.getZoom() < def.minZoom
  function syncZoom() {
    let changed = false
    for (const [, st] of on) {
      if (st.kind !== 'data' || !st.layer) continue
      const hide = tooFar(st.def)
      if (hide && map.hasLayer(st.layer)) { map.removeLayer(st.layer); changed = true }
      if (!hide && !map.hasLayer(st.layer)) { st.layer.addTo(map); changed = true }
    }
    if (changed || [...on.values()].some((st) => st.def.minZoom)) refreshHints()
  }
  map.on('zoomend', syncZoom)
  function refreshHints() {
    document.querySelectorAll('#layerBody [data-zoomhint]').forEach((el) => {
      const st = on.get(el.dataset.zoomhint)
      el.hidden = !(st && tooFar(st.def))
    })
  }

  // ── 開關 ───────────────────────────────────────────────────────────────
  const defOf = (id) => (GIS.layers[id] ? { kind: 'tile', def: GIS.layers[id] } : GIS.datasets[id] ? { kind: 'data', def: GIS.datasets[id] } : null)
  function toggle(id, want, opt = {}) {
    const d = defOf(id)
    if (!d) { // 不是圖資包的圖層，交給平台原有的圖層目錄
      if (APP.CATALOG.layers.some((l) => l.id === id)) APP.toggleOverlay(id, want)
      return
    }
    if (want && !on.has(id)) {
      const st = { ...d, opacity: opt.opacity ?? d.def.opacity ?? (d.kind === 'tile' || (d.def.themes && d.def.themes.length) ? 0.7 : 0.9), theme: opt.theme || (d.def.themes && d.def.themes[0] ? d.def.themes[0].field : ''), layer: null, loading: false, error: '' }
      on.set(id, st)
      if (d.kind === 'tile') {
        st.layer = makeTile(d.def, st.opacity).addTo(map)
        if (tooFar(d.def) && !opt.quiet) toast(`「${d.def.name}」要放大到第 ${d.def.minZoom} 級以上才會顯示`)
      } else {
        st.loading = true
        GIS.loadDataset(id).then((fc) => {
          st.loading = false
          if (on.get(id) !== st) return // 載入期間已被關掉
          st.layer = makeData(d.def, st, fc)
          if (!tooFar(d.def)) st.layer.addTo(map)
          else if (!opt.quiet) toast(`「${d.def.name}」要放大到第 ${d.def.minZoom} 級以上才會顯示`)
          APP.renderLayerPanel(); notify()
        }, (err) => {
          st.loading = false; st.error = String((err && err.message) || err)
          APP.renderLayerPanel(); notify()
        })
      }
    } else if (!want && on.has(id)) {
      const st = on.get(id)
      if (st.layer && map.hasLayer(st.layer)) map.removeLayer(st.layer)
      on.delete(id)
    }
    save(); APP.renderLayerPanel(); notify()
  }
  function setOpacity(id, v) {
    const st = on.get(id); if (!st) return
    st.opacity = v
    if (st.kind === 'tile') st.layer.setOpacity(v)
    else if (st.layer) st.layer.setStyle((f) => featureStyle(st.def, st, f))
    save()
  }
  function setTheme(id, field) {
    const st = on.get(id); if (!st) return
    st.theme = field
    if (st.layer) st.layer.setStyle((f) => featureStyle(st.def, st, f))
    map.closePopup()
    save(); APP.renderLayerPanel()
  }
  const listeners = []
  const notify = () => listeners.forEach((fn) => fn())

  // ── 圖層面板區塊 ───────────────────────────────────────────────────────
  const swatches = (items) => `<div class="legend swatches">${items.map((x) => `<div class="swatch"><span style="background:${esc(x.color)}"></span>${esc(x.label)}</div>`).join('')}</div>`
  function rowHtml(kind, def) {
    const st = on.get(def.id)
    let extra = ''
    if (st) {
      const t = kind === 'data' ? themeOf(def, st) : null
      const legend = t ? swatches(themeLegend(t))
        : def.legend && def.legend.length ? swatches(def.legend)
        : def.styleBy && def.styleBy.map ? swatches(Object.entries(def.styleBy.map).map(([label, color]) => ({ label, color })))
        : def.legendUrl ? `<div class="legend"><img alt="${esc(def.name)}圖例" src="${esc(def.legendUrl)}" loading="lazy"></div>` : ''
      extra = `<div class="layer-extra">
        ${st.loading ? '<div class="layer-note">資料載入中…</div>' : ''}
        ${st.error ? `<div class="layer-note bad">這份資料讀不到（${esc(st.error)}）</div>` : ''}
        ${def.themes && def.themes.length ? `<label class="theme-pick">顯示指標<select data-theme="${esc(def.id)}">${def.themes.map((x) => `<option value="${esc(x.field)}"${st.theme === x.field ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>` : ''}
        <div class="opacity">透明度<input type="range" min="0.1" max="1" step="0.05" value="${st.opacity}" data-pop="${esc(def.id)}"></div>
        <div class="layer-note warn" data-zoomhint="${esc(def.id)}"${tooFar(def) ? '' : ' hidden'}>目前地圖縮得太小，放大到第 ${def.minZoom} 級以上才會顯示</div>
        ${legend}
        ${t && (t.unit || t.period || t.source) ? `<div class="layer-note">${esc([t.unit ? '單位：' + t.unit : '', t.period ? '統計期：' + t.period : '', t.source || ''].filter(Boolean).join('・'))}</div>` : ''}
        ${def.note ? `<div class="layer-note">${esc(def.note)}</div>` : ''}
        ${def.source ? `<div class="layer-src">來源：${def.sourceUrl ? `<a href="${esc(def.sourceUrl)}" target="_blank" rel="noopener">${esc(def.source)}</a>` : esc(def.source)}${def.updated ? `（${esc(def.updated)}）` : ''}</div>` : ''}
      </div>`
    }
    const meta = kind === 'data' && def.count ? `<span class="layer-meta">${Number(def.count).toLocaleString('zh-TW')} 筆</span>` : ''
    return `<div class="layer-row" data-name="${esc(def.name + ' ' + (def.group || '') + ' ' + (def.source || ''))}">
      <label class="layer-check"><input type="checkbox" data-pack-layer="${esc(def.id)}"${st ? ' checked' : ''}><span>${esc(def.name)}</span>${meta}</label>${extra}</div>`
  }
  function packHtml(p) {
    const entries = [...p.layers.map((def) => ['tile', def]), ...p.datasets.filter((d) => d.showAsLayer !== false).map((def) => ['data', def])]
    if (!entries.length) return ''
    const groups = []
    for (const e of entries) {
      const g = e[1].group || ''
      let grp = groups.find((x) => x.name === g)
      if (!grp) groups.push((grp = { name: g, items: [] }))
      grp.items.push(e)
    }
    const count = entries.filter(([, d]) => on.has(d.id)).length
    return `<div class="cat${openPacks.has(p.id) ? ' open' : ''}" data-pack="${esc(p.id)}">
      <button type="button" class="cat-head" data-pack-head>${ic('chevron-right', 'chev')}${ic(packIcon(p.icon))}${esc(p.name)}<span class="cat-total">${entries.length}</span>${count ? `<span class="count">${count}</span>` : ''}</button>
      <div class="cat-body">${groups.map((g) => `<div class="layer-grp">${g.name ? `<div class="layer-group-title">${esc(g.name)}</div>` : ''}${g.items.map(([k, d]) => rowHtml(k, d)).join('')}</div>`).join('')}</div>
    </div>`
  }
  APP.layerExtra = {
    html() {
      const blocks = GIS.packs.map(packHtml).filter(Boolean)
      if (!blocks.length) return ''
      return `<div class="section-title" style="margin-top:16px">主題圖資</div>${blocks.join('')}`
    },
    bind(el) {
      el.querySelectorAll('[data-pack-head]').forEach((b) => b.addEventListener('click', () => {
        const id = b.parentElement.dataset.pack
        openPacks.has(id) ? openPacks.delete(id) : openPacks.add(id)
        store.set('openPacks', [...openPacks])
        b.parentElement.classList.toggle('open')
      }))
      el.querySelectorAll('[data-pack-layer]').forEach((cb) => cb.addEventListener('change', () => toggle(cb.dataset.packLayer, cb.checked)))
      el.querySelectorAll('[data-pop]').forEach((r) => r.addEventListener('input', () => setOpacity(r.dataset.pop, Number(r.value))))
      el.querySelectorAll('[data-theme]').forEach((s) => s.addEventListener('change', () => setTheme(s.dataset.theme, s.value)))
    },
  }

  window.PACKUI = {
    toggle, packIcon,
    isOn: (id) => on.has(id) || APP.hasOverlay(id),
    exists: (id) => !!defOf(id) || APP.CATALOG.layers.some((l) => l.id === id),
    nameOf: (id) => (defOf(id) ? defOf(id).def.name : (APP.CATALOG.layers.find((l) => l.id === id) || {}).name || ''),
    onChange: (fn) => listeners.push(fn),
  }

  // 還原上次開著的圖層（嵌入模式不還原，每次都從乾淨的地圖開始）
  if (!APP.embed) for (const [id, opacity, theme] of store.get('packLayers', [])) if (defOf(id)) toggle(id, true, { opacity, theme, quiet: true })
  APP.renderLayerPanel()
})()
