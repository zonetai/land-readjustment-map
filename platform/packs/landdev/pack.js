// 圖資包：市地重劃與區段徵收（landdev）
// 範圍與屬性整理自六都地政局與政府資料開放平臺，資料來源與查證紀錄見 NOTES.md。
// 資料檔：data/land-readjustment.js（另設別名 ld_readjust、ld_readjust_burden）、data/zone-expropriation.js（ld_zx、ld_zx_ratio）、packs/landdev/data/nomap.js（ld_nomap，無幾何）
;(function () {
  const SRC = '六都地政局、政府資料開放平臺（整理）'
  const SRC_URL = '../legacy/'
  const UPDATED = '2026-11-24'
  const P = (f) => (f && f.properties) || {}
  const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v))
  const pct = (v, d = 1) => (num(v) === null ? '' : Number(v).toFixed(d) + '%')

  // 詳細資料（專業欄位）：給 popup 用
  const RJ_FIELDS = [['白話摘要', '一句話'], ['縣市', '縣市'], ['辦理方式', '辦理方式'], ['進度', '進度'], ['年度', '辦理期間／年度'], ['面積_公頃', '面積（公頃）'],
    ['總負擔比率', '平均總負擔（%）'], ['公設用地負擔比率', '公共設施用地負擔（%）'], ['費用負擔比率', '費用負擔（%）'], ['平均分回比例_換算值', '平均可分回（%，換算值）'],
    ['負擔性質', '數字性質'], ['核對註記', '核對註記'], ['屬性來源', '資料來源'], ['範圍來源', '範圍來源'], ['備註', '備註']]
  const ZX_FIELDS = [['白話摘要', '一句話'], ['縣市', '縣市'], ['進度', '進度'], ['年度', '辦理期間／年度'], ['面積_公頃', '面積（公頃）'],
    ['抵價地比例', '抵價地比例（%）'], ['抵價地比例性質', '數字性質'], ['公共設施用地比例', '公共設施用地比例（%，多為換算值）'],
    ['原所有權人取得土地比例', '原地主取得土地比例（%，換算值）'], ['核對註記', '核對註記'], ['屬性來源', '資料來源'], ['範圍來源', '範圍來源'], ['備註', '備註']]

  GIS.registerPack({
    id: 'landdev',
    name: '市地重劃與區段徵收',
    icon: 'layout-grid',
    order: 5,
    datasets: [
      {
        id: 'ld_readjust', name: '市地重劃區（紅：政府辦理／藍：地主自辦）', file: 'data/land-readjustment.js', geometry: 'polygon', count: 406,
        showAsLayer: true, group: '市地重劃與區段徵收',
        style: { color: '#c0392b', weight: 1.5, fillOpacity: 0.22 },
        styleBy: { field: '辦理方式', map: { 公辦: '#c0392b', 自辦: '#2471a3' }, other: '#7f8c8d' },
        labelField: '名稱', popupFields: RJ_FIELDS,
        source: SRC, sourceUrl: SRC_URL, updated: UPDATED,
        note: '臺北、新北、臺中、高雄 406 區。紅色是政府辦理（公辦），藍色是地主自組重劃會辦理（自辦）。',
      },
      {
        id: 'ld_readjust_burden', name: '市地重劃：負擔比率／可分回比例', file: 'data/land-readjustment.js', geometry: 'polygon', count: 406,
        showAsLayer: true, group: '市地重劃與區段徵收',
        labelField: '名稱', popupFields: RJ_FIELDS,
        themes: [
          { field: '總負擔比率', label: '平均總負擔比率', unit: '%', breaks: [30, 35, 40, 45], colors: ['#fee5d9', '#fcae91', '#fb6a4a', '#de2d26', '#a50f15'] },
          { field: '平均分回比例_換算值', label: '平均可分回比例（換算值）', unit: '%', breaks: [55, 60, 65, 70], colors: ['#edf8e9', '#bae4b3', '#74c476', '#31a354', '#006d2c'] },
        ],
        source: SRC, sourceUrl: SRC_URL, updated: UPDATED,
        note: '可分回比例＝100%－總負擔，是換算值，不是官方公布數字；每位地主實際分回會因土地位置、地價不同。灰色表示公開資料沒有負擔比率。',
      },
      {
        id: 'ld_zx', name: '區段徵收區（綠色）', file: 'data/zone-expropriation.js', geometry: 'polygon', count: 84,
        showAsLayer: true, group: '市地重劃與區段徵收',
        style: { color: '#1e8449', weight: 2, fillOpacity: 0.25 },
        labelField: '名稱', popupFields: ZX_FIELDS,
        source: SRC, sourceUrl: SRC_URL, updated: UPDATED,
        note: '臺北、新北、臺中、高雄 84 區。區段徵收是政府把整區土地徵收後重新規劃，原地主可選擇領回一部分土地（抵價地）。',
      },
      {
        id: 'ld_zx_ratio', name: '區段徵收：抵價地比例', file: 'data/zone-expropriation.js', geometry: 'polygon', count: 84,
        showAsLayer: true, group: '市地重劃與區段徵收',
        labelField: '名稱', popupFields: ZX_FIELDS,
        themes: [{ field: '抵價地比例', label: '抵價地比例', unit: '%', breaks: [41, 46, 50.5], colors: ['#c7e9c0', '#74c476', '#31a354', '#006d2c'], classes: ['40%', '45%', '50%', '50%以上'] }],
        source: SRC, sourceUrl: SRC_URL, updated: UPDATED,
        note: '只有 7 區有公布抵價地比例；灰色表示公開資料沒有。',
      },
      { id: 'ld_nomap', name: '沒有公開範圍圖的重劃／區段徵收區', file: 'packs/landdev/data/nomap.js', geometry: 'polygon', count: 275, showAsLayer: false },
    ],
    checks: [{
      id: 'ld_share', name: '重劃負擔與可分回比例', order: 41,
      source: '六都地政局、政府資料開放平臺（整理）',
      layer: 'ld_readjust',
      run: async (pt, ctx) => {
        const [ra, zx] = await Promise.all([ctx.data('ld_readjust').catch(() => null), ctx.data('ld_zx').catch(() => null)])
        if (!ra && !zx) throw new Error('資料載入失敗')
        const inRa = ra ? ctx.containing(ra, pt) : []
        const inZx = zx ? ctx.containing(zx, pt) : []
        if (inRa.length) {
          const p = P(inRa[0].feature || inRa[0]), b = num(p['總負擔比率'])
          const share = b === null ? null : 100 - b
          const detail = [
            `${p['辦理方式'] === '自辦' ? '地主自辦' : '政府辦理'}${p['進度'] && !/^（/.test(p['進度']) ? '，' + p['進度'] : ''}${p['年度'] ? '，' + p['年度'] : ''}。`,
            b === null ? '公開資料沒有這一區的負擔比率。' : `地主平均負擔約 ${pct(b)}（公共設施用地 ${pct(p['公設用地負擔比率']) || '—'}＋費用 ${pct(p['費用負擔比率']) || '—'}），平均可分回約 ${pct(share)}（換算值）。`,
            p['核對註記'] ? '注意：' + p['核對註記'] : '',
            `數字性質：${p['負擔性質'] || '—'}；來源：${p['屬性來源'] || '—'}`,
          ].filter(Boolean).join(' ')
          return {
            level: 'info',
            headline: b === null ? `在「${p['名稱']}」市地重劃範圍內` : `在重劃區內，平均可分回約 ${pct(share)}`,
            detail,
            reportText: `勘估標的位於「${p['名稱']}」市地重劃範圍內${b === null ? '' : `，該重劃區土地所有權人平均總負擔比率為 ${pct(b, 2)}（${p['負擔性質'] || '公開資料'}），以 100% 減總負擔換算之平均分回比例約 ${pct(share, 2)}`}。`,
          }
        }
        if (inZx.length) {
          const p = P(inZx[0].feature || inZx[0]), r = num(p['抵價地比例'])
          return {
            level: 'info',
            headline: r === null ? `在「${p['名稱']}」區段徵收範圍內` : `在區段徵收區內，抵價地比例 ${pct(r, 0)}`,
            detail: [r === null ? '公開資料沒有這一區的抵價地比例。' : `原地主可申請領回的抵價地，約為原土地的 ${pct(r, 0)}（${p['抵價地比例性質'] || '公開資料'}）。`,
              num(p['公共設施用地比例']) !== null ? `公共設施用地約占 ${pct(p['公共設施用地比例'])}（多為換算值）。` : '',
              p['核對註記'] ? '注意：' + p['核對註記'] : '', `來源：${p['屬性來源'] || '—'}`].filter(Boolean).join(' '),
            reportText: `勘估標的位於「${p['名稱']}」區段徵收範圍內${r === null ? '' : `，該區抵價地比例為 ${pct(r, 0)}`}。`,
          }
        }
        // 桃園、臺南沒有公開範圍圖：給全市概況
        let county = ''
        try { county = ((await ctx.admin(pt)).county || '').replace(/台/g, '臺') } catch (e) { county = '' }
        if (county === '桃園市' || county === '臺南市') {
          const nm = await ctx.data('ld_nomap').catch(() => null)
          const rows = nm ? nm.features.map(P).filter((p) => p['縣市'] === county) : []
          const rjs = rows.filter((p) => p['開發方式'] === '市地重劃'), zxs = rows.filter((p) => p['開發方式'] === '區段徵收')
          const bs = rjs.map((p) => num(p['總負擔比率'])).filter((v) => v !== null)
          const avg = bs.length ? bs.reduce((a, b) => a + b, 0) / bs.length : null
          return {
            level: 'na',
            headline: `${county}的重劃範圍圖未公開，無法判斷`,
            detail: `${county}沒有公開市地重劃／區段徵收的範圍圖，只能列出全市清單：市地重劃 ${rjs.length} 區（${bs.length} 區有負擔比率${avg === null ? '' : `，平均約 ${pct(avg)}，可分回約 ${pct(100 - avg)}`}）、區段徵收 ${zxs.length} 區。請以地政事務所謄本或地政局資料確認。`,
            items: rjs.filter((p) => num(p['總負擔比率']) !== null).slice(0, 12).map((p) => ({ label: p['名稱'], value: `負擔 ${pct(p['總負擔比率'])}；可分回約 ${pct(p['平均分回比例_換算值'])}` })),
          }
        }
        return { level: 'na', headline: '不在已公開範圍的重劃或區段徵收區內', detail: '資料涵蓋臺北、新北、臺中、高雄已公開範圍圖的市地重劃 406 區、區段徵收 84 區。' }
      },
    }],
  })
})()
