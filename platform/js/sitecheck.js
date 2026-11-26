/* 地點體檢：點一個位置，同時跑所有圖資包的體檢項目，每項一張結果卡。
 * 只負責介面；查詢與判斷都在各圖資包的 check.run 與 js/gis-core.js。 */
(function () {
  'use strict'
  const APP = window.APP, GIS = window.GIS
  if (!APP || !GIS || APP.embed === 'map') return
  const { map, $, ic, esc, store, toast } = APP
  const DISCLAIMER = '本結果整理自政府公開圖資，僅供參考，實際情形以各主管機關公告為準。'
  const LEVEL = {
    good: { label: '良好', color: '#16a34a' },
    info: { label: '參考', color: '#64748b' },
    warn: { label: '留意', color: '#d97706' },
    bad: { label: '注意', color: '#dc2626' },
    na: { label: '查不到', color: '#94a3b8' },
  }
  const MAX_ITEM_MARKERS = 30
  const packIcon = (name) => (window.PACKUI ? window.PACKUI.packIcon(name) : name || 'package')

  const S = {
    pt: null, results: new Map(), admin: null, adminState: '', runId: 0, done: false,
    picking: false, cancelled: false, open: new Set(), when: null,
    off: new Set(store.get('checkPacksOff', [])),
  }
  const packs = () => GIS.packs.filter((p) => p.checks.length)
  const checkDef = (id) => GIS.checks.find((c) => c.id === id)
  const active = () => APP.activePanel() === 'sitecheck'
  const ordered = () => packs().flatMap((p) => [...S.results.values()].filter((r) => r.pack === p.id).sort((a, b) => ((checkDef(a.id) || {}).order || 99) - ((checkDef(b.id) || {}).order || 99)))
  const fmtDate = (d) => `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`

  // ── 地圖上的體檢點、環域、項目標記 ─────────────────────────────────────
  const group = L.layerGroup().addTo(map)
  const itemGroup = L.layerGroup().addTo(map)
  const itemMarkers = new Map() // `${checkId}:${i}` → marker
  const pointIcon = L.divIcon({ className: '', html: '<div class="sc-point"></div>', iconSize: [22, 22], iconAnchor: [11, 11] })
  function drawPoint() {
    group.clearLayers(); itemGroup.clearLayers(); itemMarkers.clear()
    if (!S.pt) return
    const ll = [S.pt.lat, S.pt.lng]
    const ring = (r, label) => {
      L.circle(ll, { radius: r, color: APP.BRAND.accent, weight: 1.5, dashArray: '6 6', fill: r === 500, fillOpacity: 0.04, interactive: false }).addTo(group)
      // 環上標示距離（放在正北方）
      L.marker([S.pt.lat + r / 111320, S.pt.lng], { interactive: false, icon: L.divIcon({ className: '', html: `<span class="sc-ring-label">${label}</span>`, iconSize: [0, 0] }) }).addTo(group)
    }
    ring(500, '500 公尺'); ring(1000, '1 公里')
    L.marker(ll, { icon: pointIcon, interactive: false, zIndexOffset: 500 }).addTo(group)
  }
  function drawItems(res) {
    for (const [k, m] of itemMarkers) if (k.startsWith(res.id + ':')) { itemGroup.removeLayer(m); itemMarkers.delete(k) }
    if (res.status !== 'done' || !Array.isArray(res.items)) return
    const color = (LEVEL[res.level] || LEVEL.info).color
    res.items.slice(0, MAX_ITEM_MARKERS).forEach((it, i) => {
      if (!isFinite(it.lat) || !isFinite(it.lng) || it.lat === null || it.lng === null) return
      const m = L.circleMarker([it.lat, it.lng], { radius: 6, color: '#fff', weight: 2, fillColor: color, fillOpacity: 1, bubblingMouseEvents: false })
        .bindTooltip(`${esc(it.label || '')}<span class="sc-tip-sub">${esc(res.name)}${it.dist != null ? '・' + esc(GIS.util.fmtDist(it.dist)) : ''}</span>`, { direction: 'top', className: 'data-tip' })
        .addTo(itemGroup)
      itemMarkers.set(res.id + ':' + i, m)
    })
  }
  function flyToItem(key) {
    const m = itemMarkers.get(key); if (!m) return
    map.flyTo(m.getLatLng(), Math.max(map.getZoom(), 17), { duration: 0.6 })
    for (const x of itemMarkers.values()) { x.setStyle({ radius: 6, weight: 2 }); x.closeTooltip() }
    m.setStyle({ radius: 9, weight: 3 }).bringToFront()
    setTimeout(() => m.openTooltip(), 650)
  }

  // ── 執行 ───────────────────────────────────────────────────────────────
  function run(lat, lng, opt = {}) {
    setPicking(false)
    S.pt = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }
    S.results = new Map(); S.admin = null; S.adminState = 'loading'; S.done = false; S.open = new Set(); S.when = new Date()
    const id = ++S.runId, pt = S.pt
    drawPoint()
    APP.setHashSuffix(`check=${pt.lat},${pt.lng}`)
    if (opt.jump) map.setView([pt.lat, pt.lng], 16, { animate: false })
    else if (map.getZoom() < 14 || !map.getBounds().pad(-0.2).contains([pt.lat, pt.lng])) map.flyTo([pt.lat, pt.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })

    GIS.ctx.admin(pt).then((a) => { if (id === S.runId) { S.admin = a; S.adminState = 'ok'; updateSummary() } }, () => { if (id === S.runId) { S.adminState = 'error'; updateSummary() } })
    const job = GIS.runChecks(pt, {
      filter: (c) => !S.off.has(c.pack),
      onUpdate: (r) => {
        if (id !== S.runId) return
        S.results.set(r.id, { ...r })
        if (r.status !== 'running') { drawItems(r); updateCard(r.id); updateOverview() }
      },
    })
    // runChecks 會同步送出每一項的「查詢中」，此時整個面板畫一次（骨架），之後逐卡更新
    if (active()) APP.rerender('sitecheck'); else APP.openPanel('sitecheck')
    if (APP.isMobile()) setTimeout(() => { if (id === S.runId) keepVisible() }, opt.jump ? 300 : 900)
    job.then(() => { if (id === S.runId) { S.done = true; updateOverview() } })
    return job
  }
  /** 手機上面板是底部抽屜，會蓋住地圖下半部：把體檢點移到上方露出來的那一塊中間 */
  function keepVisible() {
    const panel = $('#panel'), box = map.getContainer().getBoundingClientRect()
    if (!S.pt || panel.hidden) return
    const top = panel.getBoundingClientRect().top - box.top
    if (top <= 80 || top >= box.height) return
    const p = map.latLngToContainerPoint([S.pt.lat, S.pt.lng])
    const dy = p.y - top / 2, dx = p.x - box.width / 2
    if (Math.abs(dy) > 30 || Math.abs(dx) > box.width / 3) map.panBy([dx, dy], { animate: true, duration: 0.3 })
  }
  function clear() {
    S.runId++; S.pt = null; S.results = new Map(); S.admin = null; S.done = false; S.cancelled = false
    drawPoint(); APP.setHashSuffix(''); APP.rerender('sitecheck')
  }
  function setPicking(v) {
    if (v) { APP.exitPickMode(); if (APP.isMeasuring()) APP.stopMeasure() }
    S.picking = v
    map.getContainer().style.cursor = v ? 'crosshair' : ''
  }
  APP.exitPickHooks.push(() => { S.picking = false })
  APP.clickHandlers.push((e) => {
    if (!S.picking) return false
    if (!active() && APP.activePanel()) { setPicking(false); return false } // 已經切到別的功能，不搶它的點擊
    run(e.latlng.lat, e.latlng.lng)
    return true
  })

  // ── 文字輸出 ───────────────────────────────────────────────────────────
  const adminLine = () => (S.admin ? `${S.admin.county}${S.admin.town}${S.admin.village}${S.admin.section ? '（' + S.admin.section + '）' : ''}` : '')
  function reportText() {
    const lines = GIS.reportText(S.pt, ordered(), '地點體檢').split('\n')
    const head = []
    if (adminLine()) head.push('位置：' + adminLine())
    const t = GIS.util.toTWD97(S.pt.lat, S.pt.lng)
    if (t) head.push(`TWD97 座標：${Math.round(t.x)}, ${Math.round(t.y)}`)
    lines.splice(1, 0, ...head)
    lines.push('體檢日期：' + fmtDate(S.when || new Date()), DISCLAIMER)
    return lines.join('\n')
  }
  const shareUrl = () => { const u = new URL(location.href); u.searchParams.delete('panel'); u.hash = ''; return u.href.replace(/#$/, '') + `#check=${S.pt.lat},${S.pt.lng}` }
  function fillPrintSheet() {
    const el = $('#printSheet'); if (!el) return
    if (!S.pt) { el.innerHTML = ''; return }
    const rs = ordered()
    const t = GIS.util.toTWD97(S.pt.lat, S.pt.lng)
    const src = [...new Set(rs.map((r) => r.source).filter(Boolean))]
    el.innerHTML = `
      <div class="ps-head"><div class="ps-brand">${esc(APP.BRAND.name)}</div><h1>我家體檢報告</h1></div>
      <table class="ps-loc">
        <tr><th>位置</th><td>${esc(adminLine() || '（行政區查詢未完成）')}</td><th>體檢日期</th><td>${esc(fmtDate(S.when || new Date()))}</td></tr>
        <tr><th>經緯度</th><td>${S.pt.lat.toFixed(6)}, ${S.pt.lng.toFixed(6)}</td><th>TWD97</th><td>${t ? Math.round(t.x) + ', ' + Math.round(t.y) : '—'}</td></tr>
      </table>
      <p class="ps-sum">${esc(overviewText())}</p>
      ${packs().map((p) => {
        const list = rs.filter((r) => r.pack === p.id)
        if (!list.length) return ''
        return `<h2>${esc(p.name)}</h2><table class="ps-table"><thead><tr><th>項目</th><th>結果</th><th>說明</th></tr></thead><tbody>${list.map((r) => {
          const lv = LEVEL[r.level] || LEVEL.na
          const items = (r.items || []).slice(0, 6).map((it) => `${it.label || ''}${it.value ? '（' + it.value + '）' : ''}${it.dist != null ? ' ' + GIS.util.fmtDist(it.dist) : ''}`).join('；')
          return `<tr><td class="ps-name">${esc(r.name)}</td><td class="ps-lv"><span class="ps-dot" style="background:${lv.color}"></span>${esc(lv.label)}<div>${esc(r.headline || '')}</div></td>
            <td>${esc(r.status === 'done' ? (r.reportText || r.detail || '') : r.status === 'error' ? '暫時查不到這一項，請稍後再試或直接向主管機關查詢。' : '查詢中')}${items ? `<div class="ps-items">${esc(items)}</div>` : ''}</td></tr>`
        }).join('')}</tbody></table>`
      }).join('')}
      <p class="ps-foot">資料來源：${esc(src.join('、') || '—')}</p>
      <p class="ps-foot">燈號說明：良好＝條件佳；參考＝中性資訊；留意、注意＝建議進一步查證；查不到＝該項目這個位置沒有資料或服務暫時連不上。</p>
      <p class="ps-foot ps-disc">${DISCLAIMER}</p>
      <p class="ps-foot">重現這次體檢：${esc(shareUrl())}</p>`
  }
  window.addEventListener('beforeprint', fillPrintSheet)

  // ── 面板 ───────────────────────────────────────────────────────────────
  function counts() {
    const c = { bad: 0, warn: 0, good: 0, info: 0, na: 0, running: 0, total: 0 }
    for (const r of S.results.values()) { c.total++; if (r.status === 'running') c.running++; else c[r.level in LEVEL ? r.level : 'info']++ }
    return c
  }
  function overviewText() {
    const c = counts()
    const parts = [c.bad + c.warn ? `${c.bad + c.warn} 項需注意` : '沒有需要特別注意的項目']
    if (c.na) parts.push(`${c.na} 項查不到`)
    parts.push(`共檢查 ${c.total} 項`)
    return parts.join('，') + '。'
  }
  function overviewHtml() {
    const c = counts()
    if (!c.total) return '<div class="sc-over"><span class="sc-over-main">沒有勾選任何體檢類別</span></div>'
    const attention = c.bad + c.warn
    const pill = (k, n) => (n ? `<span class="sc-pill" style="--c:${LEVEL[k].color}"><i></i>${LEVEL[k].label} ${n}</span>` : '')
    return `<div class="sc-over${c.running ? ' running' : ''}">
      <div class="sc-over-main">${c.running ? `查詢中，還有 ${c.running} 項…` : attention ? `<b>${attention}</b> 項需注意` : '沒有需要特別注意的項目'}${!c.running && c.na ? `<span class="sc-over-sub">・${c.na} 項查不到</span>` : ''}</div>
      <div class="sc-pills">${pill('bad', c.bad)}${pill('warn', c.warn)}${pill('good', c.good)}${pill('info', c.info)}${pill('na', c.na)}</div>
      ${c.running ? `<div class="sc-progress"><span style="width:${Math.round(((c.total - c.running) / c.total) * 100)}%"></span></div>` : ''}
    </div>`
  }
  function summaryHtml() {
    const t = GIS.util.toTWD97(S.pt.lat, S.pt.lng)
    const a = S.admin
    const place = S.adminState === 'loading' ? '<span class="sc-skel" style="width:60%"></span>'
      : a ? `${esc(a.county)}${esc(a.town)}<span class="sc-village">${esc(a.village)}</span>`
      : '這個位置查不到行政區'
    return `<div class="sc-place">${place}</div>
      ${a && a.section ? `<div class="sc-section">${ic('map')}${esc(a.section)}${a.officeName ? `<span>・${esc(a.officeName)}</span>` : ''}</div>` : ''}
      <div class="sc-coords"><span>WGS84　${S.pt.lat.toFixed(6)}, ${S.pt.lng.toFixed(6)}</span>${t ? `<span>TWD97　${Math.round(t.x)}, ${Math.round(t.y)}</span>` : ''}</div>`
  }
  function cardHtml(r) {
    if (r.status === 'running') {
      return `<div class="sc-card loading" data-check="${esc(r.id)}"><div class="sc-card-head"><span class="sc-light"></span><div class="sc-card-main"><div class="sc-name">${esc(r.name)}</div><div class="sc-skel" style="width:${50 + (r.id.length * 7) % 40}%"></div></div></div></div>`
    }
    const lv = LEVEL[r.level] || LEVEL.info
    const def = checkDef(r.id) || {}
    const items = Array.isArray(r.items) ? r.items : []
    const err = r.status === 'error'
    const hasMore = !!(r.detail || items.length || err || r.source || def.layer)
    const isOpen = S.open.has(r.id)
    const layerBtn = def.layer && window.PACKUI && window.PACKUI.exists(def.layer)
      ? `<button type="button" class="sc-layer-btn${window.PACKUI.isOn(def.layer) ? ' on' : ''}" data-sc-layer="${esc(def.layer)}">${ic(window.PACKUI.isOn(def.layer) ? 'eye-off' : 'layers')}${window.PACKUI.isOn(def.layer) ? '隱藏圖層' : '顯示圖層'}</button>` : ''
    return `<div class="sc-card lv-${esc(r.level)}${isOpen ? ' open' : ''}" data-check="${esc(r.id)}" style="--c:${lv.color}">
      <button type="button" class="sc-card-head" data-sc-toggle="${esc(r.id)}"${hasMore ? '' : ' disabled'} aria-expanded="${isOpen}">
        <span class="sc-light" title="${lv.label}"></span>
        <div class="sc-card-main"><div class="sc-name">${esc(r.name)}<span class="sc-lv">${lv.label}</span></div><div class="sc-headline">${esc(r.headline || (err ? '暫時查不到' : ''))}</div></div>
        ${hasMore ? ic('chevron-down', 'sc-chev') : ''}
      </button>
      <div class="sc-card-body">
        ${err ? `<p class="sc-detail">這一項暫時查不到（${esc(r.error || '連線失敗')}），不影響其他項目。可以稍後按「重新體檢」。</p>` : ''}
        ${r.detail ? `<p class="sc-detail">${esc(r.detail)}</p>` : ''}
        ${items.length ? `<ul class="sc-items">${items.map((it, i) => {
          const has = isFinite(it.lat) && isFinite(it.lng) && it.lat != null && it.lng != null && i < MAX_ITEM_MARKERS
          const inner = `<span class="sc-item-main">${esc(it.label || '')}${it.value !== undefined && it.value !== null && it.value !== '' ? `<span class="sc-item-sub">${esc(it.value)}</span>` : ''}</span>${it.dist != null && isFinite(it.dist) ? `<span class="sc-item-dist">${esc(GIS.util.fmtDist(it.dist))}</span>` : ''}`
          return has ? `<li><button type="button" data-sc-item="${esc(r.id)}:${i}" title="在地圖上看這個位置">${inner}</button></li>` : `<li><div>${inner}</div></li>`
        }).join('')}</ul>` : ''}
        ${r.reportText ? `<p class="sc-report">${ic('quote')}<span>${esc(r.reportText)}</span></p>` : ''}
        <div class="sc-card-foot">${r.source ? `<span class="sc-src">來源：${esc(r.source)}</span>` : '<span></span>'}${layerBtn}</div>
      </div>
    </div>`
  }
  function updateCard(id) {
    if (!active()) return
    const el = document.querySelector(`#panelBody [data-check="${CSS.escape(id)}"]`)
    const r = S.results.get(id)
    if (!el || !r) return
    const tmp = document.createElement('div')
    tmp.innerHTML = cardHtml(r)
    const node = tmp.firstElementChild
    node.classList.add('pop')
    el.replaceWith(node)
    bindCards(node)
    APP.refreshIcons()
  }
  function updateOverview() {
    if (!active()) return
    const el = $('#scOver'); if (el) el.innerHTML = overviewHtml()
    document.querySelectorAll('#panelBody [data-sc-out]').forEach((b) => { b.disabled = !S.done })
  }
  function updateSummary() {
    if (!active() || !S.pt) return
    const el = $('#scSummary'); if (el) { el.innerHTML = summaryHtml(); APP.refreshIcons() }
  }
  function bindCards(root) {
    root.querySelectorAll('[data-sc-toggle]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.scToggle
      S.open.has(id) ? S.open.delete(id) : S.open.add(id)
      b.parentElement.classList.toggle('open', S.open.has(id))
      b.setAttribute('aria-expanded', S.open.has(id))
    }))
    root.querySelectorAll('[data-sc-item]').forEach((b) => b.addEventListener('click', () => flyToItem(b.dataset.scItem)))
    root.querySelectorAll('[data-sc-layer]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.scLayer
      window.PACKUI.toggle(id, !window.PACKUI.isOn(id))
      toast(window.PACKUI.isOn(id) ? `已顯示圖層：${window.PACKUI.nameOf(id)}` : `已隱藏圖層：${window.PACKUI.nameOf(id)}`)
    }))
  }
  function render(el) {
    const ps = packs()
    if (!ps.length) {
      el.innerHTML = `<div class="sc-empty">${ic('package-open')}<div class="sc-empty-title">目前沒有可用的體檢項目</div>
        <p class="hint">地點體檢需要的圖資包沒有載入成功${window.GIS_PACK_ERRORS && window.GIS_PACK_ERRORS.length ? `（讀不到：${esc(window.GIS_PACK_ERRORS.join('、'))}）` : ''}。請重新整理頁面；如果還是一樣，請通知網站管理者檢查 packs 資料夾。</p></div>`
      return
    }
    if (!S.pt && !S.cancelled && !S.picking && !APP.isMeasuring()) setPicking(true)
    const all = S.results.size && [...S.results.keys()].every((id) => S.open.has(id))
    el.innerHTML = `
      ${S.pt ? '' : `<div class="sc-hero"><div class="sc-hero-title">點一個位置，一次看完周邊條件</div>
        <p class="hint" style="margin-top:4px">同時檢查${esc(ps.map((p) => p.name).join('、'))}，每一項用燈號告訴你結果，還能複製成文字貼進報告。</p></div>`}
      <div class="btn-row" style="margin-top:${S.pt ? 0 : 12}px">
        <button class="btn${S.picking ? '' : S.pt ? ' btn-ghost' : ''} sc-pick" type="button" id="scPick">${ic('crosshair')}${S.picking ? '請在地圖上點一下…' : S.pt ? '換一個位置' : '在地圖上點選位置'}</button>
        ${S.pt ? `<button class="btn btn-ghost" type="button" id="scRerun" title="重新體檢">${ic('rotate-cw')}</button><button class="btn btn-ghost" type="button" id="scClear" title="清除結果">${ic('trash-2')}</button>` : ''}
      </div>
      ${S.pt ? '' : '<p class="hint">也可以先用「快速定位」找到地址，或在地圖上按右鍵（手機長按）選「體檢這個位置」。</p>'}
      <div class="sc-packs"><span class="sc-packs-label">檢查類別</span>${ps.map((p) => `<label class="sc-pack${S.off.has(p.id) ? '' : ' on'}"><input type="checkbox" data-sc-pack="${esc(p.id)}"${S.off.has(p.id) ? '' : ' checked'}>${ic(packIcon(p.icon))}${esc(p.name)}<em>${p.checks.length}</em></label>`).join('')}</div>
      ${S.pt ? `
        <div class="sc-summary" id="scSummary">${summaryHtml()}</div>
        <div id="scOver">${overviewHtml()}</div>
        <div class="sc-actions">
          <button class="btn btn-sm" type="button" data-sc-out="copy"${S.done ? '' : ' disabled'}>${ic('clipboard-copy')}複製報告文字</button>
          <button class="btn btn-sm btn-ghost" type="button" data-sc-out="print"${S.done ? '' : ' disabled'}>${ic('printer')}列印／存成 PDF</button>
          <button class="btn btn-sm btn-ghost" type="button" id="scLink">${ic('link')}複製連結</button>
        </div>
        ${ps.filter((p) => !S.off.has(p.id)).map((p) => {
          const list = ordered().filter((r) => r.pack === p.id)
          return list.length ? `<div class="sc-group"><div class="sc-group-title">${ic(packIcon(p.icon))}${esc(p.name)}${p === ps.find((x) => !S.off.has(x.id)) ? `<button type="button" class="sc-expand" id="scExpand">${all ? '全部收合' : '全部展開'}</button>` : ''}</div>${list.map(cardHtml).join('')}</div>` : ''
        }).join('')}
        <p class="hint sc-disc">${ic('info')}${DISCLAIMER}體檢點周圍的虛線圈是 500 公尺與 1 公里。</p>` : ''}`
    $('#scPick', el).addEventListener('click', () => { S.cancelled = S.picking; setPicking(!S.picking); APP.rerender('sitecheck') })
    $('#scRerun', el)?.addEventListener('click', () => run(S.pt.lat, S.pt.lng))
    $('#scClear', el)?.addEventListener('click', clear)
    el.querySelectorAll('[data-sc-pack]').forEach((cb) => cb.addEventListener('change', () => {
      cb.checked ? S.off.delete(cb.dataset.scPack) : S.off.add(cb.dataset.scPack)
      store.set('checkPacksOff', [...S.off])
      if (S.pt) run(S.pt.lat, S.pt.lng); else APP.rerender('sitecheck')
    }))
    el.querySelector('[data-sc-out="copy"]')?.addEventListener('click', () => APP.copyText(reportText(), '已複製報告文字，可以直接貼進報告'))
    el.querySelector('[data-sc-out="print"]')?.addEventListener('click', () => { fillPrintSheet(); window.print() })
    $('#scLink', el)?.addEventListener('click', () => APP.copyText(shareUrl(), '已複製連結，開啟後會重現這次體檢'))
    $('#scExpand', el)?.addEventListener('click', () => { S.open = all ? new Set() : new Set(S.results.keys()); APP.rerender('sitecheck') })
    bindCards(el)
  }

  // ── 掛到平台 ───────────────────────────────────────────────────────────
  APP.PANELS.sitecheck = { title: '地點體檢', icon: 'stethoscope', render }
  APP.NAV[0].items.unshift({ id: 'sitecheck', label: '地點體檢', icon: 'stethoscope' })
  const act = { id: 'sitecheck', label: '體檢這個位置', icon: 'stethoscope', on: (lat, lng) => run(lat, lng) }
  APP.pointActions.push(act)
  APP.ctxItems.push(act)
  if (window.PACKUI) window.PACKUI.onChange(() => { if (active() && S.pt) APP.rerender('sitecheck') })
  APP.renderNav()

  const fromHash = () => { const m = location.hash.match(/check=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/); return m ? { lat: Number(m[1]), lng: Number(m[2]) } : null }
  const okPt = (p) => p && p.lat > 20 && p.lat < 27 && p.lng > 116 && p.lng < 124
  const start = fromHash()
  if (okPt(start) && packs().length) run(start.lat, start.lng, { jump: true })
  else if (APP.embed === 'check' || start) APP.openPanel('sitecheck')
  window.addEventListener('hashchange', () => {
    const p = fromHash()
    if (okPt(p) && (!S.pt || Math.abs(p.lat - S.pt.lat) > 1e-6 || Math.abs(p.lng - S.pt.lng) > 1e-6)) run(p.lat, p.lng, { jump: true })
  })

  window.SITECHECK = { run, clear, state: S, reportText, shareUrl }
})()
