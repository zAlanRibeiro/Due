// Modo demonstração dos convites do portfólio: as chamadas /api/* respondem aqui mesmo, sem servidor (nada é gravado),
// e uma etiqueta leva de volta ao portfólio. Todos os nomes, datas e locais dos convites são fictícios.
(() => {
  const CONVIDADOS = ['Ana Beatriz Souza', 'Carlos Eduardo Lima', 'Daniela Ferreira', 'Fernanda Costa', 'Gustavo Almeida', 'Lucas Pereira',
    'Mariana Rocha', 'Paulo Henrique Dias', 'Renata Moreira', 'Thiago Martins', 'Vitória Santos'];
  const semAcento = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const json = (dados) => new Response(JSON.stringify(dados), { headers: { 'content-type': 'application/json' } });

  const fetchReal = window.fetch.bind(window);
  window.fetch = async (url, opcoes) => {
    const caminho = new URL(url, location.href).pathname;
    if (!caminho.startsWith('/api/')) return fetchReal(url, opcoes);
    await new Promise((ok) => setTimeout(ok, 500)); // o tempo de um servidor de verdade
    if (caminho === '/api/convidados') {
      const q = new URL(url, location.href).searchParams.get('q') || '';
      // Qualquer nome vale na demonstração: o digitado entra no resultado (o convite não o mostra como sugestão)
      return json([...CONVIDADOS.filter((n) => semAcento(n).includes(semAcento(q))), q.trim()]);
    }
    return json({ ok: true });
  };

  // A cada visita dá para testar a confirmação de novo (no site real, a resposta fica travada)
  try { Object.keys(localStorage).filter((k) => k.startsWith('rsvp')).forEach((k) => localStorage.removeItem(k)); } catch {}

  // Etiqueta "← due | Demonstração" (no mouse vira "Voltar ao portfólio"). Logo = vetor do cartão de visita, em ../img.
  const ESTILO = `
    .due-demo { position: fixed; z-index: 2147483647; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left));
      display: flex; align-items: center; gap: 9px; height: 38px; padding: 0 15px 0 11px; border-radius: 99px;
      background: rgb(82 2 0 / .92); color: #f6f4f1; text-decoration: none; box-shadow: 0 6px 18px rgb(40 0 0 / .28);
      -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); transition: background .2s, transform .2s;
      font: 600 11px/1 'Fira Mono', ui-monospace, Consolas, monospace; letter-spacing: .12em; text-transform: uppercase; }
    .due-demo:hover { background: #6e1410; transform: translateY(-1px); }
    .due-demo:focus-visible { outline: 2px solid #520200; outline-offset: 3px; }
    .due-demo svg { width: 15px; height: 15px; flex: none; transition: transform .2s; }
    .due-demo:hover svg { transform: translateX(-2px); }
    .due-demo-logo { width: 34px; aspect-ratio: 126.6 / 85.8; background: currentColor;
      -webkit-mask: url(../img/logo-due.svg) center / contain no-repeat; mask: url(../img/logo-due.svg) center / contain no-repeat; }
    .due-demo-texto { padding-left: 9px; border-left: 1px solid rgb(246 244 241 / .35); }
    .due-demo-texto::after { content: 'Demonstração'; }
    .due-demo:hover .due-demo-texto::after, .due-demo:focus-visible .due-demo-texto::after { content: 'Voltar ao portfólio'; }
    @media (prefers-reduced-motion: reduce) { .due-demo, .due-demo svg { transition: none; } }`;

  addEventListener('DOMContentLoaded', () => {
    if (new URLSearchParams(location.search).has('captura')) return; // capturas de tela do portfólio saem sem a etiqueta
    document.head.append(Object.assign(document.createElement('style'), { textContent: ESTILO }));
    const voltar = Object.assign(document.createElement('a'), {
      href: '../', className: 'due-demo', title: 'Site de demonstração com dados fictícios',
      innerHTML: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>'
        + '<span class="due-demo-logo"></span><span class="due-demo-texto"></span>',
    });
    voltar.setAttribute('aria-label', 'Voltar ao portfólio da Due. Este é um site de demonstração, com dados fictícios.');
    document.body.append(voltar);
  });
})();
