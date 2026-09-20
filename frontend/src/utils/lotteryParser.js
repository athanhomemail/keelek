/**
 * lotteryParser.js
 * ยูทิลิตีสำหรับถอดรหัสข้อความโพยหวยที่คัดลอกมาจากแชท หรือ LINE
 * รองรับ:
 * - ตัวคั่นหลากหลาย: จุลภาค (,), ขึ้นบรรทัดใหม่ (\n), ช่องว่าง ( ), ขีด (-), สแลช (/), จุด (.), เซมิโคลอน (;)
 * - ข้อความตัวเลขหลายบรรทัด (Multiline)
 * - ตรวจจับยอดเงินอัตโนมัติ ทั้งแบบยอดต่อบรรทัด และยอดรวมท้ายข้อความ
 * - ตัดเลขซ้ำ (Distinct) ก่อนใส่ยอดเงิน เช่น "53 36 60 36 = 50" จะได้ 36 เพียงตัวเดียว ยอด 50 บาท (ไม่เบิ้ลเป็น 100)
 * - หากข้อความไม่มียอดเงิน จะส่งสถานะ isPriceDetected = false เพื่อให้หน้าจอกรอกยอดเงิน
 */

/**
 * สร้างการกลับเลข 6 ประตูสำหรับเลข 3 ตัว
 */
export function generate6Permutations(threeDigits) {
  if (!threeDigits || threeDigits.length !== 3) return [];
  const chars = threeDigits.split('');
  const perms = new Set([
    chars[0] + chars[1] + chars[2],
    chars[0] + chars[2] + chars[1],
    chars[1] + chars[0] + chars[2],
    chars[1] + chars[2] + chars[0],
    chars[2] + chars[0] + chars[1],
    chars[2] + chars[1] + chars[0]
  ]);
  return Array.from(perms);
}

/**
 * 19 ประตู (เลข 2 ตัว 19 ตัว)
 */
export function generate19Pratu(digit) {
  if (!digit || digit.length !== 1) return [];
  const d = String(digit);
  const nums = [];
  for (let i = 0; i <= 9; i++) {
    nums.push(`${d}${i}`);
    if (i.toString() !== d) {
      nums.push(`${i}${d}`);
    }
  }
  return Array.from(new Set(nums));
}

/**
 * รูดหน้า (หลักสิบ)
 */
export function generateRoodFront(digit) {
  if (!digit || digit.length !== 1) return [];
  const nums = [];
  for (let i = 0; i <= 9; i++) nums.push(`${digit}${i}`);
  return nums;
}

/**
 * รูดหลัง (หลักหน่วย)
 */
export function generateRoodBack(digit) {
  if (!digit || digit.length !== 1) return [];
  const nums = [];
  for (let i = 0; i <= 9; i++) nums.push(`${i}${digit}`);
  return nums;
}

/**
 * เลขเบิ้ล 2 ตัว (00 - 99)
 */
export function generateDoubleNumbers() {
  return ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
}

/**
 * เลขตอง 3 ตัว (000 - 999)
 */
export function generateTripleNumbers() {
  return ['000', '111', '222', '333', '444', '555', '666', '777', '888', '999'];
}

/**
 * ตรวจจับและดึงยอดเงินออกจากข้อความหรือบรรทัด
 * รูปแบบที่รองรับ:
 * - บน 50 ล่าง 50 หรือ เต็ง 100 โต๊ด 50
 * - =50*50*50 หรือ 50x50x50 (เต็ง/โต๊ด/กลับ)
 * - =50*50 หรือ =50x50 หรือ =50/50 หรือ =50+50
 * - 50*50 หรือ 50x50
 * - =50 หรือ = 50
 * - *50, x50, 50 บาท, ตัวละ 50, อย่างละ 50
 */
export function extractPriceInfo(text, fallbackAmount = 100) {
  if (!text) {
    return {
      cleanedText: '',
      priceSummary: `ค่าเริ่มต้น ${fallbackAmount} บ.`,
      amounts: [Number(fallbackAmount) || 100, Number(fallbackAmount) || 100],
      isPriceDetected: false
    };
  }

  let cleaned = text.trim();
  let amounts = [];
  let priceSummary = '';
  let isPriceDetected = false;

  // 1. ตรวจจับรูปแบบภาษาไทย: เช่น "บน 50 ล่าง 50" หรือ "เต็ง 100 โต๊ด 50"
  const thaiPattern = /(?:บน|เต็ง)\s*[:=]?\s*(\d+)\s*(?:ล่าง|โต๊ด)\s*[:=]?\s*(\d+)/i;
  const thaiMatch = cleaned.match(thaiPattern);
  if (thaiMatch) {
    const a1 = Number(thaiMatch[1]);
    const a2 = Number(thaiMatch[2]);
    amounts = [a1, a2];
    priceSummary = `บน/เต็ง ${a1} บ. | ล่าง/โต๊ด ${a2} บ.`;
    isPriceDetected = true;
    cleaned = cleaned.replace(thaiPattern, ' ');
  }

  // 2. ตรวจจับรูปแบบ 3 ระดับที่มีเครื่องหมาย = นำหน้า: เช่น =50*50*50 หรือ = 50x50x50
  if (!isPriceDetected) {
    const tripleEqPattern = /(?:=\s*)(\d+)\s*[\*xX/]\s*(\d+)\s*[\*xX/]\s*(\d+)/;
    const tripleMatch = cleaned.match(tripleEqPattern);
    if (tripleMatch) {
      const a1 = Number(tripleMatch[1]);
      const a2 = Number(tripleMatch[2]);
      const a3 = Number(tripleMatch[3]);
      amounts = [a1, a2, a3];
      priceSummary = `บน ${a1} | โต๊ด ${a2} | กลับ ${a3} บ.`;
      isPriceDetected = true;
      cleaned = cleaned.replace(tripleEqPattern, ' ');
    }
  }

  // 3. ตรวจจับรูปแบบยอดคู่ที่มีเครื่องหมาย = นำหน้า: เช่น =50*50, =50x50, =50/50, = 50 * 50, =50+50
  if (!isPriceDetected) {
    const dualEqPattern = /(?:=\s*)(\d+)\s*[\*xX/+]\s*(\d+)/;
    const dualMatch = cleaned.match(dualEqPattern);
    if (dualMatch) {
      const a1 = Number(dualMatch[1]);
      const a2 = Number(dualMatch[2]);
      amounts = [a1, a2];
      priceSummary = `บน/เต็ง ${a1} บ. | ล่าง/โต๊ด ${a2} บ.`;
      isPriceDetected = true;
      cleaned = cleaned.replace(dualEqPattern, ' ');
    }
  }

  // 4. ตรวจจับรูปแบบยอดเดี่ยวที่มีเครื่องหมาย = นำหน้า: เช่น =50 หรือ = 50
  if (!isPriceDetected) {
    const singleEqPattern = /(?:=\s*)(\d+)/;
    const singleMatch = cleaned.match(singleEqPattern);
    if (singleMatch) {
      const a1 = Number(singleMatch[1]);
      amounts = [a1, a1];
      priceSummary = `ยอดเงิน ${a1} บ.`;
      isPriceDetected = true;
      cleaned = cleaned.replace(singleEqPattern, ' ');
    }
  }

  // 5. ตรวจจับรูปแบบยอดคู่ที่ไม่มี = (ใช้ * หรือ x เช่น 50*50 หรือ 50x50)
  if (!isPriceDetected) {
    const dualMultPattern = /\b(\d+)\s*[\*xX]\s*(\d+)\b/;
    const dualMatch = cleaned.match(dualMultPattern);
    if (dualMatch) {
      const a1 = Number(dualMatch[1]);
      const a2 = Number(dualMatch[2]);
      amounts = [a1, a2];
      priceSummary = `บน/เต็ง ${a1} บ. | ล่าง/โต๊ด ${a2} บ.`;
      isPriceDetected = true;
      cleaned = cleaned.replace(dualMultPattern, ' ');
    }
  }

  // 6. ตรวจจับรูปแบบยอดเดี่ยวที่มีตัวระบุ: เช่น *100, x100 หรือระบุคำว่า บาท หรือ ตัวละ, อย่างละ, ยอด
  if (!isPriceDetected) {
    const singleWordPattern = /(?:[\*xX]\s*(\d+))|(?:\bบาท\s*(\d+)\b)|(?:\b(\d+)\s*บาท\b)|(?:(?:ตัวละ|อย่างละ|ยอด)\s*[:=]?\s*(\d+))/i;
    const singleMatch = cleaned.match(singleWordPattern);
    if (singleMatch) {
      const a1 = Number(singleMatch[1] || singleMatch[2] || singleMatch[3] || singleMatch[4]);
      amounts = [a1, a1];
      priceSummary = `ยอดเงิน ${a1} บ.`;
      isPriceDetected = true;
      cleaned = cleaned.replace(singleWordPattern, ' ');
    }
  }

  // ถ้าไม่พบยอดเงินในข้อความ ให้ใช้ค่า fallback
  if (!isPriceDetected) {
    const def = Number(fallbackAmount) || 100;
    amounts = [def, def];
    priceSummary = `ไม่พบยอดเงินในข้อความ`;
  }

  return {
    cleanedText: cleaned,
    amounts,
    priceSummary,
    isPriceDetected
  };
}

/**
 * วิเคราะห์ข้อความโพยหวยและแปลงเป็นรายการแทงหวย
 * รองรับ:
 * - 23,45,76,23,46 (คั่นด้วยจุลภาค)
 * - 53 36 60 36 = 50 (มีเลขซ้ำ 36 จะ distinct ก่อน ให้ได้ 36 ยอด 50 เพียงตัวเดียว ไม่กลายเป็น 100)
 * - ขึ้นบรรทัดใหม่หลายบรรทัด ทั้งแบบระบุราคาแต่ละบรรทัด หรือราคารวมท้ายข้อความ หรือไม่ระบุราคา
 * - หากไม่ระบุราคา จะส่ง isPriceDetected: false เพื่อให้หน้าจอแสดงช่องกรอกยอดเงิน
 *
 * @param {string} rawText ข้อความดิบ
 * @param {Object} options ตัวเลือกการวิเคราะห์
 */
export function parseLotteryText(rawText, options = {}) {
  const {
    digitFilter = '2DIGIT',
    fallbackAmount = 100,
    customAmountTop = null,
    customAmountBottom = null,
    autoReverse = false,
    distinct = true,
    selectedBetTypes2D = ['2TOP', '2BOTTOM'],
    selectedBetTypes3D = ['3TOP', '3TOD']
  } = options;

  if (!rawText || !rawText.trim()) {
    return {
      items: [],
      rawTokens: [],
      detectedNumbers: [],
      priceSummary: '',
      isPriceDetected: false,
      amounts: [fallbackAmount, fallbackAmount],
      stats: { totalItems: 0, totalAmount: 0, count2D: 0, count3D: 0, countRun: 0 }
    };
  }

  // 1. แยกข้อความเป็นแต่ละบรรทัดเพื่อรองรับการขึ้นบรรทัดใหม่ และการระบุราคาต่อบรรทัด
  const rawLines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const parsedLines = [];
  let globalPriceInfo = null;

  for (const line of rawLines) {
    const res = extractPriceInfo(line, fallbackAmount);
    // แปลงตัวอักษรที่ไม่ใช่ตัวเลข (0-9) ให้เป็นช่องว่าง (รองรับตัวคั่น , ; - . / _ | ช่องว่าง ฯลฯ)
    const sanitized = res.cleanedText.replace(/[^0-9]/g, ' ');
    const tokens = sanitized.split(/\s+/).map(t => t.trim()).filter(Boolean);

    if (res.isPriceDetected && tokens.length === 0) {
      // บรรทัดนี้เป็นราคาล้วนๆ เช่น "= 50*50" หรือ "= 50"
      globalPriceInfo = res;
    }

    parsedLines.push({
      original: line,
      tokens,
      priceInfo: res.isPriceDetected ? res : null
    });
  }

  // ตรวจสอบว่าตรวจพบราคาจากบรรทัดใดหรือไม่
  const isAnyPriceDetected = Boolean(parsedLines.some(p => p.priceInfo) || globalPriceInfo);

  // กำหนดราคาตั้งต้นกรณีไม่พบราคาในข้อความ (ใช้ customAmountTop / customAmountBottom จากช่องกรอกยอด)
  let defaultPrice2Top = Number(fallbackAmount) || 100;
  let defaultPrice2Bottom = defaultPrice2Top;
  let defaultPrice3Top = defaultPrice2Top;
  let defaultPrice3Tod = defaultPrice2Top;

  if (!isAnyPriceDetected) {
    if (customAmountTop !== null && customAmountTop !== undefined && Number(customAmountTop) > 0) {
      defaultPrice2Top = Number(customAmountTop);
      defaultPrice3Top = Number(customAmountTop);
    }
    if (customAmountBottom !== null && customAmountBottom !== undefined && Number(customAmountBottom) > 0) {
      defaultPrice2Bottom = Number(customAmountBottom);
      defaultPrice3Tod = Number(customAmountBottom);
    } else if (customAmountTop !== null && customAmountTop !== undefined && Number(customAmountTop) > 0) {
      defaultPrice2Bottom = defaultPrice2Top;
      defaultPrice3Tod = defaultPrice3Top;
    }
  }

  // ถ้ามีราคาตรวจพบ ให้สรุปราคารวม
  let summaryText = '';
  if (isAnyPriceDetected) {
    const p = parsedLines.find(x => x.priceInfo)?.priceInfo || globalPriceInfo;
    summaryText = p ? p.priceSummary : 'ตรวจพบยอดเงิน';
  } else {
    if (defaultPrice2Top === defaultPrice2Bottom) {
      summaryText = `กำหนดยอด ${defaultPrice2Top} บ. (ไม่พบยอดในข้อความ)`;
    } else {
      summaryText = `กำหนดยอด บน/เต็ง ${defaultPrice2Top} บ. | ล่าง/โต๊ด ${defaultPrice2Bottom} บ.`;
    }
  }

  const items = [];
  const allDetectedTokens = [];
  const detectedNumbersSet = new Set();
  const seenNumberBetType = new Set();
  let count2D = 0;
  let count3D = 0;
  let countRun = 0;

  for (const pl of parsedLines) {
    let lineTokens = pl.tokens;

    // Distinct ภายในบรรทัด/ข้อความก่อนใส่ยอดเงิน ตามที่ระบุ
    // ป้องกันกรณี "53 36 60 36 = 50" ไม่ให้เลข 36 เบิ้ลเป็นยอด 100
    if (distinct) {
      lineTokens = Array.from(new Set(lineTokens));
    }

    // เลือกว่าจะใช้ราคาของบรรทัดนี้ หรือราคากลาง หรือราคาตั้งต้น
    const activePrice = pl.priceInfo || globalPriceInfo;
    let price2Top = defaultPrice2Top;
    let price2Bottom = defaultPrice2Bottom;
    let price3Top = defaultPrice3Top;
    let price3Tod = defaultPrice3Tod;

    if (activePrice && activePrice.amounts.length > 0) {
      price2Top = activePrice.amounts[0];
      price2Bottom = activePrice.amounts.length > 1 ? activePrice.amounts[1] : price2Top;
      price3Top = activePrice.amounts[0];
      price3Tod = activePrice.amounts.length > 1 ? activePrice.amounts[1] : price3Top;
    }

    for (const token of lineTokens) {
      allDetectedTokens.push(token);

      // กรอง 2 หลัก
      if (token.length === 2 && (digitFilter === '2DIGIT' || digitFilter === 'ALL')) {
        detectedNumbersSet.add(token);

        if (selectedBetTypes2D.includes('2TOP')) {
          const key = `${token}-2TOP`;
          if (!seenNumberBetType.has(key)) {
            seenNumberBetType.add(key);
            items.push({ number: token, betType: '2TOP', amount: price2Top });
            count2D++;
          }
        }
        if (selectedBetTypes2D.includes('2BOTTOM')) {
          const key = `${token}-2BOTTOM`;
          if (!seenNumberBetType.has(key)) {
            seenNumberBetType.add(key);
            items.push({ number: token, betType: '2BOTTOM', amount: price2Bottom });
            count2D++;
          }
        }

        // กลับเลขอัตโนมัติสำหรับ 2 หลัก
        if (autoReverse) {
          const rev = token.split('').reverse().join('');
          detectedNumbersSet.add(rev);
          if (selectedBetTypes2D.includes('2TOP')) {
            const key = `${rev}-2TOP`;
            if (!seenNumberBetType.has(key)) {
              seenNumberBetType.add(key);
              items.push({ number: rev, betType: '2TOP', amount: price2Top });
              count2D++;
            }
          }
          if (selectedBetTypes2D.includes('2BOTTOM')) {
            const key = `${rev}-2BOTTOM`;
            if (!seenNumberBetType.has(key)) {
              seenNumberBetType.add(key);
              items.push({ number: rev, betType: '2BOTTOM', amount: price2Bottom });
              count2D++;
            }
          }
        }
      }
      // กรอง 3 หลัก
      else if (token.length === 3 && (digitFilter === '3DIGIT' || digitFilter === 'ALL')) {
        detectedNumbersSet.add(token);

        if (selectedBetTypes3D.includes('3TOP')) {
          const key = `${token}-3TOP`;
          if (!seenNumberBetType.has(key)) {
            seenNumberBetType.add(key);
            items.push({ number: token, betType: '3TOP', amount: price3Top });
            count3D++;
          }
        }
        if (selectedBetTypes3D.includes('3TOD')) {
          const key = `${token}-3TOD`;
          if (!seenNumberBetType.has(key)) {
            seenNumberBetType.add(key);
            items.push({ number: token, betType: '3TOD', amount: price3Tod });
            count3D++;
          }
        }

        // กลับ 6 ประตูอัตโนมัติสำหรับ 3 หลัก
        if (autoReverse) {
          const perms = generate6Permutations(token);
          for (const perm of perms) {
            detectedNumbersSet.add(perm);
            if (selectedBetTypes3D.includes('3TOP')) {
              const key = `${perm}-3TOP`;
              if (!seenNumberBetType.has(key)) {
                seenNumberBetType.add(key);
                items.push({ number: perm, betType: '3TOP', amount: price3Top });
                count3D++;
              }
            }
            if (selectedBetTypes3D.includes('3TOD')) {
              const key = `${perm}-3TOD`;
              if (!seenNumberBetType.has(key)) {
                seenNumberBetType.add(key);
                items.push({ number: perm, betType: '3TOD', amount: price3Tod });
                count3D++;
              }
            }
          }
        }
      }
      // กรอง 1 หลัก (เลขวิ่ง)
      else if (token.length === 1 && (digitFilter === 'RUN' || digitFilter === 'ALL')) {
        detectedNumbersSet.add(token);
        const keyTop = `${token}-RUN_TOP`;
        if (!seenNumberBetType.has(keyTop)) {
          seenNumberBetType.add(keyTop);
          items.push({ number: token, betType: 'RUN_TOP', amount: price2Top });
          countRun++;
        }
        const keyBottom = `${token}-RUN_BOTTOM`;
        if (!seenNumberBetType.has(keyBottom)) {
          seenNumberBetType.add(keyBottom);
          items.push({ number: token, betType: 'RUN_BOTTOM', amount: price2Bottom });
          countRun++;
        }
      }
    }
  }

  const totalAmount = items.reduce((sum, it) => sum + Number(it.amount || 0), 0);

  return {
    items,
    rawTokens: allDetectedTokens,
    detectedNumbers: Array.from(detectedNumbersSet),
    priceSummary: summaryText,
    isPriceDetected: isAnyPriceDetected,
    amounts: [defaultPrice2Top, defaultPrice2Bottom],
    stats: {
      totalItems: items.length,
      totalAmount,
      count2D,
      count3D,
      countRun
    }
  };
}
