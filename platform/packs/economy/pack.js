// 圖資包：地價與人口經濟
// 鄉鎮市區統計主題圖（人口、所得、成交行情、住宅普查）＋縣市統計表（公告現值調幅等）＋行政界線圖層。
// 資料來源、統計期與處理方式見同資料夾 NOTES.md。THEMES 由建置腳本產生，與 data/towns.js 內的分級欄位一致，請勿手改。
;(function () {
  'use strict'
  const THEMES = [
    {
      "field": "pop_density_class",
      "label": "人口密度",
      "unit": "人/平方公里",
      "valueField": "pop_density",
      "breaks": [100, 500, 2000, 8000],
      "colors": ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
      "period": "115年10月底",
      "source": "內政部戶政司",
      "classes": ["未滿 100", "100～500", "500～2,000", "2,000～8,000", "8,000 以上"],
      "map": {
        "未滿 100": "#ffffb2",
        "100～500": "#fecc5c",
        "500～2,000": "#fd8d3c",
        "2,000～8,000": "#f03b20",
        "8,000 以上": "#bd0026",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "pop_chg5_class",
      "label": "近5年人口增減率",
      "unit": "%",
      "valueField": "pop_chg5",
      "breaks": [-7, -3, 0, 3],
      "colors": ["#ca0020", "#f4a582", "#f7f7f7", "#92c5de", "#0571b0"],
      "period": "109年底至114年底",
      "source": "內政部戶政司",
      "classes": ["未滿 -7", "-7～-3", "-3～0", "0～3", "3 以上"],
      "map": {
        "未滿 -7": "#ca0020",
        "-7～-3": "#f4a582",
        "-3～0": "#f7f7f7",
        "0～3": "#92c5de",
        "3 以上": "#0571b0",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "p65_class",
      "label": "65歲以上人口比率",
      "unit": "%",
      "valueField": "p65",
      "breaks": [14, 20, 24, 28],
      "colors": ["#f2f0f7", "#cbc9e2", "#9e9ac8", "#756bb1", "#54278f"],
      "period": "115年10月底",
      "source": "內政部戶政司",
      "classes": ["未滿 14", "14～20", "20～24", "24～28", "28 以上"],
      "map": {
        "未滿 14": "#f2f0f7",
        "14～20": "#cbc9e2",
        "20～24": "#9e9ac8",
        "24～28": "#756bb1",
        "28 以上": "#54278f",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "inc_median_class",
      "label": "綜合所得總額中位數",
      "unit": "萬元/戶",
      "valueField": "inc_median",
      "breaks": [40, 45, 50, 60],
      "colors": ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"],
      "period": "112年度",
      "source": "財政部財政資訊中心",
      "classes": ["未滿 40", "40～45", "45～50", "50～60", "60 以上"],
      "map": {
        "未滿 40": "#edf8e9",
        "40～45": "#bae4b3",
        "45～50": "#74c476",
        "50～60": "#31a354",
        "60 以上": "#006d2c",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "apt_unit_class",
      "label": "公寓大樓成交單價中位數",
      "unit": "萬元/坪",
      "valueField": "apt_unit",
      "breaks": [20, 25, 30, 45],
      "colors": ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"],
      "period": "114年第4季至115年第3季發布",
      "source": "內政部不動產成交案件實際資訊（開放資料）",
      "classes": ["未滿 20", "20～25", "25～30", "30～45", "45 以上"],
      "map": {
        "未滿 20": "#ffffcc",
        "20～25": "#a1dab4",
        "25～30": "#41b6c4",
        "30～45": "#2c7fb8",
        "45 以上": "#253494",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "pre_unit_class",
      "label": "預售屋成交單價中位數",
      "unit": "萬元/坪",
      "valueField": "pre_unit",
      "breaks": [30, 40, 55, 80],
      "colors": ["#ffffcc", "#a1dab4", "#41b6c4", "#2c7fb8", "#253494"],
      "period": "114年第4季至115年第3季發布",
      "source": "內政部不動產成交案件實際資訊（開放資料）",
      "classes": ["未滿 30", "30～40", "40～55", "55～80", "80 以上"],
      "map": {
        "未滿 30": "#ffffcc",
        "30～40": "#a1dab4",
        "40～55": "#41b6c4",
        "55～80": "#2c7fb8",
        "80 以上": "#253494",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "rent_unit_class",
      "label": "整戶住宅租金單價中位數",
      "unit": "元/坪/月",
      "valueField": "rent_unit",
      "breaks": [450, 550, 700, 1000],
      "colors": ["#f1eef6", "#bdc9e1", "#74a9cf", "#2b8cbe", "#045a8d"],
      "period": "114年第4季至115年第3季發布",
      "source": "內政部不動產成交案件實際資訊（開放資料）",
      "classes": ["未滿 450", "450～550", "550～700", "700～1,000", "1,000 以上"],
      "map": {
        "未滿 450": "#f1eef6",
        "450～550": "#bdc9e1",
        "550～700": "#74a9cf",
        "700～1,000": "#2b8cbe",
        "1,000 以上": "#045a8d",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "ht_age_class",
      "label": "住宅平均屋齡（房屋稅籍）",
      "unit": "年",
      "valueField": "ht_age",
      "breaks": [28, 33, 38, 43],
      "colors": ["#f7fcf5", "#c7e9c0", "#74c476", "#31a354", "#00441b"],
      "period": "115年第3季",
      "source": "內政部不動產資訊平台（房屋稅籍住宅類統計）",
      "classes": ["未滿 28", "28～33", "33～38", "38～43", "43 以上"],
      "map": {
        "未滿 28": "#f7fcf5",
        "28～33": "#c7e9c0",
        "33～38": "#74c476",
        "38～43": "#31a354",
        "43 以上": "#00441b",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    },
    {
      "field": "vac_rate_class",
      "label": "空閒住宅率",
      "unit": "%",
      "valueField": "vac_rate",
      "breaks": [9, 12, 15, 20],
      "colors": ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"],
      "period": "109年11月（人口及住宅普查）",
      "source": "行政院主計總處",
      "classes": ["未滿 9", "9～12", "12～15", "15～20", "20 以上"],
      "map": {
        "未滿 9": "#feedde",
        "9～12": "#fdbe85",
        "12～15": "#fd8d3c",
        "15～20": "#e6550d",
        "20 以上": "#a63603",
        "無資料": "#d4d4d8"
      },
      "noData": "無資料"
    }
  ]

  // ── 共用 ────────────────────────────────────────────────────────────────
  const LVR_PERIOD = '114年第4季至115年第3季發布之買賣案件'
  const LVR_SRC = '內政部不動產成交案件實際資訊（實價登錄）開放資料'
  const MIN_N = 10 // 成交件數未達 10 件不顯示中位數
  const n0 = (x) => (x == null ? '—' : Number(x).toLocaleString('en-US'))
  const sign = (x) => (x > 0 ? '增加 ' + x + '%' : x < 0 ? '減少 ' + Math.abs(x) + '%' : '持平')
  const pct = (x) => (x > 0 ? '+' : '') + x + '%'
  const agingStage = (p65) => (p65 >= 20 ? '超高齡社會' : p65 >= 14 ? '高齡社會' : p65 >= 7 ? '高齡化社會' : '')

  /** 找出這個點所在的鄉鎮市區。先問國土測繪中心（界線精確），連不上再用隨站發布的簡化界線判斷。 */
  function locate(pt, ctx) {
    return ctx.cached('eco_loc:' + pt.lat.toFixed(6) + ',' + pt.lng.toFixed(6), async () => {
      const fc = await ctx.data('eco_towns')
      let adm = null
      try {
        adm = await Promise.race([ctx.admin(pt), new Promise((_, rej) => setTimeout(() => rej(new Error('逾時')), 6000))])
      } catch (e) { adm = null }
      if (adm && adm.county) {
        const name = (adm.county + adm.town).replace(/台/g, '臺')
        const f = fc.features.find((x) => x.properties.name === name)
        if (f) return { p: f.properties, by: '國土測繪中心行政區查詢', village: adm.village || '', fc }
        // 新竹市、嘉義市：測繪中心只回「新竹市／嘉義市」不分區，改用界線判斷是哪一區
        const inCity = ctx.containing(fc, pt, (q) => q.county === adm.county.replace(/台/g, '臺'))
        if (inCity.length) return { p: inCity[0].properties, by: '國土測繪中心行政區查詢（區別以簡化界線判斷）', village: adm.village || '', fc }
      }
      const hit = ctx.containing(fc, pt)
      if (hit.length) return { p: hit[0].properties, by: '簡化行政區界線（邊界附近可能有數十公尺誤差）', village: '', fc }
      const near = ctx.nearest(fc, pt, 1, null, 300)
      if (near.length) return { p: near[0].feature.properties, by: '簡化行政區界線（取 300 公尺內最近的行政區）', village: '', fc }
      return { p: null, fc }
    })
  }
  async function countyRow(ctx, county) {
    const t = await ctx.data('eco_county_stats')
    const f = t.features.find((x) => x.properties.county === county)
    return f ? f.properties : null
  }
  /** 這個鄉鎮某指標在同縣市、全國由高到低的名次 */
  function rankOf(fc, p, key) {
    const all = fc.features.map((f) => f.properties).filter((q) => q[key] != null)
    const inC = all.filter((q) => q.county === p.county)
    const r = (arr) => arr.filter((q) => q[key] > p[key]).length + 1
    return { county: r(inC), countyN: inC.length, nation: r(all), nationN: all.length }
  }
  /** 主計總處總體統計資料庫（有 CORS）。回 [{name, period:'115年10月', value, yoy(%)}]，yoy 為與上年同月相比 */
  const NSTAT = 'https://nstatdb.dgbas.gov.tw/dgbasall/webMain.aspx?sdmx/'
  function macroSeries(ctx, table, ids) {
    const y = new Date().getFullYear()
    // 一定要同時給 startTime 與 endTime；尚未發布的月份會回 0，取最後一個大於 0 的月份
    const url = NSTAT + table + '/' + ids.join('+') + '...M.&startTime=' + (y - 2) + '-M1&endTime=' + y + '-M12'
    return ctx.cached(url, async () => {
      const j = await ctx.fetchJSON(url, { timeout: 12000 })
      const st = j.data.structure, ds = j.data.dataSets[0]
      const times = st.dimensions.observation[0].values
      const cats = st.dimensions.series[0].values
      return Object.keys(ds.series).map((k) => {
        const obs = ds.series[k].observations
        const idx = Object.keys(obs).map(Number).filter((i) => obs[i] && Number(obs[i][0]) > 0).sort((a, b) => a - b)
        if (!idx.length) throw new Error('主計總處回傳沒有資料')
        const last = idx[idx.length - 1]
        const id = times[last].id // 例：2026-M10
        const m = id.match(/^(\d{4})-M(\d+)$/)
        const prevId = m ? Number(m[1]) - 1 + '-M' + m[2] : ''
        const prev = times.findIndex((t) => t.id === prevId)
        const v = Number(obs[last][0])
        const pv = prev >= 0 && obs[prev] ? Number(obs[prev][0]) : null
        return { name: cats[Number(k.split(':')[0])].name.replace(/^[一二三四五六七八九十\d()（）.]+/, ''), period: times[last].name, value: v, yoy: pv ? Math.round((v / pv - 1) * 10000) / 100 : null }
      })
    })
  }
  const NA_OUTSIDE = { level: 'na', headline: '不在臺灣本島及離島的鄉鎮市區範圍內', detail: '這個位置對不到任何鄉鎮市區（可能在海上）。' }

  GIS.registerPack({
    id: 'economy',
    name: '地價與人口經濟',
    icon: 'chart-column',
    order: 3,

    // ── 圖磚圖層（國土測繪中心 WMTS，115-11-25 實測可取得圖磚） ──────────────
    layers: [
      {
        id: 'admin_village', name: '村里界', type: 'xyz', group: '行政界線',
        url: 'https://wmts.nlsc.gov.tw/wmts/Village/default/GoogleMapsCompatible/{z}/{y}/{x}',
        opacity: 0.9, minZoom: 10, maxNativeZoom: 19,
        source: '內政部國土測繪中心', sourceUrl: 'https://maps.nlsc.gov.tw/',
        note: '放大到街區才看得清楚村里名稱。',
      },
      {
        id: 'admin_town', name: '鄉鎮市區界', type: 'xyz', group: '行政界線',
        url: 'https://wmts.nlsc.gov.tw/wmts/TOWN/default/GoogleMapsCompatible/{z}/{y}/{x}',
        opacity: 0.9, maxNativeZoom: 19,
        source: '內政部國土測繪中心', sourceUrl: 'https://maps.nlsc.gov.tw/',
      },
      {
        id: 'admin_county', name: '縣市界', type: 'xyz', group: '行政界線',
        url: 'https://wmts.nlsc.gov.tw/wmts/CITY/default/GoogleMapsCompatible/{z}/{y}/{x}',
        opacity: 0.9, maxNativeZoom: 19,
        source: '內政部國土測繪中心', sourceUrl: 'https://maps.nlsc.gov.tw/',
      },
      {
        id: 'land_office', name: '地政事務所轄區', type: 'xyz', group: '行政界線',
        url: 'https://wmts.nlsc.gov.tw/wmts/LandOffice/default/GoogleMapsCompatible/{z}/{y}/{x}',
        opacity: 0.8, maxNativeZoom: 19,
        source: '內政部國土測繪中心', sourceUrl: 'https://maps.nlsc.gov.tw/',
        note: '申請謄本、查公告現值時確認管轄地所用。',
      },
      {
        id: 'land_use_survey', name: '國土利用現況調查', type: 'xyz', group: '土地利用',
        url: 'https://wmts.nlsc.gov.tw/wmts/LUIMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',
        opacity: 0.6, maxNativeZoom: 19,
        source: '內政部國土測繪中心', sourceUrl: 'https://www.nlsc.gov.tw/cp.aspx?n=13658',
        note: '是「現況怎麼用」的調查成果，不是使用分區或編定，不能當作法定用途依據。',
      },
    ],

    // ── 靜態資料集 ──────────────────────────────────────────────────────────
    datasets: [
      {
        id: 'eco_towns', name: '鄉鎮市區統計主題圖', file: 'packs/economy/data/towns.js',
        geometry: 'polygon', count: 368, showAsLayer: true, group: '統計主題圖',
        style: { color: '#52525b', weight: 1, fillOpacity: 0.65 },
        styleBy: { field: THEMES[0].field, map: THEMES[0].map }, // 預設：人口密度
        // 自訂欄位：可切換的主題。每個主題的 field 是資料裡預先算好的分級欄位（值就是圖例文字），
        // 介面切換主題時把 styleBy 換成 {field: theme.field, map: theme.map} 重畫即可。
        themes: THEMES,
        labelField: 'name',
        popupFields: [
          ['name', '行政區'], ['pop', '人口數（115年10月底）'], ['hh', '戶數'], ['pop_density', '人口密度（人/平方公里）'],
          ['pop_chg5', '近5年人口增減率（%，109年底至114年底）'], ['p65', '65歲以上比率（%）'], ['aging_index', '老化指數'],
          ['inc_median', '綜合所得總額中位數（萬元/戶，112年度）'], ['inc_mean', '綜合所得總額平均數（萬元/戶）'],
          ['apt_unit', '公寓大樓成交單價中位數（萬元/坪）'], ['apt_n', '公寓大樓成交件數'],
          ['pre_unit', '預售屋成交單價中位數（萬元/坪）'], ['rent_unit', '整戶住宅租金單價中位數（元/坪/月）'],
          ['ht_age', '住宅平均屋齡（年，房屋稅籍 115年第3季）'], ['ht_n', '房屋稅籍住宅數'],
          ['hs_total', '住宅數（109年普查）'], ['vac_rate', '空閒住宅率（%，109年普查）'],
        ],
        source: '內政部戶政司、財政部財政資訊中心、內政部實價登錄開放資料、內政部不動產資訊平台、行政院主計總處；界線取自 taiwan-atlas（內政部國土測繪中心鄉鎮市區界）',
        sourceUrl: 'https://www.ris.gov.tw/rs-opendata/api/Main/docs/v1', updated: '2026-11-25',
      },
      {
        id: 'eco_county_stats', name: '縣市統計表（公告現值調幅、成交行情、人口）', file: 'packs/economy/data/county_stats.js',
        geometry: 'none', table: true, // 沒有圖形，只是一張表（features[].geometry 為 null），給體檢項目依所在縣市查值
        count: 23, showAsLayer: false,
        source: '內政部地政司、內政部實價登錄開放資料、內政部戶政司', sourceUrl: 'https://data.gov.tw/dataset/24814', updated: '2026-11-25',
      },
    ],

    // ── 地點體檢 ────────────────────────────────────────────────────────────
    checks: [
      {
        id: 'eco_district', name: '所在行政區概況', order: 10, source: '內政部戶政司',
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          const stage = agingStage(p.p65)
          return {
            level: 'info',
            headline: `${p.name}｜${n0(p.pop)} 人、每平方公里 ${n0(p.pop_density)} 人`,
            detail: `人口、戶數、年齡結構為 115年10月底戶籍登記數；增減率為 109年底與 114年底相比。老化指數＝65歲以上人口÷0至14歲人口×100。65歲以上占比達 14% 稱高齡社會、達 20% 稱超高齡社會。行政區判定方式：${loc.by}。`,
            items: [
              { label: '人口數', value: n0(p.pop) + ' 人' },
              { label: '戶數', value: n0(p.hh) + ' 戶（平均每戶 ' + p.hh_size + ' 人）' },
              { label: '土地面積', value: p.area + ' 平方公里' },
              { label: '人口密度', value: n0(p.pop_density) + ' 人/平方公里' },
              { label: '近5年人口增減', value: pct(p.pop_chg5) + '（' + n0(p.pop_109) + ' → ' + n0(p.pop_114) + ' 人）' },
              { label: '65歲以上', value: p.p65 + '%' + (stage ? '（' + stage + '）' : '') },
              { label: '0至14歲', value: p.p014 + '%' },
              { label: '老化指數', value: String(p.aging_index) },
            ],
            reportText: `查詢地點位於${p.name}${loc.village ? loc.village : ''}。依內政部戶政司統計，115年10月底${p.name}戶籍人口 ${n0(p.pop)} 人、${n0(p.hh)} 戶，平均每戶 ${p.hh_size} 人，土地面積 ${p.area} 平方公里，人口密度每平方公里 ${n0(p.pop_density)} 人；114年底人口較109年底${sign(p.pop_chg5)}。65歲以上人口占 ${p.p65}%${stage ? '（屬' + stage + '）' : ''}，0至14歲占 ${p.p014}%，老化指數 ${p.aging_index}。`,
          }
        },
      },
      {
        id: 'eco_income', name: '所得水準', order: 20, source: '財政部財政資訊中心',
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          if (p.inc_median == null) return { level: 'na', headline: '查無所得統計' }
          const r = rankOf(loc.fc, p, 'inc_median')
          return {
            level: 'info',
            headline: `${p.name} 綜合所得中位數 ${p.inc_median} 萬元`,
            detail: '112年度綜合所得稅申報資料，以納稅單位（申報戶）計，單位為每戶每年。只含應申報的綜合所得總額，不含分離課稅、免稅所得，也不等於家戶可支配所得；戶籍地與實際居住地不一定相同。名次為由高到低。',
            items: [
              { label: '中位數', value: p.inc_median + ' 萬元' },
              { label: '平均數', value: p.inc_mean + ' 萬元' },
              { label: '第一分位數～第三分位數', value: p.inc_q1 + '～' + p.inc_q3 + ' 萬元' },
              { label: '納稅單位', value: n0(p.inc_units) + ' 戶' },
              { label: '中位數在' + p.county + '的名次', value: `第 ${r.county} 名／${r.countyN} 個鄉鎮市區` },
              { label: '中位數在全國的名次', value: `第 ${r.nation} 名／${r.nationN} 個鄉鎮市區` },
            ],
            reportText: `依財政部財政資訊中心112年度綜合所得稅申報統計，${p.name}納稅單位 ${n0(p.inc_units)} 戶，每戶綜合所得總額中位數約 ${p.inc_median} 萬元、平均數約 ${p.inc_mean} 萬元（第一分位數 ${p.inc_q1} 萬元、第三分位數 ${p.inc_q3} 萬元），中位數於${p.county} ${r.countyN} 個鄉鎮市區中居第 ${r.county} 位、全國 ${r.nationN} 個鄉鎮市區中居第 ${r.nation} 位。`,
          }
        },
      },
      {
        id: 'eco_deal_price', name: '行政區成交行情', order: 30, source: LVR_SRC,
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          const c = await countyRow(ctx, p.county)
          const nat = await countyRow(ctx, '全國')
          const scope = p.lvr_scope === '全市' ? p.county : p.name
          const scopeNote = p.lvr_scope === '全市' ? `${p.county}的實價登錄開放資料不分區，以下為全市統計。` : ''
          if (p.apt_unit == null && p.th_total == null && p.pre_unit == null) {
            return {
              level: 'na', headline: `${scope}近一年成交件數不足，不列統計`,
              detail: `${LVR_PERIOD}中，${scope}住家用公寓大樓 ${p.apt_n} 件、透天厝 ${p.th_n} 件、預售屋 ${p.pre_n} 件，未達 ${MIN_N} 件不計算中位數。` + (c && c.apt_unit != null ? `同期${p.county}公寓大樓單價中位數約每坪 ${c.apt_unit} 萬元。` : ''),
            }
          }
          const items = []
          if (p.apt_unit != null) {
            items.push({ label: scope + ' 公寓大樓單價中位數', value: `${p.apt_unit} 萬元/坪（${n0(p.apt_n)} 件）` })
            items.push({ label: scope + ' 公寓大樓總價中位數', value: n0(p.apt_total) + ' 萬元' })
          } else items.push({ label: scope + ' 公寓大樓', value: `僅 ${p.apt_n} 件，不列統計` })
          if (p.th_total != null) items.push({ label: scope + ' 透天厝總價中位數', value: `${n0(p.th_total)} 萬元（${n0(p.th_n)} 件）` })
          else items.push({ label: scope + ' 透天厝', value: `僅 ${p.th_n} 件，不列統計` })
          if (p.pre_unit != null) items.push({ label: scope + ' 預售屋單價中位數', value: `${p.pre_unit} 萬元/坪（${n0(p.pre_n)} 件）` })
          if (p.deal_age != null) items.push({ label: '成交住宅屋齡中位數', value: p.deal_age + ' 年' })
          if (c && c.apt_unit != null && p.lvr_scope !== '全市') items.push({ label: p.county + ' 公寓大樓單價中位數', value: `${c.apt_unit} 萬元/坪（${n0(c.apt_n)} 件）` })
          if (nat) items.push({ label: '全國 公寓大樓單價中位數', value: `${nat.apt_unit} 萬元/坪（${n0(nat.apt_n)} 件）` })
          const parts = []
          if (p.apt_unit != null) parts.push(`住家用公寓、華廈及住宅大樓成交單價中位數約每坪 ${p.apt_unit} 萬元（${n0(p.apt_n)} 件）、總價中位數約 ${n0(p.apt_total)} 萬元`)
          if (p.th_total != null) parts.push(`透天厝成交總價中位數約 ${n0(p.th_total)} 萬元（${n0(p.th_n)} 件）`)
          if (p.pre_unit != null) parts.push(`預售屋（公寓大樓）成交單價中位數約每坪 ${p.pre_unit} 萬元（${n0(p.pre_n)} 件）`)
          const cmp = c && c.apt_unit != null && p.lvr_scope !== '全市' && p.apt_unit != null ? `同期${p.county}公寓大樓單價中位數約每坪 ${c.apt_unit} 萬元。` : ''
          return {
            level: 'info',
            headline: p.apt_unit != null ? `${scope} 公寓大樓單價中位數 ${p.apt_unit} 萬元/坪` : p.th_total != null ? `${scope} 透天厝總價中位數 ${n0(p.th_total)} 萬元` : `${scope} 預售屋單價中位數 ${p.pre_unit} 萬元/坪`,
            detail: `${scopeNote}統計範圍：${LVR_PERIOD}，交易標的含建物、主要用途「住家用」。公寓大樓指公寓、華廈、住宅大樓，單價採資料所載單價（部分案件含車位）；已排除備註載明親友、員工、共有人等特殊關係、持分、地上權、瑕疵、毛胚等案件。預售屋為同期申報的預售屋買賣（已排除解約案件）。件數未達 ${MIN_N} 件不列。這是整個行政區的統計，不分屋齡、樓層、路段，不能當作個別不動產的價格。`,
            items,
            reportText: `依${LVR_SRC}（${LVR_PERIOD}），${scope}${p.lvr_scope === '全市' ? '（該市開放資料不分區，為全市統計）' : ''}${parts.join('，')}。${cmp}上開為行政區整體統計，未區分屋齡、樓層、區位及車位，僅供區域行情參考。`,
          }
        },
      },
      {
        id: 'eco_rent', name: '行政區住宅租金水準', order: 35, source: LVR_SRC,
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          const c = await countyRow(ctx, p.county)
          const nat = await countyRow(ctx, '全國')
          const scope = p.lvr_scope === '全市' ? p.county : p.name
          const cTxt = c && c.rent_unit != null ? `同期${p.county}中位數約每坪每月 ${n0(c.rent_unit)} 元（${n0(c.rent_n)} 件）。` : ''
          if (p.rent_unit == null) {
            return { level: 'na', headline: `${scope}近一年租賃登錄件數不足，不列統計`, detail: `${LVR_PERIOD.replace('買賣', '租賃')}中，${scope}整戶出租的住家用公寓大樓僅 ${p.rent_n} 件，未達 ${MIN_N} 件不計算中位數。${cTxt}` }
          }
          const items = [
            { label: scope + ' 租金單價中位數', value: `${n0(p.rent_unit)} 元/坪/月（${n0(p.rent_n)} 件）` },
            { label: scope + ' 月租金中位數', value: n0(p.rent_total) + ' 元' },
          ]
          if (c && c.rent_unit != null && p.lvr_scope !== '全市') items.push({ label: p.county + ' 租金單價中位數', value: `${n0(c.rent_unit)} 元/坪/月（${n0(c.rent_n)} 件）` })
          if (nat && nat.rent_unit != null) items.push({ label: '全國 租金單價中位數', value: `${n0(nat.rent_unit)} 元/坪/月（${n0(nat.rent_n)} 件）` })
          return {
            level: 'info',
            headline: `${scope} 整戶租金中位數 ${n0(p.rent_unit)} 元/坪/月`,
            detail: `${p.lvr_scope === '全市' ? p.county + '的開放資料不分區，以下為全市統計。' : ''}統計範圍：${LVR_PERIOD.replace('買賣', '租賃')}，住家用公寓、華廈、住宅大樓，出租型態為「整棟(戶)出租」（不含套房、雅房），已排除社會住宅包租代管與備註載明親友、員工的案件。租賃實價登錄以包租代管業、租賃住宅服務業經手及申請租金補貼等案件為主，不是全部租約，件數少的行政區代表性有限。單價以建物總面積計。`,
            items,
            reportText: `依${LVR_SRC}（${LVR_PERIOD.replace('買賣', '租賃')}），${scope}${p.lvr_scope === '全市' ? '（該市開放資料不分區，為全市統計）' : ''}整戶出租之住家用公寓大樓，租金單價中位數約每坪每月 ${n0(p.rent_unit)} 元、月租金中位數約 ${n0(p.rent_total)} 元（${n0(p.rent_n)} 件）。${p.lvr_scope !== '全市' ? cTxt : ''}上開為行政區整體統計，未區分屋齡、樓層及附屬設備，僅供區域租金水準參考。`,
          }
        },
      },
      {
        id: 'eco_housing', name: '住宅存量、屋齡與空閒住宅', order: 40, source: '內政部不動產資訊平台（房屋稅籍住宅類統計）、行政院主計總處（109年人口及住宅普查）',
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          if (!p.hs_total && p.ht_n == null) return { level: 'na', headline: '查無住宅存量資料' }
          const c = await countyRow(ctx, p.county)
          const nat = await countyRow(ctx, '全國')
          // 房屋稅籍住宅類（115年第3季）：新竹市、嘉義市來源不分區，為全市數字
          const HT_Q = '115年第3季'
          const cityWide = p.county === '新竹市' || p.county === '嘉義市'
          const htScope = cityWide ? p.county : p.name
          const htItems = p.ht_n != null ? [
            { label: `房屋稅籍住宅數（${HT_Q}）`, value: n0(p.ht_n) + ' 宅' + (cityWide ? '（全市，來源不分區）' : '') },
            { label: `住宅平均屋齡（${HT_Q}）`, value: `${p.ht_age} 年` + (!cityWide && c && c.ht_age != null ? `（${p.county} ${c.ht_age} 年` + (nat && nat.ht_age != null ? `、全國 ${nat.ht_age} 年）` : '）') : nat && nat.ht_age != null ? `（全國 ${nat.ht_age} 年）` : '') },
            { label: `住宅平均面積（${HT_Q}）`, value: `${p.ht_area} 坪` + (nat && nat.ht_area != null ? `（全國 ${nat.ht_area} 坪）` : '') },
          ] : []
          const htText = p.ht_n != null ? `依內政部不動產資訊平台房屋稅籍住宅類統計（${HT_Q}），${htScope}${cityWide ? '（該統計不分區，為全市數字）' : ''}房屋稅籍住宅共 ${n0(p.ht_n)} 宅，平均屋齡 ${p.ht_age} 年、平均面積 ${p.ht_area} 坪${nat && nat.ht_age != null ? `（全國平均屋齡 ${nat.ht_age} 年）` : ''}。` : ''
          const htDetail = '房屋稅籍住宅類統計是依各地方稅稽徵機關房屋稅籍資料彙整的「存量」屋齡與面積（含未辦保存登記建物），每季更新；它不是成交案件的屋齡。新竹市、嘉義市來源不分區。'
          if (!p.hs_total) return { level: 'info', headline: `${htScope} 住宅平均屋齡 ${p.ht_age} 年`, detail: htDetail, items: htItems, reportText: htText }
          const occ = Math.round((p.hs_occupied / p.hs_total) * 1000) / 10
          return {
            level: 'info',
            headline: (p.ht_n != null ? `${htScope} 住宅平均屋齡 ${p.ht_age} 年；` : '') + `${p.name} 普查住宅 ${n0(p.hs_total)} 宅，空閒住宅率 ${p.vac_rate}%`,
            detail: htDetail + '住宅使用情形為109年11月人口及住宅普查，距今已約6年，新興開發區的現況可能差很多。空閒住宅指普查時「目前沒有使用」的住宅，不含偶爾自住與作辦公室、倉庫等其他用途者。',
            items: [
              ...htItems,
              { label: '普查住宅總數（109年）', value: n0(p.hs_total) + ' 宅' },
              { label: '有人經常居住', value: n0(p.hs_occupied) + ' 宅（' + occ + '%）' },
              { label: '偶爾自住', value: n0(p.hs_sometimes) + ' 宅' },
              { label: '作其他用途', value: n0(p.hs_otheruse) + ' 宅' },
              { label: '空閒住宅', value: n0(p.hs_vacant) + ' 宅（' + p.vac_rate + '%）' },
              ...(c ? [{ label: p.county + ' 空閒住宅率', value: c.vac_rate + '%' }] : []),
              ...(nat ? [{ label: '全國 空閒住宅率', value: nat.vac_rate + '%' }] : []),
            ],
            reportText: htText + `依行政院主計總處109年人口及住宅普查，${p.name}住宅共 ${n0(p.hs_total)} 宅，其中有人經常居住者 ${n0(p.hs_occupied)} 宅（${occ}%），空閒住宅 ${n0(p.hs_vacant)} 宅，空閒住宅率 ${p.vac_rate}%${c ? `（${p.county} ${c.vac_rate}%${nat ? '、全國 ' + nat.vac_rate + '%' : ''}）` : ''}。`,
          }
        },
      },
      {
        id: 'eco_land_value', name: '所在縣市公告土地現值', order: 50, source: '內政部地政司',
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          const c = await countyRow(ctx, p.county)
          const nat = await countyRow(ctx, '全國')
          if (!c || !c.alv_chg) return { level: 'na', headline: '查無公告土地現值統計' }
          const yrs = ['111', '112', '113', '114', '115']
          const cum = Math.round((yrs.reduce((m, y) => m * (1 + c.alv_chg[y] / 100), 1) - 1) * 1000) / 10
          const items = yrs.slice().reverse().map((y) => ({ label: y + ' 年公告土地現值調幅', value: pct(c.alv_chg[y]) + (nat ? '（全國 ' + pct(nat.alv_chg[y]) + '）' : '') }))
          items.push({ label: '近5年累計調幅（111～115年）', value: pct(cum) })
          if (c.alp_chg && c.alp_chg['115'] != null) items.push({ label: '115 年公告地價調幅', value: pct(c.alp_chg['115']) + '（前次 113 年 ' + pct(c.alp_chg['113']) + '）' })
          if (c.lv_avg) items.push({ label: '全' + p.county.slice(-1) + '平均公告土地現值', value: n0(c.lv_avg) + ' 元/平方公尺（115年，含山林等全部土地）' })
          return {
            level: 'info',
            headline: `${p.county} 115 年公告土地現值調幅 ${pct(c.alv_chg['115'])}`,
            detail: '這是整個縣市的平均調幅與平均值，不是這筆土地的公告現值。個別地號的公告土地現值、公告地價請向地政事務所或各縣市地政局地價查詢系統查詢。公告土地現值每年1月1日公告，公告地價每2年公告一次。平均公告土地現值＝全縣市公告土地現值總額÷土地總面積。',
            items,
            reportText: `依內政部地政司統計，${p.county}115年公告土地現值較前一年${c.alv_chg['115'] > 0 ? '調升 ' + c.alv_chg['115'] + '%' : c.alv_chg['115'] < 0 ? '調降 ' + Math.abs(c.alv_chg['115']) + '%' : '持平'}（全國平均${nat ? pct(nat.alv_chg['115']) : '—'}），111年至115年累計調幅約 ${pct(cum)}${c.alp_chg && c.alp_chg['115'] != null ? '；115年公告地價調幅 ' + pct(c.alp_chg['115']) : ''}。`,
          }
        },
      },
      {
        id: 'eco_affordability', name: '所在縣市房價指標（房價所得比、貸款負擔率、住宅價格指數）', order: 55, source: '內政部不動產資訊平台',
        run: async (pt, ctx) => {
          const loc = await locate(pt, ctx)
          const p = loc.p
          if (!p) return NA_OUTSIDE
          const c = await countyRow(ctx, p.county)
          const nat = await countyRow(ctx, '全國')
          const Q = '115Q1', Q4 = '114Q4', Y = '114Q1', QT = '115年第1季'
          if (!c || !c.pir || c.pir[Q] == null) return { level: 'na', headline: `${p.county}沒有房價負擔能力統計`, detail: '內政部不動產資訊平台的房價所得比、貸款負擔率只發布到臺灣本島各縣市與澎湖縣，金門縣、連江縣沒有資料。' }
          // 內政部房價負擔能力分級：貸款負擔率未滿 30% 可合理負擔、30%～未滿 40% 略低、40%～未滿 50% 偏低、50% 以上過低
          const grade = (v) => (v < 30 ? '可合理負擔' : v < 40 ? '房價負擔能力略低' : v < 50 ? '房價負擔能力偏低' : '房價負擔能力過低')
          const chg = (a, b) => (a == null || b == null ? '' : `，去年同季 ${b}`)
          const items = [
            { label: `房價所得比（${QT}）`, value: `${c.pir[Q]} 倍${nat && nat.pir ? '（全國 ' + nat.pir[Q] + ' 倍）' : ''}${chg(c.pir[Q], c.pir[Y])}，上一季 ${c.pir[Q4]}` },
            { label: `貸款負擔率（${QT}）`, value: `${c.lbr[Q]}%${nat && nat.lbr ? '（全國 ' + nat.lbr[Q] + '%）' : ''}${chg(c.lbr[Q], c.lbr[Y])}%，上一季 ${c.lbr[Q4]}%；${grade(c.lbr[Q])}` },
          ]
          let hpiTxt = ''
          const h = c.hpi || null, hn = nat && nat.hpi
          const yoy = (o) => Math.round((o[Q] / o[Y] - 1) * 1000) / 10
          if (h) {
            items.push({ label: `住宅價格指數（${QT}）`, value: `${h[Q]}，較去年同季 ${pct(yoy(h))}，上一季 ${h[Q4]}${hn ? '（全國 ' + hn[Q] + '，年增率 ' + pct(yoy(hn)) + '）' : ''}` })
            hpiTxt = `；住宅價格指數為 ${h[Q]}，較去年同季${yoy(h) > 0 ? '上漲 ' + yoy(h) : yoy(h) < 0 ? '下跌 ' + Math.abs(yoy(h)) : '持平 0'}%`
          } else if (hn) {
            items.push({ label: `住宅價格指數（${QT}）`, value: `內政部只編全國與六都；全國 ${hn[Q]}，較去年同季 ${pct(yoy(hn))}` })
            hpiTxt = `；全國住宅價格指數為 ${hn[Q]}，較去年同季${yoy(hn) > 0 ? '上漲 ' + yoy(hn) : yoy(hn) < 0 ? '下跌 ' + Math.abs(yoy(hn)) : '持平 0'}%`
          }
          return {
            level: 'info',
            headline: `${p.county}房價所得比 ${c.pir[Q]} 倍、貸款負擔率 ${c.lbr[Q]}%`,
            detail: '這是整個縣市的統計，不是這個地段的房價。房價所得比＝中位數住宅總價÷家戶年可支配所得中位數；貸款負擔率＝中位數住宅總價的貸款月攤還額÷家戶月可支配所得中位數。內政部分級：貸款負擔率未滿 30% 為可合理負擔、30%～未滿 40% 為房價負擔能力略低、40%～未滿 50% 為偏低、50% 以上為過低。住宅價格指數由內政部依實價登錄資料編製，只有全國與六都；指數基期與編製方法以內政部公布為準。資料每季更新，本站收錄到 ' + QT + '。',
            items,
            reportText: `依內政部不動產資訊平台統計，${p.county}${QT}房價所得比為 ${c.pir[Q]} 倍、貸款負擔率為 ${c.lbr[Q]}%${nat && nat.pir ? `（全國分別為 ${nat.pir[Q]} 倍、${nat.lbr[Q]}%）` : ''}，依內政部分級屬「${grade(c.lbr[Q])}」${hpiTxt}。`,
          }
        },
      },
      {
        id: 'eco_land_use', name: '國土利用現況（點位所在坵塊）', order: 58, source: '內政部國土測繪中心（國土利用現況調查）', timeout: 15000, layer: 'land_use_survey',
        run: async (pt, ctx) => {
          const url = `https://api.nlsc.gov.tw/other/LandUsePointQuery/${pt.lng.toFixed(6)}/${pt.lat.toFixed(6)}`
          const x = await ctx.cached(url, () => ctx.fetchText(url, { timeout: 10000 }))
          const g = (t) => ((x.match(new RegExp('<' + t + '>([^<]*)</' + t + '>')) || [])[1] || '').trim()
          const c1 = g('Lname_C1'), c2 = g('Lname_C2'), c3 = g('NAME')
          if (!c1) return { level: 'na', headline: '這個位置沒有國土利用現況調查資料', detail: '國土測繪中心的國土利用現況調查在這個位置查無坵塊（可能在海上或尚未調查）。' }
          const chain = [c1, c2, c3].filter((s, i, a) => s && a.indexOf(s) === i)
          const when = g('LYEAR') ? `${g('LYEAR')} 年${g('LMONTH') ? ' ' + Number(g('LMONTH')) + ' 月' : ''}` : ''
          return {
            level: 'info',
            headline: chain.slice(-2).join('－'),
            detail: '國土利用現況調查是依航照影像與外業調查判釋的「實際使用現況」分類（三級分類），不是都市計畫使用分區，也不是非都市土地使用編定；調查成果與現況可能有時間差。點位落在坵塊交界時，結果可能是隔壁坵塊。',
            items: [{ label: '第一級分類', value: c1 }, { label: '第二級分類', value: c2 || '—' }, { label: '第三級分類', value: c3 || '—' }, ...(when ? [{ label: '調查成果時間', value: when }] : [])],
            reportText: `依內政部國土測繪中心國土利用現況調查${when ? '（' + when + '成果）' : ''}，查詢地點所在位置之土地利用現況分類為「${chain.join('－')}」。`,
          }
        },
      },
      {
        id: 'eco_macro', name: '全國物價與營建成本', order: 60, source: '行政院主計總處', timeout: 20000,
        run: async (pt, ctx) => {
          const [cpi, cci] = await Promise.all([
            macroSeries(ctx, 'A030101015', [1, 36, 37]).catch(() => null), // 消費者物價：總指數、居住類、房租
            macroSeries(ctx, 'A030501015', [1]).catch(() => null), // 營造工程物價總指數
          ])
          if (!cpi && !cci) throw new Error('主計總處資料庫連線失敗')
          const all = [...(cpi || []).map((s) => ({ ...s, name: '消費者物價－' + s.name })), ...(cci || [])]
          const f = (s) => (s.yoy == null ? '—' : pct(s.yoy))
          const total = cpi && cpi[0], rent = cpi && cpi[2], build = cci && cci[0]
          const parts = []
          if (total) parts.push(`${total.period}消費者物價總指數年增率 ${f(total)}`)
          if (rent) parts.push(`其中房租類年增率 ${f(rent)}`)
          if (build) parts.push(`${build.period}營造工程物價總指數年增率 ${f(build)}`)
          return {
            level: 'info',
            headline: [total ? '物價年增 ' + f(total) : '', build ? '營造工程物價年增 ' + f(build) : ''].filter(Boolean).join('、'),
            detail: '全國性指標，與點選位置無關，供估價報告一般因素引用。年增率＝最新一個月指數與上年同月相比，每次查詢即時向主計總處總體統計資料庫取得最新一期。',
            items: all.map((s) => ({ label: s.name + '（' + s.period + '）', value: '指數 ' + s.value + '，年增率 ' + f(s) })),
            reportText: `依行政院主計總處統計，${parts.join('，')}。`,
          }
        },
      },
    ],
  })
})()
