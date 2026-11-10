// Celular do convidado na confirmação. Usado pelo site (formulário) e pelo worker (validação final), para as regras serem as mesmas.

// Devolve o celular formatado, "(21) 99999-9999" (DDD + 9 dígitos começando com 9; aceita +55 e 0 na frente),
// ou o número do exterior começando com "+" (ex.: Portugal) como "+351912345678". Inválido = ''.
export function celular(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  let d = s.replace(/\D/g, '');
  if (s.startsWith('+') && !d.startsWith('55')) return d.length >= 8 && d.length <= 15 ? `+${d}` : '';
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
  if (d.length === 12 && d.startsWith('0')) d = d.slice(1);
  return /^[1-9]{2}9\d{8}$/.test(d) ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : '';
}

// Máscara enquanto digita: "21999991234" → "(21) 99999-1234". Número começando com "+" fica como a pessoa digitou.
export function mascaraCelular(v) {
  if (v.trim().startsWith('+')) return v;
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 7) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d;
}
