(function () {
  var C = window.DINEY || {};
  var $ = function (id) { return document.getElementById(id); };
  var ready = /^https:\/\//.test(C.supabaseUrl || '') && C.supabaseKey && C.supabaseKey.indexOf('COLE_AQUI') < 0 && window.supabase;
  var sb = ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;
  var BUCKET = 'midias', MAX = 50 * 1024 * 1024;
  var items = [], view = 'fotos', isAdmin = false, editing = false;
  var standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  var photos = function () { return items.filter(function (m) { return m.tipo === 'foto'; }); };
  var videos = function () { return items.filter(function (m) { return m.tipo !== 'foto'; }); };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function say(id, t, err) { var n = $(id); if (!n) return; n.textContent = t; n.classList.toggle('err', !!err); }
  function ytId(u) {
    var m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/.exec(u || '');
    return m ? m[1] : null;
  }
  function linkFace(m) {
    var id = ytId(m.url);
    var ig = /instagram\.com/.test(m.url);
    var face = el('div', { class: 'linkface' }, [el('span', { class: 'mono linktag', text: id ? 'YouTube' : ig ? 'Instagram' : 'Vídeo' })]);
    if (!id) return face;
    var img = el('img', { class: 'ytthumb', src: 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg', alt: '' });
    img.addEventListener('error', function () { if (img.parentNode) img.parentNode.replaceChild(face, img); });
    return img;
  }
  function caption(m) {
    if (!m.titulo && !m.cat) return null;
    return el('figcaption', { class: 'cap' }, [el('strong', { text: m.titulo || '' }), el('span', { class: 'mono', text: m.cat || '' })]);
  }
  function delBtn(m) {
    if (!isAdmin) return null;
    var b = el('button', { class: 'del', type: 'button', text: 'Remover' });
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (!b.classList.contains('sure')) {
        b.classList.add('sure'); b.textContent = 'Toque de novo para apagar';
        setTimeout(function () { b.classList.remove('sure'); b.textContent = 'Remover'; }, 3000); return;
      }
      remove(m);
    });
    return b;
  }

  // ---------- Carrossel ----------
  function carousel(list, isVid, src, auto) {
    var track = el('div', { class: 'track', tabindex: '0', 'aria-label': isVid ? 'Vídeos' : 'Fotos' });
    list.forEach(function (m, i) {
      var media;
      if (isVid) {
        var face = m.tipo === 'link' ? linkFace(m)
          : el('video', { src: m.url + '#t=0.1', preload: 'metadata', muted: '', playsinline: '' });
        media = el('button', { class: 'media', type: 'button', 'aria-label': 'Assistir em tela cheia' + (m.titulo ? ': ' + m.titulo : '') },
          [face, el('span', { class: 'playbtn' }, [el('i')])]);
        media.addEventListener('click', function () { playFull(m); });
      } else {
        media = el('button', { class: 'media', type: 'button', 'aria-label': 'Ampliar foto' + (m.titulo ? ': ' + m.titulo : '') },
          [el('img', { src: m.url, alt: m.titulo || 'Foto de ' + (m.cat || 'evento'), loading: i < 3 ? 'eager' : 'lazy' })]);
        media.addEventListener('click', function () { lbOpen(i, src); });
      }
      track.appendChild(el('figure', { class: 'slide' }, [delBtn(m), media, isVid ? caption(m) : (m.titulo ? el('figcaption', { class: 'cap' }, [el('strong', { text: m.titulo })]) : null)]));
    });
    var count = el('span', { class: 'mono count' });
    var prev = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Anterior', text: '‹' });
    var next = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Próximo', text: '›' });
    function step() { var s = track.children[0]; return s ? s.getBoundingClientRect().width + 14 : 300; }
    function upd() {
      var i = Math.min(list.length - 1, Math.round(track.scrollLeft / step()));
      count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
      prev.disabled = track.scrollLeft < 4;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', upd, { passive: true });
    window.addEventListener('resize', upd);
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev.click(); }
    });
    requestAnimationFrame(upd);
    if (auto && list.length > 1) autoPassa(track, step, auto);
    return el('div', { class: 'carousel' + (isVid ? ' vids' : '') }, [track,
      el('div', { class: 'ctrl' }, [count, el('span', { class: 'mono hint', text: 'Arraste para o lado' }), el('div', { class: 'arrows' }, [prev, next])])]);
  }


  // ---------- Vitrines de Serviços (vídeo grande passando sozinho) ----------
  var ICON_YT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z"/></svg>';
  var ICON_IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2Zm0 4.8a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4Zm5.2-9.6a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4Z"/></svg>';
  function igId(u) { var m = /instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/.exec(u || ''); return m ? m[1] : null; }
  var vitStates = [];
  function renderVitrines() {
    vitStates.forEach(function (st) { clearTimeout(st.timer); if (st.obs) st.obs.disconnect(); });
    vitStates = [];
    document.querySelectorAll('.vitrine').forEach(function (box) {
      var cat = box.getAttribute('data-cat');
      var list = items.filter(function (m) { return m.tipo !== 'foto' && (m.cat || '').toLowerCase() === cat.toLowerCase(); });
      var st = { box: box, list: list, idx: 0, timer: null, visible: false };
      vitStates.push(st);
      box.innerHTML = '';
      if (!list.length) {
        box.appendChild(el('div', { class: 'vit-empty' }, [el('div', {}, [
          el('strong', { text: cat === 'Casamento' ? 'Filmes de casamento' : 'Filmes de ' + cat.toLowerCase() }),
          el('span', { class: 'mono', text: 'Em breve' })])]));
        return;
      }
      if ('IntersectionObserver' in window) {
        st.obs = new IntersectionObserver(function (es) {
          var v = es[0].isIntersecting;
          if (v && !st.visible) { st.visible = true; vitShow(st, st.idx); }
          else if (!v && st.visible) { st.visible = false; vitStop(st); }
        }, { threshold: 0.25 });
        st.obs.observe(box);
      } else { st.visible = true; vitShow(st, 0); }
    });
  }
  function vitStop(st) { clearTimeout(st.timer); st.box.innerHTML = ''; }
  function vitNext(st) { if (st.list.length > 1) vitShow(st, (st.idx + 1) % st.list.length); }
  function vitShow(st, i) {
    clearTimeout(st.timer); st.idx = i;
    var m = st.list[i], box = st.box, yt = m.tipo === 'link' ? ytId(m.url) : null, ig = m.tipo === 'link' ? igId(m.url) : null;
    box.innerHTML = '';
    var media = el('div', { class: 'vit-media' }), wait = 15000;
    if (m.tipo === 'video') {
      var v = el('video', { src: m.url, muted: '', autoplay: '', playsinline: '', preload: 'auto' });
      v.muted = true;
      v.addEventListener('ended', function () { st.list.length > 1 ? vitNext(st) : (v.currentTime = 0, v.play()); });
      v.addEventListener('loadeddata', function () { var p = v.play(); if (p && p.catch) p.catch(function () {}); });
      media.appendChild(v); wait = 0;
    } else if (yt) {
      media.appendChild(el('iframe', { src: 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + yt + '&playsinline=1&rel=0&modestbranding=1', title: m.titulo || 'Vídeo do YouTube', allow: 'autoplay; encrypted-media; picture-in-picture', tabindex: '-1' }));
      wait = 25000;
    } else if (ig) {
      media.appendChild(el('iframe', { class: 'ig', src: 'https://www.instagram.com/p/' + ig + '/embed', title: m.titulo || 'Vídeo do Instagram', tabindex: '-1', scrolling: 'no' }));
      wait = 15000;
    } else media.appendChild(linkFace(m));
    box.appendChild(media);
    var open = el('button', { class: 'vit-open', type: 'button', 'aria-label': 'Assistir' + (m.titulo ? ': ' + m.titulo : '') });
    open.addEventListener('click', function () { playFull(m); });
    box.appendChild(open);
    if (m.tipo === 'link') {
      var a = el('a', { class: 'vit-src ' + (yt ? 'yt' : ig ? 'ig' : ''), href: m.url, target: '_blank', rel: 'noopener' });
      a.innerHTML = (yt ? ICON_YT : ig ? ICON_IG : '') ;
      a.appendChild(el('span', { text: yt ? 'Ver no YouTube' : ig ? 'Ver no Instagram' : 'Ver original' }));
      box.appendChild(a);
    }
    var dots = el('div', { class: 'vit-dots' });
    if (st.list.length > 1) st.list.forEach(function (_, j) {
      var d = el('button', { type: 'button', 'aria-label': 'Vídeo ' + (j + 1), 'aria-current': j === i ? 'true' : 'false' });
      d.addEventListener('click', function () { vitShow(st, j); });
      dots.appendChild(d);
    });
    box.appendChild(el('div', { class: 'vit-cap' }, [el('strong', { text: m.titulo || '' }), dots]));
    if (wait && st.list.length > 1) st.timer = setTimeout(function () { vitNext(st); }, wait);
  }


  // Passa sozinho a cada X segundos; se a pessoa mexer, espera um pouco e volta a passar
  var timers = [];
  function autoPassa(track, step, ms, onMove) {
    var parado = 0, visivel = true;
    ['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(function (ev) { track.addEventListener(ev, function () { parado = Date.now(); }, { passive: true }); });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; }, { threshold: 0.3 }).observe(track);
    var t = setInterval(function () {
      if (!visivel || document.hidden || Date.now() - parado < 12000 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: step(), behavior: 'smooth' });
    }, ms);
    timers.push(t);
  }
  function vimeoId(u) { var m = /vimeo\.com\/(?:video\/)?(\d+)/.exec(u || ''); return m ? m[1] : null; }
  function fonte(m) {
    var u = m.url || '';
    if (ytId(u)) return { nome: 'YouTube', icone: ICON_YT, cls: 'yt' };
    if (/instagram\.com/.test(u)) return { nome: 'Instagram', icone: ICON_IG, cls: 'ig' };
    return { nome: 'Assistir', icone: '', cls: '' };
  }
  // Carrossel de vídeos: o que está na tela toca sozinho (sem som); tocando, abre onde o vídeo está
  function videoCarousel(list) {
    var track = el('div', { class: 'track', tabindex: '0', 'aria-label': 'Vídeos' });
    var slides = list.map(function (m) {
      var box = el('div', { class: 'vmedia' });
      var f = fonte(m);
      var abre = m.tipo === 'link'
        ? el('a', { class: 'vopen', href: m.url, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Abrir no ' + f.nome + (m.titulo ? ': ' + m.titulo : '') })
        : el('button', { class: 'vopen', type: 'button', 'aria-label': 'Assistir em tela cheia' });
      if (m.tipo !== 'link') abre.addEventListener('click', function () { playFull(m); });
      var src = m.tipo === 'link' ? el('a', { class: 'vsrc ' + f.cls, href: m.url, target: '_blank', rel: 'noopener noreferrer' }) : null;
      if (src) { src.innerHTML = f.icone; src.appendChild(el('span', { text: f.nome })); }
      var fig = el('figure', { class: 'slide vslide' }, [box, abre, src, el('figcaption', { class: 'vcap' }, [el('strong', { text: m.titulo || '' })])]);
      fig._m = m; fig._box = box; parado(fig);
      return fig;
    });
    slides.forEach(function (f) { track.appendChild(f); });
    function parado(fig) {
      var m = fig._m, box = fig._box; box.innerHTML = '';
      if (m.tipo === 'video') box.appendChild(el('video', { src: m.url + '#t=0.1', preload: 'metadata', muted: '', playsinline: '' }));
      else box.appendChild(linkFace(m));
      box.appendChild(el('span', { class: 'playbtn' }, [el('i')]));
      fig._ativo = false;
    }
    function tocando(fig) {
      if (fig._ativo) return; fig._ativo = true;
      var m = fig._m, box = fig._box, yt = ytId(m.url), vm = vimeoId(m.url), ig = igId(m.url);
      if (m.tipo === 'video') { var v = box.querySelector('video'); if (v) { v.muted = true; v.loop = true; var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); } return; }
      if (window.__DEMO) return;
      var url = yt ? 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&mute=1&controls=0&loop=1&playlist=' + yt + '&playsinline=1&rel=0&modestbranding=1'
        : vm ? 'https://player.vimeo.com/video/' + vm + '?background=1&autoplay=1&muted=1&loop=1'
        : ig ? 'https://www.instagram.com/p/' + ig + '/embed' : null;
      if (!url) return;
      box.innerHTML = ''; box.appendChild(el('iframe', { src: url, title: m.titulo || 'Vídeo', allow: 'autoplay; encrypted-media; picture-in-picture', tabindex: '-1', loading: 'lazy', class: ig ? 'ig' : '' }));
    }
    function step() { var s = track.children[0]; return s ? s.getBoundingClientRect().width + 14 : 300; }
    var atual = -1, visivel = false;
    function upd() {
      var i = Math.max(0, Math.min(list.length - 1, Math.round(track.scrollLeft / step())));
      count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
      prev.disabled = track.scrollLeft < 4; next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (i !== atual || !visivel) { slides.forEach(function (f, j) { if (j !== i || !visivel) { if (f._ativo) { if (f._m.tipo === 'video') { var v = f._box.querySelector('video'); if (v) v.pause(); f._ativo = false; } else parado(f); } } }); }
      atual = i; if (visivel) tocando(slides[i]);
    }
    var count = el('span', { class: 'mono count' });
    var prev = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Vídeo anterior', text: '‹' });
    var next = el('button', { class: 'arrow', type: 'button', 'aria-label': 'Próximo vídeo', text: '›' });
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    var deb; track.addEventListener('scroll', function () { clearTimeout(deb); deb = setTimeout(upd, 160); }, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { visivel = es[0].isIntersecting; upd(); }, { threshold: 0.35 }).observe(track);
    else visivel = true;
    requestAnimationFrame(upd);
    if (list.length > 1) autoPassa(track, step, 15000);
    return el('div', { class: 'carousel vids vcar' }, [track,
      el('div', { class: 'ctrl' }, [count, el('span', { class: 'mono hint', text: 'Arraste para o lado' }), el('div', { class: 'arrows' }, [prev, next])])]);
  }

  function render() {
    timers.forEach(clearInterval); timers = [];
    var fb = $('fotos-car'); fb.innerHTML = '';
    if (photos().length) fb.appendChild(carousel(photos(), false, null, 7000));
    else fb.appendChild(el('div', { class: 'empty' }, [el('strong', { text: 'As fotos chegam em breve' }), el('p', { text: 'Assim que o Diney publicar, elas aparecem aqui.' })]));
    var vb = $('videos-car'); vb.innerHTML = '';
    if (videos().length) vb.appendChild(videoCarousel(videos()));
    else vb.appendChild(el('div', { class: 'empty' }, [el('strong', { text: 'Os vídeos chegam em breve' })]));
  }

  function load() {
    if (!sb) { render(); renderVitrines(); return; }
    sb.from('midias').select('*').order('created_at', { ascending: false }).then(function (r) {
      if (!r.error) items = (r.data || []).filter(function (m) { return m && typeof m.url === 'string' && /^https:\/\/[^\s"'<>]+$/.test(m.url) && ['foto', 'video', 'link'].indexOf(m.tipo) >= 0; });
      render(); renderVitrines();
    });
  }


  // ---------- Conteúdo editável pelo dono (textos, logo, WhatsApp) ----------
  var site = {}, defaults = {};
  document.querySelectorAll('[data-edit]').forEach(function (n) { defaults[n.getAttribute('data-edit')] = n.textContent; });
  function setIcons(url) {
    var ic = url || 'icons/icon-192.png', big = url || location.origin + '/icons/icon-512.png';
    document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]').forEach(function (l) { l.href = ic; });
    var man = document.querySelector('link[rel="manifest"]');
    if (url && man) {
      var nome = (site.textos && (site.textos['nome-1'] || '') + ' ' + (site.textos['nome-2'] || '')).trim() || 'Diney de Souza';
      man.href = 'data:application/manifest+json,' + encodeURIComponent(JSON.stringify({
        id: '/', name: nome, short_name: nome, start_url: location.origin + '/', scope: location.origin + '/',
        display: 'standalone', background_color: '#0c0a0b', theme_color: '#0c0a0b',
        icons: [{ src: big, sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: big, sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
      }));
    }
  }
  function applySite() {
    var t = site.textos || {};
    document.querySelectorAll('[data-edit]').forEach(function (n) {
      var k = n.getAttribute('data-edit');
      n.textContent = (t[k] != null && t[k] !== '') ? t[k] : defaults[k];
    });
    var logo = site.logo;
    $('brand-logo').hidden = !logo; $('brand-txt').hidden = !!logo;
    if (logo) { $('brand-logo').src = logo; $('brand-logo').alt = $('brand-txt').textContent; }
    setIcons(site.icone || null);
    setWA(site.whatsapp); setIG(site.instagram);
    var fv = site.fundoVideo && site.fundoVideo.url, bg = $('fim-bg');
    if (fv && /^https:\/\/[^\s"'<>]+$/.test(fv)) {
      if (bg.getAttribute('src') !== fv) { bg.src = fv; }
      bg.hidden = false; bg.muted = true;
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) { var pp = bg.play(); if (pp && pp.catch) pp.catch(function () {}); }
    } else { bg.hidden = true; bg.removeAttribute('src'); }
    renderServicos(); renderPassos(); renderVitrines();
  }
  function loadSite() {
    if (!sb) return;
    sb.from('site').select('data').eq('id', 1).maybeSingle().then(function (r) {
      if (!r.error && r.data) { site = r.data.data || {}; applySite(); }
    });
  }


  // ---------- Serviços e passos (o dono adiciona e remove) ----------
  var DEF_SERV = [
    { cat: 'Casamento', rotulo: 'Casamentos', titulo: 'O filme do casal', texto: 'Do making of à última música da festa. Os votos, os olhares e as lágrimas ficam guardados com som e imagem de cinema.', itens: ['Trailer do casamento para compartilhar', 'Filme completo com cerimônia e festa', 'Ensaio pré-casamento e imagens aéreas com drone'] },
    { cat: '15 anos', rotulo: '15 anos', titulo: 'A noite da debutante', texto: 'A entrada, a valsa, a troca do sapato, os amigos. Um filme leve e emocionante para ela assistir de novo daqui a muitos anos.', itens: ['Clipe vertical para Instagram e TikTok', 'Trailer da festa', 'Ensaio pré-15 e vídeo para exibir na festa'] }
  ];
  var DEF_PASSOS = [
    { t: 'Conversa', p: 'Você me conta a história, a data e o local. Eu monto uma proposta.' },
    { t: 'Roteiro', p: 'Combinamos os momentos importantes, as músicas e o cronograma do dia.' },
    { t: 'Gravação', p: 'No dia, eu filmo com discrição. Você só precisa aproveitar.' },
    { t: 'Edição', p: 'Corte, cor e som tratados com cuidado, quadro a quadro.' },
    { t: 'Estreia', p: 'Você recebe o filme em alta qualidade, pronto para assistir e compartilhar.' }
  ];
  function servicos() { return (site.servicos && site.servicos.length) ? site.servicos : DEF_SERV; }
  function passos() { return site.passos ? site.passos : DEF_PASSOS; }
  function ed(tag, cls, field, text) {
    var n = el(tag, cls ? { class: cls } : {}); n.setAttribute('data-f', field); n.textContent = text || '';
    if (editing) { n.setAttribute('contenteditable', 'true'); n.setAttribute('spellcheck', 'true'); }
    return n;
  }
  function xBtn(label, fn, cls) {
    var b = el('button', { class: 'x-btn edit-ctl' + (cls ? ' ' + cls : ''), type: 'button', 'aria-label': label, text: cls ? 'Remover serviço' : '×' });
    b.addEventListener('click', fn); return b;
  }
  function addBtn(text, fn, cls) { var b = el('button', { class: 'add-btn edit-ctl' + (cls ? ' ' + cls : ''), type: 'button', text: '+ ' + text }); b.addEventListener('click', fn); return b; }
  function liItem(text) {
    var li = el('li'), sp = ed('span', '', 'item', text);
    li.appendChild(sp); li.appendChild(xBtn('Remover linha', function () { li.remove(); }));
    return li;
  }
  function svcCard(sv) {
    var art = el('article', { class: 'service' }); art.setAttribute('data-cat', sv.cat || '');
    var top = el('div', { class: 'svc-top' }, [ed('span', 'mono', 'rotulo', sv.rotulo), xBtn('Remover serviço', function () { art.remove(); }, 'svc-del')]);
    var ul = el('ul'); (sv.itens || []).forEach(function (t) { ul.appendChild(liItem(t)); });
    art.appendChild(top);
    art.appendChild(ed('h3', '', 'titulo', sv.titulo));
    art.appendChild(ed('p', '', 'texto', sv.texto));
    art.appendChild(ul);
    art.appendChild(addBtn('Adicionar linha', function () { var li = liItem('Nova linha'); ul.appendChild(li); li.querySelector('[data-f]').focus(); }));
    var vit = el('div', { class: 'vitrine', 'aria-label': 'Filmes de ' + (sv.rotulo || '') }); vit.setAttribute('data-cat', sv.cat || sv.rotulo || '');
    art.appendChild(vit);
    return art;
  }
  function renderServicos() {
    var box = $('services'); box.innerHTML = '';
    servicos().forEach(function (sv) { box.appendChild(svcCard(sv)); });
    box.appendChild(addBtn('Adicionar serviço', function () {
      var card = svcCard({ cat: '', rotulo: 'Novo serviço', titulo: 'Título do serviço', texto: 'Escreva aqui como é esse trabalho.', itens: ['O que está incluído'] });
      box.insertBefore(card, this); card.querySelector('[data-f="rotulo"]').focus();
    }, 'add-svc'));
  }
  function stepLi(ps) {
    var li = el('li');
    li.appendChild(ed('strong', '', 't', ps.t)); li.appendChild(ed('p', '', 'p', ps.p));
    li.appendChild(xBtn('Remover passo', function () { li.remove(); }));
    return li;
  }
  function renderPassos() {
    var ol = $('steps'); ol.innerHTML = '';
    passos().forEach(function (ps) { ol.appendChild(stepLi(ps)); });
    var add = el('li', { class: 'add-li' }, [addBtn('Adicionar passo', function () { var li = stepLi({ t: 'Novo passo', p: 'Explique este passo.' }); ol.insertBefore(li, add); li.querySelector('[data-f]').focus(); })]);
    ol.appendChild(add);
  }
  function collectEstrutura() {
    var sv = [];
    document.querySelectorAll('#services .service').forEach(function (art) {
      var g = function (f) { var n = art.querySelector('[data-f="' + f + '"]'); return n ? n.textContent.replace(/\s+/g, ' ').trim() : ''; };
      var itens = []; art.querySelectorAll('[data-f="item"]').forEach(function (n) { var t = n.textContent.replace(/\s+/g, ' ').trim(); if (t) itens.push(t); });
      var rot = g('rotulo');
      if (!rot && !g('titulo')) return;
      sv.push({ cat: art.getAttribute('data-cat') || rot, rotulo: rot, titulo: g('titulo'), texto: g('texto'), itens: itens });
    });
    var ps = [];
    document.querySelectorAll('#steps li:not(.add-li)').forEach(function (li) {
      var t = li.querySelector('[data-f="t"]').textContent.replace(/\s+/g, ' ').trim(), p = li.querySelector('[data-f="p"]').textContent.replace(/\s+/g, ' ').trim();
      if (t || p) ps.push({ t: t, p: p });
    });
    return { servicos: sv, passos: ps };
  }


  // ---------- Foto ampliada ----------
  var lbIdx = 0, tx = null, lbList = function () { return photos(); };
  function lbShow() { var p = lbList()[lbIdx]; if (!p) return; $('lb-img').src = p.url; $('lb-img').alt = p.titulo || 'Foto'; }
  function lbOpen(i, list) { lbList = list || function () { return photos(); }; lbIdx = i; lbShow(); $('lb').hidden = false; $('lb-x').focus(); }
  function lbClose() { $('lb').hidden = true; }
  function lbStep(d) { var n = lbList().length; lbIdx = (lbIdx + d + n) % n; lbShow(); }
  $('lb-x').addEventListener('click', lbClose);
  $('lb-pv').addEventListener('click', function () { lbStep(-1); });
  $('lb-nx').addEventListener('click', function () { lbStep(1); });
  $('lb').addEventListener('click', function (e) { if (e.target === $('lb')) lbClose(); });
  $('lb').addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  $('lb').addEventListener('touchend', function (e) {
    if (tx === null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) lbStep(dx < 0 ? 1 : -1);
  });

  // ---------- Vídeo em tela cheia ----------
  var vfs = $('vfs'), vv = $('vfs-v'), vf = $('vfs-f');
  function playFull(m) {
    var yt = m.tipo === 'link' ? ytId(m.url) : null;
    if (m.tipo === 'link' && !yt) { window.open(m.url, '_blank', 'noopener'); return; }
    vfs.hidden = false; $('vfs-x').focus();
    if (yt) {
      vv.hidden = true; vf.hidden = false;
      vf.src = 'https://www.youtube-nocookie.com/embed/' + yt + '?autoplay=1&playsinline=1&rel=0&modestbranding=1';
    } else {
      vf.hidden = true; vv.hidden = false; vv.src = m.url;
      var p = vv.play(); if (p && p.catch) p.catch(function () {});
    }
    try {
      if (vfs.requestFullscreen) vfs.requestFullscreen().catch(function () {});
      else if (vv.webkitEnterFullscreen) vv.webkitEnterFullscreen();
    } catch (e) {}
  }
  function closeFull() {
    vv.pause(); vv.removeAttribute('src'); vv.load(); vf.removeAttribute('src'); vfs.hidden = true;
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {});
  }
  $('vfs-x').addEventListener('click', closeFull);
  vv.addEventListener('webkitendfullscreen', closeFull);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && $('lb').hidden) return;
    if (!$('lb').hidden) {
      if (e.key === 'Escape') lbClose();
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(1);
    } else if (!vfs.hidden) closeFull();
    else if (!$('appmodal').hidden) $('appmodal').hidden = true;
  });

  // ---------- Instalar app ----------
  var installEvt = null;
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); installEvt = e; });
  var dismissed = false;
  try { dismissed = localStorage.getItem('diney-app') === '1'; } catch (e) {}
  if (!dismissed && !standalone) setTimeout(function () {
    if (isAdmin) return;
    $('appbar').hidden = false;
    setTimeout(function () { $('appbar').classList.add('saindo'); setTimeout(function () { $('appbar').hidden = true; $('appbar').classList.remove('saindo'); }, 650); }, 7000);
  }, 1500);
  function hideBar() { $('appbar').hidden = true; try { localStorage.setItem('diney-app', '1'); } catch (e) {} }
  $('app-no').addEventListener('click', hideBar);
  $('app-yes').addEventListener('click', function () {
    if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(function () { installEvt = null; hideBar(); }); return; }
    var ua = navigator.userAgent || '';
    var ios = /iPhone|iPad|iPod/i.test(ua), android = /Android/i.test(ua);
    $('os-ios').hidden = android; $('os-android').hidden = ios;
    $('appmodal').hidden = false; $('app-ok').focus();
  });
  $('app-ok').addEventListener('click', function () { $('appmodal').hidden = true; hideBar(); });
  $('appmodal').addEventListener('click', function (e) { if (e.target === $('appmodal')) $('appmodal').hidden = true; });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});

  // ---------- Timecode ----------
  var tc = $('tc'), t0 = performance.now();
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function p2(n) { return String(n).padStart(2, '0'); }
  function tick(now) {
    var f = Math.floor((now - t0) / (1000 / 24)), s = Math.floor(f / 24);
    tc.textContent = p2(Math.floor(s / 3600)) + ':' + p2(Math.floor(s / 60) % 60) + ':' + p2(s % 60) + ':' + p2(f % 24);
    if (!reduce) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // ---------- Contato ----------
  var WA = '';
  function setWA(num) {
    var d = String(num || C.whatsapp || '559191864725').replace(/\D/g, '');
    WA = 'https://wa.me/' + d; document.querySelectorAll('a.zap, #wa').forEach(function (a) { a.href = WA; });
    var mostra = site.mostrarWhatsapp === true;
    document.querySelectorAll('a.zap, #wa').forEach(function (a) { a.hidden = !mostra; });
    $('orc-top').hidden = mostra;
    var l = d.replace(/^55/, ''); $('wa-num').textContent = '(' + l.slice(0, 2) + ') ' + l.slice(2, l.length - 4) + '-' + l.slice(-4);
  }
  function setIG(u) {
    u = String(u || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9._]{1,30}$/.test(u)) u = '';
    $('ig').hidden = !u;
    if (u) { $('ig').href = 'https://instagram.com/' + encodeURIComponent(u); $('ig-user').textContent = '@' + u; }
  }
  setWA(site.whatsapp);

  renderServicos(); renderPassos();
  render();
  load();

  // ---------- Câmeras de cinema 3D (realistas, girando devagar) ----------
  (function () {
    var cams = document.querySelectorAll('.cam3d');
    if (!window.THREE || !cams.length) { cams.forEach(function (c) { c.hidden = true; }); return; }
    var T = window.THREE, calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function canvasTex(w, h, draw) { var c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; return t; }
    function ruido(w, h, fn) { return canvasTex(w, h, function (x) { var im = x.createImageData(w, h); for (var i = 0; i < w * h; i++) { var v = fn(i % w, (i / w) | 0); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; } x.putImageData(im, 0, 0); }); }
    function escovado() { var row = []; for (var y = 0; y < 256; y++) row[y] = 110 + Math.random() * 60; var t = ruido(256, 256, function (x, y) { return row[y] + Math.random() * 25; }); t.wrapS = t.wrapT = T.RepeatWrapping; t.encoding = T.LinearEncoding; return t; }
    function granulado() { var t = ruido(256, 256, function () { return 90 + Math.random() * 120; }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(3, 3); t.encoding = T.LinearEncoding; return t; }
    function serrilha() { var t = ruido(256, 16, function (x) { return (x % 8) < 4 ? 230 : 40; }); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(6, 1); t.encoding = T.LinearEncoding; return t; }
    function escalaFoco() {
      var t = canvasTex(1024, 96, function (x, w, h) {
        x.fillStyle = '#0d0d0f'; x.fillRect(0, 0, w, h); x.fillStyle = '#f2f2f2'; x.font = '600 34px Arial, sans-serif'; x.textAlign = 'center';
        var n = ['∞', '30', '15', '10', '7', '5', '4', '3', '2.5', '2', '1.6', '1.3', '1.1', '0.9', '0.8'];
        n.forEach(function (v, i) { var cx = 40 + i * 68; x.fillText(v, cx, 48); x.fillRect(cx - 1, 60, 2, 22); });
        x.fillStyle = '#d9b37a'; x.fillRect(0, 88, w, 4);
      }); t.wrapS = T.RepeatWrapping; return t;
    }
    function roundedBox(w, h, d, r) {
      var sh = new T.Shape(), x = -w / 2 + r, y = -h / 2 + r, W = w - 2 * r, H = h - 2 * r;
      sh.moveTo(x, y - r); sh.lineTo(x + W, y - r); sh.quadraticCurveTo(x + W + r, y - r, x + W + r, y);
      sh.lineTo(x + W + r, y + H); sh.quadraticCurveTo(x + W + r, y + H + r, x + W, y + H + r);
      sh.lineTo(x, y + H + r); sh.quadraticCurveTo(x - r, y + H + r, x - r, y + H);
      sh.lineTo(x - r, y); sh.quadraticCurveTo(x - r, y - r, x, y - r);
      var g = new T.ExtrudeGeometry(sh, { depth: d - 2 * r * 0.6, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: 4, curveSegments: 10 });
      g.center(); return g;
    }
    function estudio(renderer) {
      var env = new T.Scene();
      var sala = new T.Mesh(new T.BoxGeometry(20, 12, 20), new T.MeshBasicMaterial({ color: 0x141012, side: T.BackSide })); env.add(sala);
      function softbox(w, h, cor, x, y, z, ry) { var m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: cor })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); }
      softbox(6, 3, 0xfff3e0, 4, 5, 5); softbox(3, 6, 0xffd9a0, -7, 1, 2); softbox(8, 1.2, 0xffffff, 0, 5.9, -3); softbox(2, 4, 0x9fb7ff, 6, 0, -6);
      var pm = new T.PMREMGenerator(renderer); var tex = pm.fromScene(env, 0.03).texture; pm.dispose(); return tex;
    }
    function sombra() {
      return new T.Mesh(new T.PlaneGeometry(4, 1.6), new T.MeshBasicMaterial({ transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false, map: canvasTex(256, 128, function (x, w, h) {
        var g = x.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,.65)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, w, h);
      }) }));
    }

    function camera3D(canvas, lado) {
      var r = new T.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      r.outputEncoding = T.sRGBEncoding; r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.2; r.physicallyCorrectLights = true;
      var scene = new T.Scene(); scene.environment = estudio(r);
      var cam = new T.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 1.1, 9.2); cam.lookAt(0, 0.15, 0);
      var key = new T.DirectionalLight(0xfff0dc, 2.8); key.position.set(4, 6, 6); scene.add(key);
      var rim = new T.DirectionalLight(0xd9b37a, 3.2); rim.position.set(-5, 3, -4); scene.add(rim);
      scene.add(new T.HemisphereLight(0x8899aa, 0x1a1412, 0.45));
      var fill = new T.PointLight(0xbfd4ff, 1.2, 30); fill.position.set(2, -1, 5); scene.add(fill);

      var esc = escovado(), gran = granulado();
      var metal = new T.MeshStandardMaterial({ color: 0x232327, metalness: 0.85, roughness: 0.38, roughnessMap: esc, bumpMap: gran, bumpScale: 0.004, envMapIntensity: 1.3 });
      var metal2 = new T.MeshStandardMaterial({ color: 0x34343a, metalness: 0.95, roughness: 0.24, roughnessMap: esc, envMapIntensity: 1.5 });
      var borracha = new T.MeshStandardMaterial({ color: 0x111113, metalness: 0, roughness: 0.85, bumpMap: gran, bumpScale: 0.012 });
      var grip = new T.MeshStandardMaterial({ color: 0x141416, metalness: 0, roughness: 0.8, bumpMap: serrilha(), bumpScale: 0.03 });
      var aco = new T.MeshStandardMaterial({ color: 0xb9b9be, metalness: 1, roughness: 0.22 });
      var ouro = new T.MeshStandardMaterial({ color: 0xd9b37a, metalness: 1, roughness: 0.28 });
      var vidro = new T.MeshPhysicalMaterial({ color: 0x0a1020, metalness: 0.1, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, reflectivity: 1, envMapIntensity: 2.2 });
      var revest = new T.MeshStandardMaterial({ color: 0x1a0f2a, metalness: 0.9, roughness: 0.15, emissive: 0x220a40, emissiveIntensity: 0.6 });

      var g = new T.Group();
      // corpo
      var corpo = new T.Mesh(roundedBox(2.3, 1.55, 1.25, 0.12), metal); g.add(corpo);
      var placa = new T.Mesh(roundedBox(2.32, 0.18, 1.27, 0.05), metal2); placa.position.y = -0.74; g.add(placa);
      for (var i = 0; i < 6; i++) { var aleta = new T.Mesh(new T.BoxGeometry(0.03, 0.9, 0.02), metal2); aleta.position.set(-0.75 + i * 0.12, 0.05, 0.64); g.add(aleta); }
      [[0.95, 0.6], [0.95, -0.55], [-0.95, 0.6], [-0.95, -0.55]].forEach(function (p) { var pz = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.02, 12), aco); pz.rotation.x = Math.PI / 2; pz.position.set(p[0], p[1], 0.64); g.add(pz); });
      var logo = new T.Mesh(new T.PlaneGeometry(0.62, 0.12), new T.MeshBasicMaterial({ transparent: true, map: canvasTex(256, 50, function (x, w, h) { x.fillStyle = '#d9b37a'; x.font = '600 30px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('D·S CINE', w / 2, h / 2 + 2); }) }));
      logo.position.set(0.45, 0.45, 0.645); g.add(logo);
      // encaixe e lente
      var mount = new T.Mesh(new T.CylinderGeometry(0.62, 0.62, 0.14, 64), aco); mount.rotation.z = Math.PI / 2; mount.position.x = 1.22; g.add(mount);
      var perfil = [[0.52, 0], [0.52, 0.25], [0.56, 0.27], [0.56, 0.75], [0.6, 0.78], [0.6, 1.25], [0.66, 1.3], [0.66, 1.55], [0.6, 1.58]].map(function (q) { return new T.Vector2(q[0], q[1]); });
      var lente = new T.Mesh(new T.LatheGeometry(perfil, 64), metal); lente.rotation.z = -Math.PI / 2; lente.position.x = 1.28; g.add(lente);
      var serrilhado = new T.InstancedMesh(new T.BoxGeometry(0.42, 0.035, 0.05), borracha, 72), dummy = new T.Object3D();
      for (var k = 0; k < 72; k++) { var ang = k / 72 * Math.PI * 2; dummy.position.set(1.28 + 0.52, Math.cos(ang) * 0.575, Math.sin(ang) * 0.575); dummy.rotation.set(ang, 0, 0); dummy.updateMatrix(); serrilhado.setMatrixAt(k, dummy.matrix); }
      g.add(serrilhado);
      var escala = new T.Mesh(new T.CylinderGeometry(0.585, 0.585, 0.16, 96, 1, true), new T.MeshStandardMaterial({ map: escalaFoco(), metalness: 0.3, roughness: 0.5 }));
      escala.rotation.z = Math.PI / 2; escala.position.x = 1.28 + 1.02; g.add(escala);
      [0.46, 0.36, 0.25].forEach(function (rr, i) {
        var lam = new T.Mesh(new T.CircleGeometry(rr, 48), new T.MeshPhysicalMaterial({ color: [0x16304a, 0x2a1640, 0x103828][i], metalness: 0.2, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.55, envMapIntensity: 2.5 }));
        lam.rotation.y = Math.PI / 2; lam.position.x = 2.6 - i * 0.12; g.add(lam);
      });
      var anelOuro = new T.Mesh(new T.TorusGeometry(0.605, 0.018, 12, 80), ouro); anelOuro.rotation.y = Math.PI / 2; anelOuro.position.x = 2.05; g.add(anelOuro);
      var coat = new T.Mesh(new T.CircleGeometry(0.52, 64), revest); coat.rotation.y = Math.PI / 2; coat.position.x = 2.82; g.add(coat);
      var olho = new T.Mesh(new T.SphereGeometry(0.62, 48, 24, 0, Math.PI * 2, 0, 0.55), vidro); olho.rotation.z = -Math.PI / 2; olho.position.x = 2.34; g.add(olho);
      // para-sol (matte box)
      var hood = new T.Mesh(new T.CylinderGeometry(0.95, 0.72, 0.5, 4, 1, true), borracha); hood.material = borracha.clone(); hood.material.side = T.DoubleSide;
      hood.rotation.z = -Math.PI / 2; hood.rotation.x = Math.PI / 4; hood.position.x = 3.08; g.add(hood);
      // chapa furada em cima
      var chapa = new T.Mesh(roundedBox(1.7, 0.06, 0.9, 0.02), metal2); chapa.position.y = 0.81; g.add(chapa);
      for (var fx = 0; fx < 7; fx++) for (var fz = 0; fz < 3; fz++) { var furo = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.065, 12), borracha); furo.position.set(-0.66 + fx * 0.22, 0.815, -0.28 + fz * 0.28); g.add(furo); }
      // empunhadura lateral e botões
      var punho = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1.05, 32), grip); punho.position.set(0.55, -0.1, -0.78); g.add(punho);
      var rec = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 0.03, 24), new T.MeshStandardMaterial({ color: 0xb3221a, metalness: 0.2, roughness: 0.35 })); rec.rotation.x = Math.PI / 2; rec.position.set(-0.6, -0.45, 0.645); g.add(rec);
      [0, 1, 2].forEach(function (i) { var bt = new T.Mesh(new T.BoxGeometry(0.14, 0.07, 0.03), metal2); bt.position.set(-0.3 + i * 0.2, -0.45, 0.64); g.add(bt); });
      // alça
      var alca = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-0.8, 0.78, 0), new T.Vector3(-0.7, 1.15, 0), new T.Vector3(0.6, 1.15, 0), new T.Vector3(0.75, 0.78, 0)]), 40, 0.06, 12), borracha); g.add(alca);
      // monitor lateral
      var tela = canvasTex(256, 160, function (x, w, h) {
        var gr = x.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#3a2a1c'); gr.addColorStop(.5, '#7a5a3a'); gr.addColorStop(1, '#1e1a24'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 2; x.strokeRect(w * .1, h * .12, w * .8, h * .76);
        x.fillStyle = '#e0483e'; x.beginPath(); x.arc(22, 20, 6, 0, 7); x.fill(); x.fillStyle = '#fff'; x.font = '16px monospace'; x.fillText('REC  4K 24', 34, 26);
      });
      var mon = new T.Group();
      mon.add(new T.Mesh(roundedBox(0.95, 0.62, 0.08, 0.04), metal));
      var scr = new T.Mesh(new T.PlaneGeometry(0.84, 0.52), new T.MeshBasicMaterial({ map: tela, toneMapped: false })); scr.position.z = 0.045; mon.add(scr);
      mon.position.set(-0.3, 1.45, 0.25); mon.rotation.y = 0.35; g.add(mon);
      var haste = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.3, 10), aco); haste.position.set(-0.3, 1.2, 0.2); g.add(haste);
      // bateria atrás
      var bat = new T.Mesh(roundedBox(0.22, 1.2, 1.0, 0.06), metal2); bat.position.x = -1.3; g.add(bat);
      var faixa = new T.Mesh(new T.BoxGeometry(0.23, 0.08, 1.01), ouro); faixa.position.set(-1.3, 0.3, 0); g.add(faixa);
      // luz de gravação
      var tally = new T.Mesh(new T.SphereGeometry(0.05, 16, 12), new T.MeshBasicMaterial({ color: 0xff2a1f, toneMapped: false })); tally.position.set(1.0, 0.68, 0.45); g.add(tally);
      // trilhos embaixo
      [-0.25, 0.25].forEach(function (z) { var rod = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 3.4, 16), aco); rod.rotation.z = Math.PI / 2; rod.position.set(0.9, -0.98, z); g.add(rod); });
      var pe = new T.Mesh(roundedBox(1.0, 0.18, 0.9, 0.05), metal); pe.position.y = -0.88; g.add(pe);

      g.scale.setScalar(0.62); g.position.x = -0.62;
      var piv = new T.Group(); piv.add(g); scene.add(piv);
      var chao = sombra(); chao.rotation.x = -Math.PI / 2; chao.position.y = -1.05; scene.add(chao);

      var base = lado === 'l' ? -0.9 : Math.PI + 0.9;
      function size() { var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
      size(); window.addEventListener('resize', size);
      var on = true, t0 = performance.now() - (lado === 'l' ? 0 : 6000);
      function draw(now) {
        var t = (now - t0) / 1000;
        if (!calm) {
          piv.rotation.y = base + Math.sin(t * 0.18) * 0.7;
          piv.rotation.x = 0.06 + Math.sin(t * 0.13) * 0.04;
          piv.position.y = Math.sin(t * 0.35) * 0.05;
          tally.visible = Math.sin(t * 2.2) > -0.2;
        } else piv.rotation.y = base;
        r.render(scene, cam);
        if (on && !calm) requestAnimationFrame(draw);
      }
      requestAnimationFrame(draw);
      if ('IntersectionObserver' in window) new IntersectionObserver(function (es) {
        var v = es[0].isIntersecting; if (v && !on) { on = true; requestAnimationFrame(draw); } else if (!v) on = false;
      }).observe(canvas);
    }
    try { camera3D($('cam-l'), 'l'); camera3D($('cam-r'), 'r'); }
    catch (e) { cams.forEach(function (c) { c.hidden = true; }); }
  })();

  loadSite();
})();
