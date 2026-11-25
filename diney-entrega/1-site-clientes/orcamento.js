(function () {
  var C = window.DINEY || {};
  var $ = function (id) { return document.getElementById(id); };
  var ready = /^https:\/\//.test(C.supabaseUrl || '') && C.supabaseKey && C.supabaseKey.indexOf('COLE_AQUI') < 0 && window.supabase;
  var sb = ready ? window.supabase.createClient(C.supabaseUrl, C.supabaseKey) : null;
  var site = {}, tipo = '', aberto = Date.now();
  var TIPOS = ['Casamento', '15 anos'];

  function chips() {
    var box = $('tipos'); box.innerHTML = '';
    var lista = TIPOS.slice();
    lista.forEach(function (t) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = t;
      b.setAttribute('aria-pressed', t === tipo ? 'true' : 'false');
      b.addEventListener('click', function () { tipo = t; chips(); });
      box.appendChild(b);
    });
  }
  chips();
  if (sb) sb.from('site').select('data').eq('id', 1).maybeSingle().then(function (r) { if (r.data) { site = r.data.data || {}; chips(); } });

  $('f').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('site-url').value) return; // robô de spam preencheu o campo escondido
    if (Date.now() - aberto < 3000) return erro('Confira os dados e toque em Enviar de novo.');
    var nome = $('nome').value.trim(), tel = $('tel').value.trim(), dig = tel.replace(/\D/g, '');
    if (!nome) return erro('Escreva o seu nome.', 'nome');
    if (dig.length < 10) return erro('Escreva o seu WhatsApp com DDD.', 'tel');
    if (!tipo) return erro('Escolha o tipo de evento.');
    var last = 0; try { last = +localStorage.getItem('diney-pedido') || 0; } catch (x) {}
    if (Date.now() - last < 60000) return erro('Você acabou de enviar um pedido. Espere um minutinho para mandar outro.');
    if (!sb) return erro('O envio ainda não está configurado.');
    $('enviar').disabled = true; $('enviar').textContent = 'Enviando...'; erro('');
    sb.from('agendamentos').insert({
      nome: nome.slice(0, 120), telefone: tel.slice(0, 30), evento: tipo.slice(0, 40),
      data: $('data').value || null, local: $('local').value.trim().slice(0, 200), msg: $('msg').value.trim().slice(0, 2000)
    }).then(function (r) {
      $('enviar').disabled = false; $('enviar').textContent = 'Enviar pedido';
      if (r.error) return erro('Não foi possível enviar agora. Tente de novo em instantes.');
      try { localStorage.setItem('diney-pedido', String(Date.now())); } catch (x) {}
      $('form-view').hidden = true; $('ok-view').hidden = false; window.scrollTo(0, 0);
    });
  });
  function erro(t, foco) { $('erro').textContent = t; if (foco) $(foco).focus(); }
})();
