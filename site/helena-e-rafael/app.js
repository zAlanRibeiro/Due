import { pixPayload } from './pix.js';
import { PRESENTES } from './presentes.js';
import { celular, mascaraCelular } from './celular.js';

// Chave Pix dos noivos. Vazia = a lista de presentes aparece, mas não dá para finalizar (não há para onde mandar o Pix).
// (Use uma chave aleatória e apague no app do banco depois do casamento.)
const PIX = { chave: 'pix@example.com', nome: 'Helena e Rafael', cidade: 'Rio de Janeiro' };
// Public Key do Mercado Pago (cartão). Vazia = só Pix. O Access Token fica no segredo MP_ACCESS_TOKEN da Cloudflare.
const MP_PUBLIC_KEY = '';
// Horário de Brasília (UTC-3). PRAZO também existe em worker.js — mudar nos dois.
const INICIO = new Date('2028-10-14T16:00:00-03:00'), FIM = new Date('2028-10-14T22:00:00-03:00');
const PRAZO = new Date('2028-09-14T23:59:59-03:00');
const LOCAL = 'Capela Nossa Senhora das Oliveiras, Santa Teresa, Rio de Janeiro - RJ';

const $ = (s, el = document) => el.querySelector(s);
const rsvp = $('#rsvp'), obrigado = $('#obrigado'), pix = $('#pix'), form = $('#rsvp form');
const guardado = (() => { try { return JSON.parse(localStorage.getItem('rsvp')) || null; } catch { return null; } })();
let nomeConvidado = guardado?.nome || '';

const calmo = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Abertura: envelope com lacre. Quem já abriu nesta visita (ou chega por um link #secao) vai direto ao convite.
const raiz = document.documentElement, abertura = $('[data-abertura]'), envelope = $('[data-envelope]');
const main = $('main');
function abrirConvite() {
  raiz.classList.add('aberto');
  raiz.classList.remove('abrindo');
  main.inert = false;
  try { sessionStorage.setItem('envelope', '1'); } catch {}
}
const jaAbriu = (() => { try { return sessionStorage.getItem('envelope'); } catch { return null; } })();
if (jaAbriu || location.hash.length > 1) abrirConvite();
else {
  main.inert = true;
  envelope.addEventListener('click', () => {
    envelope.disabled = true;
    raiz.classList.add('abrindo');
    if (calmo) return abrirConvite();
    abertura.addEventListener('animationend', (e) => { if (e.target === abertura) abrirConvite(); });
    setTimeout(abrirConvite, 3600); // garantia, caso o navegador pule a animação (aba em segundo plano)
  }, { once: true });
}

// Contagem regressiva do prazo de confirmação
const prazo = $('[data-prazo]'), flutuante = $('[data-flutuante]'), selo = $('.selo');
// Até o prazo conta para o fim das confirmações; depois, para o casamento; no dia, mensagem final.
function contar() {
  const agora = Date.now(), confirmando = agora < PRAZO;
  if (!confirmando && !prazo.classList.contains('encerrado')) {
    prazo.classList.add('encerrado');
    $('.prazo-titulo', prazo).innerHTML = 'Confirmações encerradas. <b>Faltam para o casamento:</b>';
    $('.relogio', prazo).setAttribute('aria-label', 'Tempo restante para o casamento');
    flutuante.hidden = true;
    selo.disabled = true;
    $('[data-selo-texto]').innerHTML = 'Confirmações<br>encerradas';
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
  `&text=${encodeURIComponent('Casamento Helena & Rafael')}&dates=${utc(INICIO)}/${utc(FIM)}` +
  `&location=${encodeURIComponent(LOCAL)}`;

const temPix = !!PIX.chave;
const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const el = (tag, props = {}, ...filhos) => { const e = Object.assign(document.createElement(tag), props); e.append(...filhos); return e; };

// ---------- Lista de presentes: vitrine → carrinho (guardado no navegador) → Pix do total
const lista = $('#lista'), vitrine = $('[data-vitrine]'), secaoCarrinho = $('[data-carrinho]');
const porId = new Map(PRESENTES.map((p) => [p.id, p]));
let carrinho = (() => { try { return (JSON.parse(localStorage.getItem('carrinho')) || []).filter((id) => porId.has(id)); } catch { return []; } })();
const salvarCarrinho = () => { try { localStorage.setItem('carrinho', JSON.stringify(carrinho)); } catch {} };
const totalCarrinho = () => carrinho.reduce((n, id) => n + porId.get(id).centavos, 0);
const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const nomeAZ = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true, sensitivity: 'base' });
const ORDEM = { az: nomeAZ, za: (a, b) => nomeAZ(b, a), menor: (a, b) => a.centavos - b.centavos, maior: (a, b) => b.centavos - a.centavos };

// A vitrine mostra os presentes em blocos ("Ver mais presentes"), para não carregar os 121 de uma vez
const POR_VEZ = 24;
let mostrando = POR_VEZ, posicaoVitrine = 0;
const filtrados = () => {
  const termo = semAcento($('[data-busca]').value.trim());
  return PRESENTES.filter((p) => semAcento(p.nome).includes(termo)).sort(ORDEM[$('[data-ordem]').value]);
};
function cartaoProduto(p) {
  const escolhido = carrinho.includes(p.id);
  return el('article', { className: 'produto' },
    el('img', { src: `img/presentes/${p.id}.webp`, alt: '', loading: 'lazy', width: 360, height: 360 }),
    el('h4', { textContent: p.nome }),
    el('p', { className: 'preco', textContent: reais(p.centavos) }),
    el('button', { type: 'button', className: `btn ${escolhido ? 'btn-contorno' : 'btn-verde'}`, textContent: escolhido ? 'No carrinho ✓' : 'Presentear',
      onclick: () => presentear(p.id) }));
}
function atualizarVerMais(total) {
  $('[data-ver-mais-bloco]').hidden = mostrando >= total;
  $('[data-ver-mais-contagem]').textContent = `Mostrando ${Math.min(mostrando, total)} de ${total} presentes`;
}
function mostrarProdutos({ doComeco = false } = {}) {
  if (doComeco) mostrando = POR_VEZ;
  const itens = filtrados();
  $('[data-produtos]').replaceChildren(...itens.slice(0, mostrando).map(cartaoProduto));
  $('[data-lista-vazia]').hidden = itens.length > 0;
  atualizarVerMais(itens.length);
}
// "Ver mais": só acrescenta o próximo bloco (os de cima ficam como estão) e leva o foco ao primeiro novo
$('[data-ver-mais]').addEventListener('click', () => {
  const itens = filtrados(), novos = itens.slice(mostrando, mostrando + POR_VEZ).map(cartaoProduto);
  mostrando += POR_VEZ;
  $('[data-produtos]').append(...novos);
  atualizarVerMais(itens.length);
  novos[0]?.querySelector('button').focus({ preventScroll: true });
});
function atualizarRotulo() {
  const n = carrinho.length;
  $('[data-carrinho-rotulo]').textContent = n ? `Ver carrinho (${n} ${n === 1 ? 'presente' : 'presentes'})` : 'Ver carrinho';
}
// Abrir a lista começa do primeiro bloco; voltar do carrinho mantém os blocos abertos e o ponto onde a pessoa estava
function verVitrine({ doComeco = false } = {}) {
  secaoCarrinho.hidden = true;
  vitrine.hidden = false;
  mostrarProdutos({ doComeco });
  lista.scrollTop = doComeco ? 0 : posicaoVitrine;
}
function verCarrinho() {
  if (!vitrine.hidden) posicaoVitrine = lista.scrollTop;
  vitrine.hidden = true;
  secaoCarrinho.hidden = false;
  $('[data-carrinho-itens]').replaceChildren(...carrinho.map((id) => {
    const p = porId.get(id);
    return el('li', {},
      el('img', { src: `img/presentes/${p.id}.webp`, alt: '', width: 72, height: 72 }),
      el('div', {}, el('span', { textContent: p.nome }), el('button', { type: 'button', className: 'remover', textContent: 'Remover', onclick: () => remover(id) })),
      el('b', { textContent: reais(p.centavos) }));
  }));
  $('[data-carrinho-vazio]').hidden = carrinho.length > 0;
  $('[data-carrinho-total]').textContent = reais(totalCarrinho());
  $('[data-finalizar]').disabled = !carrinho.length || !temPix;
  $('[data-carrinho-erro]').textContent = temPix ? '' : 'O Pix dos noivos ainda não foi configurado.';
  lista.scrollTop = 0;
}
function presentear(id) {
  if (!carrinho.includes(id)) carrinho.push(id);
  salvarCarrinho();
  atualizarRotulo();
  verCarrinho(); // como no casar.com: ao escolher, mostra o carrinho
}
function remover(id) {
  carrinho = carrinho.filter((c) => c !== id);
  salvarCarrinho();
  atualizarRotulo();
  verCarrinho();
}
$('[data-busca]').addEventListener('input', () => mostrarProdutos({ doComeco: true }));
$('[data-ordem]').addEventListener('change', () => mostrarProdutos({ doComeco: true }));
$('[data-ver-carrinho]').addEventListener('click', verCarrinho);
$('[data-voltar-lista]').addEventListener('click', () => verVitrine());
$('[data-finalizar]').addEventListener('click', () => abrirPix({ centavos: totalCarrinho(), itens: [...carrinho] }));
document.querySelectorAll('[data-abrir-lista]').forEach((b) => b.addEventListener('click', () => {
  obrigado.close();
  lista.showModal();
  verVitrine({ doComeco: true });
}));
atualizarRotulo();

document.querySelectorAll('[data-outro]').forEach((b) => (b.hidden = !temPix));
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-outro]')) abrirPix();
  if (e.target.closest('[data-fechar]')) e.target.closest('dialog').close();
});

// Elementos que aparecem suavemente ao rolar (e os ramos das bordas de cada folha)
const revelar = new IntersectionObserver((itens) => itens.forEach((it) => {
  if (it.isIntersecting) { it.target.classList.add('visivel'); revelar.unobserve(it.target); }
}), { threshold: .15 });
document.querySelectorAll('[data-revelar]').forEach((el) => revelar.observe(el));
const folhas = new IntersectionObserver((itens) => itens.forEach((it) => {
  if (it.isIntersecting) { it.target.classList.add('visivel'); folhas.unobserve(it.target); }
}), { threshold: .05 });
document.querySelectorAll('.folha').forEach((el) => folhas.observe(el));

// Botão flutuante e selo: chamam até a pessoa responder; depois indicam que já respondeu (a resposta não pode ser alterada)
function marcarRespondido() {
  flutuante.textContent = 'Resposta enviada';
  flutuante.disabled = true;
  flutuante.classList.replace('pulsar', 'confirmado') || flutuante.classList.add('confirmado');
  selo.disabled = true;
  $('[data-selo-texto]').innerHTML = 'Presença<br>respondida<br>♥';
}
if (guardado) marcarRespondido(); else flutuante.classList.add('pulsar');
document.querySelectorAll('[data-abrir-rsvp]').forEach((b) => b.addEventListener('click', () => rsvp.showModal()));

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
// Formata o celular enquanto digita. Ao apagar não reformata (senão o "-" e os parênteses voltariam e travariam o apagar);
// ao sair do campo, formata de novo.
form.telefone.addEventListener('input', (e) => {
  if (!e.inputType?.startsWith('delete')) form.telefone.value = mascaraCelular(form.telefone.value);
});
form.telefone.addEventListener('blur', () => { form.telefone.value = celular(form.telefone.value) || mascaraCelular(form.telefone.value); });

// Nome: só quem está na lista de convidados dos noivos (o servidor confere de novo). Sugestões a partir de 3 letras, sem acento.
const sugestoes = $('[data-sugestoes]');
const chaveNome = (s) => semAcento(s.trim().replace(/\s+/g, ' '));
// Falha com a mensagem do servidor (ex.: muitas buscas) ou sem mensagem quando falta conexão.
const buscarConvidados = async (q) => {
  const r = await fetch('/api/convidados?q=' + encodeURIComponent(q)).catch(() => { throw new Error(''); });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.erro || '');
  return j;
};
let timerBusca, ultimaBusca = 0;
form.nome.addEventListener('input', () => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(async () => {
    const busca = ++ultimaBusca, digitado = form.nome.value;
    const nomes = chaveNome(digitado).length >= 3 ? await buscarConvidados(digitado).catch(() => []) : [];
    if (busca !== ultimaBusca) return; // chegou depois de uma busca mais nova
    sugestoes.replaceChildren(...nomes.filter((n) => chaveNome(n) !== chaveNome(digitado)).map((n) =>
      el('button', { type: 'button', textContent: n, onclick: () => { form.nome.value = n; sugestoes.hidden = true; erro.textContent = ''; form.telefone.focus(); } })));
    sugestoes.hidden = !sugestoes.children.length;
  }, 250);
});

function validarForm() {
  if (!form.comparecera.value) return 'Informe se poderá comparecer.';
  if (form.nome.value.trim().length < 3) return form.nome.focus(), 'Informe seu nome completo.';
  if (!celular(form.telefone.value)) return form.telefone.focus(), 'Informe um celular válido, com DDD.';
  if (form.comparecera.value === 'sim') {
    if (form.temAcomp.value === 'sim' && form.acompanhante.value.trim().length < 3) return form.acompanhante.focus(), 'Informe o nome do acompanhante.';
    if (!form.semCrianca.checked && form.crianca.value.trim().length < 3) return form.crianca.focus(), 'Informe o nome da criança/adolescente ou marque "Sem acompanhante".';
  }
}

// Enviar = mostrar o resumo e pedir certeza; só "Sim, confirmar" grava.
const certeza = $('#certeza');
let pendente;
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = validarForm();
  if (msg) return (erro.textContent = msg);
  const nomes = await buscarConvidados(form.nome.value).catch((err) => err);
  if (nomes instanceof Error) return (erro.textContent = nomes.message || 'Não foi possível conferir seu nome. Verifique sua conexão e tente novamente.');
  const daLista = nomes.find((n) => chaveNome(n) === chaveNome(form.nome.value));
  if (!daLista) return form.nome.focus(), (erro.textContent = 'Não encontramos este nome na lista de convidados. Digite e escolha seu nome nas sugestões; se não aparecer, fale com os noivos.');
  form.nome.value = daLista; // grafia da lista dos noivos
  sugestoes.hidden = true;
  const vai = form.comparecera.value === 'sim';
  pendente = {
    comparecera: vai,
    nome: form.nome.value.trim(),
    telefone: celular(form.telefone.value),
    acompanhante: vai && form.temAcomp.value === 'sim' ? form.acompanhante.value.trim() : '',
    crianca: vai && !form.semCrianca.checked ? form.crianca.value.trim() : '',
    recado: form.recado.value.trim(),
  };
  const linhas = [['Presença', vai ? 'Vou comparecer' : 'Não poderei ir'], ['Nome', pendente.nome], ['Celular', pendente.telefone],
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
    try { localStorage.setItem('rsvp', JSON.stringify(pendente)); } catch {}
    marcarRespondido();
    certeza.close();
    rsvp.close();
    const primeiro = nomeConvidado.split(' ')[0];
    const convite = 'Se quiser, conheça nossa lista de presentes.';
    $('[data-msg]', obrigado).textContent = pendente.comparecera
      ? `Presença confirmada, ${primeiro}! Esperamos você. ${convite}`
      : `Que pena, ${primeiro}! Sentiremos sua falta. ${convite}`;
    obrigado.showModal();
  } catch (err) {
    certeza.close();
    erro.textContent = err.message || 'Não foi possível enviar. Verifique sua conexão e tente novamente.';
  } finally {
    botao.disabled = false; botao.textContent = 'Sim, confirmar';
  }
});

// Pix: do carrinho (valor fixo = soma dos itens) ou valor livre ("outro valor")
const valorInput = $('[data-valor-input]'), codigo = $('[data-codigo]'), pixMsg = $('[data-pix-msg]');
let pagamento = null; // { centavos, itens } quando vem do carrinho
const centavosDigitados = () => Math.round(Number(valorInput.value) * 100);
function gerarPix() {
  const centavos = pagamento ? pagamento.centavos : centavosDigitados();
  const valido = centavos >= 100 && centavos <= 10_000_000;
  codigo.value = valido ? pixPayload({ ...PIX, valor: centavos / 100 }) : '';
  $('[data-qr]').innerHTML = '';
  if (valido && window.qrcode) {
    const qr = qrcode(0, 'M'); qr.addData(codigo.value); qr.make();
    $('[data-qr]').innerHTML = qr.createSvgTag(5, 2) + 'Ou escaneie com o app do banco';
  }
  $('[data-copiar]').disabled = $('[data-paguei]').disabled = !valido;
}
function abrirPix({ centavos = 0, itens = null } = {}) {
  if (!temPix) return;
  pagamento = itens ? { centavos, itens } : null;
  valorInput.value = centavos ? (centavos / 100).toFixed(2) : '';
  valorInput.readOnly = !!itens;
  const resumo = $('[data-pix-itens]');
  resumo.hidden = !itens;
  resumo.replaceChildren(...(itens || []).map((id) => el('li', {}, el('span', { textContent: porId.get(id).nome }), el('b', { textContent: reais(porId.get(id).centavos) }))));
  $('[data-pix-nome]').value ||= nomeConvidado;
  pixMsg.textContent = '';
  gerarPix();
  obrigado.close();
  pix.showModal(); // abre por cima da lista: fechando o Pix, volta ao carrinho
  mostrarForma();
  if (!itens) valorInput.focus();
}
let timerCartao;
valorInput.addEventListener('input', () => {
  gerarPix();
  clearTimeout(timerCartao);
  if (formaCartao()) timerCartao = setTimeout(montarCartao, 600); // o formulário do cartão é refeito com o valor novo
});

// Cartão: formulário seguro do Mercado Pago (Card Payment Brick). O site só recebe um token de uso único;
// quem cobra é o servidor, sempre com o valor da lista.
$('[data-formas]').hidden = !MP_PUBLIC_KEY;
const formaCartao = () => $('[name="forma"]:checked').value === 'cartao';
let sdkMp, brick, vezCartao = 0;
const carregarSdkMp = () => (sdkMp ||= new Promise((ok, falha) =>
  document.head.append(el('script', { src: 'https://sdk.mercadopago.com/js/v2', onload: ok, onerror: () => { sdkMp = null; falha(); } }))));
function mostrarForma() {
  const cartao = formaCartao();
  pix.querySelectorAll('[data-so-pix]').forEach((e) => (e.hidden = cartao));
  $('[data-so-cartao]').hidden = !cartao;
  $('#t-pix').textContent = cartao ? 'Presente com cartão' : 'Presente via Pix';
  pixMsg.textContent = '';
  if (cartao) montarCartao();
  else { vezCartao++; brick?.unmount(); brick = null; }
}
$('[data-formas]').addEventListener('change', mostrarForma);
async function montarCartao() {
  const vez = ++vezCartao, centavos = pagamento ? pagamento.centavos : centavosDigitados();
  brick?.unmount(); brick = null;
  if (!(centavos >= 100 && centavos <= 10_000_000)) return;
  try { await carregarSdkMp(); } catch { pixMsg.textContent = 'Não foi possível carregar o pagamento com cartão. Verifique sua conexão ou use o Pix.'; return; }
  if (vez !== vezCartao) return; // trocou de valor ou de forma enquanto carregava
  const novo = await new MercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' }).bricks().create('cardPayment', 'cartao-mp', {
    initialization: { amount: centavos / 100 },
    customization: { paymentMethods: { maxInstallments: 12 }, visual: { style: { customVariables: { baseColor: '#414923' } } } },
    callbacks: { onReady() {}, onError: (e) => console.error('Mercado Pago', e), onSubmit: pagarCartao },
  });
  if (vez === vezCartao) brick = novo; else novo.unmount();
}
const RECUSAS = {
  cc_rejected_insufficient_amount: 'O cartão não tem limite ou saldo suficiente.',
  cc_rejected_bad_filled_security_code: 'O código de segurança está incorreto.',
  cc_rejected_bad_filled_date: 'A data de validade está incorreta.',
  cc_rejected_call_for_authorize: 'O banco do cartão pediu autorização: fale com ele e tente de novo.',
};
// Resolver = o Brick encerra; rejeitar = o Brick libera o botão para tentar de novo (outro cartão gera outro token).
async function pagarCartao(cartao) {
  pixMsg.textContent = '';
  const r = await fetch('/api/cartao', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nome: $('[data-pix-nome]').value, ...(pagamento ? { itens: pagamento.itens } : { valor: centavosDigitados() / 100 }),
      recado: $('[data-pix-recado]').value, site: $('[data-pix-site]').value, cartao }) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r?.ok || ['rejected', 'cancelled'].includes(j.situacao)) {
    pixMsg.textContent = j.erro || (j.situacao ? (RECUSAS[j.detalhe] || 'O pagamento foi recusado.') + ' Tente outro cartão ou use o Pix.'
      : 'Não foi possível enviar o pagamento. Verifique sua conexão e tente novamente.');
    throw new Error(pixMsg.textContent);
  }
  presenteRecebido(j.situacao === 'approved' ? 'Pagamento aprovado! Muito obrigado pelo carinho! ♥'
    : 'Pagamento em análise pelo Mercado Pago: os noivos verão assim que for aprovado. Obrigado pelo carinho! ♥', 3500);
}
// Depois do Pix declarado ou do cartão aceito: agradece, esvazia o carrinho e fecha
function presenteRecebido(msg, ms = 1800) {
  pixMsg.textContent = msg;
  $('[data-pix-recado]').value = '';
  const doCarrinho = !!pagamento;
  if (doCarrinho) { carrinho = []; salvarCarrinho(); atualizarRotulo(); }
  setTimeout(() => { pix.close(); if (doCarrinho) lista.close(); $('[data-paguei]').disabled = false; }, ms);
}
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
    // Do carrinho vão só os itens: o total é calculado de novo no servidor, com os preços da lista
    const r = await fetch('/api/presente', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nome: $('[data-pix-nome]').value, ...(pagamento ? { itens: pagamento.itens } : { valor: centavosDigitados() / 100 }),
        recado: $('[data-pix-recado]').value, site: $('[data-pix-site]').value }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro);
    presenteRecebido('Muito obrigado pelo carinho! ♥');
  } catch (err) {
    pixMsg.textContent = err.message || 'Não foi possível registrar agora, mas seu Pix vale do mesmo jeito. Obrigado! ♥';
    botao.disabled = false;
  }
});
