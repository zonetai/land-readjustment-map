/* 歷年航照比對：左右兩個年份的正射影像，中間一條可拖曳的分隔線（捲簾）。
 * 影像直接向內政部國土測繪中心 WMTS 索取。掛在 window.APP（js/app.js）上。 */
(function () {
  'use strict'
  const APP = window.APP
  if (!APP || APP.embed) return
  const { map, $, ic, esc, store } = APP
  const URL = (id) => `https://wmts.nlsc.gov.tw/wmts/${id}/default/GoogleMapsCompatible/{z}/{y}/{x}`
  /** 各年影像最細到第幾級不一定相同，先保守用 18 級，再放大就用同一張放大顯示 */
  const MAX_NATIVE_ZOOM = 18
  const YEARS = [
    { id: 'PHOTO1', label: '2003–2005 年（民國 92–94）', short: '2003–05' },
    ...Array.from({ length: 12 }, (_, i) => ({ id: 'PHOTO' + (2014 + i), label: `${2014 + i} 年（民國 ${103 + i}）`, short: String(2014 + i) })),
    { id: 'PHOTO2', label: '最新（通用版，各地拍攝年份不同）', short: '最新' },
  ]
  const idx = (id, fallback) => { const i = YEARS.findIndex((y) => y.id === id); return i < 0 ? fallback : i }
  const T = { on: false, left: idx(store.get('swipeLeft', 'PHOTO2014'), 1), right: idx(store.get('swipeRight', 'PHOTO2025'), 12), ratio: 0.5, layers: { left: null, right: null } }

  const panes = { left: map.createPane('swipeL'), right: map.createPane('swipeR') }
  panes.left.style.zIndex = 250; panes.right.style.zIndex = 251
  panes.left.style.pointerEvents = panes.right.style.pointerEvents = 'none'
  const handle = $('#swipeHandle'), bar = $('#swipeBar')

  function clip() {
    if (!T.on) return
    const size = map.getSize()
    const nw = map.containerPointToLayerPoint([0, 0]), se = map.containerPointToLayerPoint(size)
    const x = nw.x + size.x * T.ratio
    panes.left.style.clip = `rect(${nw.y}px, ${x}px, ${se.y}px, ${nw.x}px)`
    panes.right.style.clip = `rect(${nw.y}px, ${se.x}px, ${se.y}px, ${x}px)`
    handle.style.left = T.ratio * 100 + '%'
  }
  function setSide(side, i) {
    T[side] = (i + YEARS.length) % YEARS.length
    if (T.layers[side]) map.removeLayer(T.layers[side])
    T.layers[side] = L.tileLayer(URL(YEARS[T[side]].id), { pane: side === 'left' ? 'swipeL' : 'swipeR', maxZoom: 20, maxNativeZoom: MAX_NATIVE_ZOOM, attribution: '航照影像 &copy; 內政部國土測繪中心' }).addTo(map)
    store.set(side === 'left' ? 'swipeLeft' : 'swipeRight', YEARS[T[side]].id)
    renderBar(); clip()
  }
  function renderBar() {
    const side = (k, title) => `<div class="swipe-side" data-side="${k}">
      <span class="swipe-side-title">${title}</span>
      <button type="button" class="icon-btn" data-step="-1" aria-label="${title}往前一年" title="往前一年">${ic('chevron-left')}</button>
      <select aria-label="${title}年份" data-year>${YEARS.map((y, i) => `<option value="${i}"${T[k] === i ? ' selected' : ''}>${esc(y.label)}</option>`).join('')}</select>
      <button type="button" class="icon-btn" data-step="1" aria-label="${title}往後一年" title="往後一年">${ic('chevron-right')}</button>
    </div>`
    bar.innerHTML = `${side('left', '左邊')}${side('right', '右邊')}
      <button type="button" class="icon-btn swipe-close" id="swipeClose" title="關閉歷年航照" aria-label="關閉歷年航照">${ic('x')}</button>
      <div class="swipe-hint">拖曳中間的分隔線，比較同一塊地在兩個年份的樣子。影像來源：內政部國土測繪中心。</div>`
    handle.innerHTML = `<span class="swipe-tag l">${esc(YEARS[T.left].short)}</span><span class="swipe-tag r">${esc(YEARS[T.right].short)}</span><div class="swipe-knob">${ic('chevrons-left-right')}</div>`
    bar.querySelectorAll('.swipe-side').forEach((el) => {
      const k = el.dataset.side
      el.querySelector('[data-year]').addEventListener('change', (e) => setSide(k, Number(e.target.value)))
      el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => setSide(k, T[k] + Number(b.dataset.step))))
    })
    $('#swipeClose').addEventListener('click', () => toggle(false))
    APP.refreshIcons()
  }
  function toggle(on) {
    T.on = on === undefined ? !T.on : on
    handle.hidden = bar.hidden = !T.on
    document.body.classList.toggle('swiping', T.on)
    if (T.on) {
      T.ratio = 0.5
      setSide('left', T.left); setSide('right', T.right)
    } else {
      for (const k of ['left', 'right']) { if (T.layers[k]) map.removeLayer(T.layers[k]); T.layers[k] = null }
    }
    APP.renderDock(); APP.renderNav()
  }
  map.on('move zoom resize viewreset', clip)

  // 拖曳分隔線
  let dragging = false
  const moveTo = (clientX) => {
    const r = map.getContainer().getBoundingClientRect()
    T.ratio = Math.max(0.02, Math.min(0.98, (clientX - r.left) / r.width))
    clip()
  }
  handle.addEventListener('pointerdown', (e) => { dragging = true; handle.setPointerCapture(e.pointerId); handle.classList.add('drag'); e.preventDefault() })
  handle.addEventListener('pointermove', (e) => { if (dragging) moveTo(e.clientX) })
  const end = () => { dragging = false; handle.classList.remove('drag') }
  handle.addEventListener('pointerup', end)
  handle.addEventListener('pointercancel', end)
  handle.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    T.ratio = Math.max(0.02, Math.min(0.98, T.ratio + (e.key === 'ArrowLeft' ? -0.03 : 0.03))); clip()
  })
  handle.tabIndex = 0
  handle.setAttribute('role', 'slider')
  handle.setAttribute('aria-label', '航照比對分隔線')

  const entry = { id: 'timeline', label: '歷年航照比對', icon: 'history', active: () => T.on, on: () => toggle() }
  APP.tools.push(entry)
  APP.NAV[0].items.push({ ...entry, label: '歷年航照' })
  APP.renderDock(); APP.renderNav()
  window.TIMELINE = { toggle, setSide, state: T, years: YEARS }
})()
