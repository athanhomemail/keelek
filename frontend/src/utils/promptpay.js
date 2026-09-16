/**
 * Thai QR Payment (PromptPay EMVCo Standard) Payload Generator
 * Conforms to Bank of Thailand (BOT) and EMVCo Merchant-Presented Mode specifications
 */

function crc16(data) {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function formatTag(tag, value) {
  const len = String(value.length).padStart(2, '0');
  return `${tag}${len}${value}`;
}

/**
 * Generate PromptPay QR EMVCo payload string
 * @param {string} target - Mobile number (10 digits) or Citizen ID (13 digits) or e-Wallet ID (15 digits)
 * @param {number|string} [amount] - Amount in THB (optional, e.g. 150.00)
 * @returns {string} EMVCo QR Code payload string
 */
export function generatePromptPayPayload(target, amount) {
  if (!target) return '';
  const cleaned = String(target).replace(/[^0-9]/g, '');
  if (!cleaned) return '';

  let subTag = '';
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    // Mobile phone: prefix with '0066' and drop leading '0' (total 13 digits)
    const formatted = '0066' + cleaned.slice(1);
    subTag = formatTag('01', formatted);
  } else if (cleaned.length === 13) {
    // National ID / Tax ID (13 digits)
    subTag = formatTag('02', cleaned);
  } else if (cleaned.length === 15) {
    // e-Wallet ID (15 digits)
    subTag = formatTag('03', cleaned);
  } else {
    // Default fallback
    subTag = formatTag('01', cleaned);
  }

  const tag29Value = formatTag('00', 'A000000677010111') + subTag;
  const tag29 = formatTag('29', tag29Value);

  const numAmount = Number(amount);
  const isDynamic = !isNaN(numAmount) && numAmount > 0;

  let payload = '';
  payload += formatTag('00', '01'); // Format indicator
  payload += formatTag('01', isDynamic ? '12' : '11'); // 12 = Dynamic (amount specified), 11 = Static
  payload += tag29;
  payload += formatTag('58', 'TH'); // Country code
  payload += formatTag('53', '764'); // Currency: THB (764)

  if (isDynamic) {
    payload += formatTag('54', numAmount.toFixed(2));
  }

  payload += '6304'; // CRC placeholder
  const checksum = crc16(payload);
  return payload + checksum;
}

/**
 * Formats a phone or citizen ID nicely for display (e.g. 081-234-5678 or 1-1037-00123-45-6)
 */
export function formatPromptPayDisplay(target) {
  if (!target) return '';
  const cleaned = String(target).replace(/[^0-9]/g, '');
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 13) {
    return `${cleaned.slice(0, 1)}-${cleaned.slice(1, 5)}-${cleaned.slice(5, 10)}-${cleaned.slice(10, 12)}-${cleaned.slice(12)}`;
  }
  return target;
}
