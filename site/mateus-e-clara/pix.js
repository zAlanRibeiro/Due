// Gera o "Pix copia e cola" (BR Code estático, padrão EMV do Banco Central).
const campo = (id, valor) => id + String(valor.length).padStart(2, '0') + valor;

const ascii = (s, max) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().slice(0, max);

export function crc16(str) {
  let crc = 0xffff;
  for (const c of str) {
    crc ^= c.charCodeAt(0) << 8;
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function pixPayload({ chave, nome, cidade, valor, txid = '***' }) {
  const payload =
    campo('00', '01') +
    campo('26', campo('00', 'br.gov.bcb.pix') + campo('01', chave)) +
    campo('52', '0000') +
    campo('53', '986') +
    (valor ? campo('54', Number(valor).toFixed(2)) : '') +
    campo('58', 'BR') +
    campo('59', ascii(nome, 25)) +
    campo('60', ascii(cidade, 15)) +
    campo('62', campo('05', txid)) +
    '6304';
  return payload + crc16(payload);
}
