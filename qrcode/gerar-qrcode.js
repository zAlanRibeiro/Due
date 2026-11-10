// QR Code da Due com o logo no centro. Uso (na pasta PortifolioDue): node qrcode/gerar-qrcode.js site https://endereco qrcode/qrcode-portfolio-due.svg
const fs = require('fs'), path = require('path');
const [site, url, saida] = process.argv.slice(2);
const qrcode = require(path.resolve(site, 'helena-e-rafael/vendor/qrcode.js'));

const VINHO = '#520200', CREME = '#f6f4f1';
const qr = qrcode(0, 'H'); // correção de erro máxima (30%): o logo cobre ~7% do código
qr.addData(url.toUpperCase(), 'Alphanumeric'); // maiúsculas = modo alfanumérico = código menor, módulos maiores
qr.make();
const n = qr.getModuleCount(), m = 4, N = n + 2 * m; // m = margem silenciosa

// Área do logo no centro (em módulos), com a proporção do logo (126.6 x 85.8)
const lw = Math.round(n * 0.3) | 1, lh = Math.round(lw * 0.72) | 1;
const lx = (n - lw) / 2, ly = (n - lh) / 2;
const noLogo = (r, c) => c >= lx && c < lx + lw && r >= ly && r < ly + lh;
const olho = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

let d = '';
for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
  if (qr.isDark(r, c) && !olho(r, c) && !noLogo(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;

// Olhos (cantos) com cantos levemente arredondados: anel 7x7 + miolo 3x3.
// Raio grande (1.6) deixa de ser lido por leitores menos tolerantes; R = 0 dá olhos quadrados.
const R = Number(process.env.QR_RAIO ?? 0);
const quadrado = (x, y, l, r) => r ? `M${x + r} ${y}h${l - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${l - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${2 * r - l}a${r} ${r} 0 0 1 ${-r} ${-r}v${2 * r - l}a${r} ${r} 0 0 1 ${r} ${-r}z`
  : `M${x} ${y}h${l}v${l}h${-l}z`;
const olhos = [[0, 0], [0, n - 7], [n - 7, 0]].map(([r, c]) => {
  const x = c + m, y = r + m;
  return `<path fill-rule="evenodd" d="${quadrado(x, y, 7, R)}${quadrado(x + 1, y + 1, 5, R * 0.6)}"/><path d="${quadrado(x + 2, y + 2, 3, R * 0.6)}"/>`;
}).join('');

// Logo "due" (vetor do cartão) dentro de um cartão creme
const logo = fs.readFileSync(path.resolve(site, 'img/logo-due.svg'), 'utf8')
  .replace(/<svg[^>]*>/, '').replace('</svg>', '').replaceAll('currentColor', VINHO);
const p = 0.6; // respiro entre o cartão e o logo
// <g transform> em vez de <svg> aninhado: alguns programas (MuPDF, gráficas) ignoram a posição de svg aninhado
const k = Math.min((lw - 2 * p) / 126.6, (lh - 2 * p) / 85.8);
const gx = lx + m + (lw - 126.6 * k) / 2, gy = ly + m + (lh - 85.8 * k) / 2;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges">
<title>QR Code: ${url}</title>
<rect width="${N}" height="${N}" fill="${CREME}"/>
<g fill="${VINHO}"><path d="${d}"/>${olhos}</g>
<rect x="${lx + m + 0.2}" y="${ly + m + 0.2}" width="${lw - 0.4}" height="${lh - 0.4}" rx="1.2" fill="${CREME}" stroke="${VINHO}" stroke-width=".35" shape-rendering="geometricPrecision"/>
<g transform="translate(${gx.toFixed(3)} ${gy.toFixed(3)}) scale(${k.toFixed(5)}) translate(-63.9 -31.1)" fill="${VINHO}" shape-rendering="geometricPrecision">${logo}</g>
</svg>
`;
fs.writeFileSync(saida, svg);
console.log(`QR versão ${(n - 17) / 4} (${n}x${n} módulos), logo ${lw}x${lh} módulos = ${(100 * lw * lh / (n * n)).toFixed(1)}% da área`);
