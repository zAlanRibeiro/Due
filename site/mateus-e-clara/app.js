import { pixPayload } from './pix.js';

// Chave Pix aleatória dos noivos (apagar no app do banco depois do casamento).
const PIX = { chave: 'pix@example.com', nome: 'Clara e Mateus', cidade: 'Rio de Janeiro' };
const VALORES = [[50, 'bronze'], [100, 'bronze'], [200, 'prata'], [500, 'prata'], [750, 'ouro'], [1000, 'ouro']];
// Horário de Brasília (UTC-3). PRAZO também existe em worker.js — mudar nos dois.
const INICIO = new Date('2028-04-22T18:00:00-03:00'), FIM = new Date('2028-04-22T22:00:00-03:00');
const PRAZO = new Date('2028-04-07T23:59:59-03:00');
// Trocar a chave quando as respostas forem apagadas (mudança de data): libera quem já tinha respondido.
const RSVP = 'rsvp-demo';

const $ = (s, el = document) => el.querySelector(s);
const rsvp = $('#rsvp'), obrigado = $('#obrigado'), pix = $('#pix'), form = $('#rsvp form');
const guardado = (() => { try { return JSON.parse(localStorage.getItem(RSVP)) || null; } catch { return null; } })();
let nomeConvidado = guardado?.nome || '';

const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Contagem regressiva do prazo de confirmação
const prazo = $('[data-prazo]'), flutuante = $('[data-abrir-rsvp]');
// Até o prazo conta para o fim das confirmações; depois, para o casamento; no dia, mensagem final.
function contar() {
  const agora = Date.now(), confirmando = agora < PRAZO;
  if (!confirmando && !prazo.classList.contains('encerrado')) {
    prazo.classList.add('encerrado');
    $('.prazo-titulo', prazo).innerHTML = 'Confirmações encerradas. <b>Faltam para o casamento:</b>';
    $('.relogio', prazo).setAttribute('aria-label', 'Tempo restante para o casamento');
    flutuante.hidden = true;
  }
  const falta = (confirmando ? PRAZO : INICIO) - agora;
  if (falta <= 0) {
    clearInterval(relogio);
    $('.prazo-titulo', prazo).textContent = agora < FIM ? 'É hoje! Celebre conosco ♥' : 'Obrigado por celebrar conosco! ♥';
    $('.relogio', prazo).hidden = true;
    return;
  }
  const s = Math.floor(falta / 1000);
  [s / 86400, (s % 86400) / 3600, (s % 3600) / 60, s % 60].forEach((n, i) => {
    const b = prazo.querySelectorAll('.relogio b')[i], v = String(Math.floor(n)).padStart(2, '0');
    if (b.textContent === v) return;
    b.textContent = v;
    // o número que mudou "cai" no lugar
    if (!calmo) b.animate([{ opacity: 0, transform: 'translateY(-35%)' }, { opacity: 1, transform: 'none' }], { duration: 400, easing: 'ease-out' });
  });
}
const relogio = setInterval(contar, 1000);
contar();

const utc = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
$('[data-agenda]').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
  `&text=${encodeURIComponent('Casamento Mateus & Clara')}&dates=${utc(INICIO)}/${utc(FIM)}&details=${encodeURIComponent('Traje: Social')}` +
  `&location=${encodeURIComponent('Espaço Villa Serena, Rua das Hortênsias, 120 - Jardim Botânico, Rio de Janeiro - RJ')}`;

// Cartões de valores (página e pós-confirmação)
document.querySelectorAll('[data-grade]').forEach((g) => {
  g.innerHTML = VALORES.map(([v, c], i) =>
    `<button class="cartao ${c}" data-valor="${v}" data-revelar style="--i:${i}"><span>Contribua com:<strong>${v} reais</strong></span></button>`).join('');
});
document.addEventListener('click', (e) => {
  const cartao = e.target.closest('.cartao');
  if (cartao) abrirPix(Number(cartao.dataset.valor));
  if (e.target.closest('[data-outro]')) abrirPix(0);
  if (e.target.closest('[data-fechar]')) e.target.closest('dialog').close();
});

// Elementos que aparecem suavemente ao rolar
const revelar = new IntersectionObserver((itens) => itens.forEach((it) => {
  if (it.isIntersecting) { it.target.classList.add('visivel'); revelar.unobserve(it.target); }
}), { threshold: .15 });
document.querySelectorAll('[data-revelar]').forEach((el) => revelar.observe(el));

// Botão flutuante: pulsa até a pessoa responder; depois vira um selo (a resposta não pode ser alterada)
function marcarRespondido() {
  flutuante.textContent = 'Resposta enviada';
  flutuante.disabled = true;
  flutuante.classList.replace('pulsar', 'confirmado') || flutuante.classList.add('confirmado');
}
if (guardado) marcarRespondido(); else flutuante.classList.add('pulsar');
flutuante.addEventListener('click', () => rsvp.showModal());

// Fluxo do formulário
const extras = $('[data-extras]'), acomp = $('[data-acomp]'), erro = $('[data-erro]');
function atualizar() {
  extras.hidden = form.comparecera.value !== 'sim';
  acomp.hidden = form.temAcomp.value !== 'sim';
  form.crianca.disabled = form.semCrianca.checked;
  if (form.semCrianca.checked) form.crianca.value = '';
  erro.textContent = '';
}
form.addEventListener('change', atualizar);

function validarForm() {
  if (!form.comparecera.value) return 'Informe se poderá comparecer.';
  if (form.nome.value.trim().length < 3) return form.nome.focus(), 'Informe seu nome completo.';
  const tel = form.telefone.value.replace(/\D/g, '').replace(/^0|^55(?=\d{10,11}$)/, ''); // mesma regra de telefone() no worker.js
  if (!/^\d{10,11}$/.test(tel)) return form.telefone.focus(), 'Informe seu telefone com DDD.';
  if (form.comparecera.value === 'sim') {
    if (form.temAcomp.value === 'sim' && form.acompanhante.value.trim().length < 3) return form.acompanhante.focus(), 'Informe o nome do acompanhante.';
    if (!form.semCrianca.checked && form.crianca.value.trim().length < 3) return form.crianca.focus(), 'Informe o nome da criança/adolescente ou marque "Sem acompanhante".';
  }
}

// Enviar = mostrar o resumo e pedir certeza; só "Sim, confirmar" grava.
const certeza = $('#certeza');
let pendente;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = validarForm();
  if (msg) return (erro.textContent = msg);
  const vai = form.comparecera.value === 'sim';
  pendente = {
    comparecera: vai,
    nome: form.nome.value.trim(),
    telefone: form.telefone.value.trim(),
    acompanhante: vai && form.temAcomp.value === 'sim' ? form.acompanhante.value.trim() : '',
    crianca: vai && !form.semCrianca.checked ? form.crianca.value.trim() : '',
    recado: form.recado.value.trim(),
  };
  const linhas = [['Presença', vai ? 'Vou comparecer' : 'Não poderei ir'], ['Nome', pendente.nome], ['Telefone', pendente.telefone],
    ...(vai ? [['Acompanhante', pendente.acompanhante || 'Sem acompanhante'], ['Criança/adolescente', pendente.crianca || 'Sem acompanhante']] : [])];
  $('[data-resumo]').replaceChildren(...linhas.flatMap(([k, v]) =>
    [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
  certeza.showModal();
});

$('[data-confirmar]').addEventListener('click', async () => {
  const botao = $('[data-confirmar]');
  botao.disabled = true; botao.textContent = 'Enviando…';
  try {
    const r = await fetch('/api/confirmar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...pendente, site: form.site.value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.erro);
    nomeConvidado = pendente.nome;
    try { localStorage.setItem(RSVP, JSON.stringify(pendente)); } catch {}
    marcarRespondido();
    certeza.close();
    rsvp.close();
    const primeiro = nomeConvidado.split(' ')[0];
    $('[data-msg]', obrigado).textContent = pendente.comparecera
      ? `Presença confirmada, ${primeiro}! Esperamos você. Se quiser, nos presenteie:`
      : `Que pena, ${primeiro}! Sentiremos sua falta. Se quiser, nos presenteie:`;
    obrigado.showModal();
  } catch (err) {
    certeza.close();
    erro.textContent = err.message || 'Não foi possível enviar. Verifique sua conexão e tente novamente.';
  } finally {
    botao.disabled = false; botao.textContent = 'Sim, confirmar';
  }
});

// Pix
const valorInput = $('[data-valor-input]'), codigo = $('[data-codigo]'), pixMsg = $('[data-pix-msg]');
function gerarPix() {
  const valor = Math.round(Number(valorInput.value));
  const valido = valor >= 1 && valor <= 100000;
  codigo.value = valido ? pixPayload({ ...PIX, valor }) : '';
  $('[data-qr]').innerHTML = '';
  if (valido && window.qrcode) {
    const qr = qrcode(0, 'M'); qr.addData(codigo.value); qr.make();
    $('[data-qr]').innerHTML = qr.createSvgTag(5, 2) + 'Ou escaneie com o app do banco';
  }
  $('[data-copiar]').disabled = $('[data-paguei]').disabled = !valido;
}
function abrirPix(valor) {
  valorInput.value = valor || '';
  $('[data-pix-nome]').value ||= nomeConvidado;
  pixMsg.textContent = '';
  gerarPix();
  obrigado.close();
  pix.showModal();
  if (!valor) valorInput.focus();
}
valorInput.addEventListener('input', gerarPix);
// Aviso flutuante que some sozinho (fica dentro do diálogo para aparecer por cima dele)
let timerAviso;
function avisar(texto) {
  const aviso = $('[data-aviso]');
  aviso.textContent = texto;
  aviso.classList.add('mostrar');
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => aviso.classList.remove('mostrar'), 3000);
}
$('[data-copiar]').addEventListener('click', async () => {
  const botao = $('[data-copiar]');
  try { await navigator.clipboard.writeText(codigo.value); } catch { codigo.select(); document.execCommand('copy'); }
  avisar('Código Pix copiado com sucesso!');
  pixMsg.textContent = 'Agora abra o app do seu banco e cole em Pix Copia e Cola.';
  botao.textContent = 'Código copiado!';
  botao.classList.add('copiado');
  setTimeout(() => { botao.textContent = 'Copiar código Pix'; botao.classList.remove('copiado'); }, 3000);
});
$('[data-paguei]').addEventListener('click', async () => {
  const botao = $('[data-paguei]');
  botao.disabled = true;
  try {
    const r = await fetch('/api/presente', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: $('[data-pix-nome]').value, valor: Math.round(Number(valorInput.value)),
        recado: $('[data-pix-recado]').value, site: $('[data-pix-site]').value }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro);
    pixMsg.textContent = 'Muito obrigado pelo carinho! ❤';
    $('[data-pix-recado]').value = '';
    setTimeout(() => { pix.close(); botao.disabled = false; }, 1800);
  } catch (err) {
    pixMsg.textContent = err.message || 'Não foi possível registrar agora, mas seu Pix vale do mesmo jeito. Obrigado! ❤';
    botao.disabled = false;
  }
});
