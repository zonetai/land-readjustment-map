// ── 圖資包核心 ────────────────────────────────────────────────────────────
// 不含任何介面。負責：圖資包註冊、靜態資料集載入、空間運算、對外查詢工具、執行「地點體檢」。
// 圖資包放在 packs/<id>/pack.js，以 GIS.registerPack({...}) 註冊；規格見 packs/README.md。
// 這個檔在瀏覽器（含 file:// 直接開啟）與 Node（測試）都能執行。
;(function (root) {
  'use strict'
  const GIS = (root.GIS = root.GIS || {})
  root.GIS_DATA = root.GIS_DATA || {}
  GIS.packs = []
  GIS.layers = {} // id -> 圖磚圖層定義
  GIS.datasets = {} // id -> 靜態資料集定義
  GIS.checks = [] // 地點體檢項目
  const isNode = typeof document === 'undefined'

  GIS.registerPack = function (pack) {
    if (!pack || !pack.id) throw new Error('pack.id 必填')
    if (GIS.packs.some((p) => p.id === pack.id)) return
    pack.layers = pack.layers || []
    pack.datasets = pack.datasets || []
    pack.checks = pack.checks || []
    for (const l of pack.layers) { l.pack = pack.id; l.category = l.category || pack.id; GIS.layers[l.id] = l }
    for (const d of pack.datasets) { d.pack = pack.id; GIS.datasets[d.id] = d }
    for (const c of pack.checks) { c.pack = pack.id; c.group = c.group || pack.id; GIS.checks.push(c) }
    GIS.packs.push(pack)
    GIS.packs.sort((a, b) => (a.order || 99) - (b.order || 99))
  }

  // ── 靜態資料集：packs/<pack>/data/<file>.js 內容為 window.GIS_DATA['<id>'] = {FeatureCollection}
  const loading = {}
  GIS.loadDataset = function (id) {
    if (root.GIS_DATA[id]) return Promise.resolve(prep(root.GIS_DATA[id]))
    if (loading[id]) return loading[id]
    const def = GIS.datasets[id]
    if (!def) return Promise.reject(new Error('沒有這個資料集：' + id))
    loading[id] = new Promise((resolve, reject) => {
      if (isNode) {
        try { require(require('path').resolve(GIS.baseDir || '.', def.file)); resolve(prep(root.GIS_DATA[id])) } catch (e) { reject(e) }
        return
      }
      const s = document.createElement('script')
      s.src = (GIS.baseUrl || '') + def.file
      s.onload = () => (root.GIS_DATA[id] ? resolve(prep(root.GIS_DATA[id])) : reject(new Error('資料檔沒有設定 GIS_DATA.' + id)))
      s.onerror = () => { delete loading[id]; reject(new Error('資料檔載入失敗：' + def.file)) }
      document.head.appendChild(s)
    })
    return loading[id]
  }

  // ── 空間運算（WGS84 經緯度，距離單位公尺）
  const R = 6371008.8, RAD = Math.PI / 180
  function dist(a, b) {
    const dLat = (b.lat - a.lat) * RAD, dLng = (b.lng - a.lng) * RAD
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2
    return 2 * R * Math.asin(Math.sqrt(s))
  }
  function eachCoord(g, fn) {
    const walk = (c) => (typeof c[0] === 'number' ? fn(c) : c.forEach(walk))
    if (g) (g.type === 'GeometryCollection' ? g.geometries.forEach((x) => eachCoord(x, fn)) : walk(g.coordinates))
  }
  function prep(fc) {
    if (fc.__prepped) return fc
    for (const f of fc.features) {
      let x0 = 180, y0 = 90, x1 = -180, y1 = -90
      eachCoord(f.geometry, (c) => { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1] })
      Object.defineProperty(f, 'bbox_', { value: [x0, y0, x1, y1], enumerable: false })
    }
    Object.defineProperty(fc, '__prepped', { value: true, enumerable: false })
    return fc
  }
  function inRing(pt, ring) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1]
      if (yi > pt.lat !== yj > pt.lat && pt.lng < ((xj - xi) * (pt.lat - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }
  function inPolygon(pt, rings) { return inRing(pt, rings[0]) && !rings.slice(1).some((h) => inRing(pt, h)) }
  function contains(geom, pt) {
    if (!geom) return false
    if (geom.type === 'Polygon') return inPolygon(pt, geom.coordinates)
    if (geom.type === 'MultiPolygon') return geom.coordinates.some((p) => inPolygon(pt, p))
    return false
  }
  function segDist(pt, a, b) { // 點到線段，局部平面近似
    const kx = Math.cos(pt.lat * RAD) * RAD * R, ky = RAD * R
    const px = (pt.lng - a[0]) * kx, py = (pt.lat - a[1]) * ky, dx = (b[0] - a[0]) * kx, dy = (b[1] - a[1]) * ky
    const len = dx * dx + dy * dy
    const t = len ? Math.max(0, Math.min(1, (px * dx + py * dy) / len)) : 0
    return Math.hypot(px - t * dx, py - t * dy)
  }
  function lineDist(pt, line) { let m = Infinity; for (let i = 1; i < line.length; i++) m = Math.min(m, segDist(pt, line[i - 1], line[i])); return line.length === 1 ? dist(pt, { lng: line[0][0], lat: line[0][1] }) : m }
  /** 點到圖徵的最短距離（公尺）；點落在面內回傳 0 */
  function distTo(pt, geom) {
    if (!geom) return Infinity
    switch (geom.type) {
      case 'Point': return dist(pt, { lng: geom.coordinates[0], lat: geom.coordinates[1] })
      case 'MultiPoint': return Math.min(...geom.coordinates.map((c) => dist(pt, { lng: c[0], lat: c[1] })))
      case 'LineString': return lineDist(pt, geom.coordinates)
      case 'MultiLineString': return Math.min(...geom.coordinates.map((l) => lineDist(pt, l)))
      case 'Polygon': return contains(geom, pt) ? 0 : Math.min(...geom.coordinates.map((r) => lineDist(pt, r)))
      case 'MultiPolygon': return contains(geom, pt) ? 0 : Math.min(...geom.coordinates.flatMap((p) => p.map((r) => lineDist(pt, r))))
      case 'GeometryCollection': return Math.min(...geom.geometries.map((g) => distTo(pt, g)))
    }
    return Infinity
  }
  function bboxFar(pt, f, radius) { // 用外框先排除，radius 公尺
    const b = f.bbox_; if (!b) return false
    const dLat = radius / (RAD * R), dLng = dLat / Math.cos(pt.lat * RAD)
    return pt.lng < b[0] - dLng || pt.lng > b[2] + dLng || pt.lat < b[1] - dLat || pt.lat > b[3] + dLat
  }
  /** 半徑內的圖徵，由近到遠：[{feature, dist}] */
  function within(fc, pt, radius, filter) {
    prep(fc); const out = []
    for (const f of fc.features) {
      if (filter && !filter(f.properties, f)) continue
      if (bboxFar(pt, f, radius)) continue
      const d = distTo(pt, f.geometry)
      if (d <= radius) out.push({ feature: f, dist: d })
    }
    return out.sort((a, b) => a.dist - b.dist)
  }
  /** 最近的 n 個圖徵：[{feature, dist}]；maxDist 可限制搜尋範圍（預設不限） */
  function nearest(fc, pt, n = 1, filter, maxDist = Infinity) {
    prep(fc)
    for (const r of [1000, 5000, 25000, 150000]) { // 逐步放大搜尋半徑，避免每次全量精算
      if (r > maxDist && maxDist !== Infinity) break
      const hit = within(fc, pt, Math.min(r, maxDist), filter)
      if (hit.length >= n) return hit.slice(0, n)
    }
    return within(fc, pt, maxDist === Infinity ? 5e6 : maxDist, filter).slice(0, n)
  }
  /** 包含這個點的面圖徵：[feature] */
  function containing(fc, pt, filter) {
    prep(fc)
    return fc.features.filter((f) => (!filter || filter(f.properties, f)) && !bboxFar(pt, f, 0) && contains(f.geometry, pt))
  }
  function fmtDist(m) { return m == null || !isFinite(m) ? '—' : m < 1000 ? Math.round(m / 10) * 10 + ' 公尺' : (m / 1000).toFixed(m < 10000 ? 1 : 0) + ' 公里' }
  /** 步行時間估計（分鐘）：直線距離 ×1.3 繞路係數、每分鐘 80 公尺 */
  function walkMin(m) { return Math.max(1, Math.round((m * 1.3) / 80)) }
  function toTWD97(lat, lng) {
    if (!root.proj4) return null
    const p = root.proj4('EPSG:4326', '+proj=tmerc +lat_0=0 +lon_0=121 +k=0.9999 +x_0=250000 +y_0=0 +ellps=GRS80 +units=m +no_defs', [lng, lat])
    return { x: p[0], y: p[1] }
  }
  function toMercator(lat, lng) { return { x: lng * RAD * 6378137, y: Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) * 6378137 } }

  // ── 對外查詢（全部在使用者瀏覽器直接連公開服務，服務必須允許跨來源或支援 JSONP）
  const cache = new Map()
  function cached(key, fn) {
    if (!cache.has(key)) { const p = fn(); cache.set(key, p); p.catch(() => cache.delete(key)) }
    return cache.get(key)
  }
  async function fetchText(url, opt = {}) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), opt.timeout || 12000)
    try {
      const r = await fetch(url, { method: opt.method || 'GET', body: opt.body, headers: opt.headers, signal: ctl.signal })
      if (!r.ok) throw new Error('HTTP ' + r.status)
      return await r.text()
    } catch (e) { throw new Error(e.name === 'AbortError' ? '查詢逾時' : e.message || '連線失敗') } finally { clearTimeout(t) }
  }
  async function fetchJSON(url, opt) { return JSON.parse(await fetchText(url, opt)) }
  function jsonp(url, params = {}, timeout = 12000) {
    return new Promise((resolve, reject) => {
      const name = '__gis_jsonp_' + Math.random().toString(36).slice(2)
      const s = document.createElement('script')
      const done = (fn, v) => { clearTimeout(t); delete root[name]; s.remove(); fn(v) }
      const t = setTimeout(() => done(reject, new Error('查詢逾時')), timeout)
      root[name] = (data) => done(resolve, data)
      s.src = url + (url.includes('?') ? '&' : '?') + new URLSearchParams({ ...params, callback: name })
      s.onerror = () => done(reject, new Error('連線失敗'))
      document.head.appendChild(s)
    })
  }
  /** WMS GetFeatureInfo，回傳文字。o: {url, layers, lat, lng, infoFormat='text/plain', version='1.1.1', px=101, span=0.0004, extra={}} */
  function wmsFeatureInfo(o) {
    const span = o.span || 0.0004, px = o.px || 101, half = (px - 1) / 2
    const v = o.version || '1.1.1'
    const q = { SERVICE: 'WMS', VERSION: v, REQUEST: 'GetFeatureInfo', LAYERS: o.layers, QUERY_LAYERS: o.queryLayers || o.layers, STYLES: '', FORMAT: 'image/png', INFO_FORMAT: o.infoFormat || 'text/plain', FEATURE_COUNT: o.count || 5, WIDTH: px, HEIGHT: px, ...(o.extra || {}) }
    if (v === '1.3.0') { q.CRS = 'EPSG:4326'; q.BBOX = [o.lat - span, o.lng - span, o.lat + span, o.lng + span].join(','); q.I = half; q.J = half }
    else { q.SRS = 'EPSG:4326'; q.BBOX = [o.lng - span, o.lat - span, o.lng + span, o.lat + span].join(','); q.X = half; q.Y = half }
    const url = o.url + (o.url.includes('?') ? '&' : '?') + new URLSearchParams(q)
    return cached(url, () => fetchText(url, { timeout: o.timeout }))
  }
  /** ArcGIS REST 圖層點查。layerUrl 例：https://host/arcgis/rest/services/X/MapServer/3。o: {distance(公尺), outFields='*', where='1=1', returnGeometry=false, jsonp=false, max} → features 陣列 */
  function arcgisQuery(layerUrl, pt, o = {}) {
    const p = { f: 'json', geometry: pt.lng + ',' + pt.lat, geometryType: 'esriGeometryPoint', inSR: 4326, outSR: 4326, spatialRel: 'esriSpatialRelIntersects', outFields: o.outFields || '*', where: o.where || '1=1', returnGeometry: o.returnGeometry ? 'true' : 'false' }
    if (o.distance) { p.distance = o.distance; p.units = 'esriSRUnit_Meter' }
    if (o.max) p.resultRecordCount = o.max
    const url = layerUrl.replace(/\/$/, '') + '/query'
    const key = url + '?' + new URLSearchParams(p)
    return cached(key, async () => {
      const j = o.jsonp ? await jsonp(url, p, o.timeout) : await fetchJSON(key, { timeout: o.timeout })
      if (j.error) throw new Error(j.error.message || 'ArcGIS 查詢錯誤')
      return j.features || []
    })
  }
  /** ArcGIS REST identify（對整個 MapServer）。o: {layers='all', tolerance=3, jsonp=false} → results 陣列 */
  function arcgisIdentify(serviceUrl, pt, o = {}) {
    const d = 0.002
    const p = { f: 'json', geometry: pt.lng + ',' + pt.lat, geometryType: 'esriGeometryPoint', sr: 4326, layers: o.layers || 'all', tolerance: o.tolerance ?? 3, mapExtent: [pt.lng - d, pt.lat - d, pt.lng + d, pt.lat + d].join(','), imageDisplay: '400,400,96', returnGeometry: 'false' }
    const url = serviceUrl.replace(/\/$/, '') + '/identify'
    const key = url + '?' + new URLSearchParams(p)
    return cached(key, async () => {
      const j = o.jsonp ? await jsonp(url, p, o.timeout) : await fetchJSON(key, { timeout: o.timeout })
      if (j.error) throw new Error(j.error.message || 'ArcGIS 查詢錯誤')
      return j.results || []
    })
  }
  /** 行政區、村里、地段（國土測繪中心）：{county, town, village, section, countyCode, townCode, villageCode, sectionCode, officeName} */
  function admin(pt) {
    const url = `https://api.nlsc.gov.tw/other/TownVillagePointQuery/${pt.lng.toFixed(6)}/${pt.lat.toFixed(6)}/4326`
    return cached(url, async () => {
      const x = await fetchText(url)
      const g = (t) => (x.match(new RegExp('<' + t + '>([^<]*)</' + t + '>')) || [])[1] || ''
      if (!g('ctyName')) throw new Error('查無行政區')
      return { county: g('ctyName'), town: g('townName'), village: g('villageName'), section: g('sectName'), countyCode: g('ctyCode'), townCode: g('townCode'), villageCode: g('villageCode'), sectionCode: g('sectCode'), officeName: g('officeName') }
    })
  }

  const ctx = { fetchJSON, fetchText, jsonp, wmsFeatureInfo, arcgisQuery, arcgisIdentify, admin, cached, data: (id) => GIS.loadDataset(id), within, nearest, containing, contains, dist, distTo, fmtDist, walkMin, toTWD97, toMercator }
  GIS.ctx = ctx
  GIS.util = { dist, distTo, within, nearest, containing, contains, fmtDist, walkMin, toTWD97, toMercator, prep }

  /**
   * 執行地點體檢。pt = {lat, lng}。每個項目各自完成就呼叫 onUpdate(result)。
   * result = {id, name, group, pack, status:'running'|'done'|'error', level, headline, detail, items, reportText, source, error}
   */
  GIS.runChecks = function (pt, opt = {}) {
    const p = { lat: pt.lat, lng: pt.lng, ...(toTWD97(pt.lat, pt.lng) ? { twd97: toTWD97(pt.lat, pt.lng) } : {}) }
    const list = GIS.checks.filter((c) => !opt.filter || opt.filter(c)).sort((a, b) => (a.order || 99) - (b.order || 99))
    const base = (c) => ({ id: c.id, name: c.name, group: c.group, pack: c.pack, source: c.source || '' })
    const jobs = list.map(async (c) => {
      const res = { ...base(c), status: 'running' }
      opt.onUpdate && opt.onUpdate(res)
      try {
        const r = await Promise.race([
          Promise.resolve().then(() => c.run(p, ctx)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('查詢逾時')), c.timeout || 25000)),
        ])
        Object.assign(res, { status: 'done', level: 'info', headline: '', ...(r || { level: 'na', headline: '無資料' }) })
      } catch (e) {
        Object.assign(res, { status: 'error', level: 'na', headline: '暫時查不到', error: String((e && e.message) || e) })
      }
      opt.onUpdate && opt.onUpdate(res)
      return res
    })
    return Promise.all(jobs)
  }
  /** 體檢結果轉成可貼進報告的純文字 */
  GIS.reportText = function (pt, results, title) {
    const lines = [(title || '地點體檢') + `（${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}）`]
    for (const pack of GIS.packs) {
      const rs = results.filter((r) => r.pack === pack.id && r.status === 'done' && r.level !== 'na')
      if (!rs.length) continue
      lines.push('', '【' + pack.name + '】')
      for (const r of rs) lines.push('・' + r.name + '：' + (r.reportText || r.headline))
    }
    const src = [...new Set(results.map((r) => r.source).filter(Boolean))]
    if (src.length) lines.push('', '資料來源：' + src.join('、'))
    return lines.join('\n')
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = GIS
})(typeof window !== 'undefined' ? window : globalThis)
