// 圖資包：規劃與開發（都市計畫、都市更新、整體開發區、產業園區、文化資產）
// 規格見 packs/README.md；來源與實測紀錄見 packs/planning/NOTES.md
;(function (root) {
  'use strict'
  const GIS = root.GIS
  const HG = 'https://www.historygis.udd.gov.taipei/arcgis/rest/services'
  const PLAN_THEME = HG + '/UrbanPlan2/PlanTheme/MapServer' // 臺北市都市計畫主題圖（動態服務，無快取圖磚）
  const ZONE2 = HG + '/UrbanPlan2/UrbanPlan2/MapServer' // 臺北市使用分區（含完整分區名稱）
  const ZONE1 = HG + '/Urban/UrbanPlan/MapServer' // 臺北市使用分區（快取版，只有簡稱）
  const NO_TDR = HG + '/Hosted/' + encodeURIComponent('不得容積移轉地區') + '/FeatureServer/0'
  const WRA = 'https://maps.wra.gov.tw/arcgis/rest/services/WMS/GIC_WMS/MapServer' // 水利署權責圖資（有 CORS）
  const WRA_WMS = 'https://maps.wra.gov.tw/arcgis/services/WMS/GIC_WMS/MapServer/WMSServer'
  const SRC_WRA = '經濟部水利署（水利地理資訊服務平台）'
  const URL_WRA = 'https://gic.wra.gov.tw/'
  const SRC_TP = '臺北市政府都市發展局（臺北市歷史圖資展示系統）'
  const URL_TP = 'https://www.historygis.udd.gov.taipei/urban/map/'
  const ortho = (y, svc) => ({
    id: 'tp_ortho_' + y, name: '臺北市航照 ' + y + ' 年', type: 'xyz', group: '歷史航照（臺北市）',
    url: HG + '/Aerial/' + (svc || 'Ortho_' + y) + '/MapServer/tile/{z}/{y}/{x}',
    opacity: 1, maxNativeZoom: 19, source: SRC_TP, sourceUrl: URL_TP,
    note: '只涵蓋臺北市。可與現況對照，判讀土地使用沿革（原為農地、工廠、眷村等）。',
  })

  // ── 共用小工具 ──────────────────────────────────────────────────────────
  const inTaipeiBox = (pt) => pt.lat > 24.96 && pt.lat < 25.22 && pt.lng > 121.45 && pt.lng < 121.67
  const clean = (s) => String(s == null ? '' : s).trim()
  const rocDate = (ms) => { if (ms == null) return ''; const d = new Date(ms + 8 * 3600e3); return d.getUTCFullYear() - 1911 + '.' + String(d.getUTCMonth() + 1).padStart(2, '0') + '.' + String(d.getUTCDate()).padStart(2, '0') }
  /** 是否在臺北市轄內：用都發局行政區圖層判斷（外框內含部分新北市，不能只看經緯度範圍）。回傳行政區名或 '' */
  function taipeiTown(pt, ctx) {
    if (!inTaipeiBox(pt)) return Promise.resolve('')
    return ctx.cached('planning:tptown:' + pt.lat + ',' + pt.lng, async () => {
      const fs = await ctx.arcgisQuery(ZONE2 + '/3', pt, { outFields: 'TownName' })
      return fs.length ? clean(fs[0].attributes.TownName) || '臺北市' : ''
    })
  }
  const NOT_TAIPEI = { level: 'na', headline: '不在臺北市，無此圖資', detail: '這個項目目前只有臺北市有可公開點查的圖資。' }
  const ringsToGeom = (g) => (g && g.rings ? { type: 'Polygon', coordinates: g.rings } : null)
  const P = (f) => f.properties || {}

  GIS.registerPack({
    id: 'planning',
    name: '規劃與開發',
    icon: 'building-2',
    order: 4,

    // ── 1) 圖層 ───────────────────────────────────────────────────────────
    layers: [
      {
        id: 'tp_renewal_area', name: '公劃都市更新地區（臺北市）', type: 'arcgis', url: PLAN_THEME, layerName: 'show:0',
        group: '都市更新', opacity: 0.6,
        legend: [
          { color: '#00ffff', label: '89.06.26 公告劃定' }, { color: '#ffff00', label: '91.10.28 公告劃定' },
          { color: '#ff7f00', label: '91.10.19 公告劃定' }, { color: '#00ff00', label: '震災及高氯離子建物劃定' },
          { color: '#ff0000', label: '依都市更新條例劃定' },
        ],
        source: SRC_TP, sourceUrl: URL_TP,
        note: '市府公告劃定的更新地區（不含民間自行劃定的更新單元）。只涵蓋臺北市。',
      },
      {
        id: 'tp_slope_limit', name: '山坡地管制區（臺北市）', type: 'xyz',
        url: HG + '/Hosted/planlimit2_3826/MapServer/tile/{z}/{y}/{x}',
        group: '開發管制', opacity: 0.6, minZoom: 13, maxNativeZoom: 18,
        source: SRC_TP, sourceUrl: URL_TP, note: '放大到 13 級以上才有圖。只涵蓋臺北市。',
      },
      {
        id: 'tp_military_limit', name: '軍事管制區禁限建範圍（臺北市）', type: 'arcgis', url: PLAN_THEME, layerName: 'show:1',
        group: '開發管制', opacity: 0.6, legend: [{ color: '#ffffbe', label: '軍事禁限建範圍（紅框）' }],
        source: SRC_TP, sourceUrl: URL_TP, note: '只涵蓋臺北市，共 6 處。',
      },
      {
        id: 'tp_urban_design', name: '都市設計審議地區（臺北市）', type: 'arcgis', url: PLAN_THEME, layerName: 'show:3',
        group: '開發管制', opacity: 0.5, legend: [{ color: '#a5f57a', label: '須經都市設計審議地區' }],
        source: SRC_TP, sourceUrl: URL_TP, note: '位於範圍內的開發案，申請建照前須先通過都市設計審議。只涵蓋臺北市。',
      },
      {
        id: 'tp_no_buildline', name: '免建築線指示地區（臺北市）', type: 'arcgis', url: PLAN_THEME, layerName: 'show:4',
        group: '開發管制', opacity: 0.6, legend: [{ color: '#bed2ff', label: '可免建築線指示地區' }],
        source: SRC_TP, sourceUrl: URL_TP, note: '多為重劃區、區段徵收區。只涵蓋臺北市，共 10 處。',
      },
      {
        id: 'wra_water_protect', name: '自來水水質水量保護區', type: 'wms', url: WRA_WMS, layerName: 'TWQPROT',
        wmsVersion: '1.1.1', wmsFormat: 'image/png', group: '水源與河川管制', opacity: 0.55,
        source: SRC_WRA, sourceUrl: URL_WRA, note: '全國 107 處。區內土地利用受自來水法第 11 條限制。',
      },
      {
        id: 'wra_reservoir_catchment', name: '水庫集水區', type: 'wms', url: WRA_WMS, layerName: 'reservoir',
        wmsVersion: '1.1.1', wmsFormat: 'image/png', group: '水源與河川管制', opacity: 0.5,
        source: SRC_WRA, sourceUrl: URL_WRA, note: '全國 80 座水庫的集水區範圍，屬環境敏感地區。',
      },
      {
        id: 'wra_river_zone', name: '河川區域（中央管河川）', type: 'wms', url: WRA_WMS, layerName: 'RIVREGLN',
        wmsVersion: '1.1.1', wmsFormat: 'image/png', group: '水源與河川管制', opacity: 0.55,
        source: SRC_WRA, sourceUrl: URL_WRA, note: '河川區域內的土地使用受水利法管制。臺北市轄段僅供參考。',
      },
      ortho(1957), ortho(1979, 'Ortho_1979_2'), ortho(1991), ortho(2005), ortho(2015), ortho(2025),
    ],

    // ── 2) 靜態資料集 ─────────────────────────────────────────────────────
    datasets: [
      {
        // 例外：這個檔由介面整合時從 platform/data/land-readjustment.geojson 轉出，不在本資料夾
        id: 'readjust', name: '市地重劃區', file: 'data/land-readjustment.js', geometry: 'polygon', count: 406,
        showAsLayer: false, group: '整體開發區',
        source: '各直轄市政府地政局（政府資料開放平臺）', sourceUrl: 'https://data.gov.tw/', updated: '2026-11-19',
      },
      {
        id: 'eminent', name: '區段徵收區', file: 'packs/planning/data/eminent.js', geometry: 'polygon', count: 84,
        showAsLayer: true, group: '整體開發區',
        style: { color: '#7c3aed', weight: 2, fillOpacity: 0.2 }, labelField: 'name',
        popupFields: [['name', '名稱'], ['city', '縣市'], ['status', '進度'], ['year', '年度'], ['area', '面積（公頃）']],
        source: '臺北、新北、臺中、高雄市政府地政局（政府資料開放平臺）', sourceUrl: 'https://data.gov.tw/dataset/121676', updated: '2026-11-19',
      },
      {
        id: 'industrial_parks', name: '產業園區／工業區範圍', file: 'packs/planning/data/industrial_parks.js', geometry: 'polygon', count: 212,
        showAsLayer: true, group: '產業用地',
        style: { color: '#b45309', weight: 2, fillOpacity: 0.25 },
        styleBy: { field: 'status', map: { 已開發: '#b45309', 開發中: '#dc2626', 自行購地設廠: '#78716c', 編定中: '#2563eb', 已編定未開發: '#0891b2' } },
        labelField: 'name', minZoom: 9,
        popupFields: [['name', '名稱'], ['city', '縣市'], ['type', '設置依據'], ['status', '開發狀態'], ['area', '面積（公頃）']],
        source: '經濟部產業園區管理局', sourceUrl: 'https://data.gov.tw/dataset/25598', updated: '2026-09-17',
      },
      {
        id: 'heritage', name: '文化資產（北北基桃）', file: 'packs/planning/data/heritage.js', geometry: 'point', count: 953,
        showAsLayer: true, group: '文化資產',
        style: { color: '#be123c', radius: 5, weight: 1, fillOpacity: 0.8 },
        styleBy: { field: 'kind', map: { 古蹟: '#be123c', 歷史建築: '#ea580c', 紀念建築: '#ca8a04', 聚落建築群: '#65a30d', 考古遺址: '#0d9488', 文化景觀: '#2563eb', 史蹟: '#7c3aed' } },
        labelField: 'name', minZoom: 12,
        popupFields: [['name', '名稱'], ['kind', '類別'], ['level', '級別'], ['city', '縣市']],
        source: '文化部文化資產局', sourceUrl: 'https://data.gov.tw/dataset/6246', updated: '2026-11-25',
      },
    ],

    // ── 3) 地點體檢 ───────────────────────────────────────────────────────
    checks: [
      {
        id: 'plan_zone_tp', name: '都市計畫使用分區（臺北市）', order: 10, source: SRC_TP, timeout: 25000,
        run: async (pt, ctx) => {
          const town = await taipeiTown(pt, ctx)
          if (!town) return NOT_TAIPEI
          let zone = '', memo = '', orig = ''
          const fs = await ctx.arcgisQuery(ZONE2 + '/2', pt).catch(() => [])
          if (fs.length) {
            const a = fs[0].attributes
            zone = clean(a['使用分區']) || clean(a['分區簡稱']) || clean(a['分區代碼'])
            memo = clean(a['分區說明']); orig = clean(a['原屬分區'])
          }
          if (!zone) { // 備援：快取版分區圖，只有簡稱
            for (const l of [1, 0]) {
              const f1 = await ctx.arcgisQuery(ZONE1 + '/' + l, pt, { outFields: 'NAME' })
              zone = [...new Set(f1.map((f) => clean(f.attributes.NAME)).filter(Boolean))].join('、')
              if (zone) break
            }
          }
          if (!zone) { // 點在道路上時分區圖沒有面圖徵，改列出 40 公尺內的鄰近分區
            const near = await ctx.arcgisQuery(ZONE2 + '/2', pt, { distance: 40, outFields: '使用分區,分區簡稱' }).catch(() => [])
            const names = [...new Set(near.map((f) => clean(f.attributes['使用分區']) || clean(f.attributes['分區簡稱'])).filter(Boolean))]
            if (!names.length) return { level: 'na', headline: '查無分區', detail: '這個位置與周邊 40 公尺內在分區圖上都沒有面圖徵，請把點位移到街廓內再查一次。' }
            return {
              level: 'info', headline: '點位在道路上；鄰近：' + names.slice(0, 4).join('、'),
              detail: '這個位置在分區圖上沒有面圖徵（通常是道路用地）。上列為 40 公尺內的使用分區，請把點位移到勘估標的所在街廓內再查一次。',
              reportText: `勘估點位落於道路用地或分區圖未劃設處，周邊 40 公尺內之土地使用分區為${names.slice(0, 4).map((n) => '「' + n + '」').join('、')}；實際分區仍應以主管機關核發之土地使用分區證明為準。`,
            }
          }
          const extra = [memo && '分區說明：' + memo, orig && '原屬分區：' + orig].filter(Boolean).join('；')
          return {
            level: 'info', headline: zone,
            detail: (extra ? extra + '。' : '') + '查詢結果為都發局圖台的分區圖面，容積率、建蔽率及是否有細部計畫特別規定，須另查土地使用分區管制及都市計畫書。',
            reportText: `勘估標的位於臺北市${town}，依臺北市政府都市發展局都市計畫使用分區圖查詢，土地使用分區為「${zone}」${orig ? `（原屬分區：${orig}）` : ''}；實際分區仍應以主管機關核發之土地使用分區證明為準。`,
          }
        },
      },
      {
        id: 'plan_renewal_tp', name: '公劃都市更新地區（臺北市）', order: 20, source: SRC_TP, timeout: 25000,
        run: async (pt, ctx) => {
          const town = await taipeiTown(pt, ctx)
          if (!town) return NOT_TAIPEI
          const R = 300
          const fs = await ctx.arcgisQuery(PLAN_THEME + '/0', pt, { distance: R, outFields: 'OBJECTID,PROJNUM,PLANDES,PLANDATE', returnGeometry: true })
          const rows = fs.map((f) => {
            const g = ringsToGeom(f.geometry)
            return { des: clean(f.attributes.PLANDES) || '公告劃定更新地區', no: clean(f.attributes.PROJNUM), dist: g ? ctx.distTo(pt, g) : NaN }
          }).sort((a, b) => a.dist - b.dist)
          const inside = rows.filter((r) => r.dist === 0)
          const items = rows.slice(0, 8).map((r) => ({ label: r.des, value: (r.no ? '案號 ' + r.no + '；' : '') + (r.dist === 0 ? '位於範圍內' : '距離約 ' + ctx.fmtDist(r.dist)), dist: Math.round(r.dist) }))
          const tail = '僅含市府公告劃定的更新地區，不含民間自行劃定的更新單元與個別都更、危老案件。'
          if (inside.length) {
            return {
              level: 'info', headline: '位於公劃更新地區內', items,
              detail: `${inside[0].des}${inside[0].no ? '（案號 ' + inside[0].no + '）' : ''}。${tail}`,
              reportText: `勘估標的位於臺北市政府公告劃定之都市更新地區範圍內（${inside[0].des}），辦理都市更新時得依都市更新條例相關規定申請。`,
            }
          }
          if (rows.length) {
            return {
              level: 'info', headline: `不在範圍內；${R} 公尺內有 ${rows.length} 處`, items,
              detail: `最近一處距離約 ${ctx.fmtDist(rows[0].dist)}。${tail}`,
              reportText: `勘估標的未位於臺北市政府公告劃定之都市更新地區範圍內，惟周邊 ${R} 公尺內有 ${rows.length} 處公劃更新地區，最近者距離約 ${ctx.fmtDist(rows[0].dist)}。`,
            }
          }
          return {
            level: 'info', headline: `不在範圍內，${R} 公尺內也沒有`, detail: tail,
            reportText: `勘估標的未位於臺北市政府公告劃定之都市更新地區範圍內，周邊 ${R} 公尺內亦無公劃更新地區。`,
          }
        },
      },
      {
        id: 'plan_limits_tp', name: '開發管制地區（臺北市）', order: 30, source: SRC_TP, timeout: 25000,
        run: async (pt, ctx) => {
          const town = await taipeiTown(pt, ctx)
          if (!town) return NOT_TAIPEI
          const defs = [
            { key: '山坡地管制區', url: PLAN_THEME + '/2', strict: true, why: '開發強度與建築行為受山坡地相關規定限制' },
            { key: '軍事管制區禁限建範圍', url: PLAN_THEME + '/1', strict: true, why: '建築高度或建築行為受軍事禁限建管制' },
            { key: '不得容積移轉地區', url: NO_TDR, strict: true, why: '依都發局圖台標示，屬不得辦理容積移轉之地區' },
            { key: '都市設計審議地區', url: PLAN_THEME + '/3', strict: false, why: '申請建照前須先通過都市設計審議' },
            { key: '免建築線指示地區', url: PLAN_THEME + '/4', strict: false, why: '申請建築時可免申請建築線指示' },
          ]
          const res = await Promise.all(defs.map((d) => ctx.arcgisQuery(d.url, pt).then((fs) => ({ d, hit: fs.length > 0, ok: true, a: fs[0] && fs[0].attributes }), () => ({ d, hit: false, ok: false }))))
          if (res.every((r) => !r.ok)) throw new Error('臺北市都發局圖台連線失敗')
          const failed = res.filter((r) => !r.ok).map((r) => r.d.key)
          const hits = res.filter((r) => r.hit)
          const items = res.map((r) => ({ label: r.d.key, value: !r.ok ? '暫時查不到' : r.hit ? '位於範圍內' + (r.a && clean(r.a.PROJNUM || r.a.id) ? '（計畫案號 ' + clean(r.a.PROJNUM || r.a.id) + '）' : '') : '不在範圍內' }))
          const failNote = failed.length ? `（${failed.join('、')}暫時查不到）` : ''
          if (!hits.length) {
            return {
              level: failed.length ? 'info' : 'good', headline: '未落入管制地區' + failNote, items,
              detail: '查詢項目：山坡地管制區、軍事禁限建、不得容積移轉地區、都市設計審議地區、免建築線指示地區。不含航高限制、捷運禁限建等其他管制。',
              reportText: failed.length ? '' : '經查臺北市政府都市發展局圖資，勘估標的未位於山坡地管制區、軍事管制區禁限建範圍、不得容積移轉地區及都市設計審議地區。',
            }
          }
          const strict = hits.filter((r) => r.d.strict)
          const names = hits.map((r) => r.d.key)
          return {
            level: strict.length ? 'warn' : 'info', headline: '位於' + names.join('、') + failNote, items,
            detail: hits.map((r) => `${r.d.key}：${r.d.why}。`).join(''),
            reportText: `經查臺北市政府都市發展局圖資，勘估標的位於${names.join('、')}內，${hits.map((r) => r.d.why).join('；')}，開發利用時應予留意。`,
          }
        },
      },
      {
        id: 'plan_water_zone', name: '水源保護區與河川區域', order: 35, source: SRC_WRA, timeout: 25000,
        run: async (pt, ctx) => {
          const defs = [
            { key: '自來水水質水量保護區', layer: 88, name: (a) => clean(a.WQQPZ_NAME) || clean(a.NAME), why: '土地利用受自來水法第 11 條限制，禁止或限制貽害水質水量之行為' },
            { key: '水庫集水區', layer: 94, name: (a) => clean(a.Name || a.NAME) + '集水區', why: '屬環境敏感地區，開發須符合水土保持及水庫集水區相關規定' },
            { key: '河川區域', layer: 101, name: (a) => clean(a.RV_NAME || a.rv_name) + '河川區域', why: '土地使用受水利法管制，原則上不得建築' },
          ]
          const res = await Promise.all(defs.map((d) => ctx.arcgisQuery(WRA + '/' + d.layer, pt).then((fs) => ({ d, ok: true, names: [...new Set(fs.map((f) => d.name(f.attributes)))] }), () => ({ d, ok: false, names: [] }))))
          if (res.every((r) => !r.ok)) throw new Error('水利署圖資連線失敗')
          const failed = res.filter((r) => !r.ok).map((r) => r.d.key)
          const failNote = failed.length ? `（${failed.join('、')}暫時查不到）` : ''
          const hits = res.filter((r) => r.names.length)
          const items = res.map((r) => ({ label: r.d.key, value: !r.ok ? '暫時查不到' : r.names.length ? '位於範圍內：' + r.names.join('、') : '不在範圍內' }))
          if (!hits.length) {
            return {
              level: failed.length ? 'info' : 'good', headline: '未落入' + failNote, items,
              detail: '查詢項目：自來水水質水量保護區、水庫集水區、中央管河川的河川區域。不含飲用水水源水質保護區、縣市管河川及區域排水。',
              reportText: failed.length ? '' : '經查經濟部水利署圖資，勘估標的未位於自來水水質水量保護區、水庫集水區及中央管河川之河川區域內。',
            }
          }
          const all = hits.flatMap((r) => r.names)
          return {
            level: hits.some((r) => r.d.layer === 101) ? 'bad' : 'warn', headline: '位於' + all.join('、') + failNote, items,
            detail: hits.map((r) => `${r.d.key}：${r.d.why}。`).join('') + '圖資為水利署公開範圍，實際界線以主管機關公告圖說為準。',
            reportText: `經查經濟部水利署圖資，勘估標的位於${all.join('、')}內，${hits.map((r) => r.d.why).join('；')}，開發利用時應予留意。`,
          }
        },
      },
      {
        id: 'plan_readjust', name: '市地重劃／區段徵收區', order: 40, source: '各直轄市政府地政局（政府資料開放平臺）',
        run: async (pt, ctx) => {
          const R = 500
          const [ra, em] = await Promise.all([ctx.data('readjust').catch(() => null), ctx.data('eminent').catch(() => null)])
          if (!ra && !em) throw new Error('重劃與區段徵收資料載入失敗')
          const all = []
          const add = (fc, kind) => { if (fc) for (const h of ctx.within(fc, pt, R)) all.push({ ...h, kind }) }
          add(ra, '市地重劃'); add(em, '區段徵收')
          all.sort((a, b) => a.dist - b.dist)
          const nm = (h) => P(h.feature)['名稱'] || P(h.feature).name || '（未命名）'
          const desc = (h) => {
            const p = P(h.feature)
            const area = Number(p['面積_公頃'] || p.area)
            const bits = [p['辦理方式'], p['進度'] || p.status, (p['年度'] || p.year) && '年度 ' + (p['年度'] || p.year), area > 0 && '面積約 ' + Math.round(area * 100) / 100 + ' 公頃']
            return bits.filter((x) => x && x !== '未載明' && !/^（/.test(x) && String(x).length < 30).join('、')
          }
          if (!all.length) {
            // 資料只有臺北、新北、臺中、高雄；離任何一區都很遠就視為不在涵蓋範圍
            const near = [ra, em].filter(Boolean).flatMap((fc) => ctx.nearest(fc, pt, 1, null, 15000))
            if (!near.length) return { level: 'na', headline: '不在資料涵蓋範圍', detail: '重劃區資料涵蓋臺北、新北、臺中、高雄四市；區段徵收資料涵蓋同四市。' }
            return {
              level: 'info', headline: `不在範圍內，${R} 公尺內也沒有`,
              detail: '資料涵蓋臺北、新北、臺中、高雄四市已公開範圍圖的市地重劃區（406 區）與區段徵收區（84 區）；未公開範圍圖的自辦重劃區可能未收錄。',
              reportText: `勘估標的未位於已公開範圍之市地重劃區或區段徵收區內，周邊 ${R} 公尺內亦無。`,
            }
          }
          const items = all.slice(0, 8).map((h) => ({ label: nm(h), value: [h.kind, desc(h), h.dist === 0 && '位於範圍內'].filter(Boolean).join('；'), dist: Math.round(h.dist) }))
          const inside = all.filter((h) => h.dist === 0)
          if (inside.length) {
            const h = inside[0], p = P(h.feature)
            const done = /已完成/.test(p['進度'] || p.status || '')
            const burden = p['總負擔比率'] ? `，${p['負擔性質'] && p['負擔性質'].length < 20 ? p['負擔性質'] : '總負擔比率'} ${p['總負擔比率']}%` : ''
            return {
              level: 'info', headline: `位於${h.kind}區內：${nm(h)}`, items,
              detail: [h.kind, desc(h)].filter(Boolean).join('、') + burden + `。${R} 公尺內共 ${all.length} 區。`,
              reportText: `勘估標的位於「${nm(h)}」${h.kind}範圍內${desc(h) ? '（' + desc(h) + '）' : ''}${done ? '，屬已辦理完成之整體開發地區' : ''}。`,
            }
          }
          return {
            level: 'info', headline: `不在範圍內；${R} 公尺內有 ${all.length} 區`, items,
            detail: `最近為「${nm(all[0])}」（${all[0].kind}），距離約 ${ctx.fmtDist(all[0].dist)}。`,
            reportText: `勘估標的未位於市地重劃區或區段徵收區內，惟周邊 ${R} 公尺內有 ${all.length} 處整體開發區，最近者為「${nm(all[0])}」（${all[0].kind}），距離約 ${ctx.fmtDist(all[0].dist)}。`,
          }
        },
      },
      {
        id: 'plan_industrial', name: '產業園區／工業區（1 公里內）', order: 50, source: '經濟部產業園區管理局',
        run: async (pt, ctx) => {
          const R = 1000
          const fc = await ctx.data('industrial_parks')
          const hits = ctx.within(fc, pt, R)
          const note = '範圍為經濟部產業園區管理局公開的 212 處編定工業區與產業園區（外框已簡化，誤差約數十公尺）；不含科學園區及都市計畫工業區。'
          if (!hits.length) {
            const n = ctx.nearest(fc, pt, 1)[0]
            return {
              level: 'info', headline: '1 公里內沒有',
              detail: (n ? `最近為「${P(n.feature).name}」，距離約 ${ctx.fmtDist(n.dist)}。` : '') + note,
              reportText: `勘估標的周邊 1 公里內無經濟部列管之編定工業區或產業園區${n ? `，最近者為「${P(n.feature).name}」，距離約 ${ctx.fmtDist(n.dist)}` : ''}。`,
            }
          }
          const items = hits.slice(0, 8).map((h) => ({ label: P(h.feature).name, value: `${P(h.feature).status}、${P(h.feature).area} 公頃` + (h.dist === 0 ? '；位於範圍內' : ''), dist: Math.round(h.dist) }))
          const h = hits[0], p = P(h.feature)
          if (h.dist === 0) {
            return {
              level: 'info', headline: `位於「${p.name}」內`, items, detail: `${p.type}、${p.status}、面積 ${p.area} 公頃。` + note,
              reportText: `勘估標的位於「${p.name}」範圍內（${p.status}，面積約 ${p.area} 公頃）。`,
            }
          }
          return {
            level: 'info', headline: `1 公里內有 ${hits.length} 處，最近 ${ctx.fmtDist(h.dist)}`, items, detail: `最近為「${p.name}」（${p.status}）。` + note,
            reportText: `勘估標的周邊 1 公里內有 ${hits.length} 處編定工業區或產業園區，最近者為「${p.name}」，距離約 ${ctx.fmtDist(h.dist)}。`,
          }
        },
      },
      {
        id: 'plan_heritage', name: '文化資產（100 公尺內）', order: 60, source: '文化部文化資產局',
        run: async (pt, ctx) => {
          const NEAR = 100, FAR = 300
          const fc = await ctx.data('heritage')
          const COVER = ['臺北市', '新北市', '基隆市', '桃園市']
          let county = ''
          try { county = (await ctx.admin(pt)).county } catch (e) { /* 行政區查不到時，改用距離判斷涵蓋範圍 */ }
          const covered = county ? COVER.includes(county) : ctx.nearest(fc, pt, 1, null, 10000).length > 0
          if (!covered) return { level: 'na', headline: '不在資料涵蓋範圍', detail: '文化資產點位目前只收錄臺北市、新北市、基隆市、桃園市。' }
          const hits = ctx.within(fc, pt, FAR)
          const near = hits.filter((h) => h.dist <= NEAR)
          const label = (h) => (P(h.feature).level || '') + P(h.feature).kind
          const items = hits.slice(0, 8).map((h) => ({ label: P(h.feature).name, value: label(h), dist: Math.round(h.dist), lat: h.feature.geometry.coordinates[1], lng: h.feature.geometry.coordinates[0] }))
          const note = `門檻：${NEAR} 公尺內列為須留意，${FAR} 公尺內列為參考。點位為文資局登錄的代表座標，不是保存範圍界線；距離僅供初判。`
          if (near.length) {
            const h = near[0]
            return {
              level: 'warn', headline: `${NEAR} 公尺內有 ${near.length} 處，最近 ${ctx.fmtDist(h.dist)}`, items,
              detail: `最近為「${P(h.feature).name}」（${label(h)}）。鄰接文化資產的開發案，可能涉及文化資產保存法的審查或古蹟保存區、容積移轉等規定。` + note,
              reportText: `勘估標的周邊 ${NEAR} 公尺內有 ${near.length} 處經指定或登錄之文化資產，最近者為「${P(h.feature).name}」（${label(h)}），距離約 ${ctx.fmtDist(h.dist)}；開發利用時應留意文化資產保存法相關規定。`,
            }
          }
          if (hits.length) {
            const h = hits[0]
            return {
              level: 'info', headline: `${NEAR} 公尺內沒有；${FAR} 公尺內有 ${hits.length} 處`, items,
              detail: `最近為「${P(h.feature).name}」（${label(h)}），距離約 ${ctx.fmtDist(h.dist)}。` + note,
              reportText: `勘估標的周邊 ${NEAR} 公尺內無經指定或登錄之文化資產；${FAR} 公尺內有 ${hits.length} 處，最近者為「${P(h.feature).name}」（${label(h)}），距離約 ${ctx.fmtDist(h.dist)}。`,
            }
          }
          return {
            level: 'good', headline: `${FAR} 公尺內沒有`, detail: note,
            reportText: `勘估標的周邊 ${FAR} 公尺內無經指定或登錄之古蹟、歷史建築等文化資產。`,
          }
        },
      },
    ],
  })
})(typeof window !== 'undefined' ? window : globalThis)
