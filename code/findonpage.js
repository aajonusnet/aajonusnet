(() => {
  // --- simple CSS loader
  function ensureCSS() {
    if (document.getElementById('find-on-page-css')) return;
    const link = document.createElement('link');
    link.id = 'find-on-page-css';
    link.rel = 'stylesheet';
    link.href = '/code/findonpage.css';
    document.head.appendChild(link);
  }

  const state = {
    ui: null, input: null, clearBtn: null, closeBtn: null, nextBtn: null, prevBtn: null, countEl: null,
    activateBtn: null,
    matches: [], current: -1, lastQuery: '',
  };

  function el(tag, attrs={}, text){
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) n.setAttribute(k,v);
    if (text) n.textContent = text;
    return n;
  }

  function isVisible(el) {
    if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) return false;
    if (el.checkVisibility && !el.checkVisibility()) return false;
    if (el.inert) return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
    return true;
  }

  function updatePosition() {
    if (!state.ui || state.ui.hidden) return;

    const vv = window.visualViewport;
    const vh = window.innerHeight;

    const isFocused = document.activeElement === state.input;
    
    // 1. Detect Keyboard/Zoom
    const isKeyboardOpen = isFocused && vv && (vv.height < vh * 0.9);

    if (isKeyboardOpen) {
      // --- MODE A: KEYBOARD OPEN (Layout Pinning) ---
      // We switch to Absolute + 'Top/Left' properties.
      // This is slower than transform but STABLE. It forces the browser 
      // to calculate the input's position correctly during a scroll jump.
      
      state.ui.style.position = 'absolute';
      
      // The Holy Grail: pageTop gives the exact document Y coordinate 
      // of the top of the visible glass.
      // Fallback: pageYOffset + offsetTop
      const visualTop = vv.pageTop || (window.pageYOffset + vv.offsetTop);
      const visualLeft = vv.pageLeft || (window.pageXOffset + vv.offsetLeft);
      const visualWidth = vv.width;

      const barWidth = state.ui.offsetWidth;
      const padding = 12;
      const x = Math.max(0, visualLeft + visualWidth - barWidth - padding);   
      const y = visualTop + 12; // 12px padding from top

      // Apply via Layout properties
      // This prevents the "Phantom Bar" effect because the element actually moves in the DOM flow.
      state.ui.style.top = `${y}px`;
      state.ui.style.left = `${x}px`;
      state.ui.style.right = 'auto';

    } else {
      // --- MODE B: NORMAL READING (Fixed) ---
      state.ui.style.position = 'fixed';
      state.ui.style.top = '12px';
      state.ui.style.right = '12px';
      state.ui.style.left = 'auto';
    }
  }

  function startTracking() {
    if (state.trackingRaf) return;
    const loop = () => {
      updatePosition();
      state.trackingRaf = requestAnimationFrame(loop);
    };
    state.trackingRaf = requestAnimationFrame(loop);
  }
  function stopTracking() {
    if (state.trackingRaf) {
      cancelAnimationFrame(state.trackingRaf);
      state.trackingRaf = null;
    }
  }

  function buildActivate(){
    const btn = document.createElement('button');
    btn.id = 'findx-activate';
    btn.type = 'button';
    btn.className = 'activate-find-on-page';
    btn.style.visibility = 'hidden';
    btn.setAttribute('aria-label','Open Find on Page');
    btn.setAttribute('data-findx-ui','');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>';
    btn.addEventListener('click', () => { openUI(); });
    document.body.appendChild(btn);
    state.activateBtn = btn;
  }

  function buildBar(){
    const bar = document.createElement('div');
    bar.id = 'findx-bar';
    bar.setAttribute('data-findx-ui','');
    bar.setAttribute('role','dialog');
    bar.setAttribute('aria-label','Find on page');
    bar.hidden = true;

    const close = el('button',{ class: 'findx-close', type:'button', 'aria-label':'Close finder', 'data-findx-ui':'' }, '✕');

    const inputWrap = el('div',{ class:'findx-input-wrap', 'data-findx-ui':'' });
    const input = el('input',{
      class:'findx-input', type:'text', placeholder:'Find on page', 'data-findx-ui':'',
      autocomplete:'off', autocapitalize:'off', autocorrect:'off', spellcheck:'false'
    });
    const clear = el('button',{ class:'findx-clear', type:'button', 'aria-label':'Clear search', 'data-findx-ui':'' }, '✕');
    clear.hidden = true;
    inputWrap.append(input, clear);

    const count = el('span',{ class:'findx-count', 'data-findx-ui':'', 'aria-live': 'polite', 'aria-atomic': 'true' }, '0 of 0');
    const prev = el('button',{ class:'findx-btn', type:'button', 'aria-label':'Previous match', 'data-findx-ui':'' }, '▲');
    const next = el('button',{ class:'findx-btn', type:'button', 'aria-label':'Next match', 'data-findx-ui':'' }, '▼');

    bar.append(close, inputWrap, count, prev, next);
    document.body.appendChild(bar);

    Object.assign(state, { ui:bar, input, clearBtn:clear, closeBtn:close, nextBtn:next, prevBtn:prev, countEl:count });

    input.addEventListener('input', () => { performSearch(input.value); toggleClear(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? gotoPrev() : gotoNext(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeUI(); }
    });

    clear.addEventListener('click', () => {
      input.value = '';
      toggleClear();
      performSearch('');
      input.focus({ preventScroll:true });
    });

    next.addEventListener('click', gotoNext);
    prev.addEventListener('click', gotoPrev);
    close.addEventListener('click', closeUI);

    for (const ctl of [close, clear, next, prev]) ctl.addEventListener('dblclick', e => e.preventDefault(), { passive:false });
    
    const safeFocus = (e) => {
      if (e.cancelable) e.preventDefault();
      input.focus({ preventScroll: true });
    };
    input.addEventListener('mousedown', safeFocus);
    input.addEventListener('touchstart', safeFocus, { passive: false });
  }

  function toggleClear(){
    state.clearBtn.hidden = !(state.input.value && state.input.value.length > 0);
  }

  // If global removeHighlights (site-search) exists, we’ll use it.
  // Otherwise, fall back to locally removing mark tags only.
  const maybeRemoveSearchHighlights = () => {
    if (typeof window.removeHighlights === 'function') {
      try { window.removeHighlights(); return; } catch {}
    }
    document.querySelectorAll('mark').forEach((node) => {
      node.outerHTML = node.innerHTML;
    });
  };

  function openUI(){
    maybeRemoveSearchHighlights();
    state.ui.hidden = false;
    if (state.activateBtn) state.activateBtn.style.display = 'none';
    updatePosition();    
    startTracking();
    if (state.input) {
       state.input.focus({ preventScroll:true });
    }
  }

  function closeUI(){
    stopTracking();
    state.ui.hidden = true;
    if (state.activateBtn) state.activateBtn.style.display = 'flex';
    state.input.value = '';
    state.lastQuery = '';
    toggleClear();
    clearHighlights();
    updateCount();
  }

  // --- search
  function performSearch(qRaw){
    const q = (qRaw || '').trim();
    if (q === state.lastQuery) return;
    state.lastQuery = q;

    clearHighlights();
    if (!q) { updateCount(); return; }

    const textNodes = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node){
        if (!node || !node.parentElement) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest('[data-findx-ui]')) return NodeFilter.FILTER_REJECT;
        const tn = node.parentElement.tagName.toLowerCase();
        if (['script', 'style', 'textarea', 'input', 'select', 'button', 'noscript', 'svg'].includes(tn)) {
           return NodeFilter.FILTER_REJECT;
        }
        if (!isVisible(node.parentElement)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    const qLower = q.toLowerCase();
    const created = [];

    for (const tn of textNodes) {
      const text = tn.nodeValue;
      const lower = text.toLowerCase();
      let idx = 0, last = 0, found = false;
      const frag = document.createDocumentFragment();

      while ((idx = lower.indexOf(qLower, last)) !== -1) {
        found = true;
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement('mark');
        mark.className = 'findx-hit';
        mark.setAttribute('data-findx-hit','1');
        mark.textContent = text.slice(idx, idx + qLower.length);
        frag.appendChild(mark);
        created.push(mark);
        last = idx + qLower.length;
      }
      if (found) {
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        tn.parentNode.replaceChild(frag, tn);
      }
    }

    state.matches = created;
    state.current = created.length ? 0 : -1;
    updateCount();
    // Wait for the browser to acknowledge the layout change before measuring
    requestAnimationFrame(() => {
       requestAnimationFrame(() => {
          focusCurrent();
       });
    });
  }
function clearHighlights(){
    if (!state.matches.length) return;
    for (const h of state.matches) {
        if (h.parentNode) {
            h.outerHTML = h.innerHTML;
        }
    }
    state.matches = [];
    state.current = -1;
}

  function updateCount(){
    const total = state.matches.length;
    const current = state.current >= 0 ? state.current + 1 : 0;
    state.countEl.textContent = `${current} of ${total}`;
    const disabled = total === 0;
    state.nextBtn.disabled = disabled;
    state.prevBtn.disabled = disabled;
  }

  function gotoNext(){
    if (!state.matches.length) return;
    state.current = (state.current + 1) % state.matches.length;
    updateCount();
    focusCurrent();
  }

  function gotoPrev(){
    if (!state.matches.length) return;
    state.current = (state.current - 1 + state.matches.length) % state.matches.length;
    updateCount();
    focusCurrent();
  }

  // center the current match, and follow during smooth scroll
  function focusCurrent(){
    for (const el of state.matches) el.classList.remove('findx-current');
    if (state.current < 0 || !state.matches[state.current]) return;

    const el = state.matches[state.current];
    el.classList.add('findx-current');

    const vv = window.visualViewport;
    const rect = el.getBoundingClientRect();
    const elemTopAbs = rect.top + window.pageYOffset;
    const viewportHeight = vv ? vv.height : window.innerHeight;
    const newY = elemTopAbs + rect.height/2 - (viewportHeight / 2);
    const safeY = Math.max(0, newY);

    // Pre-position the bar to its destination BEFORE scrolling (prevents flash on mobile keyboard)
    if (state.ui && state.ui.style.position === 'absolute' && vv) {
      const left = (vv.pageLeft || window.pageXOffset + (vv.offsetLeft || 0)) + vv.width - state.ui.offsetWidth - 12;
      state.ui.style.top = `${safeY + 12}px`;
      state.ui.style.left = `${Math.max(0, left)}px`;
    }
    window.scrollTo({ top: safeY, behavior: 'auto' });
  }

  // boot
  function boot(){
    if (document.querySelector('[data-findx-ui]')) return; // Stop if already exists
    ensureCSS();
    buildActivate();
    buildBar();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updatePosition);
      window.visualViewport.addEventListener('scroll', updatePosition);
    }
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();