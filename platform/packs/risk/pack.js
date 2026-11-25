// ── 圖資包：災害與環境風險 ────────────────────────────────────────────────
// 資料來源與實測紀錄見 NOTES.md。所有點查都在使用者瀏覽器直接連政府公開服務。
// 一次體檢對外請求：水利署 identify 1、國土測繪中心圖磚 5、農村水保署清單 2、行政區查詢 1（與其他包共用快取），合計 9。
;(function (root) {
  'use strict'
  const GIS = root.GIS

  // ══ 共用工具 ══════════════════════════════════════════════════════════
  const WRA_REST = 'https://maps.wra.gov.tw/arcgis/rest/services/WMS/GIC_WMS/MapServer'
  const WRA_WMS = 'https://maps.wra.gov.tw/arcgis/services/WMS/GIC_WMS/MapServer/WMSServer'
  const NLSC_WMTS = 'https://wmts.nlsc.gov.tw/wmts/'
  const WRA_SRC = '經濟部水利署'
  const GSMMA_SRC = '經濟部地質調查及礦業管理中心'

  // 淹水潛勢 10 個降雨情境（水利署第三代淹水潛勢圖）
  const FLOOD = [
    { id: 107, wms: 'flood_150mm_6hr', hr: 6, mm: 150 },
    { id: 108, wms: 'flood_250mm_6hr', hr: 6, mm: 250 },
    { id: 109, wms: 'flood_350mm_6hr', hr: 6, mm: 350 },
    { id: 110, wms: 'flood_200mm_12hr', hr: 12, mm: 200 },
    { id: 111, wms: 'flood_300mm_12hr', hr: 12, mm: 300 },
    { id: 112, wms: 'flood_400mm_12hr', hr: 12, mm: 400 },
    { id: 113, wms: 'flood_200mm_24hr', hr: 24, mm: 200 },
    { id: 114, wms: 'flood_350mm_24hr', hr: 24, mm: 350 },
    { id: 115, wms: 'flood_500mm_24hr', hr: 24, mm: 500 },
    { id: 116, wms: 'flood_650mm_24hr', hr: 24, mm: 650 },
  ]
  const FLOOD_DEPTH = { 1: '0.3～0.5 公尺', 2: '0.5～1.0 公尺', 3: '1.0～2.0 公尺', 4: '2.0～3.0 公尺', 5: '3.0 公尺以上' }
  // 較常發生的降雨（各延時的最小與次小情境）：在這些情境就淹水，視為高風險
  const FLOOD_FREQUENT = [107, 108, 110, 111, 113, 114]
  // 水利管制區圖層（與淹水同一個 identify 請求一起查）
  const WRA_ZONE_LAYERS = [13, 23, 24, 88, 102, 103, 117, 118]

  /** 水利署 identify：一次查 10 個淹水情境＋水利管制區，回 results 陣列（同一點只打一次） */
  function wraIdentify(pt, ctx) {
    const layers = 'all:' + FLOOD.map((f) => f.id).concat(WRA_ZONE_LAYERS).join(',')
    return ctx.arcgisIdentify(WRA_REST, pt, { layers, tolerance: 0, timeout: 20000 })
  }

  /**
   * 讀國土測繪中心 WMTS 圖磚像素（該服務回應帶 CORS 標頭，canvas 可讀）。
   * 回 { center:[r,g,b,a], mPerPx, nearest(test, maxM) }；nearest 回圖磚內符合 test(r,g,b,a) 的最近像素距離（公尺）或 null。
   * margin：希望點位離圖磚邊緣至少幾公尺（用來挑縮放層級，讓「鄰近」判斷不被圖磚邊緣截斷）。
   */
  function tilePixels(ctx, layer, pt, zooms, margin) {
    const key = 'risk-tile:' + layer + ':' + zooms.join('/') + ':' + pt.lat.toFixed(6) + ',' + pt.lng.toFixed(6)
    return ctx.cached(key, async () => {
      if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') throw new Error('此項目需在瀏覽器執行')
      const rad = (pt.lat * Math.PI) / 180
      let pick = null
      for (const z of zooms) {
        const n = 2 ** z
        const xf = ((pt.lng + 180) / 360) * n
        const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n
        const x = Math.floor(xf), y = Math.floor(yf)
        const tileM = (40075016.686 * Math.cos(rad)) / n
        const fx = xf - x, fy = yf - y
        const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * tileM
        const cand = { z, x, y, fx, fy, tileM, edge }
        if (!pick || cand.edge > pick.edge) pick = cand
        if (edge >= (margin || 0)) { pick = cand; break }
      }
      const url = `${NLSC_WMTS}${layer}/default/GoogleMapsCompatible/${pick.z}/${pick.y}/${pick.x}`
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000)
      let blob
      try {
        const r = await fetch(url, { signal: ctl.signal })
        if (!r.ok) throw new Error('HTTP ' + r.status)
        blob = await r.blob()
      } catch (e) { throw new Error(e.name === 'AbortError' ? '查詢逾時' : e.message || '連線失敗') } finally { clearTimeout(t) }
      const bm = await createImageBitmap(blob)
      const w = bm.width, h = bm.height
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h
      const g = cv.getContext('2d', { willReadFrequently: true }); g.drawImage(bm, 0, 0)
      const d = g.getImageData(0, 0, w, h).data
      const cx = Math.min(w - 1, Math.floor(pick.fx * w)), cy = Math.min(h - 1, Math.floor(pick.fy * h))
      const mPerPx = pick.tileM / w
      const at = (i, j) => { const o = (j * w + i) * 4; return [d[o], d[o + 1], d[o + 2], d[o + 3]] }
      return {
        center: at(cx, cy), mPerPx, zoom: pick.z, edge: pick.edge,
        nearest(test, maxM) {
          const rpx = Math.ceil(maxM / mPerPx); let best = null
          for (let j = Math.max(0, cy - rpx); j <= Math.min(h - 1, cy + rpx); j++) {
            for (let i = Math.max(0, cx - rpx); i <= Math.min(w - 1, cx + rpx); i++) {
              const o = (j * w + i) * 4
              if (d[o + 3] < 40 || !test(d[o], d[o + 1], d[o + 2], d[o + 3])) continue
              const m = Math.hypot(i - cx, j - cy) * mPerPx
              if (m <= maxM && (best === null || m < best)) best = m
            }
          }
          return best
        },
      }
    })
  }
  const opaque = (c) => c[3] >= 40
  // 液化潛勢圖配色：紅＝高、黃＝中、綠＝低（實測像素值 255,0,52／255,255,0／0,255,0）
  function liqClass(c) {
    if (!opaque(c)) return null
    const [r, g, b] = c
    const d = (p) => (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2
    const cand = [['高', [255, 0, 52]], ['中', [255, 255, 0]], ['低', [0, 255, 0]]].map(([k, p]) => [k, d(p)]).sort((a, b2) => a[1] - b2[1])
    return cand[0][0]
  }
  // 地質敏感區圖配色：紅＝活動斷層、藍＝地下水補注（實測 255,0,51／0,0,255；兩者重疊時約 229,0,72）
  const isFaultZone = (r, g, b) => r > 150 && g < 90 && b < 130
  const isRecharge = (r, g, b) => b > 150 && r < 110 && g < 110
  const isAnyColor = () => true
  const sameName = (a, b) => String(a || '').replace(/台/g, '臺').trim() === String(b || '').replace(/台/g, '臺').trim()
  const round10 = (m) => Math.max(10, Math.round(m / 10) * 10)

  // ══ 圖層 ══════════════════════════════════════════════════════════════
  const floodLegend = [{ color: '#9ca3af', label: '可能淹水 0.3 公尺以上（深度級距請用「地點體檢」點查）' }]
  const floodLayers = FLOOD.filter((f) => f.id !== 116).map((f) => ({
    id: 'risk_' + f.wms, name: `淹水潛勢 ${f.hr} 小時 ${f.mm} 毫米`, type: 'wms', url: WRA_WMS, layerName: f.wms,
    wmsVersion: '1.1.1', wmsFormat: 'image/png', group: '淹水潛勢（降雨情境）', opacity: 0.6, legend: floodLegend,
    source: WRA_SRC, sourceUrl: 'https://fhy.wra.gov.tw/', note: `${f.hr} 小時累積降雨 ${f.mm} 毫米的模擬淹水範圍（第三代淹水潛勢圖），非實際淹水紀錄。`,
  }))
  const wraLayer = (id, name, layerName, color, note) => ({
    id, name, type: 'wms', url: WRA_WMS, layerName, wmsVersion: '1.1.1', wmsFormat: 'image/png', group: '水利管制區', opacity: 0.6,
    legend: [{ color, label: name }], source: WRA_SRC, sourceUrl: 'https://gic.wra.gov.tw/', note,
  })

  // ══ 體檢項目 ══════════════════════════════════════════════════════════
  const checks = []

  // 1. 淹水潛勢 ─────────────────────────────────────────────────────────
  checks.push({
    id: 'risk_flood', name: '淹水潛勢（10 種降雨情境）', order: 10, source: WRA_SRC + '（第三代淹水潛勢圖）', timeout: 25000,
    run: async (pt, ctx) => {
      const res = await wraIdentify(pt, ctx)
      const cls = {}
      for (const r of res) { const c = parseInt(r.attributes && r.attributes.Class, 10); if (r.layerId >= 107 && r.layerId <= 116 && c) cls[r.layerId] = Math.max(cls[r.layerId] || 0, c) }
      const items = FLOOD.map((f) => ({ label: `${f.hr} 小時 ${f.mm} 毫米`, value: cls[f.id] ? '淹水 ' + FLOOD_DEPTH[cls[f.id]] : '未達 0.3 公尺' }))
      const hit = FLOOD.filter((f) => cls[f.id])
      const rule = '判級門檻：任一情境淹水達 1.0 公尺以上，或在較常見的降雨（6 小時 250 毫米以下、12 小時 300 毫米以下、24 小時 350 毫米以下）就淹水為紅燈；只在更大降雨情境淹水 0.3～1.0 公尺為黃燈；10 個情境都未達 0.3 公尺為綠燈。淹水潛勢圖是模擬結果（網格約 40 公尺），不代表實際一定淹水或不淹水。'
      if (!hit.length) {
        return { level: 'good', headline: '10 個降雨情境均未達 0.3 公尺', detail: rule, items,
          reportText: '依經濟部水利署第三代淹水潛勢圖，勘估標的所在位置於 6 小時 150～350 毫米、12 小時 200～400 毫米及 24 小時 200～650 毫米等 10 個降雨情境下，模擬淹水深度均未達 0.3 公尺。' }
      }
      const maxC = Math.max(...hit.map((f) => cls[f.id]))
      const first = hit[0] // 依延時、雨量由小到大排列
      const frequent = hit.some((f) => FLOOD_FREQUENT.includes(f.id))
      const level = maxC >= 3 || frequent ? 'bad' : 'warn'
      const worst = hit.filter((f) => cls[f.id] === maxC).pop()
      const list = hit.map((f) => `${f.hr} 小時 ${f.mm} 毫米（${FLOOD_DEPTH[cls[f.id]]}）`).join('、')
      return {
        level, headline: `${hit.length} 個情境會淹水，最深 ${FLOOD_DEPTH[maxC]}`,
        detail: `最小淹水情境：${first.hr} 小時 ${first.mm} 毫米；最深情境：${worst.hr} 小時 ${worst.mm} 毫米。` + rule, items,
        reportText: `依經濟部水利署第三代淹水潛勢圖，勘估標的所在位置於下列降雨情境有淹水潛勢：${list}；其餘情境模擬淹水深度未達 0.3 公尺。`,
      }
    },
  })

  // 2. 土壤液化潛勢 ─────────────────────────────────────────────────────
  checks.push({
    id: 'risk_liquefaction', name: '土壤液化潛勢', order: 20, source: GSMMA_SRC + '（圖磚：國土測繪中心）', timeout: 25000,
    run: async (pt, ctx) => {
      const [p1, p2] = await Promise.allSettled([tilePixels(ctx, 'SoilLiquefaction', pt, [16]), tilePixels(ctx, 'SoilLiquefaction2', pt, [16])])
      if (p1.status === 'rejected' && p2.status === 'rejected') throw p1.reason
      const c1 = p1.status === 'fulfilled' ? liqClass(p1.value.center) : null
      const c2 = p2.status === 'fulfilled' ? liqClass(p2.value.center) : null
      const items = [
        { label: '初級圖（比例尺 1/25,000）', value: p1.status === 'rejected' ? '暫時查不到' : c1 ? c1 + '潛勢' : '不在調查範圍' },
        { label: '中級圖（縣市精進版）', value: p2.status === 'rejected' ? '暫時查不到' : c2 ? c2 + '潛勢' : '此處沒有中級圖' },
      ]
      const rule = '判級門檻：高潛勢紅燈、中潛勢黃燈、低潛勢綠燈；有中級圖時以中級圖為準（鑽孔較密、精度較高）。本項是讀取官方圖磚上該點的顏色判定等級（約 2 公尺一格），位在色塊交界處請放大圖層目視確認；液化潛勢圖僅供防災參考，個別基地仍應以地質鑽探為準。'
      const use = c2 || c1
      if (!use) {
        return { level: 'na', headline: '不在液化潛勢調查範圍', items,
          detail: '此處在初級與中級土壤液化潛勢圖上都沒有著色，通常是山區、丘陵、台地或尚未公開調查成果的地區，不代表沒有液化風險。' + rule }
      }
      const which = c2 ? '中級' : '初級'
      const level = use === '高' ? 'bad' : use === '中' ? 'warn' : 'good'
      const both = c1 && c2 && c1 !== c2 ? `（初級圖為${c1}潛勢）` : ''
      return {
        level, headline: `${use}潛勢（${which}圖）${both}`, detail: rule, items,
        reportText: `依經濟部地質調查及礦業管理中心土壤液化潛勢圖（${which}），勘估標的所在位置屬土壤液化${use}潛勢區${c1 && c2 && c1 !== c2 ? `（初級圖為${c1}潛勢）` : ''}。`,
      }
    },
  })

  // 3. 活動斷層距離 ─────────────────────────────────────────────────────
  checks.push({
    id: 'risk_fault', name: '距最近活動斷層', order: 30, source: GSMMA_SRC + '（活動斷層分布圖，地質雲開放資料）',
    run: async (pt, ctx) => {
      const fc = await ctx.data('active_faults')
      const near = ctx.nearest(fc, pt, 40)
      if (!near.length) return { level: 'na', headline: '查無資料' }
      const byName = []
      for (const n of near) if (!byName.some((b) => b.feature.properties.name === n.feature.properties.name)) byName.push(n)
      const a = byName[0], p = a.feature.properties
      const items = byName.slice(0, 3).map((n) => ({ label: n.feature.properties.name, value: `${n.feature.properties.cls}活動斷層・${n.feature.properties.obs === '觀察' ? '位置已確認' : '推測或隱伏'}`, dist: Math.round(n.dist) }))
      const level = a.dist <= 150 ? 'bad' : a.dist <= 1000 ? 'warn' : 'good'
      const rule = '判級門檻：150 公尺內紅燈（活動斷層地質敏感區通常劃在斷層線兩側各約 150 公尺，逆斷層上盤側較寬，約 200 公尺；另依建築法規，活動斷層線兩側 30～100 公尺內有禁限建規定）、150 公尺～1 公里黃燈（近斷層，耐震設計須考慮近斷層效應）、超過 1 公里綠燈。第一類指過去 1 萬年內曾活動，第二類指過去 10 萬年內曾活動。斷層線為比例尺 1/25,000 圖資並經簡化（誤差可達數十公尺），「推測或隱伏」段位置不確定性更高；是否位於地質敏感區請以公告圖及「地質敏感區」項目為準。'
      const dTxt = a.dist < 10 ? '不到 10 公尺' : a.dist < 1000 ? Math.round(a.dist / 10) * 10 + ' 公尺' : (a.dist / 1000).toFixed(1) + ' 公里'
      return {
        level, headline: `${p.name} ${dTxt}`, detail: `最近的是${p.name}（${p.cls}活動斷層，該段${p.obs === '觀察' ? '位置已確認' : '為推測或隱伏'}）。` + rule, items,
        reportText: `勘估標的距最近之活動斷層「${p.name}」（${p.cls}活動斷層）約 ${dTxt}${a.dist <= 150 ? '，位於斷層線兩側 150 公尺範圍內，可能屬活動斷層地質敏感區，應查明公告範圍及相關建築限制' : a.dist <= 1000 ? '，屬近斷層區域' : ''}。`,
      }
    },
  })

  // 4. 地質敏感區 ───────────────────────────────────────────────────────
  checks.push({
    id: 'risk_geosensitive', name: '地質敏感區', order: 40, source: GSMMA_SRC + '（圖磚：國土測繪中心）', timeout: 25000,
    run: async (pt, ctx) => {
      const [g1, g2] = await Promise.allSettled([tilePixels(ctx, 'GeoSensitive', pt, [15, 14, 13], 150), tilePixels(ctx, 'GeoSensitive2', pt, [15, 14, 13], 150)])
      if (g1.status === 'rejected' && g2.status === 'rejected') throw g1.reason
      const inside = [], nearby = [], failed = []
      if (g1.status === 'fulfilled') {
        const c = g1.value.center
        if (opaque(c)) {
          let any = false
          if (isFaultZone(c[0], c[1], c[2])) { inside.push('活動斷層地質敏感區'); any = true }
          if (isRecharge(c[0], c[1], c[2]) || (c[0] > 150 && c[2] > 60 && c[2] < 130)) { inside.push('地下水補注地質敏感區'); any = true }
          if (!any) inside.push('地質敏感區（類別請開圖層確認，可能為地質遺跡）')
        }
        if (!inside.includes('活動斷層地質敏感區')) { const m = g1.value.nearest(isFaultZone, 150); if (m !== null) nearby.push(['活動斷層地質敏感區', m]) }
      } else failed.push('活動斷層／地下水補注／地質遺跡')
      if (g2.status === 'fulfilled') {
        if (opaque(g2.value.center)) inside.push('山崩與地滑地質敏感區')
        else { const m = g2.value.nearest(isAnyColor, 150); if (m !== null) nearby.push(['山崩與地滑地質敏感區', m]) }
      } else failed.push('山崩與地滑')
      const rule = '判級門檻：位於活動斷層或山崩與地滑地質敏感區內紅燈；只位於地下水補注或其他類別地質敏感區內、或 150 公尺內有活動斷層／山崩與地滑地質敏感區為黃燈；都沒有為綠燈。位於地質敏感區內的土地開發前，依地質法應做基地地質調查及地質安全評估；地下水補注地質敏感區主要限制開發的透水與補注，不是建築安全問題。本項是讀取官方圖磚上的顏色判定（約 4～17 公尺一格），邊界附近請以公告圖為準。'
      const failTxt = failed.length ? `（${failed.join('、')}類暫時查不到）` : ''
      const items = [...inside.map((n) => ({ label: n, value: '位於範圍內' })), ...nearby.map(([n, m]) => ({ label: n, value: '鄰近', dist: round10(m) }))]
      if (inside.length) {
        const severe = inside.some((n) => /活動斷層|山崩/.test(n))
        return { level: severe ? 'bad' : 'warn', headline: '位於' + inside.map((n) => n.replace('地質敏感區', '')).join('、') + '地質敏感區' + failTxt, detail: rule, items,
          reportText: `勘估標的位於${inside.join('及')}範圍內${nearby.length ? '，並鄰近' + nearby.map(([n, m]) => `${n}（約 ${round10(m)} 公尺）`).join('、') : ''}，土地開發前應依地質法辦理基地地質調查及地質安全評估。` }
      }
      if (nearby.length) {
        return { level: 'warn', headline: '鄰近' + nearby.map(([n, m]) => `${n.replace('地質敏感區', '')}（約 ${round10(m)} 公尺）`).join('、') + '地質敏感區' + failTxt, detail: rule, items,
          reportText: `勘估標的未位於已公告之地質敏感區內，惟鄰近${nearby.map(([n, m]) => `${n}（約 ${round10(m)} 公尺）`).join('、')}。` }
      }
      if (failed.length) return { level: 'na', headline: '部分類別暫時查不到', detail: `已查到的類別未位於地質敏感區內；${failed.join('、')}類暫時查不到。` + rule }
      return { level: 'good', headline: '不在已公告的地質敏感區內', detail: rule,
        reportText: '經套疊經濟部地質調查及礦業管理中心地質敏感區圖資，勘估標的未位於已公告之活動斷層、山崩與地滑、地下水補注及地質遺跡地質敏感區內。' }
    },
  })

  // 5. 土石流與大規模崩塌 ───────────────────────────────────────────────
  const ARDSWC = 'https://246.ardswc.gov.tw/data/'
  checks.push({
    id: 'risk_debris', name: '土石流與大規模崩塌', order: 50, source: '農業部農村發展及水土保持署（圖磚：國土測繪中心）', timeout: 25000,
    run: async (pt, ctx) => {
      const [tile, adm, deb, lsl] = await Promise.allSettled([
        tilePixels(ctx, 'MUDSLIDE_PG', pt, [15, 14, 13], 200),
        ctx.admin(pt),
        ctx.cached('risk-ardswc-debris', () => ctx.fetchJSON(ARDSWC + 'Debris.json', { timeout: 20000 })),
        ctx.cached('risk-ardswc-landslide', () => ctx.fetchJSON(ARDSWC + 'LandSlide.json', { timeout: 20000 })),
      ])
      if (tile.status === 'rejected' && (adm.status === 'rejected' || deb.status === 'rejected')) throw tile.reason
      const inZone = tile.status === 'fulfilled' && opaque(tile.value.center)
      const nearM = tile.status === 'fulfilled' && !inZone ? tile.value.nearest(isAnyColor, 200) : null
      let streams = null, slides = null, vill = ''
      if (adm.status === 'fulfilled') {
        const a = adm.value; vill = a.county + a.town + a.village
        const m = (d) => sameName(d.County, a.county) && sameName(d.Town, a.town) && sameName(d.Vill, a.village)
        if (deb.status === 'fulfilled' && deb.value && Array.isArray(deb.value.Debris)) streams = deb.value.Debris.filter(m)
        if (lsl.status === 'fulfilled' && lsl.value && Array.isArray(lsl.value.LandSlide)) slides = lsl.value.LandSlide.filter(m)
      }
      const items = []
      if (tile.status === 'fulfilled') items.push({ label: '土石流潛勢溪流及影響範圍（圖面）', value: inZone ? '位於範圍內' : nearM !== null ? '鄰近' : '200 公尺內沒有', ...(nearM !== null ? { dist: round10(nearM) } : {}) })
      else items.push({ label: '土石流潛勢溪流及影響範圍（圖面）', value: '暫時查不到' })
      if (streams) for (const s of streams.slice(0, 8)) items.push({ label: s.No, value: '土石流潛勢溪流' + (s.LandMark ? '・地標：' + s.LandMark : '') + (s.AlertValue ? '・警戒雨量 ' + s.AlertValue + ' 毫米' : '') })
      if (slides) for (const s of slides.slice(0, 5)) items.push({ label: s.No, value: '大規模崩塌潛勢區・' + (s.CName || '') })
      const nS = streams ? streams.length : null, nL = slides ? slides.length : null
      const rule = '判級門檻：點位落在土石流潛勢溪流或其影響範圍圖面上為紅燈；200 公尺內有、或所在村里有土石流潛勢溪流／大規模崩塌潛勢區為黃燈；都沒有為綠燈。村里清單只代表「同一村里內有」，不代表標的本身受影響，請開「土石流」圖層對照位置；大規模崩塌潛勢區目前只有村里清單，沒有可點查的範圍圖。'
      const villTxt = vill && nS !== null ? `所在村里（${vill}）列管土石流潛勢溪流 ${nS} 條${nL !== null ? `、大規模崩塌潛勢區 ${nL} 處` : ''}` : '村里清單暫時查不到'
      if (inZone) {
        return { level: 'bad', headline: '位於土石流潛勢溪流或其影響範圍內', detail: villTxt + '。' + rule, items,
          reportText: `勘估標的位於農業部農村發展及水土保持署公開之土石流潛勢溪流或其影響範圍內${nS ? `（所在${vill}列管土石流潛勢溪流 ${nS} 條：${streams.map((s) => s.No).join('、')}）` : ''}。` }
      }
      if (nearM !== null || nS || nL) {
        const parts = []
        if (nearM !== null) parts.push(`距土石流潛勢溪流或其影響範圍約 ${round10(nearM)} 公尺`)
        if (nS) parts.push(`所在${vill}列管土石流潛勢溪流 ${nS} 條（${streams.map((s) => s.No).slice(0, 10).join('、')}${nS > 10 ? '等' : ''}）`)
        if (nL) parts.push(`大規模崩塌潛勢區 ${nL} 處（${slides.map((s) => s.No).join('、')}）`)
        return { level: 'warn', headline: nearM !== null ? `土石流潛勢範圍約 ${round10(nearM)} 公尺` : `所在村里有${nS ? '土石流潛勢溪流 ' + nS + ' 條' : ''}${nS && nL ? '、' : ''}${nL ? '大規模崩塌潛勢區 ' + nL + ' 處' : ''}`,
          detail: villTxt + '。' + rule, items, reportText: `勘估標的未位於土石流潛勢溪流影響範圍內，惟${parts.join('；')}。` }
      }
      if (tile.status === 'rejected' || nS === null) return { level: 'na', headline: '部分資料暫時查不到', detail: villTxt + '。' + rule, items }
      return { level: 'good', headline: '200 公尺內及所在村里均無土石流潛勢溪流', detail: villTxt + '。' + rule, items,
        reportText: `勘估標的周邊 200 公尺內無土石流潛勢溪流及其影響範圍，所在${vill}亦無列管之土石流潛勢溪流${nL !== null ? '及大規模崩塌潛勢區' : ''}。` }
    },
  })

  // 6. 水利管制區 ───────────────────────────────────────────────────────
  checks.push({
    id: 'risk_water_zone', name: '水利管制區（地下水管制、海岸防護、排水、海堤）', order: 60, source: WRA_SRC + '（水利地理資訊服務平台）', timeout: 25000,
    run: async (pt, ctx) => {
      const res = await wraIdentify(pt, ctx)
      const has = (id) => res.filter((r) => r.layerId === id)
      const at = (r, k) => { const v = r.attributes && r.attributes[k]; return v && v !== 'Null' ? String(v).trim() : '' }
      const found = [] // [名稱, 說明, 嚴重度 2 紅 1 黃]
      for (const r of has(13)) found.push(['河川水道範圍' + (at(r, 'RIVER_NAME') ? '（' + at(r, 'RIVER_NAME') + '）' : ''), '點位落在水利署河川水道圖面上，可能屬河川區域，原則上不得建築，應洽河川分署確認河川區域線', 2])
      for (const r of has(102)) found.push(['海堤區域' + (at(r, 'EM_NAME') || at(r, 'NAME') ? '（' + (at(r, 'EM_NAME') || at(r, 'NAME')) + '）' : ''), '海堤區域內的使用行為須經許可', 2])
      for (const r of has(103)) found.push(['區域排水設施範圍' + (at(r, 'DRAIN_NAME') ? '（' + at(r, 'DRAIN_NAME') + '）' : ''), '排水設施範圍內禁止妨礙排水的行為，建築須經許可', 2])
      if (has(23).length) found.push(['地下水第一級管制區', '地層下陷較嚴重地區，原則上禁止新鑿水井；常與淹水、地層下陷風險並存', 1])
      else if (has(24).length) found.push(['地下水第二級管制區', '鑿井引水須申請許可；對一般建築使用影響有限', 0])
      for (const r of has(117)) found.push([`海岸防護區（${at(r, '級別') || '級別未註明'}・${at(r, '屬性區域') || '防護區'}）`, '海岸防護計畫範圍，可能有暴潮溢淹、海岸侵蝕等災害防治管制', 1])
      for (const r of has(118)) found.push([`海岸防護區陸域緩衝區（${at(r, '級別') || '級別未註明'}）`, '海岸防護計畫的陸域緩衝區，開發利用須符合海岸防護計畫', 1])
      for (const r of has(88)) found.push(['自來水水質水量保護區（' + (at(r, 'WQQPZ_NAME') || at(r, 'NAME')).replace(/自來水水質水量保護區$/, '') + '）', '禁止貽害水質水量的行為，土地利用受限；區內土地可能有回饋或補償', 1])
      const rule = '判級門檻：位於河川水道範圍、海堤區域或區域排水設施範圍為紅燈；位於地下水第一級管制區、海岸防護區（含陸域緩衝區）或自來水水質水量保護區為黃燈；只位於地下水第二級管制區不亮燈（僅提示）；都不在為綠燈。地下水管制區級別係依水利署圖層（gwconare 為第一級、gwconare2 為第二級）判讀，正式範圍以公告為準。'
      const items = found.map(([n, why]) => ({ label: n, value: why }))
      if (!found.length) {
        return { level: 'good', headline: '不在所查的水利管制區內', detail: rule,
          reportText: '經套疊經濟部水利署圖資，勘估標的未位於河川水道範圍、海堤區域、區域排水設施範圍、地下水管制區、海岸防護區及自來水水質水量保護區內。' }
      }
      const sev = Math.max(...found.map((f) => f[2]))
      return { level: sev === 2 ? 'bad' : sev === 1 ? 'warn' : 'info', headline: '位於' + found.map((f) => f[0]).join('、'), detail: rule, items,
        reportText: `經套疊經濟部水利署圖資，勘估標的位於${found.map((f) => f[0]).join('、')}範圍內，相關使用限制應依水利法、海岸管理法及自來水法等規定查明。` }
    },
  })

  // 7. 海嘯溢淹潛勢 ─────────────────────────────────────────────────────
  checks.push({
    id: 'risk_tsunami', name: '海嘯溢淹潛勢', order: 70, source: '國家災害防救科技中心（圖磚：國土測繪中心）', timeout: 25000,
    run: async (pt, ctx) => {
      const t = await tilePixels(ctx, 'TSUNAMIO', pt, [15, 14, 13], 300)
      const rule = '判級門檻：點位落在海嘯溢淹潛勢圖著色範圍內為黃燈（海嘯屬低頻率事件，不列紅燈）；300 公尺內有著色範圍為提示；其餘為綠燈。本項是讀取官方圖磚顏色判定，溢淹深度請開「海嘯」圖層查看。'
      if (opaque(t.center)) return { level: 'warn', headline: '位於海嘯溢淹潛勢範圍內', detail: rule, reportText: '勘估標的位於國家災害防救科技中心海嘯溢淹潛勢圖之模擬溢淹範圍內。' }
      const m = t.nearest(isAnyColor, 300)
      if (m !== null) return { level: 'info', headline: `海嘯溢淹潛勢範圍約 ${round10(m)} 公尺`, detail: rule, reportText: `勘估標的未位於海嘯溢淹潛勢範圍內，距最近之模擬溢淹範圍約 ${round10(m)} 公尺。` }
      return { level: 'good', headline: '不在海嘯溢淹潛勢範圍內', detail: rule, reportText: '勘估標的未位於海嘯溢淹潛勢圖之模擬溢淹範圍內。' }
    },
  })

  // 8. 核能電廠距離 ─────────────────────────────────────────────────────
  checks.push({
    id: 'risk_nuclear', name: '距核能電廠', order: 80, source: '核能電廠位置為公開資訊整理；緊急應變計畫區半徑依核能安全委員會公告',
    run: async (pt, ctx) => {
      const fc = await ctx.data('nuclear_plants')
      const near = ctx.nearest(fc, pt, 4).filter((n) => n.feature.properties.epz)
      if (!near.length) return { level: 'na', headline: '查無資料' }
      const a = near[0], p = a.feature.properties, km = a.dist / 1000
      const items = near.slice(0, 3).map((n) => ({ label: n.feature.properties.name, value: n.feature.properties.status, dist: Math.round(n.dist), lat: n.feature.geometry.coordinates[1], lng: n.feature.geometry.coordinates[0] }))
      const rule = '判級門檻：位於核能電廠緊急應變計畫區（電廠半徑 8 公里）內為黃燈，其餘為綠燈。核一、核二、核三廠均已停止運轉並進入除役，但廠內仍貯存用過核子燃料，緊急應變計畫區是否調整以核能安全委員會公告為準；核四（龍門）廠未曾裝填燃料運轉，不計入。距離為到廠區中心點的直線距離。'
      if (km <= 8) return { level: 'warn', headline: `${p.name} ${km.toFixed(1)} 公里（緊急應變計畫區內）`, detail: rule, items,
        reportText: `勘估標的距${p.name}約 ${km.toFixed(1)} 公里，位於該廠緊急應變計畫區（半徑 8 公里）範圍內；該廠${p.status}。` }
      return { level: 'good', headline: `${p.name} ${km < 100 ? km.toFixed(1) : Math.round(km)} 公里，不在緊急應變計畫區`, detail: rule, items,
        reportText: `勘估標的距最近之核能電廠（${p.name}）約 ${km < 100 ? km.toFixed(1) : Math.round(km)} 公里，不在核能電廠緊急應變計畫區（半徑 8 公里）範圍內。` }
    },
  })

  // ══ 註冊 ══════════════════════════════════════════════════════════════
  GIS.registerPack({
    id: 'risk', name: '災害與環境風險', icon: 'shield-alert', order: 2,
    layers: [
      { id: 'risk_liquefaction2', name: '土壤液化潛勢（中級）', type: 'xyz', url: NLSC_WMTS + 'SoilLiquefaction2/default/GoogleMapsCompatible/{z}/{y}/{x}', group: '地質', opacity: 0.6, maxNativeZoom: 18,
        legend: [{ color: '#ff0034', label: '高潛勢' }, { color: '#ffff00', label: '中潛勢' }, { color: '#00ff00', label: '低潛勢' }],
        source: GSMMA_SRC, sourceUrl: 'https://www.liquid.net.tw/', note: '中級圖只有部分縣市的都會區有（鑽孔較密、精度比初級圖高），沒有著色的地方請看初級圖。' },
      { id: 'risk_geo_sensitive', name: '地質敏感區（活動斷層、地下水補注、地質遺跡）', type: 'xyz', url: NLSC_WMTS + 'GeoSensitive/default/GoogleMapsCompatible/{z}/{y}/{x}', group: '地質', opacity: 0.6, maxNativeZoom: 18,
        legend: [{ color: '#ff0033', label: '活動斷層地質敏感區' }, { color: '#0000ff', label: '地下水補注地質敏感區' }],
        source: GSMMA_SRC, sourceUrl: 'https://www.gsmma.gov.tw/nss/p/geosensitive', note: '區內土地開發前須依地質法做基地地質調查及地質安全評估。' },
      { id: 'risk_geo_sensitive2', name: '地質敏感區（山崩與地滑）', type: 'xyz', url: NLSC_WMTS + 'GeoSensitive2/default/GoogleMapsCompatible/{z}/{y}/{x}', group: '地質', opacity: 0.6, maxNativeZoom: 18,
        legend: [{ color: '#660033', label: '山崩與地滑地質敏感區' }],
        source: GSMMA_SRC, sourceUrl: 'https://www.gsmma.gov.tw/nss/p/geosensitive', note: '多分布在山坡地，範圍零碎，請放大檢視。' },
      ...floodLayers,
      wraLayer('risk_gw_control1', '地下水第一級管制區', 'gwconare', '#ffaa00', '地層下陷較嚴重地區，原則上禁止新鑿水井。級別依水利署圖層名稱判讀，以公告為準。'),
      wraLayer('risk_gw_control2', '地下水第二級管制區', 'gwconare2', '#005ce6', '鑿井引水須申請許可。級別依水利署圖層名稱判讀，以公告為準。'),
      wraLayer('risk_drain_area', '區域排水設施範圍', 'REGDAREA', '#33cc33', '排水設施範圍內建築及使用須經許可。'),
      wraLayer('risk_seawall', '海堤區域', 'SEAWALLZONE', '#00a884', '海堤區域內的使用行為須經許可。'),
      wraLayer('risk_coast_protect', '海岸防護區', 'CoastalProtectionZone', '#a94dc2', '一、二級海岸防護計畫範圍（暴潮溢淹、海岸侵蝕、地層下陷等）。'),
      wraLayer('risk_coast_buffer', '海岸防護區陸域緩衝區', 'CoastalBufferZone', '#eb7033', '海岸防護計畫的陸域緩衝區。'),
      wraLayer('risk_water_protect', '自來水水質水量保護區', 'TWQPROT', '#ff00c5', '區內禁止貽害水質水量的行為，土地利用受限。'),
    ],
    datasets: [
      { id: 'active_faults', name: '活動斷層線（36 條，含分支）', file: 'packs/risk/data/active_faults.js', geometry: 'line', count: 132, showAsLayer: true, group: '地質',
        style: { color: '#dc2626', weight: 3 }, styleBy: { field: 'cls', map: { 第一類: '#dc2626', 第二類: '#f59e0b' } }, labelField: 'name',
        popupFields: [['name', '斷層名稱'], ['cls', '分類'], ['obs', '位置確認程度']],
        source: GSMMA_SRC + '（地質雲開放資料 ActiveFault）', sourceUrl: 'https://www.geologycloud.tw/', updated: '2026-11-25' },
      { id: 'nuclear_plants', name: '核能電廠', file: 'packs/risk/data/nuclear_plants.js', geometry: 'point', count: 4, showAsLayer: true, group: '環境',
        style: { color: '#7c3aed', radius: 7, weight: 2, fillOpacity: 0.5 }, labelField: 'name', popupFields: [['name', '名稱'], ['status', '現況'], ['addr', '位置']],
        source: '公開資訊整理（位置經國土測繪中心村里查詢核對）', sourceUrl: 'https://www.nusc.gov.tw/', updated: '2026-11-25' },
    ],
    checks,
  })
})(typeof window !== 'undefined' ? window : globalThis)
