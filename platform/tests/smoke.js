/* 介面煙霧測試（node tests/smoke.js）
 * 起一個本機靜態伺服器，用 Playwright 開頁面；所有對外請求一律攔截（圖磚回 1x1 PNG、行政區查詢回固定 XML、其他回空 JSON），
 * 所以不需要網路。測試用圖資包在 packs/_demo/（網址加 ?packs=_demo 載入）。
 * 環境變數：SHOTS=截圖資料夾（不給就不截圖）。 */
const http = require('http')
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const { chromium } = require('playwright')

const ROOT = path.resolve(__dirname, '..')
const SHOTS = process.env.SHOTS || ''
const PT = { lat: 25.033, lng: 121.5436 }
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.geojson': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' }

// ── 1x1 PNG（可指定顏色，方便截圖時分辨左右兩年的航照）
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
function png1x1(r, g, b, a) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]) }
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0])
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from([0, r, g, b, a]))), chunk('IEND', Buffer.alloc(0))])
}
const TRANSPARENT = png1x1(0, 0, 0, 0)
function tileFor(url) {
  const m = url.match(/\/wmts\/PHOTO(\d+)\//)
  if (m) { const y = Number(m[1]); const t = y > 2000 ? (y - 2014) / 11 : y === 1 ? 0 : 1; return png1x1(Math.round(150 - 90 * t), Math.round(130 + 40 * t), Math.round(90 + 20 * t), 255) }
  if (/\/wmts\/EMAP\//.test(url)) return png1x1(236, 240, 244, 255)
  if (/example\.test/.test(url)) return png1x1(225, 29, 72, 90)
  return TRANSPARENT
}
const ADMIN_XML = '<?xml version="1.0" encoding="UTF-8"?><townVillageItem><ctyCode>A</ctyCode><ctyName>臺北市</ctyName><townCode>A02</townCode><townName>大安區</townName><officeCode>AC</officeCode><officeName>大安地政事務所</officeName><sectCode>0434</sectCode><sectName>復興段一小段</sectName><villageCode>63000030017</villageCode><villageName>龍圖里</villageName></townVillageItem>'

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0])
    if (p.endsWith('/')) p += 'index.html'
    const file = path.join(ROOT, p)
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found') }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' })
    fs.createReadStream(file).pipe(res)
  })
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)))
}

const results = []
async function test(name, fn) {
  try { await fn(); results.push([true, name]); console.log('  ✓ ' + name) }
  catch (e) { results.push([false, name, e.message]); console.log('  ✗ ' + name + '\n      ' + String(e.message).split('\n').slice(0, 4).join('\n      ')) }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg) }

async function main() {
  const server = await serve()
  const base = `http://127.0.0.1:${server.address().port}/`
  const browser = await chromium.launch()
  if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true })
  const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(350); await page.screenshot({ path: path.join(SHOTS, name + '.png') }) } }

  /** 開一頁：攔截所有對外請求、記錄錯誤與請求網址 */
  async function open(url, opt = {}) {
    const context = await browser.newContext({ viewport: opt.viewport || { width: 1440, height: 900 }, hasTouch: !!opt.mobile, isMobile: !!opt.mobile, permissions: ['clipboard-read', 'clipboard-write'] })
    const page = await context.newPage()
    const errors = [], external = []
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const loc = (m.location() || {}).url || ''
      if (/\/packs\/[\w-]+\/pack\.js/.test(loc) && /404|Failed to load/.test(m.text())) return // 圖資包還沒放上來，介面要能容忍
      errors.push('console: ' + m.text() + ' @' + loc)
    })
    await page.route('**/*', (route) => {
      const u = route.request().url()
      if (/^(file:|data:|blob:)/.test(u) || u.startsWith(base)) return route.continue()
      external.push(u)
      if (/TownVillagePointQuery/.test(u)) return route.fulfill({ status: 200, contentType: 'text/xml; charset=utf-8', headers: { 'Access-Control-Allow-Origin': '*' }, body: ADMIN_XML })
      if (/openfreemap\.org\/styles/.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{"version":8,"sources":{},"layers":[]}' })
      if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' })
      const type = route.request().resourceType()
      if (type === 'image' || /\/wmts\/|\/wms|\/tile\/|\/export\?|\.(png|jpe?g)(\?|$)/i.test(u)) return route.fulfill({ status: 200, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' }, body: tileFor(u) })
      if (type === 'script') return route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: '{}' })
    })
    // 測試用光柵底圖（無頭瀏覽器不一定有 WebGL）；opt.vector 時維持預設向量底圖
    if (!opt.vector) await page.addInitScript(() => { try { if (!localStorage.getItem('wlgis:basemap')) localStorage.setItem('wlgis:basemap', '"taiwan_emap"') } catch (e) { /* file:// 無痕 */ } })
    await page.goto(url)
    await page.waitForFunction(() => window.APP && window.APP.map && window.PACKUI, null, { timeout: 15000 })
    return { page, context, errors, external }
  }
  const clickLatLng = async (page, lat, lng, button = 'left') => {
    const p = await page.evaluate(([la, ln]) => { const pt = APP.map.latLngToContainerPoint([la, ln]); const r = APP.map.getContainer().getBoundingClientRect(); return { x: r.left + pt.x, y: r.top + pt.y } }, [lat, lng])
    await page.mouse.click(p.x, p.y, { button })
  }
  const waitChecks = (page) => page.waitForFunction(() => window.SITECHECK && SITECHECK.state.done, null, { timeout: 20000 })
  const noScrollX = (page) => page.evaluate(() => ({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, win: window.innerWidth }))
  const canvasInk = (page) => page.evaluate(() => { const c = document.querySelector('.leaflet-packdata-pane canvas'); if (!c) return -1; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n })

  // ══ 1. 正式首頁（不帶參數）
  console.log('\n正式首頁')
  const realPacks = ['living', 'risk', 'economy', 'planning'].filter((id) => fs.existsSync(path.join(ROOT, 'packs', id, 'pack.js')))
  console.log('  （目前存在的圖資包：' + (realPacks.join('、') || '無') + '）')
  {
    const { page, context, errors, external } = await open(base)
    await test('首頁載入沒有錯誤（缺圖資包也不會壞）', async () => {
      await page.waitForSelector('#nav .nav-item')
      await page.waitForTimeout(800)
      assert(!errors.length, errors.join('\n'))
    })
    await test('預設不會載入測試包 _demo', async () => {
      assert(await page.evaluate(() => !GIS.packs.some((p) => p.id === '_demo')), '_demo 被載入了')
    })
    await test('左側選單有「地點體檢」（第一項）與「歷年航照」', async () => {
      const labels = await page.$$eval('#nav .nav-item .nav-label', (els) => els.map((e) => e.textContent))
      assert(labels[0] === '地點體檢', '第一項是 ' + labels[0]); assert(labels.includes('歷年航照'), labels.join(','))
    })
    await test('重劃範圍改由 data/land-readjustment.js 載入，清單有資料', async () => {
      await page.waitForSelector('#panelBody [data-rj]', { timeout: 15000 })
      const n = await page.evaluate(() => GIS_DATA.readjust.features.length)
      assert(n > 300, '重劃區筆數 ' + n)
      assert(await page.evaluate(() => !performance.getEntriesByType('resource').some((r) => /land-readjustment\.geojson/.test(r.name))), '還在抓 .geojson')
    })
    if (realPacks.length) {
      await test(`真實圖資包（${realPacks.join('、')}）：註冊成功、圖層全部開關一輪不出錯`, async () => {
        const info = await page.evaluate(() => GIS.packs.map((p) => `${p.id}：圖層 ${p.layers.length}、資料集 ${p.datasets.length}、體檢 ${p.checks.length}`))
        console.log('      ' + info.join('\n      '))
        const loaded = await page.evaluate(() => GIS.packs.map((p) => p.id))
        const missing = realPacks.filter((id) => !loaded.includes(id))
        assert(!missing.length, 'pack.js 存在但沒有註冊成功：' + missing.join('、'))
        await page.click('[data-tool="layers"]')
        const res = await page.evaluate(async () => {
          const ids = [...Object.keys(GIS.layers), ...Object.values(GIS.datasets).filter((d) => d.showAsLayer !== false).map((d) => d.id)]
          const bad = []
          for (const id of ids) { try { PACKUI.toggle(id, true, { quiet: true }) } catch (e) { bad.push(id + ' 開啟：' + e.message) } }
          await new Promise((r) => setTimeout(r, 2500))
          const rows = document.querySelectorAll('#layerBody [data-pack-layer]').length
          const failed = [...document.querySelectorAll('#layerBody .layer-note.bad')].map((e) => e.closest('.layer-row').querySelector('.layer-check span').textContent + '：' + e.textContent)
          for (const id of ids) { try { PACKUI.toggle(id, false) } catch (e) { bad.push(id + ' 關閉：' + e.message) } }
          return { n: ids.length, rows, bad, failed }
        })
        console.log(`      圖層＋資料集共 ${res.n} 個，面板列出 ${res.rows} 列`)
        assert(res.rows === res.n, `面板列數 ${res.rows} ≠ ${res.n}`)
        assert(!res.bad.length && !res.failed.length, [...res.bad, ...res.failed].join('\n'))
        assert(!errors.length, errors.join('\n'))
      })
      await test('真實圖資包：主題圖資料集的每個指標都能切換、圖例級數與顏色數一致', async () => {
        const out = await page.evaluate(async () => {
          const msgs = []
          for (const d of Object.values(GIS.datasets).filter((x) => x.showAsLayer !== false && x.themes && x.themes.length)) {
            PACKUI.toggle(d.id, true, { quiet: true })
            await GIS.loadDataset(d.id)
            await new Promise((r) => setTimeout(r, 600))
            const sel = document.querySelector(`select[data-theme="${d.id}"]`)
            if (!sel) { msgs.push(d.id + '：沒有指標下拉'); continue }
            for (const t of d.themes) {
              sel.value = t.field; sel.dispatchEvent(new Event('change'))
              await new Promise((r) => setTimeout(r, 150))
              const row = document.querySelector(`[data-pack-layer="${d.id}"]`).closest('.layer-row')
              const n = row.querySelectorAll('.swatch').length
              if (n !== t.colors.length + 1) msgs.push(`${d.id}/${t.field}：圖例 ${n} 格，顏色 ${t.colors.length} 個`)
              if (!Array.isArray(t.breaks) || t.breaks.length !== t.colors.length - 1) msgs.push(`${d.id}/${t.field}：breaks ${t.breaks && t.breaks.length} 個、colors ${t.colors.length} 個（應該差 1）`)
              const fc = GIS_DATA[d.id], vf = t.valueField || t.field
              const have = fc.features.filter((f) => f.properties && f.properties[vf] !== null && f.properties[vf] !== undefined && !isNaN(Number(f.properties[vf]))).length
              msgs.push(`ok ${d.id}/${t.label}：${have}/${fc.features.length} 筆有數值`)
            }
          }
          return msgs
        })
        console.log('      ' + (out.join('\n      ') || '（沒有帶 themes 的資料集）'))
        const bad = out.filter((m) => !m.startsWith('ok '))
        assert(!bad.length, bad.join('\n'))
        assert(!errors.length, errors.join('\n'))
        if (out.length) {
          await page.evaluate(() => { APP.map.setView([24.2, 121.0], 9, { animate: false }); const b = document.querySelector('#layerBody'); const sel = b.querySelector('select[data-theme]'); if (sel) b.scrollTop = sel.closest('.cat').offsetTop - 60 })
          await shot(page, 'real-packs-theme')
          await page.evaluate(() => { for (const d of Object.values(GIS.datasets)) if (d.themes && PACKUI.isOn(d.id)) PACKUI.toggle(d.id, false); APP.map.setView([25.0418, 121.544], 13, { animate: false }) })
        }
      })
      await test('真實圖資包：跑一次體檢（對外查詢全部攔截）不出錯、每項都有結果', async () => {
        const out = await page.evaluate(async (pt) => { const r = await SITECHECK.run(pt.lat, pt.lng); return r.map((x) => `${x.pack}/${x.id}｜${x.status}｜${x.level}｜${x.headline}${x.error ? '｜' + x.error : ''}`) }, PT)
        console.log('      ' + out.join('\n      '))
        const cards = await page.$$eval('#panelBody .sc-card:not(.loading)', (e) => e.length)
        assert(cards === out.length && cards > 0, `卡片 ${cards} 張、項目 ${out.length} 個`)
        const bad = out.filter((l) => /undefined|\[object Object\]|NaN/.test(l))
        assert(!bad.length, '結果文字有問題：\n' + bad.join('\n'))
        assert(!errors.length, errors.join('\n'))
        await shot(page, 'real-packs-check')
      })
    }
    await context.close()
  }

  // ══ 2. 測試包：圖層面板
  console.log('\n圖層面板（?packs=_demo）')
  {
    const { page, context, errors, external } = await open(base + '?packs=_demo#25.033,121.5436,14')
    await test('載入測試包沒有錯誤', async () => { await page.waitForTimeout(500); assert(!errors.length, errors.join('\n')); assert(await page.evaluate(() => GIS.packs.length === 1 && GIS.checks.length === 7), '測試包沒註冊好') })
    await test('圖資包指定的圖示不存在時改用相近或通用圖示', async () => {
      const r = await page.evaluate(() => [PACKUI.packIcon('shield-alert'), PACKUI.packIcon('chart-column'), PACKUI.packIcon('no-such-icon'), PACKUI.packIcon('')])
      assert(JSON.stringify(r) === JSON.stringify(['shield-alert', 'bar-chart-3', 'package', 'package']), r.join(','))
    })
    await test('圖層面板列出包內圖層與資料集（不含 showAsLayer:false）', async () => {
      await page.click('[data-tool="layers"]')
      const ids = await page.$$eval('#layerBody [data-pack-layer]', (els) => els.map((e) => e.dataset.packLayer))
      assert(JSON.stringify(ids) === JSON.stringify(['demo_xyz', 'demo_wms', 'demo_arcgis', 'demo_points', 'demo_far', 'demo_towns']), ids.join(','))
      const groups = await page.$$eval('#layerBody [data-pack] .layer-group-title', (els) => els.map((e) => e.textContent))
      assert(JSON.stringify(groups) === JSON.stringify(['圖磚', '動態出圖', '資料集']), groups.join(','))
    })
    await test('xyz 圖層：開啟後會抓圖磚，並顯示圖例、說明與來源', async () => {
      await page.check('[data-pack-layer="demo_xyz"]')
      await page.waitForTimeout(400)
      assert(external.some((u) => /tiles\.example\.test\/xyz\/14\/\d+\/\d+/.test(u)), '沒有抓 xyz 圖磚')
      const txt = await page.$eval('#layerBody [data-pack-layer="demo_xyz"]', (e) => e.closest('.layer-row').textContent)
      assert(/高/.test(txt) && /這是測試用的說明文字/.test(txt) && /來源：測試機關/.test(txt), txt)
    })
    await test('arcgis 圖層：export 網址的外框、座標系與 layers 參數正確', async () => {
      await page.check('[data-pack-layer="demo_arcgis"]')
      await page.waitForTimeout(400)
      const u = external.find((x) => /MapServer\/export\?/.test(x))
      assert(u, '沒有送出 export 請求')
      const q = new URL(u).searchParams
      const b = q.get('bbox').split(',').map(Number)
      const span = 40075016.685578488 / 2 ** 14
      assert(Math.abs(b[2] - b[0] - span) < 0.01 && Math.abs(b[3] - b[1] - span) < 0.01, '外框大小不對 ' + q.get('bbox'))
      assert(b[0] > 13.4e6 && b[0] < 13.6e6 && b[1] > 2.8e6 && b[1] < 2.9e6, '外框不在臺北附近 ' + q.get('bbox'))
      assert(q.get('layers') === 'show:1,2' && q.get('bboxSR') === '3857' && q.get('imageSR') === '3857' && q.get('size') === '256,256' && q.get('format') === 'png32' && q.get('transparent') === 'true' && q.get('f') === 'image', u)
    })
    await test('wms 圖層：縮太小不抓圖並提示，放大後才抓', async () => {
      await page.check('[data-pack-layer="demo_wms"]')
      await page.waitForTimeout(300)
      assert(!external.some((u) => /example\.test\/wms/.test(u)), '第 14 級就抓了 minZoom 15 的圖層')
      assert(await page.isVisible('[data-zoomhint="demo_wms"]'), '沒有顯示放大提示')
      await page.evaluate(() => { APP.map.setZoom(15, { animate: false }) })
      await page.waitForTimeout(500)
      assert(external.some((u) => /example\.test\/wms\?.*LAYERS=DEMO/i.test(u)), '放大後沒有抓 WMS')
      assert(!(await page.isVisible('[data-zoomhint="demo_wms"]')), '放大後提示沒有消失')
      await page.evaluate(() => { APP.map.setZoom(14, { animate: false }) })
    })
    await test('關閉圖層後不再顯示額外設定', async () => {
      for (const id of ['demo_xyz', 'demo_arcgis', 'demo_wms']) await page.uncheck(`[data-pack-layer="${id}"]`)
      assert((await page.$$('#layerBody [data-pack] .layer-extra')).length === 0, '還有展開的圖層設定')
    })
    await test('點資料集（2,400 點）：勾選才載入、畫在畫布上、有分色圖例', async () => {
      assert(await page.evaluate(() => !GIS_DATA.demo_points), '還沒勾選就載入了')
      await page.check('[data-pack-layer="demo_points"]')
      await page.waitForFunction(() => !!GIS_DATA.demo_points)
      await page.waitForTimeout(500)
      const ink = await canvasInk(page)
      assert(ink > 500, '畫布上沒有東西：' + ink)
      const legend = await page.$$eval('#layerBody [data-pack-layer="demo_points"]', (e) => [...e[0].closest('.layer-row').querySelectorAll('.swatch')].map((s) => s.textContent))
      assert(JSON.stringify(legend) === JSON.stringify(['捷運', '臺鐵', '公車']), legend.join(','))
      await shot(page, 'desktop-layers')
      await page.uncheck('[data-pack-layer="demo_points"]')
      await page.waitForTimeout(200)
      assert((await canvasInk(page)) === 0, '關掉後畫布還有東西')
    })
    await test('資料集 minZoom：縮太小不畫並提示', async () => {
      await page.check('[data-pack-layer="demo_far"]')
      await page.waitForTimeout(400)
      assert((await canvasInk(page)) === 0, '第 14 級就畫了 minZoom 16 的資料')
      assert(await page.isVisible('[data-zoomhint="demo_far"]'), '沒有提示')
      await page.evaluate(() => { APP.map.setZoom(16, { animate: false }) })
      await page.waitForTimeout(500)
      assert((await canvasInk(page)) > 50, '放大後沒有畫出來')
      await page.uncheck('[data-pack-layer="demo_far"]')
      await page.evaluate(() => { APP.map.setView([25.033, 121.5436], 13, { animate: false }) })
    })
    await test('主題圖：指標下拉、分級圖例、切換指標、popup 顯示該指標數值', async () => {
      await page.check('[data-pack-layer="demo_towns"]')
      await page.waitForSelector('select[data-theme="demo_towns"]')
      await page.waitForTimeout(400)
      const opts = await page.$$eval('select[data-theme="demo_towns"] option', (e) => e.map((o) => o.textContent))
      assert(JSON.stringify(opts) === JSON.stringify(['人口數', '公告土地現值']), opts.join(','))
      const legend1 = await page.$$eval('#layerBody [data-pack-layer="demo_towns"]', (e) => [...e[0].closest('.layer-row').querySelectorAll('.swatch')].map((s) => s.textContent))
      assert(legend1.length === 5 && /低於 10,000 人/.test(legend1[0]) && /100,000 人 以上/.test(legend1[3]) && legend1[4] === '沒有資料', legend1.join('|'))
      const color = () => page.evaluate(() => { const c = document.querySelector('.leaflet-packdata-pane canvas'); const p = APP.map.latLngToContainerPoint([25.0, 121.495]); const s = APP.map.getSize(); const k = c.width / (s.x * 1.6); const o = APP.map.containerPointToLayerPoint([0, 0]); const b = L.DomUtil.getPosition(c); const d = c.getContext('2d').getImageData(Math.round((p.x + o.x - b.x) * k), Math.round((p.y + o.y - b.y) * k), 1, 1).data; return [...d].join(',') })
      const c1 = await color()
      await clickLatLng(page, 25.0, 121.495) // 測試區1：人口 15,000
      await page.waitForSelector('.leaflet-popup-content')
      const pop1 = await page.$eval('.leaflet-popup-content', (e) => e.textContent.replace(/\s+/g, ' '))
      assert(/測試區1/.test(pop1) && /人口數\s*15,000 人/.test(pop1), pop1)
      await page.selectOption('select[data-theme="demo_towns"]', 'price')
      await page.waitForTimeout(300)
      const legend2 = await page.$$eval('#layerBody [data-pack-layer="demo_towns"]', (e) => [...e[0].closest('.layer-row').querySelectorAll('.swatch')].map((s) => s.textContent))
      assert(legend2.length === 4 && /低於 50,000 元\/㎡/.test(legend2[0]), legend2.join('|'))
      const c2 = await color()
      assert(c1 !== c2 && c1 !== '0,0,0,0', `切換指標後顏色沒有變：${c1} → ${c2}`)
      await clickLatLng(page, 25.0, 121.495)
      await page.waitForSelector('.leaflet-popup-content')
      const pop2 = await page.$eval('.leaflet-popup-content', (e) => e.textContent.replace(/\s+/g, ' '))
      assert(/公告土地現值\s*40,000 元\/㎡/.test(pop2), pop2)
      await shot(page, 'desktop-layers-theme')
      await page.evaluate(() => { APP.map.closePopup() })
    })
    await test('圖層搜尋：只留下符合的圖層', async () => {
      await page.fill('#layerQ', '統計')
      const vis = await page.$$eval('#layerBody .layer-row', (els) => els.filter((e) => !e.hidden).map((e) => e.querySelector('.layer-check').textContent.trim()))
      assert(vis.length === 1 && /測試統計區/.test(vis[0]), vis.join('|'))
      await page.fill('#layerQ', '地籍')
      const vis2 = await page.$$eval('#layerBody .layer-row', (els) => els.filter((e) => !e.hidden && e.offsetParent).length)
      assert(vis2 >= 1, '搜尋「地籍」找不到原有圖層（收合的分類也要找得到）')
      await page.fill('#layerQ', '完全不存在的圖層')
      assert(await page.isVisible('#layerNone'), '沒有顯示找不到的提示')
      await page.fill('#layerQ', '')
    })
    await test('重新整理後還原上次開著的圖層與指標', async () => {
      await page.reload()
      await page.waitForFunction(() => window.PACKUI && PACKUI.isOn('demo_towns'))
      await page.click('[data-tool="layers"]')
      assert((await page.$eval('select[data-theme="demo_towns"]', (e) => e.value)) === 'price', '指標沒有還原')
    })
    await test('整段操作沒有錯誤', async () => assert(!errors.length, errors.join('\n')))
    await context.close()
  }

  // ══ 3. 地點體檢
  console.log('\n地點體檢')
  let reportFromClick = '', P = PT // P：實際點到的位置（滑鼠點擊以像素為準，和 PT 會差一點點）
  const f6 = (n) => n.toFixed(6)
  {
    const { page, context, errors, external } = await open(base + '?packs=_demo#25.033,121.5436,15')
    await test('從左側選單進入：自動進入選點模式', async () => {
      await page.click('#nav [data-panel="sitecheck"]')
      await page.waitForSelector('#scPick')
      assert(/請在地圖上點一下/.test(await page.textContent('#scPick')), '沒有進入選點模式')
      assert((await page.$$('#panelBody .sc-pack')).length === 1, '沒有圖資包勾選')
      await shot(page, 'desktop-check-start')
    })
    await test('點地圖：先出現載入中的卡片，再逐項出現結果', async () => {
      await clickLatLng(page, PT.lat, PT.lng)
      await page.waitForSelector('#panelBody .sc-card')
      const first = await page.evaluate(() => ({ all: document.querySelectorAll('#panelBody .sc-card').length, loading: document.querySelectorAll('#panelBody .sc-card.loading').length }))
      assert(first.all === 7 && first.loading >= 3, `一開始 ${first.all} 張、載入中 ${first.loading} 張`)
      await page.waitForSelector('#panelBody .sc-card.lv-warn') // 300ms 後才回來
      const mid = await page.evaluate(() => document.querySelectorAll('#panelBody .sc-card.loading').length)
      assert(mid >= 1, '黃燈出現時應該還有項目在跑（逐項出現）')
      assert(await page.$eval('[data-sc-out="copy"]', (e) => e.disabled), '還沒跑完就能複製')
      await waitChecks(page)
      P = await page.evaluate(() => SITECHECK.state.pt)
      assert(Math.abs(P.lat - PT.lat) < 1e-4 && Math.abs(P.lng - PT.lng) < 1e-4, '體檢點和點擊位置不符 ' + JSON.stringify(P))
      assert((await page.$$('#panelBody .sc-card.loading')).length === 0, '跑完還有載入中的卡片')
    })
    await test('燈號正確（綠、參考、黃、紅、查不到×3，含錯誤與逾時）', async () => {
      const lv = await page.$$eval('#panelBody .sc-card', (els) => els.map((e) => e.dataset.check + '=' + [...e.classList].find((c) => c.startsWith('lv-'))))
      assert(JSON.stringify(lv) === JSON.stringify(['demo_good=lv-good', 'demo_info=lv-info', 'demo_warn=lv-warn', 'demo_bad=lv-bad', 'demo_na=lv-na', 'demo_throw=lv-na', 'demo_timeout=lv-na']), lv.join(','))
      const light = await page.$eval('[data-check="demo_bad"] .sc-light', (e) => getComputedStyle(e).backgroundColor)
      assert(light === 'rgb(220, 38, 38)', '紅燈顏色 ' + light)
      const hl = await page.$eval('[data-check="demo_timeout"] .sc-headline', (e) => e.textContent)
      assert(hl === '暫時查不到', hl)
    })
    await test('位置摘要（縣市、鄉鎮、村里、地段、兩種座標）與總覽列', async () => {
      const s = await page.$eval('#scSummary', (e) => e.textContent.replace(/\s+/g, ' '))
      assert(/臺北市大安區\s*龍圖里/.test(s) && /復興段一小段/.test(s) && s.includes(`WGS84 ${f6(P.lat)}, ${f6(P.lng)}`) && /TWD97 30\d{4}, 27\d{5}/.test(s), s)
      const o = await page.$eval('#scOver', (e) => e.textContent.replace(/\s+/g, ' '))
      assert(/2 項需注意/.test(o) && /3 項查不到/.test(o) && /注意 1/.test(o) && /留意 1/.test(o), o)
      assert(!/分數|總分|評分/.test(await page.textContent('#panelBody')), '出現了自創分數')
    })
    await test('地圖上有體檢點、500 公尺與 1 公里環、項目標記', async () => {
      const m = await page.evaluate(() => ({ point: document.querySelectorAll('.sc-point').length, labels: [...document.querySelectorAll('.sc-ring-label')].map((e) => e.textContent), circles: 0 }))
      assert(m.point === 1 && JSON.stringify(m.labels) === JSON.stringify(['500 公尺', '1 公里']), JSON.stringify(m))
      const n = await page.evaluate(() => { let c = 0, r = []; APP.map.eachLayer((l) => { if (l instanceof L.Circle) r.push(l.getRadius()); else if (l instanceof L.CircleMarker && l.options.radius === 6) c++ }); return { c, r: r.sort((a, b) => a - b) } })
      assert(n.c === 3 && JSON.stringify(n.r) === JSON.stringify([500, 1000]), JSON.stringify(n))
    })
    await test('展開卡片：說明、清單、來源；點清單項目地圖會飛過去', async () => {
      await page.click('[data-sc-toggle="demo_good"]')
      const body = await page.$eval('[data-check="demo_good"] .sc-card-body', (e) => e.textContent.replace(/\s+/g, ' '))
      assert(/500 公尺內算近/.test(body) && /來源：測試資料/.test(body) && /公尺/.test(body), body)
      const before = await page.evaluate(() => APP.map.getCenter())
      await page.click('[data-sc-item="demo_good:2"]')
      await page.waitForTimeout(1500)
      const after = await page.evaluate(() => ({ c: APP.map.getCenter(), z: APP.map.getZoom(), tip: (document.querySelector('.leaflet-tooltip') || {}).textContent }))
      assert(after.z >= 17 && (Math.abs(after.c.lat - before.lat) > 1e-5 || Math.abs(after.c.lng - before.lng) > 1e-5), '地圖沒有移動')
      assert(/測試點/.test(after.tip || ''), '沒有標示該項目：' + after.tip)
      await page.click('[data-sc-toggle="demo_throw"]')
      assert(/暫時查不到（測試錯誤）/.test(await page.textContent('[data-check="demo_throw"] .sc-card-body')), '錯誤說明沒顯示')
    })
    await test('卡片上的「顯示圖層」開關', async () => {
      await page.click('[data-check="demo_good"] [data-sc-layer="demo_points"]')
      await page.waitForFunction(() => PACKUI.isOn('demo_points'))
      await page.waitForSelector('[data-check="demo_good"].open [data-sc-layer].on')
      assert(/隱藏圖層/.test(await page.textContent('[data-check="demo_good"] [data-sc-layer]')), '按鈕文字沒有變')
      await page.waitForTimeout(500)
      assert((await canvasInk(page)) > 0, '圖層沒有畫出來')
      await shot(page, 'desktop-check-result')
      await page.click('[data-check="demo_good"] [data-sc-layer="demo_points"]')
      await page.waitForFunction(() => !PACKUI.isOn('demo_points'))
      assert((await page.$$('[data-check="demo_bad"] [data-sc-layer]')).length === 0, '沒有對應圖層的卡片不該有開關')
    })
    await test('複製報告文字：內容正確', async () => {
      await page.click('[data-sc-out="copy"]')
      await page.waitForTimeout(200)
      const text = (reportFromClick = await page.evaluate(() => navigator.clipboard.readText()))
      const lines = text.split('\n')
      assert(lines[0] === `地點體檢（${f6(P.lat)}, ${f6(P.lng)}）`, lines[0])
      assert(lines[1] === '位置：臺北市大安區龍圖里（復興段一小段）', lines[1])
      assert(/^TWD97 座標：30\d{4}, 27\d{5}$/.test(lines[2]), lines[2])
      for (const need of ['【測試圖資】', '・最近的測試點：勘估標的距測試點', '・所在統計區：勘估標的位於測試區5。', '・黃燈項目：勘估標的位於測試中潛勢區。', '・紅燈項目：勘估標的位於測試高潛勢區。', '資料來源：測試資料、測試機關', '本結果整理自政府公開圖資，僅供參考，實際情形以各主管機關公告為準。']) assert(text.includes(need), '少了：' + need + '\n' + text)
      assert(!/會出錯|會逾時|查無資料項目/.test(text), '查不到的項目不該進報告\n' + text)
      assert(/體檢日期：\d{4} 年 \d+ 月 \d+ 日/.test(text), text)
    })
    await test('複製連結：網址帶 #check=緯度,經度', async () => {
      await page.click('#scLink')
      await page.waitForTimeout(200)
      const link = await page.evaluate(() => navigator.clipboard.readText())
      assert(link === base + `?packs=_demo#check=${P.lat},${P.lng}`, link)
      assert(page.url().includes(`check=${P.lat},${P.lng}`), '網址列沒有記錄體檢點：' + page.url())
    })
    await test('列印版面：只印體檢結果，含地點、日期、各項結果、來源與免責說明', async () => {
      await page.evaluate(() => { window.print = () => window.dispatchEvent(new Event('beforeprint')) })
      await page.click('[data-sc-out="print"]')
      await page.emulateMedia({ media: 'print' })
      try {
      const v = await page.evaluate(() => ({ app: getComputedStyle(document.querySelector('#app')).display, sheet: getComputedStyle(document.querySelector('#printSheet')).display, text: document.querySelector('#printSheet').innerText }))
      assert(v.app === 'none' && v.sheet === 'block', JSON.stringify([v.app, v.sheet]))
      for (const need of ['地點體檢報告', '臺北市大安區龍圖里（復興段一小段）', '體檢日期', `${f6(P.lat)}, ${f6(P.lng)}`, '紅燈項目', '高潛勢', '勘估標的位於測試高潛勢區。', '會逾時的項目', '資料來源：測試資料、測試機關', '本結果整理自政府公開圖資，僅供參考，實際情形以各主管機關公告為準。']) assert(v.text.includes(need), '列印內容少了：' + need)
      if (SHOTS) {
        await page.pdf({ path: path.join(SHOTS, 'print-report.pdf'), format: 'A4', printBackground: false })
        await page.setViewportSize({ width: 794, height: 1123 })
        await page.screenshot({ path: path.join(SHOTS, 'print-report.png'), fullPage: true })
      }
      } finally { await page.setViewportSize({ width: 1440, height: 900 }); await page.emulateMedia({ media: 'screen' }) }
      assert((await page.evaluate(() => getComputedStyle(document.querySelector('#printSheet')).display)) === 'none', '平常不該看到列印內容')
    })
    await test('取消勾選圖資包：不跑該包；全部取消時顯示提示', async () => {
      await page.click('#panelBody .sc-pack')
      await page.waitForFunction(() => SITECHECK.state.done)
      assert((await page.$$('#panelBody .sc-card')).length === 0, '取消後還有卡片')
      assert(/沒有勾選任何體檢類別/.test(await page.textContent('#scOver')), await page.textContent('#scOver'))
      await page.click('#panelBody .sc-pack')
      await waitChecks(page)
      assert((await page.$$('#panelBody .sc-card')).length === 7, '重新勾選後沒有重跑')
    })
    await test('右鍵選單「體檢這個位置」', async () => {
      await page.evaluate(() => { APP.map.setView([25.05, 121.52], 15, { animate: false }) })
      await page.waitForTimeout(300)
      await clickLatLng(page, 25.05, 121.52, 'right')
      await page.waitForSelector('#ctxMenu:not([hidden])')
      await page.click('#ctxMenu >> text=體檢這個位置')
      await page.waitForFunction(() => Math.abs(SITECHECK.state.pt.lat - 25.05) < 0.001)
      await waitChecks(page)
    })
    await test('快速定位的結果可以直接體檢（卡片與 popup 都有按鈕）', async () => {
      await page.click('#nav [data-panel="locate"]')
      await page.fill('#locQ', '25.0400, 121.5500')
      await page.press('#locQ', 'Enter')
      await page.waitForSelector('#panelBody [data-act="sitecheck"]')
      await page.waitForTimeout(1200)
      await page.evaluate(() => APP.map.eachLayer((l) => { if (l instanceof L.Marker && l.getPopup && l.getPopup() && /定位|經緯度/.test(String(l.getPopup().getContent()))) l.openPopup() }))
      await page.waitForSelector('.leaflet-popup-content [data-act="sitecheck"]')
      await page.click('.leaflet-popup-content [data-act="sitecheck"]')
      await page.waitForFunction(() => Math.abs(SITECHECK.state.pt.lat - 25.04) < 1e-6 && Math.abs(SITECHECK.state.pt.lng - 121.55) < 1e-6)
      assert(await page.evaluate(() => APP.activePanel() === 'sitecheck'), '沒有切到體檢面板')
      await waitChecks(page)
    })
    await test('清除結果', async () => {
      await page.click('#scClear')
      assert((await page.$$('#panelBody .sc-card')).length === 0 && !/check=/.test(page.url()), page.url())
      assert(await page.evaluate(() => document.querySelectorAll('.sc-point').length === 0), '地圖上的體檢點沒清掉')
    })
    await test('整段操作沒有錯誤；行政區查詢打的是國土測繪中心', async () => {
      assert(!errors.length, errors.join('\n'))
      assert(external.some((u) => /api\.nlsc\.gov\.tw\/other\/TownVillagePointQuery/.test(u)) && external.some((u) => u.includes(`TownVillagePointQuery/${f6(P.lng)}/${f6(P.lat)}/4326`)), '沒有查行政區')
    })
    await context.close()
  }
  {
    const { page, context, errors } = await open(base + `?packs=_demo#check=${P.lat},${P.lng}`)
    await test('#check= 連結：打開就重現同一份體檢', async () => {
      await page.waitForSelector('#panelBody .sc-card')
      await waitChecks(page)
      const z = await page.evaluate(() => ({ c: APP.map.getCenter(), z: APP.map.getZoom(), panel: APP.activePanel() }))
      assert(z.panel === 'sitecheck' && z.z === 16 && Math.abs(z.c.lat - P.lat) < 1e-4, JSON.stringify(z))
      const text = await page.evaluate(() => SITECHECK.reportText())
      assert(text === reportFromClick && text.length > 100, '報告內容和點選時不同\n' + text)
      assert(page.url().includes(`check=${P.lat},${P.lng}`), page.url())
      assert(!errors.length, errors.join('\n'))
    })
    await context.close()
  }
  {
    const { page, context, errors } = await open(base + '?packs=nope,_none')
    await test('沒有任何圖資包載入成功：體檢面板顯示清楚的空狀態', async () => {
      await page.click('#nav [data-panel="sitecheck"]')
      const t = await page.textContent('#panelBody')
      assert(/目前沒有可用的體檢項目/.test(t) && /讀不到：nope、_none/.test(t), t)
      await page.click('[data-tool="layers"]')
      assert((await page.$$('#layerBody [data-pack]')).length === 0 && (await page.$$('#layerBody .layer-row')).length >= 20, '圖層面板應只剩原有圖層')
      assert(!errors.length, errors.join('\n'))
      await shot(page, 'desktop-check-empty')
    })
    await context.close()
  }

  // ══ 4. 歷年航照
  console.log('\n歷年航照')
  {
    const { page, context, errors, external } = await open(base + '?packs=_demo#25.033,121.5436,16')
    await page.click('#panelClose').catch(() => {})
    await test('從工具列開啟：左右各一年，預設 2014 對 2025', async () => {
      await page.click('[data-tool="timeline"]')
      await page.waitForSelector('#swipeBar:not([hidden])')
      await page.waitForTimeout(500)
      assert(external.some((u) => /wmts\.nlsc\.gov\.tw\/wmts\/PHOTO2014\/default\/GoogleMapsCompatible\/16\/\d+\/\d+$/.test(u)), '沒有抓 2014 影像')
      assert(external.some((u) => /wmts\/PHOTO2025\/default\/GoogleMapsCompatible\/16\//.test(u)), '沒有抓 2025 影像')
      const tags = await page.$$eval('.swipe-tag', (e) => e.map((x) => x.textContent))
      assert(JSON.stringify(tags) === JSON.stringify(['2014', '2025']), tags.join(','))
      assert(await page.$eval('[data-tool="timeline"]', (e) => e.classList.contains('active')), '工具鈕沒有亮')
    })
    await test('年份清單：92–94 年、2014～2025 共 12 年、最新通用版', async () => {
      const ids = await page.evaluate(() => TIMELINE.years.map((y) => y.id))
      assert(JSON.stringify(ids) === JSON.stringify(['PHOTO1', ...Array.from({ length: 12 }, (_, i) => 'PHOTO' + (2014 + i)), 'PHOTO2']), ids.join(','))
    })
    await test('切換年份（下拉與前後一年按鈕）', async () => {
      await page.selectOption('.swipe-side[data-side="left"] select', { label: '2018 年（民國 107）' })
      await page.waitForTimeout(400)
      assert(external.some((u) => /wmts\/PHOTO2018\//.test(u)), '沒有抓 2018 影像')
      await page.click('.swipe-side[data-side="right"] [data-step="-1"]')
      await page.waitForTimeout(400)
      assert(external.some((u) => /wmts\/PHOTO2024\//.test(u)), '沒有抓 2024 影像')
      const tags = await page.$$eval('.swipe-tag', (e) => e.map((x) => x.textContent))
      assert(JSON.stringify(tags) === JSON.stringify(['2018', '2024']), tags.join(','))
      await page.selectOption('.swipe-side[data-side="left"] select', '0')
      await page.waitForTimeout(300)
      assert(external.some((u) => /wmts\/PHOTO1\//.test(u)), '沒有抓 92–94 年影像')
    })
    await test('拖曳分隔線：左右影像的裁切跟著動，平移地圖後仍對齊', async () => {
      const state = () => page.evaluate(() => { const r = (el) => (el.style.clip.match(/-?[\d.]+/g) || []).map(Number); const o = APP.map.containerPointToLayerPoint([0, 0]); return { ratio: TIMELINE.state.ratio, l: r(document.querySelector('.leaflet-swipeL-pane')), rr: r(document.querySelector('.leaflet-swipeR-pane')), ox: o.x, w: APP.map.getSize().x, handle: document.querySelector('#swipeHandle').style.left } })
      const a = await state()
      assert(Math.abs(a.ratio - 0.5) < 1e-6 && Math.abs(a.l[1] - (a.ox + a.w / 2)) < 1 && Math.abs(a.rr[3] - a.l[1]) < 1e-6, JSON.stringify(a))
      const box = await page.$eval('#swipeHandle', (e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })
      await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x - 300, box.y, { steps: 5 }); await page.mouse.up()
      const b = await state()
      assert(Math.abs(b.ratio - (0.5 - 300 / b.w)) < 0.01 && Math.abs(b.l[1] - (b.ox + b.w * b.ratio)) < 1, JSON.stringify(b))
      await shot(page, 'desktop-timeline')
      await page.evaluate(() => { APP.map.panBy([200, 80], { animate: false }) })
      const c = await state()
      assert(Math.abs(c.l[1] - (c.ox + c.w * c.ratio)) < 1 && c.ox !== b.ox, '平移後裁切沒有更新 ' + JSON.stringify(c))
    })
    await test('左側選單也能開關；關閉後影像移除', async () => {
      await page.click('#nav [data-navact="timeline"]')
      assert(await page.isHidden('#swipeBar') && await page.isHidden('#swipeHandle'), '沒有關掉')
      assert(await page.evaluate(() => document.querySelectorAll('.leaflet-swipeL-pane img, .leaflet-swipeR-pane img').length === 0), '影像沒移除')
      await page.click('#nav [data-navact="timeline"]')
      await page.waitForSelector('#swipeBar:not([hidden])')
      await page.click('#swipeClose')
      assert(await page.isHidden('#swipeBar'), '關閉鈕沒作用')
      assert(!errors.length, errors.join('\n'))
    })
    await context.close()
  }

  // ══ 5. 嵌入模式
  console.log('\n嵌入模式')
  {
    const { page, context, errors } = await open(base + '?packs=_demo&embed=check')
    await test('?embed=check：只有地圖＋地點體檢面板', async () => {
      await page.waitForSelector('#scPick')
      assert(await page.isHidden('#sidebar') && await page.isHidden('.brand') && await page.isHidden('#panelClose'), '選單或品牌列還在')
      assert(await page.isVisible('#panel') && /地點體檢/.test(await page.textContent('#panel .panel-title')), '體檢面板沒開')
      await clickLatLng(page, 25.04, 121.55)
      await waitChecks(page)
      assert((await page.$$('#panelBody .sc-card')).length === 7, '嵌入模式點地圖沒有體檢')
      assert(await page.isHidden('[data-tool="measure"]') && await page.isVisible('[data-tool="layers"]'), '工具列')
      assert(!errors.length, errors.join('\n'))
      await shot(page, 'embed-check')
    })
    await context.close()
  }
  {
    const { page, context, errors } = await open(base + '?packs=_demo&embed=map')
    await test('?embed=map：只有地圖與圖層鈕', async () => {
      await page.waitForSelector('[data-tool="layers"]')
      assert(await page.isHidden('#sidebar') && await page.isHidden('#panel'), '選單或面板還在')
      const tools = await page.$$eval('#toolDock .tool', (els) => els.filter((e) => e.offsetParent).map((e) => e.dataset.tool))
      assert(JSON.stringify(tools) === JSON.stringify(['layers', 'zin', 'zout']), tools.join(','))
      await page.click('[data-tool="layers"]')
      assert((await page.$$('#layerBody [data-pack-layer]')).length === 6, '圖層面板沒有圖資包')
      assert(!errors.length, errors.join('\n'))
      await shot(page, 'embed-map')
    })
    await context.close()
  }

  // ══ 6. 手機寬度
  console.log('\n手機（390x844）')
  {
    const { page, context, errors } = await open(base + '?packs=_demo#check=25.033,121.5436', { viewport: { width: 390, height: 844 }, mobile: true })
    const fits = async (what) => { const s = await noScrollX(page); assert(s.doc <= 390 && s.body <= 390, `${what}出現水平捲動：${JSON.stringify(s)}`) }
    await test('體檢面板：底部抽屜、沒有水平捲動', async () => {
      await waitChecks(page)
      await fits('體檢面板')
      const r = await page.$eval('#panel', (e) => { const b = e.getBoundingClientRect(); return { l: b.left, w: b.width, bottom: Math.round(b.bottom), h: b.height } })
      assert(r.l === 0 && r.w === 390 && r.bottom === 844 && r.h < 844 * 0.7, JSON.stringify(r))
      const over = await page.$$eval('#panelBody *', (els) => els.filter((e) => e.getBoundingClientRect().right > 391).map((e) => e.className).slice(0, 5))
      assert(!over.length, '有元素超出螢幕：' + over.join(','))
      await page.waitForTimeout(900)
      const vis = await page.evaluate(() => { const p = APP.map.latLngToContainerPoint([SITECHECK.state.pt.lat, SITECHECK.state.pt.lng]); return { y: p.y, x: p.x, top: document.querySelector('#panel').getBoundingClientRect().top } })
      assert(vis.y > 40 && vis.y < vis.top - 20 && vis.x > 40 && vis.x < 350, '體檢點被面板蓋住了 ' + JSON.stringify(vis))
      await page.tap('[data-sc-toggle="demo_good"]')
      await shot(page, 'mobile-check')
      await page.$eval('#panelBody', (e) => { e.scrollTop = 420 })
      await shot(page, 'mobile-check-cards')
    })
    await test('圖層面板：全寬、沒有水平捲動', async () => {
      await page.tap('#panelClose')
      await page.tap('[data-tool="layers"]')
      await page.check('[data-pack-layer="demo_towns"]')
      await page.waitForSelector('select[data-theme="demo_towns"]')
      await fits('圖層面板')
      const over = await page.$$eval('#layerBody *', (els) => els.filter((e) => e.offsetParent && e.getBoundingClientRect().right > 391).map((e) => e.className).slice(0, 5))
      assert(!over.length, '有元素超出螢幕：' + over.join(','))
      await page.$eval('#layerBody', (e) => { e.scrollTop = e.scrollHeight })
      await shot(page, 'mobile-layers')
      await page.tap('#layerClose')
    })
    await test('歷年航照：控制列不超出螢幕、可切年份', async () => {
      await page.tap('[data-tool="timeline"]')
      await page.waitForSelector('#swipeBar:not([hidden])')
      await fits('歷年航照')
      const r = await page.$eval('#swipeBar', (e) => { const b = e.getBoundingClientRect(); return { l: b.left, r: b.right } })
      assert(r.l >= 0 && r.r <= 390, JSON.stringify(r))
      const over = await page.$$eval('#swipeBar *, #swipeHandle *', (els) => els.filter((e) => e.offsetParent && (e.getBoundingClientRect().right > 390 || e.getBoundingClientRect().left < 0)).map((e) => e.className || e.tagName).slice(0, 5))
      assert(!over.length, '有元素超出螢幕：' + over.join(','))
      await page.tap('.swipe-side[data-side="left"] [data-step="1"]')
      assert((await page.$eval('.swipe-tag.l', (e) => e.textContent)) === '2015', '年份沒有切換')
      await page.waitForTimeout(600)
      await shot(page, 'mobile-timeline')
      await page.tap('#swipeClose')
      assert(!errors.length, errors.join('\n'))
    })
    await context.close()
  }

  // ══ 7. file:// 直接開
  console.log('\n直接雙擊 index.html（file://）')
  {
    const fileUrl = 'file://' + path.join(ROOT, 'index.html')
    const { page, context, errors } = await open(fileUrl + '?packs=_demo')
    await test('file:// 開啟不報錯，重劃範圍讀得到', async () => {
      await page.waitForSelector('#panelBody [data-rj]', { timeout: 15000 })
      assert(!errors.length, errors.join('\n'))
    })
    await test('file:// 下圖資包、資料集、體檢都能用', async () => {
      await page.evaluate(() => PACKUI.toggle('demo_points', true))
      await page.waitForFunction(() => !!GIS_DATA.demo_points)
      const out = await page.evaluate(async () => (await SITECHECK.run(25.033, 121.5436)).map((r) => r.level).join(','))
      assert(out === 'good,info,warn,bad,na,na,na', out)
      assert((await page.$$('#panelBody .sc-card')).length === 7, '卡片沒出來')
      assert(/^file:.*#.*check=25\.033,121\.5436/.test(page.url()), page.url())
      assert(!errors.length, errors.join('\n'))
    })
    await context.close()
  }
  {
    const { page, context, errors } = await open('file://' + path.join(ROOT, 'index.html'))
    await test('file:// 開正式首頁（不帶參數）不報錯', async () => { await page.waitForSelector('#panelBody [data-rj]', { timeout: 15000 }); await page.waitForTimeout(500); assert(!errors.length, errors.join('\n')) })
    await context.close()
  }

  // ══ 8. 預設向量底圖
  console.log('\n預設向量底圖')
  {
    const { page, context, errors } = await open(base + '?packs=_demo', { vector: true })
    await test('預設底圖（向量）下載入與體檢不報錯', async () => {
      await page.evaluate(() => SITECHECK.run(25.033, 121.5436))
      await page.waitForTimeout(500)
      const real = errors.filter((e) => !/WebGL|webgl/.test(e)) // 無頭瀏覽器沒有顯示卡時 MapLibre 會抱怨，與本次功能無關
      assert(!real.length, real.join('\n'))
      if (real.length !== errors.length) console.log('      （略過 ' + (errors.length - real.length) + ' 則無頭瀏覽器的 WebGL 訊息）')
    })
    await context.close()
  }

  await browser.close()
  server.close()
  const pass = results.filter((r) => r[0]).length, fail = results.length - pass
  console.log(`\n結果：通過 ${pass} 項、失敗 ${fail} 項（共 ${results.length} 項）`)
  if (fail) { console.log('失敗項目：'); for (const r of results.filter((x) => !x[0])) console.log('  ✗ ' + r[1]) }
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(2) })
