(function () {
  'use strict';
  var C = window.DINEY || {};
  var $ = function (id) { return document.getElementById(id); };
  var ok = /^https:\/\//.test(C.supabaseUrl || '') && C.supabaseKey && C.supabaseKey.indexOf('COLE_AQUI') < 0 && window.supabase;
  var sb = ok ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;
  var BUCKET = 'midias', MAX = 50 * 1024 * 1024;
  var site = {}, pedidos = [], midias = [], filtro = 'todos', tipoM = 'foto', canal = null, logado = false;

  var DEF_TEXTOS = { 'nome-1': 'Diney', 'nome-2': 'de Souza', 'fotos-titulo': 'Fotos', 'videos-titulo': 'Vídeos', 'servicos-titulo': 'Serviços', 'proc-titulo': 'Como funciona', 'cont-titulo': 'Fale com o Diney' };
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

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) { if (k === 'text') n.textContent = attrs[k]; else n.setAttribute(k, attrs[k]); }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function say(id, t, err) { var n = $(id); n.textContent = t; n.classList.toggle('err', !!err); }
  var toastT;
  function toast(t) { var n = $('toast'); n.textContent = t; n.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { n.hidden = true; }, 2600); }
  function limpa(v, max) { return String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
  function fmtData(d) { if (!d) return ''; var a = String(d).split('-'); return a[2] + '/' + a[1] + '/' + a[0]; }
  function seguro(fn) { return function () { if (!logado) { show('login'); return; } return fn.apply(this, arguments); }; }
  function confirmar(btn, texto, acao) {
    if (!btn.classList.contains('sure')) {
      var antes = btn.textContent; btn.classList.add('sure'); btn.textContent = texto;
      setTimeout(function () { btn.classList.remove('sure'); btn.textContent = antes; }, 3000); return;
    }
    acao();
  }

  // ---------- Telas ----------
  var telas = ['login', 'home', 'pedidos', 'pedido', 'faturamento', 'fotos', 'videos', 'textos', 'contatos'];
  function show(v) {
    if (!logado) v = 'login';
    telas.forEach(function (t) { $('v-' + t).hidden = t !== v; });
    $('sair').hidden = !logado;
    if (v === 'pedidos') abrirPedidos();
    if (v === 'faturamento') { renderFat(); loadPedidos().then(renderFat); }
    if (v === 'fotos') loadMidias();
    if (v === 'videos') { loadMidias(); loadSite().then(fundoPrev); }
    if (v === 'textos') fillTextos();
    if (v === 'contatos') fillContatos();
    if (location.hash !== '#' + v && v !== 'login') history.replaceState(null, '', '#' + v);
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-go]'); if (b) show(b.getAttribute('data-go'));
  });
  $('ver-site').href = C.siteUrl || '../';

  // ---------- Entrar / sair ----------
  if (!sb) { say('login-msg', 'O painel ainda não foi configurado (falta o config.js).', true); $('entrar').disabled = true; return; }
  function entrou(user) {
    if (!user) { logado = false; if (canal) { sb.removeChannel(canal); canal = null; } show('login'); return; }
    sb.rpc('is_admin').then(function (r) {
      if (r.data !== true) {
        sb.auth.signOut(); logado = false; show('login');
        say('login-msg', 'Essa conta não tem acesso ao painel.', true); return;
      }
      logado = true;
      loadSite(); loadPedidos(); loadMidias(); ouvirPedidos();
      var h = (location.hash || '').slice(1); if (h === 'pedido') h = 'pedidos';
      show(telas.indexOf(h) > 0 ? h : 'home');
    });
  }
  sb.auth.getSession().then(function (r) { entrou(r.data.session && r.data.session.user); });
  sb.auth.onAuthStateChange(function (ev, s) { if (ev === 'SIGNED_OUT') entrou(null); });
  var tentativas = 0, bloqueadoAte = 0;
  $('f-login').addEventListener('submit', function (e) {
    e.preventDefault();
    if (Date.now() < bloqueadoAte) { say('login-msg', 'Muitas tentativas. Espere um minuto.', true); return; }
    $('entrar').disabled = true; say('login-msg', 'Entrando...');
    sb.auth.signInWithPassword({ email: $('email').value.trim().toLowerCase(), password: $('senha').value }).then(function (r) {
      $('entrar').disabled = false; $('senha').value = '';
      if (r.error) {
        tentativas++; if (tentativas >= 5) { bloqueadoAte = Date.now() + 60000; tentativas = 0; }
        say('login-msg', 'E-mail ou senha errados.', true); return;
      }
      say('login-msg', ''); entrou(r.data.user);
    });
  });
  $('sair').addEventListener('click', function () { Promise.resolve(sb.auth.signOut()).then(function () { entrou(null); }, function () { entrou(null); }); });

  // ---------- Dados do site ----------
  function loadSite() {
    return sb.from('site').select('data').eq('id', 1).maybeSingle().then(function (r) { site = (r.data && r.data.data) || {}; });
  }
  function saveSite(patch) {
    return loadSite().then(function () {
      var next = Object.assign({}, site, patch);
      return sb.from('site').update({ data: next }).eq('id', 1).select('data');
    }).then(function (r) {
      if (r.error || !r.data || !r.data.length) return false;
      site = r.data[0].data; return true;
    });
  }
  function servicos() { return (site.servicos && site.servicos.length) ? site.servicos : DEF_SERV; }

  // ---------- Pedidos ----------
  function badge() {
    var n = pedidos.filter(function (p) { return !p.visto && p.status !== 'recusado'; }).length;
    $('badge').hidden = !n; $('badge').textContent = n > 99 ? '99+' : String(n);
    document.title = (n ? '(' + n + ') ' : '') + 'Painel · Diney de Souza';
  }
  function loadPedidos() {
    return sb.from('agendamentos').select('*').order('created_at', { ascending: false }).limit(500).then(function (r) {
      if (r.error) return;
      pedidos = r.data || []; badge(); renderFat(); if (!$('v-pedidos').hidden) renderPedidos();
    });
  }
  function ouvirPedidos() {
    if (canal) return;
    try {
      canal = sb.channel('pedidos-painel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agendamentos' }, function () {
        loadPedidos(); toast('Chegou um pedido novo!');
      }).subscribe();
    } catch (e) {}
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && logado) loadPedidos(); });
  function waCliente(p) {
    var d = String(p.telefone || '').replace(/\D/g, ''); if (d.length < 10) return null;
    if (d.indexOf('55') !== 0 || d.length < 12) d = '55' + d;
    var t = 'Olá, ' + limpa(p.nome, 60).split(' ')[0] + '! Aqui é o Diney de Souza. Recebi seu pedido de orçamento' + (p.evento ? ' para ' + limpa(p.evento, 40).toLowerCase() : '') + (p.data ? ' no dia ' + fmtData(p.data) : '') + '. Vamos conversar?';
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(t);
  }
  function quando(d) {
    var dt = new Date(d), min = Math.round((Date.now() - dt) / 60000);
    if (min < 1) return 'agora'; if (min < 60) return 'há ' + min + ' min';
    var h = Math.round(min / 60); if (h < 24) return 'há ' + h + ' h';
    return dt.toLocaleDateString('pt-BR');
  }
  function renderPedidos() {
    var box = $('ped-list'); box.innerHTML = '';
    var lista = pedidos.filter(function (p) { return p.status !== 'recusado'; });
    if (!lista.length) { box.appendChild(el('div', { class: 'empty', text: 'Nenhum pedido ainda. Quando alguém pedir orçamento no site, aparece aqui.' })); return; }
    lista.forEach(function (p) {
      var row = el('button', { class: 'prow', type: 'button' }, [
        el('span', { class: 'dot' + (p.visto ? ' lido' : ''), 'aria-hidden': 'true' }),
        el('span', { class: 'pinfo' }, [
          el('b', { text: limpa(p.evento, 40) + (p.data ? ' · ' + fmtData(p.data) : '') }),
          el('span', { text: limpa(p.nome, 120) + ' · ' + quando(p.created_at) })
        ]),
        p.status === 'aceito' ? el('span', { class: 'tag-ok', text: 'Aceito' }) : null,
        el('span', { class: 'seta', text: '›', 'aria-hidden': 'true' })
      ]);
      row.setAttribute('aria-label', (p.visto ? '' : 'Novo: ') + limpa(p.evento, 40) + ', ' + limpa(p.nome, 120));
      row.addEventListener('click', function () { abrirDetalhe(p); });
      box.appendChild(row);
    });
  }
  function abrirPedidos() { renderPedidos(); loadPedidos(); }
  function abrirDetalhe(p) {
    $('d-tag').textContent = p.visto ? 'Pedido' : 'Pedido novo';
    $('d-evento').textContent = limpa(p.evento, 40) || 'Evento';
    $('d-quando').textContent = 'Chegou em ' + new Date(p.created_at).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });
    $('d-nome').textContent = limpa(p.nome, 120);
    $('d-tel').textContent = limpa(p.telefone, 30) || '—';
    $('d-data').textContent = p.data ? fmtData(p.data) : 'Não informada';
    $('d-local').textContent = limpa(p.local, 200) || 'Não informado';
    $('d-msg-box').hidden = !p.msg; $('d-msg').textContent = String(p.msg || '').slice(0, 2000);
    var wa = waCliente(p); $('d-wa').hidden = !wa; $('d-semtel').hidden = !!wa; if (wa) $('d-wa').href = wa;
    atual = p; decideUI();
    show('pedido');
    if (!p.visto) sb.from('agendamentos').update({ visto: true }).eq('id', p.id).then(function (r) { if (!r.error) { p.visto = true; badge(); } });
  }

  // ---------- Aceitar / recusar e faturamento ----------
  var atual = null;
  function brl(v) { return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function lerValor(t) {
    t = String(t || '').replace(/[^\d,\.]/g, '');
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
    var n = parseFloat(t); return isFinite(n) && n >= 0 && n < 10000000 ? Math.round(n * 100) / 100 : null;
  }
  function decideUI() {
    var p = atual, aceito = p.status === 'aceito';
    $('d-decide').hidden = aceito; $('d-aceito').hidden = !aceito;
    $('d-valor').value = p.valor ? String(p.valor).replace('.', ',') : '';
    $('d-aceito-valor').textContent = p.valor ? brl(p.valor) : 'Sem valor';
    $('d-tag').textContent = aceito ? 'Trabalho aceito' : (p.visto ? 'Pedido' : 'Pedido novo');
    say('d-msg2', '');
  }
  $('d-aceitar').addEventListener('click', seguro(function () {
    var v = lerValor($('d-valor').value);
    if ($('d-valor').value.trim() && v === null) { say('d-msg2', 'Valor inválido. Ex.: 3500 ou 3.500,00', true); return; }
    $('d-aceitar').disabled = true;
    sb.from('agendamentos').update({ status: 'aceito', valor: v, visto: true }).eq('id', atual.id).select('*').then(function (r) {
      $('d-aceitar').disabled = false;
      if (r.error || !r.data || !r.data.length) { say('d-msg2', 'Não salvou. Tente de novo.', true); return; }
      Object.assign(atual, r.data[0]); decideUI(); toast('Trabalho aceito' + (v ? ': ' + brl(v) : '')); loadPedidos();
    });
  }));
  $('d-editar-valor').addEventListener('click', function () { $('d-aceito').hidden = true; $('d-decide').hidden = false; $('d-valor').focus(); });
  $('d-recusar').addEventListener('click', seguro(function () {
    confirmar($('d-recusar'), 'Toque de novo para recusar', function () {
      sb.from('agendamentos').update({ status: 'recusado', visto: true }).eq('id', atual.id).then(function (r) {
        if (r.error) { say('d-msg2', 'Não salvou. Tente de novo.', true); return; }
        atual.status = 'recusado'; toast('Pedido recusado'); loadPedidos(); show('pedidos');
      });
    });
  }));
  function renderFat() {
    var hoje = new Date(), aceitos = pedidos.filter(function (p) { return p.status === 'aceito'; });
    function mesDo(p) { var d = new Date((p.data || String(p.created_at).slice(0, 10)) + 'T12:00:00'); return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear(); }
    var total = aceitos.reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0);
    var mes = aceitos.filter(mesDo).reduce(function (a, p) { return a + (Number(p.valor) || 0); }, 0);
    $('f-mes').textContent = brl(mes); $('f-total').textContent = 'Total de todos os trabalhos: ' + brl(total);
    $('c-novos').textContent = pedidos.filter(function (p) { return p.status === 'novo' || !p.status; }).length;
    $('c-aceitos').textContent = aceitos.length;
    $('c-recusados').textContent = pedidos.filter(function (p) { return p.status === 'recusado'; }).length;
    $('tile-fat').textContent = aceitos.length ? aceitos.length + ' aceitos · ' + brl(total) : 'Aceitos e quanto faturou';
    var box = $('f-lista'); box.innerHTML = '';
    if (!aceitos.length) { box.appendChild(el('div', { class: 'empty', text: 'Nenhum trabalho aceito ainda. Abra um pedido e toque em Aceitar.' })); return; }
    aceitos.slice().sort(function (a, b) { return String(a.data || '9').localeCompare(String(b.data || '9')); }).forEach(function (p) {
      var b = el('button', { class: 'job', type: 'button' }, [
        el('span', { class: 'ji' }, [el('b', { text: limpa(p.evento, 40) + (p.data ? ' · ' + fmtData(p.data) : '') }), el('span', { text: limpa(p.nome, 120) })]),
        el('span', { class: 'jv', text: p.valor ? brl(p.valor) : '—' })
      ]);
      b.addEventListener('click', function () { abrirDetalhe(p); });
      box.appendChild(b);
    });
  }

  // ---------- Fotos e vídeos ----------
  var MAX_LINKS = 30;
  function loadMidias() {
    return sb.from('midias').select('*').order('created_at', { ascending: false }).limit(2000).then(function (r) {
      if (r.error) return;
      midias = (r.data || []).filter(function (m) { return /^https:\/\//.test(m.url || ''); });
      renderFotos(); renderVideos(); contadores();
    });
  }
  function fotosL() { return midias.filter(function (m) { return m.tipo === 'foto'; }); }
  function videosL() { return midias.filter(function (m) { return m.tipo !== 'foto'; }).slice().reverse(); }
  function contadores() {
    var f = fotosL().length, v = videosL().length;
    $('tile-fotos').textContent = f ? f + ' no site' : 'Colocar e tirar';
    $('tile-videos').textContent = v ? v + ' de ' + MAX_LINKS + ' links' : 'Por link';
  }
  function origem(u) { return /youtu\.?be/.test(u) ? { n: 'YouTube', c: 'yt' } : /instagram\.com/.test(u) ? { n: 'Instagram', c: 'ig' } : { n: 'Link', c: '' }; }
  function renderFotos() {
    var list = fotosL(), box = $('fotos-list'); box.innerHTML = ''; $('n-fotos').textContent = list.length;
    if (!list.length) { box.appendChild(el('div', { class: 'empty', text: 'Nenhuma foto ainda. Toque em "Adicionar fotos".' })); return; }
    list.forEach(function (m) {
      var del = el('button', { class: 'del', type: 'button', text: 'Remover' });
      del.addEventListener('click', seguro(function () { confirmar(del, 'Toque de novo', function () { removeMidia(m); }); }));
      box.appendChild(el('figure', { class: 'item' }, [el('div', { class: 'th' }, [el('img', { src: m.url, alt: '', loading: 'lazy' })]), el('figcaption', {}, [del])]));
    });
  }
  function renderVideos() {
    var list = videosL(), box = $('links'); box.innerHTML = '';
    list.forEach(function (m, i) {
      var o = origem(m.url), del = el('button', { class: 'del', type: 'button', text: 'Remover' });
      del.addEventListener('click', seguro(function () { confirmar(del, 'Toque de novo', function () { removeMidia(m); }); }));
      box.appendChild(el('div', { class: 'lnk' }, [
        el('div', { class: 'lnk-top' }, [el('b', { text: 'Link ' + (i + 1) + (m.titulo ? ' · ' + limpa(m.titulo, 80) : '') }), del]),
        el('div', {}, [el('span', { class: 'src ' + o.c, text: o.n }), document.createTextNode('  ' + limpa(m.cat, 40))]),
        el('a', { class: 'url', href: m.url, target: '_blank', rel: 'noopener noreferrer', text: m.url })
      ]));
    });
    var cheio = list.length >= MAX_LINKS;
    $('novo-n').textContent = cheio ? 'Limite de ' + MAX_LINKS + ' links' : 'Link ' + (list.length + 1);
    ['v-url', 'v-cat', 'v-titulo', 'v-add'].forEach(function (id) { $(id).disabled = cheio; });
  }
  function removeMidia(m) {
    sb.from('midias').delete().eq('id', m.id).then(function (r) {
      if (r.error) { toast('Não foi possível remover.'); return; }
      if (m.path) sb.storage.from(BUCKET).remove([m.path]);
      toast('Removido do site.'); loadMidias();
    });
  }
  function shrink(file) {
    return new Promise(function (res) {
      if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return res(file);
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var max = 2000, w = img.naturalWidth, h = img.naturalHeight, s = Math.min(1, max / Math.max(w, h));
        if (s === 1 && file.size < 1.2 * 1024 * 1024) { URL.revokeObjectURL(url); return res(file); }
        var c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); res(b ? new File([b], 'foto.jpg', { type: 'image/jpeg' }) : file); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(file); };
      img.src = url;
    });
  }
  var EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };
  function up(blob) {
    var ext = EXT[blob.type]; if (!ext) return Promise.resolve(null);
    var path = Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
    return sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false })
      .then(function (r) { return r.error ? null : { path: path, url: sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl }; });
  }
  // Muitas fotos de uma vez: envia de 3 em 3
  $('m-file').addEventListener('change', seguro(function (e) {
    var files = Array.prototype.slice.call(e.target.files || []).filter(function (f) { return /^image\//.test(f.type); }); e.target.value = '';
    if (!files.length) return;
    var total = files.length, feitos = 0, ok = 0, falhas = 0, fila = files.slice();
    $('m-bar').hidden = false; $('m-bar-i').style.width = '3%'; say('m-msg', 'Enviando 0 de ' + total + '...');
    function uma() {
      var f = fila.shift(); if (!f) return Promise.resolve();
      return shrink(f).then(function (file) {
        if (file.size > MAX) return null;
        return up(file).then(function (u) { if (!u) return null; return sb.from('midias').insert({ tipo: 'foto', url: u.url, path: u.path, titulo: '', cat: 'Fotos' }).then(function (r) { return r.error ? null : true; }); });
      }).then(function (res) {
        feitos++; if (res) ok++; else falhas++;
        $('m-bar-i').style.width = Math.round(feitos / total * 100) + '%'; say('m-msg', 'Enviando ' + feitos + ' de ' + total + '...');
        return uma();
      });
    }
    Promise.all([uma(), uma(), uma()]).then(function () {
      $('m-bar').hidden = true; loadMidias();
      say('m-msg', ok + ' foto(s) no site.' + (falhas ? ' ' + falhas + ' não foram (arquivo grande ou com erro).' : ''), !!falhas);
    });
  }));
  $('v-add').addEventListener('click', seguro(function () {
    var u = $('v-url').value.trim();
    if (videosL().length >= MAX_LINKS) { say('v-msg', 'Você já tem ' + MAX_LINKS + ' links. Remova um para colocar outro.', true); return; }
    if (!/^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be|instagram\.com)\/[^\s"'<>]+$/i.test(u)) { say('v-msg', 'Cole um link do Instagram ou do YouTube (começa com https://).', true); return; }
    $('v-add').disabled = true;
    sb.from('midias').insert({ tipo: 'link', url: u.slice(0, 500), titulo: limpa($('v-titulo').value, 80), cat: limpa($('v-cat').value, 40) }).then(function (r) {
      $('v-add').disabled = false;
      if (r.error) { say('v-msg', 'Não foi possível adicionar.', true); return; }
      $('v-url').value = ''; $('v-titulo').value = ''; say('v-msg', 'Link adicionado. Já está no site.'); loadMidias();
    });
  }));

  // ---------- Vídeo do fundo do final ----------
  function fundoPrev() {
    var b = $('f-prev'), url = site.fundoVideo && site.fundoVideo.url; b.innerHTML = '';
    if (url && /^https:\/\//.test(url)) { b.appendChild(el('video', { src: url, muted: '', loop: '', autoplay: '', playsinline: '' })); b.appendChild(el('b', { text: 'Fale com o Diney' })); var v = b.querySelector('video'); v.muted = true; var pp = v.play(); if (pp && pp.catch) pp.catch(function () {}); }
    else b.appendChild(el('span', { text: 'Sem vídeo' }));
  }
  $('f-file').addEventListener('change', seguro(function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (!/^video\/(mp4|quicktime|webm)$/.test(f.type)) { say('f-msg', 'Use um vídeo MP4, MOV ou WEBM.', true); return; }
    if (f.size > MAX) { say('f-msg', 'O vídeo passou de 50 MB. Use um vídeo mais curto.', true); return; }
    say('f-msg', 'Enviando o vídeo... pode levar um pouco.');
    var antigo = site.fundoVideo && site.fundoVideo.path;
    up(f).then(function (u) {
      if (!u) throw new Error('up');
      return saveSite({ fundoVideo: { url: u.url, path: u.path } });
    }).then(function (ok) {
      if (!ok) { say('f-msg', 'Não salvou. Tente de novo.', true); return; }
      if (antigo) sb.storage.from(BUCKET).remove([antigo]);
      say('f-msg', 'Pronto! Já está no final do site.'); fundoPrev();
    }).catch(function () { say('f-msg', 'Não foi possível enviar o vídeo.', true); });
  }));
  $('f-del').addEventListener('click', seguro(function () {
    var antigo = site.fundoVideo && site.fundoVideo.path;
    confirmar($('f-del'), 'Toque de novo para tirar', function () {
      saveSite({ fundoVideo: null }).then(function (ok) {
        if (ok && antigo) sb.storage.from(BUCKET).remove([antigo]);
        say('f-msg', ok ? 'Vídeo do fundo tirado.' : 'Não salvou.', !ok); fundoPrev();
      });
    });
  }));

  // ---------- Textos ----------
  function campo(label, val, max, multi) {
    var inp = el(multi ? 'textarea' : 'input', { maxlength: String(max) }); inp.value = val || '';
    return { wrap: el('label', {}, [document.createTextNode(label), inp]), inp: inp };
  }
  function svcBox(sv) {
    var box = el('div', { class: 'svc' }); box._cat = sv.cat || '';
    var rot = campo('Nome do serviço', sv.rotulo, 30), tit = campo('Título', sv.titulo, 60), txt = campo('Descrição', sv.texto, 400, true), its = campo('O que está incluído (uma linha por item)', (sv.itens || []).join('\n'), 600, true);
    var del = el('button', { class: 'del', type: 'button', text: 'Remover serviço' });
    del.addEventListener('click', function () { confirmar(del, 'Toque de novo para remover', function () { box.remove(); }); });
    box.appendChild(el('div', { class: 'svc-top' }, [el('b', { text: sv.rotulo || 'Novo serviço' }), del]));
    [rot, tit, txt, its].forEach(function (c) { box.appendChild(c.wrap); });
    box._get = function () {
      var r = limpa(rot.inp.value, 30); if (!r) return null;
      return { cat: box._cat || r, rotulo: r, titulo: limpa(tit.inp.value, 60), texto: limpa(txt.inp.value, 400), itens: its.inp.value.split('\n').map(function (x) { return limpa(x, 120); }).filter(Boolean).slice(0, 10) };
    };
    return box;
  }
  function passoBox(p) {
    var box = el('div', { class: 'svc' }), t = campo('Título do passo', p.t, 40), d = campo('Explicação', p.p, 300, true);
    var del = el('button', { class: 'del', type: 'button', text: 'Remover' });
    del.addEventListener('click', function () { box.remove(); });
    box.appendChild(el('div', { class: 'svc-top' }, [el('b', { text: 'Passo' }), del])); box.appendChild(t.wrap); box.appendChild(d.wrap);
    box._get = function () { var a = limpa(t.inp.value, 40), b = limpa(d.inp.value, 300); return (a || b) ? { t: a, p: b } : null; };
    return box;
  }
  function fillTextos() {
    var tx = site.textos || {};
    Object.keys(DEF_TEXTOS).forEach(function (k) { var n = $('t-' + k); if (n) n.value = tx[k] || DEF_TEXTOS[k]; });
    var sv = $('svcs'); sv.innerHTML = ''; servicos().forEach(function (s) { sv.appendChild(svcBox(s)); });
    var ps = $('passos'); ps.innerHTML = ''; (site.passos || DEF_PASSOS).forEach(function (p) { ps.appendChild(passoBox(p)); });
    say('t-msg', '');
  }
  $('add-svc').addEventListener('click', function () { var b = svcBox({ rotulo: '', titulo: '', texto: '', itens: [] }); $('svcs').appendChild(b); b.querySelector('input').focus(); });
  $('add-passo').addEventListener('click', function () { var b = passoBox({ t: '', p: '' }); $('passos').appendChild(b); b.querySelector('input').focus(); });
  $('t-salvar').addEventListener('click', seguro(function () {
    var textos = Object.assign({}, site.textos || {});
    Object.keys(DEF_TEXTOS).forEach(function (k) { var v = limpa($('t-' + k).value, 60); if (v && v !== DEF_TEXTOS[k]) textos[k] = v; else delete textos[k]; });
    var sv = [], ps = [];
    $('svcs').childNodes.forEach(function (b) { var v = b._get && b._get(); if (v) sv.push(v); });
    $('passos').childNodes.forEach(function (b) { var v = b._get && b._get(); if (v) ps.push(v); });
    $('t-salvar').disabled = true; say('t-msg', 'Salvando...');
    saveSite({ textos: textos, servicos: sv.slice(0, 12), passos: ps.slice(0, 12) }).then(function (ok) {
      $('t-salvar').disabled = false;
      if (ok) { say('t-msg', 'Salvo! Já aparece no site.'); toast('Textos salvos'); } else say('t-msg', 'Não salvou. Tente de novo.', true);
    });
  }));

  // ---------- Contatos e logo ----------
  var showWA = false, novaLogo;
  function setShowWA(on, anim) {
    showWA = on; $('c-showwa').setAttribute('aria-checked', on ? 'true' : 'false');
    var d = $('c-demo'); d.classList.toggle('on', on);
    if (anim && on) { d.classList.remove('tap'); void d.offsetWidth; d.classList.add('tap'); }
  }
  $('c-showwa').addEventListener('click', function () { setShowWA(!showWA, true); });
  function logoPrev(url) { var b = $('c-logo-prev'); b.innerHTML = ''; if (url) b.appendChild(el('img', { src: url, alt: 'Logo' })); else b.textContent = 'Sem logo'; }
  function fillContatos() {
    $('c-ig').value = site.instagram ? '@' + site.instagram : '';
    var w = String(site.whatsapp || C.whatsapp || '').replace(/^55/, '');
    $('c-wa').value = w ? '(' + w.slice(0, 2) + ') ' + w.slice(2) : '';
    setShowWA(site.mostrarWhatsapp === true, false);
    novaLogo = undefined; logoPrev(site.logo); say('c-msg', '');
  }
  $('c-logo').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f || !/^image\/(png|jpeg|webp)$/.test(f.type)) { say('c-msg', 'Use uma imagem PNG, JPG ou WEBP.', true); return; }
    novaLogo = f; logoPrev(URL.createObjectURL(f));
  });
  $('c-logo-del').addEventListener('click', function () { novaLogo = null; logoPrev(null); });
  function iconeQuadrado(file) {
    return new Promise(function (res) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = c.height = 512; var x = c.getContext('2d');
        x.fillStyle = '#0c0a0b'; x.fillRect(0, 0, 512, 512);
        var s = Math.min(420 / img.naturalWidth, 420 / img.naturalHeight), w = img.naturalWidth * s, h = img.naturalHeight * s;
        x.drawImage(img, (512 - w) / 2, (512 - h) / 2, w, h); URL.revokeObjectURL(url);
        c.toBlob(function (b) { res(b); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); res(null); };
      img.src = url;
    });
  }
  $('c-salvar').addEventListener('click', seguro(function () {
    var ig = $('c-ig').value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');
    if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) { say('c-msg', 'Instagram inválido. Escreva só o @usuario.', true); return; }
    var d = $('c-wa').value.replace(/\D/g, '');
    if (d && (d.length < 10 || d.length > 13)) { say('c-msg', 'Coloque o WhatsApp com DDD.', true); return; }
    if (showWA && !d && !site.whatsapp) { say('c-msg', 'Para mostrar o WhatsApp, coloque o número.', true); return; }
    var patch = { instagram: ig || null, mostrarWhatsapp: showWA, whatsapp: d ? (d.indexOf('55') === 0 && d.length >= 12 ? d : '55' + d) : site.whatsapp };
    $('c-salvar').disabled = true; say('c-msg', 'Salvando...');
    var job = Promise.resolve();
    if (novaLogo === null) { patch.logo = null; patch.icone = null; }
    else if (novaLogo) {
      job = shrink(novaLogo).then(function (small) { return Promise.all([up(small), iconeQuadrado(novaLogo).then(function (b) { return b ? up(b) : null; })]); })
        .then(function (u) { if (!u[0]) throw new Error('upload'); patch.logo = u[0].url; patch.icone = (u[1] || u[0]).url; });
    }
    job.then(function () { return saveSite(patch); }).then(function (ok) {
      $('c-salvar').disabled = false;
      if (ok) { say('c-msg', 'Salvo! Já aparece no site.'); toast('Contatos salvos'); novaLogo = undefined; } else say('c-msg', 'Não salvou. Tente de novo.', true);
    }).catch(function () { $('c-salvar').disabled = false; say('c-msg', 'Não foi possível enviar a logo. Tente outra imagem.', true); });
  }));

  window.addEventListener('hashchange', function () { var h = location.hash.slice(1); if (logado && telas.indexOf(h) > 0 && h !== 'pedido') show(h); });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
