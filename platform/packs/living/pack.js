// 圖資包：生活機能（交通、學校、醫療、公共設施）
// 估價報告「區域因素／個別因素」會寫到的項目。資料來源與查證紀錄見 NOTES.md。
;(function (root) {
  'use strict'
  const GIS = root.GIS
  const NLSC_WMTS = 'https://wmts.nlsc.gov.tw/wmts/'
  const NLSC_SRC = { source: '內政部國土測繪中心', sourceUrl: 'https://maps.nlsc.gov.tw/' }
  const xyz = (id) => NLSC_WMTS + id + '/default/GoogleMapsCompatible/{z}/{y}/{x}'

  // ── 共用小工具 ─────────────────────────────────────────────────────────
  const R_NEAR = 500, R_MID = 1000 // 「近」與「尚可步行」的門檻（公尺，直線距離）
  const uniqBy = (arr, key) => { const s = new Set(); return arr.filter((x) => { const k = key(x); if (s.has(k)) return false; s.add(k); return true }) }
  const withStation = (n) => (/站$/.test(n) ? n : n + '站')
  const PREFIX = { 捷運: '捷運', 輕軌: '輕軌', 臺鐵: '臺鐵', 高鐵: '高鐵' }
  const stationName = (p) => PREFIX[p.type] + withStation(p.name)
  const rng = (m) => (m >= 1000 ? m / 1000 + ' 公里' : m + ' 公尺') // 門檻用的整數距離

  /** 國土測繪中心地標環域查詢。kind：edu 文教、med 醫療社福、dis 殯葬環保加油站。回傳 [{name,sname,code,addr,lat,lng,dist}]（由近到遠） */
  function marks(ctx, kind, pt, radius) {
    const url = `https://api.nlsc.gov.tw/other/MarkBufferAnlys/${kind}/${pt.lng.toFixed(6)}/${pt.lat.toFixed(6)}/${radius}`
    return ctx.cached(url, async () => {
      const j = await ctx.fetchJSON(url, { timeout: 15000 })
      if (!Array.isArray(j)) throw new Error('地標查詢回應格式不符')
      return j
        .filter((o) => isFinite(o.lat) && isFinite(o.lon))
        .map((o) => ({ name: (o.name || '').trim(), sname: (o.sname || o.name || '').trim(), code: String(o.marktype || ''), addr: o.addr || '', lat: +o.lat, lng: +o.lon, dist: ctx.dist(pt, { lat: +o.lat, lng: +o.lon }) }))
        .sort((a, b) => a.dist - b.dist)
    })
  }
  const NOT_DAY_SCHOOL = /進修|補校|補習|空中大學|推廣/ // 附設進修部與本校同址，不重複計
  function eduKind(o) {
    if (o.code === '9920105') return '幼兒園'
    if (o.code === '9920201') return '圖書館'
    if (o.code === '9920202' || o.code === '9920203' || o.code === '9920204' || o.code === '9920206' || o.code.startsWith('99401')) return '藝文展演設施'
    if (NOT_DAY_SCHOOL.test(o.name) || NOT_DAY_SCHOOL.test(o.sname)) return null
    if (o.code === '9920103') return '國小'
    if (o.code === '9920102') return /國中|國民中學/.test(o.name + o.sname) ? '國中' : '高中職'
    if (o.code === '9920101') return '大專院校'
    return null
  }
  function medKind(o) {
    if (o.code === '9930101') return '醫院'
    if (o.code === '9930102') return '衛生所'
    if (o.code === '9930301') return '托育及兒少福利設施'
    if (o.code === '9930302') return '老人福利及長照機構'
    return null
  }
  function disKind(o) {
    if (o.code === '9350200') return '公墓'
    if (o.code === '9930201') return '殯儀館'
    if (o.code === '9930202') return '火化場'
    if (o.code === '9930203') return '納骨塔'
    if (o.code.startsWith('937')) return '污水、垃圾等環保設施'
    if (o.code.startsWith('99602')) return '加油（氣）站'
    return '其他'
  }
  const group = (list, kindOf) => { const g = {}; for (const o of list) { const k = kindOf(o); if (!k) continue; (g[k] = g[k] || []).push(o) } for (const k in g) g[k] = uniqBy(g[k], (o) => o.sname.replace(/(國中部|國小部|高中部)$/, '')); return g } // 同校本部與「○○部」只算一所
  const inR = (list, r) => (list || []).filter((o) => o.dist <= r)
  const nameDist = (ctx, o) => `${o.sname}（約 ${ctx.fmtDist(o.dist)}）`
  const listText = (ctx, list, max = 4) => list.slice(0, max).map((o) => nameDist(ctx, o)).join('、') + (list.length > max ? ' 等' : '')
  const toItem = (ctx, o, kind) => ({ label: o.sname, value: kind, dist: Math.round(o.dist), lat: o.lat, lng: o.lng })

  // ── 軌道車站（靜態資料集） ─────────────────────────────────────────────
  /** o: {types, what, far(超過即視為無), goodAt, infoAt, walkMax} */
  function railCheck(o) {
    return async (pt, ctx) => {
      const fc = await ctx.data('rail_stations')
      const hits = uniqBy(ctx.nearest(fc, pt, 6, (p) => o.types.includes(p.type)), (h) => h.feature.properties.type + h.feature.properties.name)
      if (!hits.length) return { level: 'na', headline: '查無車站資料' }
      const n = hits[0], p = n.feature.properties, d = Math.max(10, n.dist)
      // 同名站（不同路線月台相距較遠者）路線合併顯示
      const lines = [...new Set(ctx.nearest(fc, pt, 6, (q) => q.type === p.type && q.name === p.name).filter((h) => h.dist < d + 400).flatMap((h) => h.feature.properties.line.split('、')))].join('、')
      const paren = p.type === '高鐵' ? '' : p.type === '臺鐵' ? ((p.line.match(/（(.+)）/) || [])[1] || '') : lines
      const withParen = stationName(p) + (paren ? `（${paren}）` : '')
      const walk = d <= o.walkMax ? `，步行約 ${ctx.walkMin(d)} 分鐘` : ''
      const rule = `判定門檻（直線距離）：${rng(o.goodAt)}內為近（綠）、超過 ${rng(o.far)} 視為無（不列入報告文字），其間僅列距離。步行時間以直線距離 ×1.3、每分鐘 80 公尺估算，實際路徑請現場確認。`
      const items = hits.filter((h) => h.dist <= Math.max(o.infoAt * 1.5, d)).slice(0, 3).map((h) => ({ label: stationName(h.feature.properties), value: h.feature.properties.line, dist: Math.round(h.dist), lat: h.feature.geometry.coordinates[1], lng: h.feature.geometry.coordinates[0] }))
      if (d > o.far) return { level: 'na', headline: `${rng(o.far)}內無${o.what}`, detail: `最近為${withParen}，直線距離約 ${ctx.fmtDist(d)}。${rule}`, reportText: `查詢地點 ${rng(o.far)}範圍內無${o.what}，最近之${stationName(p)}直線距離約 ${ctx.fmtDist(d)}。` }
      return {
        level: d <= o.goodAt ? 'good' : 'info',
        headline: `${stationName(p)} ${ctx.fmtDist(d)}`,
        detail: `${lines}。${rule}`,
        items,
        reportText: `查詢地點距${withParen}直線距離約 ${ctx.fmtDist(d)}${walk}。`,
      }
    }
  }

  // ── 公車、公共自行車（交通部 TDX 即時查詢） ─────────────────────────────
  const TDX_CITY = { 臺北市: 'Taipei', 新北市: 'NewTaipei', 桃園市: 'Taoyuan', 臺中市: 'Taichung', 臺南市: 'Tainan', 高雄市: 'Kaohsiung', 基隆市: 'Keelung', 新竹市: 'Hsinchu', 新竹縣: 'HsinchuCounty', 苗栗縣: 'MiaoliCounty', 彰化縣: 'ChanghuaCounty', 南投縣: 'NantouCounty', 雲林縣: 'YunlinCounty', 嘉義縣: 'ChiayiCounty', 嘉義市: 'Chiayi', 屏東縣: 'PingtungCounty', 宜蘭縣: 'YilanCounty', 花蓮縣: 'HualienCounty', 臺東縣: 'TaitungCounty', 金門縣: 'KinmenCounty', 澎湖縣: 'PenghuCounty', 連江縣: 'LienchiangCounty' }
  async function tdxNearby(ctx, pt, path, select, radius) {
    const a = await ctx.admin(pt)
    const city = TDX_CITY[(a.county || '').replace(/台/g, '臺')]
    if (!city) return { county: a.county, list: null }
    const url = `https://tdx.transportdata.tw/api/basic/v2/${path}/City/${city}?$spatialFilter=${encodeURIComponent(`nearby(${pt.lat.toFixed(6)},${pt.lng.toFixed(6)},${radius})`)}&$select=${select}&$format=JSON`
    const list = await ctx.cached(url, () => ctx.fetchJSON(url, { timeout: 15000 }))
    return {
      county: a.county,
      list: (Array.isArray(list) ? list : []).filter((s) => s.StationPosition && isFinite(s.StationPosition.PositionLat)).map((s) => ({ raw: s, name: (s.StationName && s.StationName.Zh_tw) || '', lat: s.StationPosition.PositionLat, lng: s.StationPosition.PositionLon, dist: ctx.dist(pt, { lat: s.StationPosition.PositionLat, lng: s.StationPosition.PositionLon }) })).sort((x, y) => x.dist - y.dist),
    }
  }
  const tdxFail = (e) => {
    const msg = String((e && e.message) || e)
    return /429/.test(msg)
      ? { level: 'na', headline: '今日查詢額度已用完', detail: '交通部 TDX 對未註冊的匿名查詢有每日次數上限（同一個對外 IP 共用），額度用完後要到隔日才恢復。' }
      : { level: 'na', headline: '暫時查不到', detail: `交通部 TDX 未回應（${msg}）。可稍後再試。` }
  }

  GIS.registerPack({
    id: 'living',
    name: '生活機能',
    icon: 'map-pinned',
    order: 1,

    layers: [
      { id: 'living_school_area', name: '各級學校範圍', type: 'xyz', url: xyz('SCHOOL'), group: '學校', opacity: 0.75, maxNativeZoom: 18, ...NLSC_SRC, note: '學校校地範圍，不是學區（通學區）。' },
      { id: 'living_cvs', name: '便利商店（超商）', type: 'xyz', url: xyz('ConvenienceStore'), group: '生活設施', opacity: 1, minZoom: 12, maxNativeZoom: 18, ...NLSC_SRC, note: '放大到街區才看得清楚。' },
      { id: 'living_aed', name: 'AED 位置', type: 'xyz', url: xyz('AED'), group: '生活設施', opacity: 1, minZoom: 12, maxNativeZoom: 18, ...NLSC_SRC },
      { id: 'living_shelters', name: '避難收容所', type: 'xyz', url: xyz('SHELTERS'), group: '生活設施', opacity: 1, maxNativeZoom: 18, ...NLSC_SRC },
      { id: 'living_road', name: '道路路網', type: 'xyz', url: xyz('ROAD'), group: '交通', opacity: 0.85, maxNativeZoom: 18, ...NLSC_SRC, note: '疊在正射影像上看臨路條件用。' },
    ],

    datasets: [
      {
        id: 'rail_stations', name: '軌道車站（捷運、輕軌、臺鐵、高鐵）', file: 'packs/living/data/rail_stations.js',
        geometry: 'point', count: 526, showAsLayer: true, group: '交通',
        style: { color: '#2563eb', radius: 5, weight: 2, fillOpacity: 0.6 },
        styleBy: { field: 'type', map: { 捷運: '#2563eb', 輕軌: '#7c3aed', 臺鐵: '#0f766e', 高鐵: '#ea580c' } },
        labelField: 'name',
        popupFields: [['name', '站名'], ['type', '類別'], ['line', '路線'], ['operator', '營運單位'], ['code', '車站代碼']],
        minZoom: 9,
        source: '交通部 TDX 運輸資料流通服務', sourceUrl: 'https://tdx.transportdata.tw/', updated: '2026-11-25',
      },
      {
        id: 'school_district_tp', name: '臺北市國小、國中學區（里鄰對照表）', file: 'packs/living/data/school_district_tp.js',
        geometry: 'point', count: 0, showAsLayer: false, group: '學校',
        source: '臺北市政府教育局（115 學年度國小、國中里鄰學區對照表）', sourceUrl: 'https://data.gov.tw/dataset/121151', updated: '2026-09-16',
        note: '里鄰對照表，沒有圖形，只供地點體檢「所屬學區」使用。',
      },
      {
        id: 'rail_planned', name: '興建中／規劃中軌道車站（OpenStreetMap，不完整）', file: 'packs/living/data/rail_planned.js',
        geometry: 'point', count: 61, showAsLayer: true, group: '交通',
        style: { color: '#ea580c', radius: 5, weight: 2, fillOpacity: 0.35 },
        styleBy: { field: 'status', map: { 興建中: '#ea580c', 規劃中: '#a855f7' } },
        labelField: 'name',
        popupFields: [['name', '站名'], ['code', '車站代碼'], ['line', '路線'], ['status', '狀態（OSM 標註）']],
        minZoom: 10,
        source: 'OpenStreetMap 貢獻者（ODbL 授權）', sourceUrl: 'https://www.openstreetmap.org/copyright', updated: '2026-11-25',
        note: '志願者編輯的資料，不是主管機關公告：只有萬大線、桃園綠線及延伸線、環狀線北南東環、汐止東湖線、機場捷運 A14／A23、高雄黃線部分車站；位置與「興建中／規劃中」狀態可能與核定內容不同。三鶯線、淡海輕軌二期、臺中捷運藍線等其他路線沒有資料。',
      },
      {
        id: 'school_district_ntpc', name: '新北市公立國小學區（里鄰對照表）', file: 'packs/living/data/school_district_ntpc.js',
        geometry: 'point', count: 0, showAsLayer: false, group: '學校',
        source: '新北市政府教育局（新北市公立國小學區）', sourceUrl: 'https://data.gov.tw/dataset/124829', updated: '2026-11-25',
        note: '里鄰對照表，沒有圖形，只供地點體檢「所屬學區」使用。只有國小；國中學區尚未取得。',
      },
    ],

    checks: [
      {
        id: 'living_metro', name: '最近捷運／輕軌站', order: 10, source: '交通部 TDX',
        run: railCheck({ types: ['捷運', '輕軌'], what: '捷運或輕軌車站', goodAt: R_NEAR, infoAt: R_MID, far: 3000, walkMax: 2000 }),
      },
      {
        id: 'living_tra', name: '最近臺鐵車站', order: 11, source: '交通部 TDX',
        run: railCheck({ types: ['臺鐵'], what: '臺鐵車站', goodAt: R_NEAR, infoAt: R_MID, far: 5000, walkMax: 2000 }),
      },
      {
        id: 'living_hsr', name: '最近高鐵車站', order: 12, source: '交通部 TDX',
        run: railCheck({ types: ['高鐵'], what: '高鐵車站', goodAt: 1000, infoAt: 5000, far: 30000, walkMax: 2000 }),
      },
      {
        id: 'living_rail_planned', name: '興建中／規劃中軌道車站（1 公里內）', order: 12.5, source: 'OpenStreetMap 貢獻者（ODbL）',
        run: async (pt, ctx) => {
          const fc = await ctx.data('rail_planned')
          const hits = ctx.within(fc, pt, R_MID)
          const note = '查詢範圍 1 公里（直線距離），只列出不評分。資料取自 OpenStreetMap（2026-11-25），是志願者編輯的資料、不是主管機關公告，只收錄 61 站：萬大－中和－樹林線、桃園捷運綠線及延伸中壢段、環狀線北南東環段、汐止東湖線、機場捷運 A14 與 A23、高雄捷運黃線部分車站。站位與「興建中／規劃中」為 OSM 標註，可能與核定計畫不同；其他興建或規劃中的路線（如三鶯線、淡海輕軌二期、臺中捷運藍線）沒有資料，所以「沒有」不代表周邊確無新設車站。通車時程請查各捷運工程主管機關公告。'
          if (!hits.length) return { level: 'info', headline: '1 公里內未查得', detail: note, reportText: '查詢地點 1 公里範圍內，未查得興建中或規劃中之軌道車站（依 OpenStreetMap 已標註之路線，資料不完整）。' }
          const p0 = hits[0].feature.properties
          const nm = (p) => (p.code && !p.name.includes(p.code) ? `${p.name}（${p.code}）` : p.name)
          const items = hits.slice(0, 8).map((h) => ({ label: nm(h.feature.properties), value: `${h.feature.properties.line}｜${h.feature.properties.status}`, dist: Math.round(h.dist), lat: h.feature.geometry.coordinates[1], lng: h.feature.geometry.coordinates[0] }))
          return {
            level: 'info', headline: `${hits.length} 站，最近 ${nm(p0)} ${ctx.fmtDist(hits[0].dist)}`, items,
            detail: `最近為${p0.line}「${nm(p0)}」（OSM 標註：${p0.status}），直線距離約 ${ctx.fmtDist(hits[0].dist)}。` + note,
            reportText: `查詢地點 1 公里範圍內有 ${hits.length} 處興建中或規劃中之軌道車站，最近者為${p0.line}「${nm(p0)}」（${p0.status}），直線距離約 ${ctx.fmtDist(hits[0].dist)}；站位取自 OpenStreetMap，實際站位及通車時程應以主管機關公告為準。`,
          }
        },
      },
      {
        id: 'living_bus', requires: 'tdx', name: '公車站（500 公尺內）', order: 13, source: '交通部 TDX', timeout: 30000,
        run: async (pt, ctx) => {
          let r
          try { r = await tdxNearby(ctx, pt, 'Bus/Station', 'StationName,StationPosition,Stops', R_NEAR) } catch (e) { return tdxFail(e) }
          if (!r.list) return { level: 'na', headline: '此縣市無資料', detail: `查無「${r.county || ''}」的市區公車資料。` }
          const rule = `只查所在縣市（${r.county}）的市區公車站位，不含公路客運與鄰縣市路線；位在縣市交界時會少算。判定門檻（直線距離）：最近站位 300 公尺內為近（綠）。`
          if (!r.list.length) return { level: 'info', headline: '500 公尺內無公車站', detail: rule, reportText: '查詢地點 500 公尺範圍內無市區公車站位。' }
          const names = uniqBy(r.list, (s) => s.name)
          const routes = new Set(r.list.flatMap((s) => (s.raw.Stops || []).map((x) => x.RouteName && x.RouteName.Zh_tw)).filter(Boolean))
          const n = r.list[0]
          return {
            level: n.dist <= 300 ? 'good' : 'info',
            headline: `${names.length} 個站名、${routes.size} 條路線`,
            detail: `最近為「${n.name}」約 ${ctx.fmtDist(n.dist)}。${rule}`,
            items: names.slice(0, 6).map((s) => ({ label: s.name, value: [...new Set((s.raw.Stops || []).map((x) => x.RouteName && x.RouteName.Zh_tw).filter(Boolean))].slice(0, 8).join('、'), dist: Math.round(s.dist), lat: s.lat, lng: s.lng })),
            reportText: `查詢地點 500 公尺範圍內有市區公車站 ${names.length} 處（以站名計）、行經路線 ${routes.size} 條，最近站位「${n.name}」直線距離約 ${ctx.fmtDist(n.dist)}。`,
          }
        },
      },
      {
        id: 'living_bike', requires: 'tdx', name: '公共自行車站（500 公尺內）', order: 14, source: '交通部 TDX', timeout: 30000,
        run: async (pt, ctx) => {
          let r
          try { r = await tdxNearby(ctx, pt, 'Bike/Station', 'StationName,StationPosition,BikesCapacity', R_NEAR) } catch (e) {
            if (/HTTP 40[04]/.test(String(e && e.message))) return { level: 'na', headline: '此縣市無公共自行車資料' }
            return tdxFail(e)
          }
          if (!r.list) return { level: 'na', headline: '此縣市無資料' }
          const rule = `只查所在縣市（${r.county}）的公共自行車租賃站。判定門檻（直線距離）：最近站 300 公尺內為近（綠）。`
          if (!r.list.length) return { level: 'info', headline: '500 公尺內無租賃站', detail: rule, reportText: '查詢地點 500 公尺範圍內無公共自行車租賃站。' }
          const n = r.list[0], clean = (s) => s.replace(/^YouBike\s*[\d.]*E?_?/i, '')
          return {
            level: n.dist <= 300 ? 'good' : 'info',
            headline: `${r.list.length} 站，最近 ${ctx.fmtDist(n.dist)}`,
            detail: `最近為「${clean(n.name)}」。${rule}`,
            items: r.list.slice(0, 6).map((s) => ({ label: clean(s.name), value: s.raw.BikesCapacity ? `車柱 ${s.raw.BikesCapacity} 格` : '', dist: Math.round(s.dist), lat: s.lat, lng: s.lng })),
            reportText: `查詢地點 500 公尺範圍內有公共自行車租賃站 ${r.list.length} 處，最近一站「${clean(n.name)}」直線距離約 ${ctx.fmtDist(n.dist)}。`,
          }
        },
      },
      {
        id: 'living_school', name: '鄰近學校（國小、國中）', order: 20, source: '內政部國土測繪中心（地標）',
        run: async (pt, ctx) => {
          const g = group(await marks(ctx, 'edu', pt, R_MID), eduKind)
          const es = g['國小'] || [], js = g['國中'] || [], hs = g['高中職'] || [], us = g['大專院校'] || []
          const rule = '以直線距離計；500 公尺內有國小或國中為近（綠）。這是「距離」不是「學區」：實際就讀學校依各縣市教育局公告的通學區（依里鄰劃分）為準。進修部、補校與本校同址，不重複計。'
          const items = [...es.map((o) => toItem(ctx, o, '國小')), ...js.map((o) => toItem(ctx, o, '國中')), ...hs.map((o) => toItem(ctx, o, '高中職')), ...us.map((o) => toItem(ctx, o, '大專院校'))].sort((a, b) => a.dist - b.dist)
          if (!es.length && !js.length) {
            const other = hs.length + us.length ? `（另有高中職 ${hs.length} 所、大專院校 ${us.length} 所）` : ''
            return { level: 'info', headline: '1 公里內無國小、國中', detail: rule, items, reportText: `查詢地點 1 公里範圍內無國民小學及國民中學${other}。` }
          }
          const part = (label, list) => (list.length ? `${label} ${list.length} 所（${listText(ctx, list)}）` : `無${label}`)
          const near = [...inR(es, R_NEAR), ...inR(js, R_NEAR)]
          const extra = hs.length || us.length ? `另有${[hs.length ? `高中職 ${hs.length} 所` : '', us.length ? `大專院校 ${us.length} 所` : ''].filter(Boolean).join('、')}。` : ''
          return {
            level: near.length ? 'good' : 'info',
            headline: `國小 ${es.length} 所、國中 ${js.length} 所（1 公里內）`,
            detail: `500 公尺內：國小 ${inR(es, R_NEAR).length} 所、國中 ${inR(js, R_NEAR).length} 所。${rule}`,
            items,
            reportText: `查詢地點 1 公里範圍內有${part('國小', es)}、${part('國中', js)}${near.length ? `，其中 500 公尺內有${near.map((o) => o.sname).join('、')}` : ''}。${extra}`,
          }
        },
      },
      {
        id: 'living_school_district', name: '所屬學區（臺北市、新北市）', order: 21, source: '臺北市政府教育局、新北市政府教育局',
        run: async (pt, ctx) => {
          let a
          try { a = await ctx.admin(pt) } catch (e) { return { level: 'na', headline: '查不到所在村里', detail: '國土測繪中心的村里查詢沒有回應，無法對照學區；請稍後再試。' } }
          const norm = (s) => String(s || '').replace(/台/g, '臺').trim()
          const county = norm(a.county), town = norm(a.town), village = norm(a.village)
          if (county === '新北市') {
            const nd = await ctx.data('school_district_ntpc')
            const rows = nd.towns[town] || []
            // token 形如「社後里（1-3鄰）」「宏翠里1鄰」「全區」；里名要整個相同才算
            const pick = (list) => list.filter((k) => k === '全區' || k.startsWith(village)).map((k) => (k === '全區' ? '' : k.slice(village.length).replace(/^（(.*)）$/, '$1')))
            const full = (r) => (r[1] && r[1] !== town ? r[1] : '') + r[0]
            const base = [], free = new Map()
            for (const r of rows) {
              for (const q of pick(r[2])) base.push({ school: full(r), q })
              for (const q of pick(r[3])) { const e = free.get(q) || []; if (!e.includes(full(r))) e.push(full(r)); free.set(q, e) }
            }
            const NT_NOTE = '資料為新北市政府教育局「新北市公立國小學區」（政府資料開放平臺，2026-11-25 取得），只有國小，國中學區尚未取得。本圖台查不到「鄰」，鄰別請依戶籍對照。自由學區是指該範圍可在所列學校中選擇；額滿學校、改分發及當學年度調整，以教育局及學校公告為準。'
            if (!base.length && !free.size) return { level: 'na', headline: `對照表查無「${town}${village}」`, detail: '這個里在新北市國小學區表中查不到（可能是里名用字不同、行政區調整，或來源表列方式特殊），請逕向新北市政府教育局或學校查詢。' + NT_NOTE }
            const qt = (q) => q || '全里'
            const items = [...base.map((b) => ({ label: '國小基本學區｜' + qt(b.q), value: b.school })), ...[...free].map(([q, list]) => ({ label: '國小自由學區｜' + qt(q), value: list.join('、') }))]
            const names = [...new Set([...base.map((b) => b.school), ...[...free.values()].flat()])]
            const bt = base.map((b) => (b.q ? `${b.q}為` : '') + b.school).join('；')
            const ft = [...free].map(([q, list]) => `${q || '全里'}為${list.join('、')}之自由學區`).join('；')
            return {
              level: 'info', headline: '國小：' + names.join('、'), items,
              detail: `所在村里為${county}${town}${village}。` + (base.length + free.size > 1 ? '這個里依鄰別分屬不同學區。' : '') + NT_NOTE,
              reportText: `查詢地點位於${county}${town}${village}，依新北市政府教育局公立國小學區表，${[bt && '基本學區' + (base.length === 1 && !base[0].q ? '為' : '：') + bt, ft && (bt ? '另' : '') + ft].filter(Boolean).join('；')}。${base.length + free.size > 1 ? '（該里依鄰別劃分學區，實際應依戶籍所在鄰別認定。）' : ''}國中學區未列入本次查詢。`,
            }
          }
          const d = await ctx.data('school_district_tp')
          // 同一段鄰別若列了多所互為共同學區的學校，併成一列；已有「全里」列的學校不再重複列它的個別鄰別
          const rowsOf = (lv) => {
            const raw = ((d[lv].towns[town] || {})[village] || []).map((r) => ({ school: d[lv].schools[r[0]], from: r[1] || 0, to: r[2] || 0, shared: (r[3] || []).map((i) => d[lv].schools[i]) }))
            const whole = new Set(raw.filter((r) => !r.from && !r.to).map((r) => r.school))
            const g = new Map()
            for (const r of raw) {
              if ((r.from || r.to) && whole.has(r.school)) continue
              const k = r.from + '-' + r.to
              const e = g.get(k) || { from: r.from, to: r.to, schools: [], shared: false }
              for (const n of [r.school, ...r.shared]) if (!e.schools.includes(n)) e.schools.push(n)
              if (r.shared.length) e.shared = true
              g.set(k, e)
            }
            return [...g.values()]
          }
          const es = rowsOf('elementary'), js = rowsOf('junior')
          if (!es.length && !js.length) {
            if (county !== '臺北市') return { level: 'na', headline: `${county || '此處'}尚無學區資料`, detail: '目前只收錄臺北市（115 學年度國小、國中）與新北市（國小）的里鄰學區對照表；其他縣市尚未取得。' }
            return { level: 'na', headline: `對照表查無「${town}${village}」`, detail: '這個里在教育局 115 學年度里鄰學區對照表中查不到（可能是里名用字不同或行政區調整），請逕向臺北市政府教育局或學校查詢。' }
          }
          const range = (r) => (!r.from && !r.to ? '全里' : r.to >= 99 ? `${r.from} 鄰以後` : r.from === r.to ? `${r.from} 鄰` : `${r.from}–${r.to} 鄰`)
          const val = (r) => r.schools.join('、') + (r.shared ? '（共同學區）' : '')
          const names = (rows) => [...new Set(rows.flatMap((r) => r.schools))]
          const items = [...es.map((r) => ({ label: '國小｜' + range(r), value: val(r) })), ...js.map((r) => ({ label: '國中｜' + range(r), value: val(r) }))]
          const split = es.length > 1 || js.length > 1
          const part = (label, rows) => (rows.length ? `${label}為${rows.length === 1 && !rows[0].from && !rows[0].to ? val(rows[0]) : rows.map((r) => range(r) + '：' + val(r)).join('；')}` : `${label}在對照表中查無資料`)
          return {
            level: 'info',
            headline: `國小：${names(es).join('、') || '查無'}｜國中：${names(js).join('、') || '查無'}`,
            items,
            detail: `所在村里為${county}${town}${village}。${split ? '這個里依鄰別分屬不同學校，本圖台查不到「鄰」，請依戶籍所在的鄰對照上列範圍。' : ''}依臺北市政府教育局 ${d.year}國小、國中里鄰學區對照表；學區每學年檢討公告，共同學區、額滿學校改分發及實際入學資格仍以教育局及學校當年度公告為準。`,
            reportText: `查詢地點位於${county}${town}${village}，依臺北市政府教育局 ${d.year}里鄰學區對照表，${part('國小學區', es)}；${part('國中學區', js)}。${split ? '（該里依鄰別劃分學區，實際應依戶籍所在鄰別認定。）' : ''}`,
          }
        },
      },
      {
        id: 'living_medical', name: '鄰近醫院', order: 30, source: '內政部國土測繪中心（地標）',
        run: async (pt, ctx) => {
          const g = group(await marks(ctx, 'med', pt, 3000), medKind)
          const hos = g['醫院'] || [], phc = g['衛生所'] || []
          const rule = '以直線距離計；1 公里內有醫院為近（綠），查詢範圍 3 公里。地標資料不分醫學中心、區域醫院、地區醫院，也不含診所；醫院層級請另查衛生福利部醫事機構資料。'
          const items = [...hos.slice(0, 8).map((o) => toItem(ctx, o, '醫院')), ...phc.slice(0, 2).map((o) => toItem(ctx, o, '衛生所'))]
          const phcText = phc.length ? `最近之衛生所（健康服務中心）為${nameDist(ctx, phc[0])}。` : ''
          if (!hos.length) return { level: 'info', headline: '3 公里內無醫院', detail: rule, items, reportText: `查詢地點 3 公里範圍內無醫院。${phcText}` }
          const h1 = inR(hos, R_MID)
          return {
            level: h1.length ? 'good' : 'info',
            headline: `${hos[0].sname} ${ctx.fmtDist(hos[0].dist)}`,
            detail: `1 公里內醫院 ${h1.length} 家、3 公里內 ${hos.length} 家。${rule}`,
            items,
            reportText: h1.length
              ? `查詢地點 1 公里範圍內有醫院 ${h1.length} 家（${listText(ctx, h1)}），3 公里範圍內共 ${hos.length} 家。${phcText}`
              : `查詢地點 1 公里範圍內無醫院，3 公里範圍內有醫院 ${hos.length} 家，最近為${nameDist(ctx, hos[0])}。${phcText}`,
          }
        },
      },
      {
        id: 'living_summary', name: '生活機能摘要（500 公尺／1 公里）', order: 40, source: '交通部 TDX、內政部國土測繪中心（地標）', timeout: 30000,
        run: async (pt, ctx) => {
          const rows = [] // {label, list:[{sname,dist,lat,lng}], unit}
          const fc = await ctx.data('rail_stations')
          const rail = (types) => uniqBy(ctx.within(fc, pt, R_MID, (p) => types.includes(p.type)), (h) => h.feature.properties.type + h.feature.properties.name).map((h) => ({ sname: stationName(h.feature.properties), dist: h.dist, lat: h.feature.geometry.coordinates[1], lng: h.feature.geometry.coordinates[0] }))
          rows.push({ label: '捷運／輕軌站', unit: '處', list: rail(['捷運', '輕軌']) }, { label: '臺鐵／高鐵站', unit: '處', list: rail(['臺鐵', '高鐵']) })
          const failed = []
          const [edu, med] = await Promise.all([
            marks(ctx, 'edu', pt, R_MID).catch(() => { failed.push('文教設施'); return [] }),
            marks(ctx, 'med', pt, 3000).catch(() => { failed.push('醫療社福設施'); return [] }),
          ])
          const ge = group(edu, eduKind), gm = group(inR(med, R_MID), medKind)
          if (!failed.includes('文教設施')) for (const [k, u] of [['國小', '所'], ['國中', '所'], ['高中職', '所'], ['大專院校', '所'], ['幼兒園', '所'], ['圖書館', '處'], ['藝文展演設施', '處']]) rows.push({ label: k, unit: u, list: ge[k] || [] })
          if (!failed.includes('醫療社福設施')) for (const [k, u] of [['醫院', '家'], ['衛生所', '處'], ['托育及兒少福利設施', '處'], ['老人福利及長照機構', '處']]) rows.push({ label: k, unit: u, list: gm[k] || [] })
          const has = rows.filter((r) => r.list.length)
          const items = rows.map((r) => ({
            label: r.label,
            value: r.list.length ? `500 公尺內 ${inR(r.list, R_NEAR).length} ${r.unit}／1 公里內 ${r.list.length} ${r.unit}，最近：${r.list[0].sname}` : '1 公里內無',
            ...(r.list.length ? { dist: Math.round(r.list[0].dist), lat: r.list[0].lat, lng: r.list[0].lng } : {}),
          }))
          const note = '只列數量與最近一處，不評分。範圍為直線距離。超商請開「便利商店」圖層目視；公園、市場、警消、郵局尚無可公開的全國點位資料，未列入。' + (failed.length ? `（${failed.join('、')}暫時查不到，本次未列。）` : '')
          if (!has.length) return { level: 'info', headline: '1 公里內未查得列管設施', detail: note, items, reportText: '查詢地點 1 公里範圍內未查得軌道車站、學校、醫院等公共設施。' }
          const seg = (r, rad) => { const n = inR(r.list, rad).length; return n ? `${r.label} ${n} ${r.unit}` : '' }
          const t500 = rows.map((r) => seg(r, R_NEAR)).filter(Boolean), t1000 = rows.map((r) => seg(r, R_MID)).filter(Boolean)
          return {
            level: 'info',
            headline: `1 公里內 ${has.length} 類設施`,
            detail: note,
            items,
            reportText: `查詢地點周邊公共設施：500 公尺範圍內${t500.length ? '有' + t500.join('、') : '未查得列管設施'}；1 公里範圍內有${t1000.join('、')}。${failed.length ? `（${failed.join('、')}本次查詢未回應，未列入。）` : ''}`,
          }
        },
      },
      {
        id: 'living_nimby', name: '鄰近殯葬、環保設施與加油站', order: 50, source: '內政部國土測繪中心（地標）',
        run: async (pt, ctx) => {
          const g = group(await marks(ctx, 'dis', pt, R_MID), disKind)
          const heavyKinds = ['殯儀館', '火化場', '納骨塔', '公墓', '污水、垃圾等環保設施', '其他']
          const heavy = heavyKinds.flatMap((k) => (g[k] || []).map((o) => ({ ...o, kind: k }))).sort((a, b) => a.dist - b.dist)
          const gas = (g['加油（氣）站'] || []).map((o) => ({ ...o, kind: '加油（氣）站' }))
          const rule = '查詢範圍 1 公里（直線距離）。門檻：殯儀館、火化場、納骨塔、公墓、污水或垃圾處理設施在 500 公尺內列黃燈；加油（氣）站在 100 公尺內列黃燈；其餘僅列出供參。資料為國土測繪中心地標，不含變電所、高壓電塔、宮廟、特種行業等，仍須現場勘查。'
          const items = [...heavy, ...gas].sort((a, b) => a.dist - b.dist).slice(0, 10).map((o) => toItem(ctx, o, o.kind))
          if (!heavy.length && !gas.length) return { level: 'good', headline: '1 公里內未查得', detail: rule, reportText: '查詢地點 1 公里範圍內未查得殯葬設施、污水及垃圾處理設施與加油站（依國土測繪中心地標資料）。' }
          const warn = [...inR(heavy, R_NEAR), ...inR(gas, 100)]
          const txt = (list) => list.slice(0, 5).map((o) => `${o.sname}（${o.kind}，約 ${ctx.fmtDist(o.dist)}）`).join('、') + (list.length > 5 ? ' 等' : '')
          const parts = []
          if (heavy.length) parts.push(`殯葬及環保設施 ${heavy.length} 處：${txt(heavy)}`)
          if (gas.length) parts.push(`加油（氣）站 ${gas.length} 處，最近為${nameDist(ctx, gas[0])}`)
          return {
            level: warn.length ? 'warn' : 'info',
            headline: warn.length ? `${warn[0].sname} ${ctx.fmtDist(warn[0].dist)}` : heavy.length ? `1 公里內 ${heavy.length} 處（均逾 500 公尺）` : `僅加油站 ${gas.length} 處`,
            detail: rule,
            items,
            reportText: `查詢地點 1 公里範圍內有${parts.join('；')}。`,
          }
        },
      },
    ],
  })
})(typeof window !== 'undefined' ? window : globalThis)
