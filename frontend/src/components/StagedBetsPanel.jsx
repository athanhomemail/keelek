import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { QRCodeCanvas } from 'qrcode.react';
import { generatePromptPayPayload, formatPromptPayDisplay } from '../utils/promptpay.js';
import { useAuth } from '../context/AuthContext.jsx';
import { 
  Trash2, Copy, Check, Camera, Grid, 
  CheckCircle, AlertTriangle, XCircle, Sparkles,
  Sliders, ArrowUpRight, ShieldAlert, DollarSign,
  Download, QrCode, Building2, User
} from 'lucide-react';

const BET_TYPE_INFO = {
  '2TOP': { label: '2 ตัวบน', color: 'emerald', border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-300' },
  '2BOTTOM': { label: '2 ตัวล่าง', color: 'blue', border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-300' },
  '3TOP': { label: '3 ตัวบน', color: 'amber', border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-300' },
  '3TOD': { label: '3 ตัวโต๊ด', color: 'purple', border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-300' },
  'RUN_TOP': { label: 'วิ่งบน', color: 'cyan', border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-300' },
  'RUN_BOTTOM': { label: 'วิ่งล่าง', color: 'pink', border: 'border-pink-500/40', bg: 'bg-pink-500/10', text: 'text-pink-300' },
};

const DEFAULT_RATES = {
  '3TOP': 900,
  '3TOD': 130,
  '2TOP': 95,
  '2BOTTOM': 95,
  'RUN_TOP': 3.2,
  'RUN_BOTTOM': 4.2
};

const BET_ORDER = ['2TOP', '2BOTTOM', '3TOP', '3TOD', 'RUN_TOP', 'RUN_BOTTOM'];

export default function StagedBetsPanel({
  stagedItems = [],
  validations = {},
  note = '',
  periodName = '',
  isPaid = false,
  hasUnacceptedItems = false,
  unacceptedItems = [],
  isValidatingQuota = false,
  onUpdateItemAmount,
  onBatchUpdateGroup,
  onRemoveItem,
  onClearAll
}) {
  const [viewMode, setViewMode] = useState('CARDS'); // 'CARDS' | 'CAPTURE'
  const [copied, setCopied] = useState(false);
  const [copyingImg, setCopyingImg] = useState(false);
  const [imgCopied, setImgCopied] = useState(false);
  const [copyImgMsg, setCopyImgMsg] = useState('');
  const [tabWarning, setTabWarning] = useState('');
  const [batchEditType, setBatchEditType] = useState(null);
  const [batchPriceInput, setBatchPriceInput] = useState('');
  const [showPaymentInfo, setShowPaymentInfo] = useState(true);

  const { user } = useAuth();
  const slipRef = useRef(null);
  const warningTimerRef = useRef(null);

  const startWarningTimer = (duration = 5000) => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }
    warningTimerRef.current = setTimeout(() => {
      setTabWarning('');
      warningTimerRef.current = null;
    }, duration);
  };

  const clearWarningTimer = () => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
  };

  // ล้าง timer เมื่อ unmount
  useEffect(() => {
    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, []);

  // ควบคุมการสลับไปยังแท็บสลิปแคปส่งลูกค้า
  const handleSwitchToCapture = () => {
    if (hasUnacceptedItems) {
      const names = unacceptedItems.map(it => `${it.number} (${BET_TYPE_INFO[it.betType]?.label || it.betType})`).join(', ');
      setTabWarning(`🚫 มีตัวเลขที่ไม่สามารถรับได้ (${names}) กรุณาลบออกหรือปรับยอดก่อนเปิดสลิป`);
      startWarningTimer(5000);
      return;
    }
    if (isValidatingQuota) {
      setTabWarning('⏳ กำลังตรวจสอบโควตาตัวเลข กรุณารอสักครู่...');
      startWarningTimer(3000);
      return;
    }
    clearWarningTimer();
    setTabWarning('');
    setViewMode('CAPTURE');
  };

  // หากอยู่ในโหมดสลิปอยู่ แล้วมีเลขที่กลายเป็นอั้น/เกินโควตา ให้เด้งกลับมาหน้าการ์ดปรับแต่ง
  React.useEffect(() => {
    if (viewMode === 'CAPTURE' && hasUnacceptedItems) {
      setViewMode('CARDS');
      setTabWarning('🚫 มีตัวเลขที่ไม่สามารถรับได้ ระบบเปลี่ยนกลับมาที่หน้าการ์ดปรับแต่งเพื่อแก้ไข');
      startWarningTimer(5000);
    }
  }, [hasUnacceptedItems, viewMode]);

  // จัดกลุ่ม stagedItems ตาม betType โดยยังคงเก็บ original index ไว้สำหรับ update/delete
  const groupedByType = useMemo(() => {
    const groups = {};
    stagedItems.forEach((item, originalIndex) => {
      const type = item.betType || 'OTHER';
      if (!groups[type]) {
        groups[type] = [];
      }
      groups[type].push({ ...item, originalIndex });
    });

    // เรียงตัวเลขในแต่ละกลุ่มจากน้อยไปมาก (Ascending: เช่น 00, 01, 12, ... 99)
    Object.keys(groups).forEach(type => {
      groups[type].sort((a, b) => {
        return a.number.localeCompare(b.number, undefined, { numeric: true });
      });
    });

    // Helper คำนวณอัตราจ่ายเต็มและจ่ายครึ่งของหมวดนี้
    const resolveRates = (type, items) => {
      const foundVal = items.find(it => validations[`${it.number}_${it.betType}`]?.baseRate);
      const baseRate = foundVal 
        ? validations[`${foundVal.number}_${foundVal.betType}`].baseRate 
        : (DEFAULT_RATES[type] || 95);
      const halfRate = Number((baseRate / 2).toFixed(2));
      return { baseRate, halfRate };
    };

    // เรียงตาม BET_ORDER
    const ordered = [];
    BET_ORDER.forEach(type => {
      if (groups[type] && groups[type].length > 0) {
        const { baseRate, halfRate } = resolveRates(type, groups[type]);
        ordered.push({
          type,
          info: BET_TYPE_INFO[type] || { label: type, text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/40' },
          items: groups[type],
          totalAmount: groups[type].reduce((sum, it) => sum + Number(it.amount || 0), 0),
          baseRate,
          halfRate
        });
      }
    });

    // ประเภทอื่นๆ ที่อาจอยู่นอกเหนือ default list
    Object.keys(groups).forEach(type => {
      if (!BET_ORDER.includes(type) && groups[type].length > 0) {
        const { baseRate, halfRate } = resolveRates(type, groups[type]);
        ordered.push({
          type,
          info: { label: type, text: 'text-slate-300', bg: 'bg-slate-500/10', border: 'border-slate-700' },
          items: groups[type],
          totalAmount: groups[type].reduce((sum, it) => sum + Number(it.amount || 0), 0),
          baseRate,
          halfRate
        });
      }
    });

    return ordered;
  }, [stagedItems, validations]);

  const totalAmount = stagedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const hasPromptPay = Boolean(user?.promptpay);
  const hasBank = Boolean(user?.account_no && user?.bank_name);

  // คำนวณ Payload PromptPay QR (มาตรฐาน BOT EMVCo) ผูกกับยอดเงินอัตโนมัติ
  const promptPayPayload = useMemo(() => {
    if (!user?.promptpay) return '';
    return generatePromptPayPayload(user.promptpay, totalAmount);
  }, [user?.promptpay, totalAmount]);

  // ดำเนินการปรับราคายกหมวด
  const handleApplyBatchPrice = (type) => {
    const price = Number(batchPriceInput);
    if (!price || price <= 0) return;
    if (onBatchUpdateGroup) {
      onBatchUpdateGroup(type, price);
    }
    setBatchEditType(null);
    setBatchPriceInput('');
  };

  // สร้างข้อความสรุปสำหรับแชร์ทาง Line
  const generateSlipText = () => {
    let text = `🏷️ รายการเลขที่คีย์ | Keelek\n`;
    if (note && note.trim()) text += `📝 หมายเหตุ: ${note.trim()}\n`;
    if (periodName) text += `📅 งวด: ${periodName}\n`;
    text += `⏰ เวลา: ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.\n`;
    text += `--------------------------------\n`;

    groupedByType.forEach(group => {
      text += `📌 ${group.info.label} (จ่ายเต็ม บาทละ ${group.baseRate} | จ่ายครึ่ง บาทละ ${group.halfRate})\n`;
      // จัดกลุ่มตามราคาภายในประเภทเดียวกัน
      const priceMap = {};
      group.items.forEach(it => {
        const amt = it.amount;
        if (!priceMap[amt]) priceMap[amt] = [];
        priceMap[amt].push(it);
      });

      Object.entries(priceMap).forEach(([amt, items]) => {
        const numLabels = items.map(it => {
          const val = validations[`${it.number}_${it.betType}`];
          if (val?.isBlocked) return `${it.number}(อั้น)`;
          if (val?.isHalfPay) return `${it.number}(ครึ่ง)`;
          return it.number;
        });

        text += `• ตัวละ ${Number(amt).toLocaleString()} บ. (${items.length} ตัว):\n`;
        text += `👉 ${numLabels.join(', ')}\n`;
        text += `   [รวม ${(Number(amt) * items.length).toLocaleString()} บ.]\n\n`;
      });
    });

    text += `--------------------------------\n`;
    text += `💰 ยอดรวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท (${stagedItems.length} รายการ)\n`;
    text += `📌 สถานะเงิน: ${isPaid ? '✓ จ่ายแล้ว' : '⏳ ยังไม่จ่าย'}`;

    if (showPaymentInfo) {
      if (hasPromptPay) {
        text += `\n\n🏦 ช่องทางชำระเงิน (พร้อมเพย์):\n`;
        text += `   หมายเลข: ${formatPromptPayDisplay(user.promptpay)}\n`;
        text += `   ชื่อบัญชี: ${user.real_name || user.display_name}`;
      } else if (hasBank) {
        text += `\n\n🏦 ช่องทางชำระเงิน (บัญชีธนาคาร):\n`;
        text += `   ธนาคาร: ${user.bank_name}\n`;
        text += `   เลขบัญชี: ${user.account_no}\n`;
        text += `   ชื่อบัญชี: ${user.real_name || user.display_name}`;
      }
    }

    return text;
  };

  const handleCopySlip = () => {
    if (hasUnacceptedItems) {
      setTabWarning('🚫 มีตัวเลขที่ไม่สามารถรับได้ กรุณาแก้ไขก่อน');
      startWarningTimer(5000);
      setViewMode('CARDS');
      return;
    }
    const text = generateSlipText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // คัดลอกรูปภาพการ์ดสลิปไปยัง Clipboard โดยตรง
  const handleCopyImage = async () => {
    if (!slipRef.current || copyingImg) return;
    if (hasUnacceptedItems) {
      setTabWarning('🚫 มีตัวเลขที่ไม่สามารถรับได้ กรุณาแก้ไขก่อนคัดลอกรูปภาพ');
      startWarningTimer(5000);
      setViewMode('CARDS');
      return;
    }
    setCopyingImg(true);
    setCopyImgMsg('กำลังสร้างรูปภาพ...');

    try {
      const canvas = await html2canvas(slipRef.current, {
        backgroundColor: '#0a0d14',
        scale: 2,
        useCORS: true,
        logging: false
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          throw new Error('ไม่สามารถแปลงสลิปเป็นรูปภาพได้');
        }

        try {
          if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
              new ClipboardItem({ 'image/png': blob })
            ]);
            setImgCopied(true);
            setCopyImgMsg('✓ คัดลอกรูปภาพแล้ว! สามารถกดวาง (Ctrl+V) ได้ทันที');
            setTimeout(() => {
              setImgCopied(false);
              setCopyImgMsg('');
            }, 3500);
          } else {
            throw new Error('Clipboard image write not supported');
          }
        } catch (clipErr) {
          // เบราว์เซอร์บางตัว (เช่น mobile หรือ permission จำกัด) ไม่อนุญาตเขียนรูปภาพลง clipboard ตรงๆ -> ทำ auto-download ให้ทันที
          console.warn('Clipboard write image failed, downloading instead:', clipErr);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `รายการแทงหวย_${note ? note.replace(/[/\\?%*:|"<>]/g, '_') : 'บิล'}_${new Date().toISOString().slice(0, 10)}.png`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          setImgCopied(true);
          setCopyImgMsg('✓ ดาวน์โหลดรูปภาพเรียบร้อยแล้ว (เบราว์เซอร์ไม่รองรับคัดลอกรูปตรง)');
          setTimeout(() => {
            setImgCopied(false);
            setCopyImgMsg('');
          }, 3500);
        }
      }, 'image/png');
    } catch (err) {
      console.error('Failed to copy image:', err);
      setCopyImgMsg('เกิดข้อผิดพลาดในการสร้างรูปภาพ');
      setTimeout(() => setCopyImgMsg(''), 3000);
    } finally {
      setCopyingImg(false);
    }
  };

  // ดาวน์โหลดรูปภาพสลิปโดยตรง
  const handleDownloadImage = async () => {
    if (!slipRef.current) return;
    if (hasUnacceptedItems) {
      setTabWarning('🚫 มีตัวเลขที่ไม่สามารถรับได้ กรุณาแก้ไขก่อน');
      startWarningTimer(5000);
      setViewMode('CARDS');
      return;
    }
    try {
      const canvas = await html2canvas(slipRef.current, {
        backgroundColor: '#0a0d14',
        scale: 2,
        useCORS: true,
        logging: false
      });
      const link = document.createElement('a');
      link.download = `รายการแทงหวย_${note ? note.replace(/[/\\?%*:|"<>]/g, '_') : 'บิล'}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download image error:', err);
    }
  };

  if (!stagedItems.length) return null;

  return (
    <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-2xl transition-all">
      {/* 1. Header Bar: Title, Count, View Toggles & Clear Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm sm:text-base text-slate-100">
                รายการเลขที่กำลังคีย์
              </h3>
              <span className="inline-flex items-center justify-center px-2.5 pt-1 pb-1.5 rounded-full text-xs font-mono font-bold leading-none bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {stagedItems.length} รายการ
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              แสดงเป็นการ์ดกระชับ ปรับราคาและดูโควตาได้แบบ Realtime
            </p>
          </div>
        </div>

        {/* Action Controls & View Switcher */}
        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex bg-obsidian-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('CARDS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'CARDS'
                  ? 'bg-amber-500 text-obsidian-950 shadow-md font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>การ์ดปรับแต่ง</span>
            </button>
            <button
              type="button"
              onClick={handleSwitchToCapture}
              title={
                hasUnacceptedItems
                  ? 'มีตัวเลขที่ไม่สามารถรับได้ กรุณาแก้ไขก่อน'
                  : 'สลิปแคปส่งลูกค้า'
              }
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'CAPTURE'
                  ? 'bg-amber-500 text-obsidian-950 shadow-md font-bold'
                  : hasUnacceptedItems
                  ? 'text-slate-500 opacity-60 hover:opacity-80'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Camera className="w-3.5 h-3.5" />
              <span>สลิปแคปส่งลูกค้า</span>
              {hasUnacceptedItems && (
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 ml-0.5" />
              )}
            </button>
          </div>

          {/* Clear All Button */}
          <button
            type="button"
            onClick={onClearAll}
            className="p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-800 transition-colors"
            title="ล้างทั้งหมด"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Warning banner when blocked items exist */}
      {tabWarning && (
        <div className="mb-4 px-3.5 py-2.5 rounded-2xl text-xs bg-red-500/15 border border-red-500/40 text-red-300 flex flex-wrap items-center justify-between gap-2 shadow-lg animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{tabWarning}</span>
          </div>
          <button 
            type="button"
            onClick={() => {
              clearWarningTimer();
              setTabWarning('');
            }} 
            className="text-slate-400 hover:text-white px-1 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. MODE A: CARDS VIEW (Interactive Mini-Cards grouped by Bet Type) */}
      {viewMode === 'CARDS' && (
        <div className="space-y-4">
          {groupedByType.map(group => (
            <div 
              key={group.type}
              className="bg-obsidian-950/60 rounded-2xl p-3.5 sm:p-4 border border-slate-800/80 shadow-inner"
            >
              {/* Group Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800/60">
                <div className="flex items-center space-x-2">
                  <span className={`inline-flex items-center justify-center px-3 pt-1.5 pb-2 rounded-xl text-xs font-bold leading-none border ${group.info.bg} ${group.info.text} ${group.info.border}`}>
                    {group.info.label}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {group.items.length} ตัว • รวม <strong className="text-slate-200">{group.totalAmount.toLocaleString()}</strong> บ.
                  </span>
                </div>

                {/* Batch Adjust Price for this group */}
                <div className="flex items-center space-x-1.5">
                  {batchEditType === group.type ? (
                    <div className="flex items-center space-x-1 animate-fade-in">
                      <input
                        type="number"
                        min="1"
                        autoFocus
                        placeholder="ยอดเงิน"
                        value={batchPriceInput}
                        onChange={(e) => setBatchPriceInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleApplyBatchPrice(group.type);
                          if (e.key === 'Escape') setBatchEditType(null);
                        }}
                        className="w-20 bg-obsidian-900 border border-amber-500/50 rounded-lg px-2 py-1 text-xs text-amber-300 outline-none text-right font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => handleApplyBatchPrice(group.type)}
                        className="px-2 py-1 bg-amber-500 text-obsidian-950 font-bold rounded-lg text-xs hover:bg-amber-400"
                      >
                        นำไปใช้
                      </button>
                      <button
                        type="button"
                        onClick={() => setBatchEditType(null)}
                        className="p-1 text-slate-400 hover:text-slate-200 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setBatchEditType(group.type);
                        setBatchPriceInput(String(group.items[0]?.amount || 100));
                      }}
                      className="text-[11px] text-slate-400 hover:text-amber-300 bg-obsidian-900 hover:bg-obsidian-850 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center space-x-1 transition-colors"
                    >
                      <Sliders className="w-3 h-3 text-amber-400" />
                      <span>ปรับราคายกหมวด</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Grid of Number Cards (Responsive multi-column) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-2.5">
                {group.items.map(item => {
                  const valKey = `${item.number}_${item.betType}`;
                  const val = validations[valKey];

                  // คำนวณยอดโควตาที่เหลือหลังหักการแทงนี้
                  const remainingQuotaAfter = val ? Math.max(0, val.remainingQuota - Number(item.amount || 0)) : null;
                  const isOverQuota = val && !val.isBlocked && (Number(item.amount || 0) > val.remainingQuota);

                  return (
                    <div
                      key={`${item.number}_${item.betType}_${item.originalIndex}`}
                      className={`relative bg-obsidian-900/90 rounded-xl p-2.5 border transition-all flex flex-col justify-between ${
                        val?.isBlocked 
                          ? 'border-red-500/50 bg-red-950/10' 
                          : isOverQuota
                          ? 'border-red-500/60 bg-red-950/20'
                          : val?.isHalfPay
                          ? 'border-orange-500/40 bg-orange-950/10'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Top: Number + Delete Button */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-lg font-black font-mono tracking-wider leading-none ${
                          val?.isBlocked 
                            ? 'text-red-400 line-through' 
                            : val?.isHalfPay 
                            ? 'text-orange-400' 
                            : 'text-amber-400'
                        }`}>
                          {item.number}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(item.originalIndex)}
                          className="w-5 h-5 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/15 flex items-center justify-center text-xs transition-colors"
                          title="ลบตัวเลขนี้"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Middle: Interactive Amount Input */}
                      <div className="mb-2">
                        <div className="flex items-center bg-obsidian-950 border border-slate-750 focus-within:border-amber-400 rounded-lg px-2 py-1 transition-all">
                          <span className="text-[10px] text-slate-500 mr-1 font-semibold">฿</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              onUpdateItemAmount(item.originalIndex, val === '' ? '' : Number(val));
                            }}
                            className="w-full bg-transparent text-right font-mono font-bold text-xs text-slate-100 outline-none"
                            placeholder="ยอดเงิน"
                          />
                        </div>
                      </div>

                      {/* Bottom: Realtime Quota & Status Indicators */}
                      <div className="text-[10px]">
                        {val?.isBlocked ? (
                          <div className="text-red-400 font-semibold flex items-center space-x-1 truncate" title={val.note || 'เลขอั้น ไม่รับแทง'}>
                            <XCircle className="w-3 h-3 shrink-0" />
                            <span className="truncate">อั้นไม่รับแทง</span>
                          </div>
                        ) : isOverQuota ? (
                          <div>
                            <div className="text-red-400 font-bold flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>เกินโควตา!</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => onUpdateItemAmount(item.originalIndex, val.remainingQuota)}
                              className="text-[9px] text-amber-300 underline hover:text-amber-200 mt-0.5 block truncate"
                            >
                              ปรับเป็น {val.remainingQuota} บ.
                            </button>
                          </div>
                        ) : val?.isHalfPay ? (
                          <div>
                            <span className="text-orange-400 font-medium flex items-center space-x-1">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              <span>จ่ายครึ่ง (เหลือ {val.remainingQuota})</span>
                            </span>
                            <span className="text-[9px] text-slate-500 block font-mono">
                              จ่ายบาทละ {val.effectiveRate}
                            </span>
                          </div>
                        ) : val?.canAccept ? (
                          <div className="text-emerald-400 flex items-center justify-between font-mono">
                            <span className="flex items-center space-x-1">
                              <CheckCircle className="w-3 h-3 shrink-0 text-emerald-500" />
                              <span>รับได้</span>
                            </span>
                            <span className="text-[9px] text-slate-400 font-normal">
                              เหลือ {remainingQuotaAfter}
                            </span>
                          </div>
                        ) : (
                          <div className="text-slate-500 text-[9px] flex items-center space-x-1">
                            <span>กำลังตรวจ...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. MODE B: CAPTURE SLIP VIEW (Ultra-compact, perfect for screenshots & LINE sharing) */}
      {viewMode === 'CAPTURE' && (
        <div className="animate-fade-in">
          {/* Slip Container: Styled like an elegant receipt card */}
          <div 
            ref={slipRef}
            id="staged-capture-slip"
            className="bg-gradient-to-b from-obsidian-950 to-obsidian-900 border-2 border-amber-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden"
          >
            {/* Top decorative receipt bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-400" />

            {/* Slip Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed border-slate-700/80 pb-4 mb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-black text-slate-100 tracking-wide">
                    🏷️ รายการเลขที่คีย์
                  </span>
                  <span className="inline-flex items-center justify-center text-[11px] font-bold leading-none px-2.5 pt-1 pb-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    รอส่งบิล
                  </span>
                </div>
                {note && (
                  <div className="text-xs text-slate-300 mt-1">
                    หมายเหตุ: <strong className="text-amber-400 font-semibold">{note}</strong>
                  </div>
                )}
              </div>

              <div className="text-right text-xs">
                <div className="font-semibold text-slate-300">
                  {periodName || 'งวดปัจจุบัน'}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                </div>
              </div>
            </div>

            {/* Slip Content: Grouped by Bet Type & Amounts */}
            <div className="space-y-4 text-xs font-sans">
              {groupedByType.map(group => {
                // จัดกลุ่มตัวเลขที่ราคาเดียวกันเข้าด้วยกัน
                const priceMap = {};
                group.items.forEach(it => {
                  const amt = it.amount;
                  if (!priceMap[amt]) priceMap[amt] = [];
                  priceMap[amt].push(it);
                });

                return (
                  <div key={group.type} className="bg-obsidian-900/60 rounded-2xl p-3.5 border border-slate-800/80">
                    {/* Category Title & Subtotal */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center justify-center font-bold text-xs leading-none text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 pt-1.5 pb-2 rounded-xl">
                        {group.info.label} ({group.items.length} รายการ)
                      </span>
                      <span className="font-mono font-bold text-slate-200 text-xs">
                        รวม {group.totalAmount.toLocaleString()} บ.
                      </span>
                    </div>

                    {/* Payout Rates Legend - Clean & Minimal Typography */}
                    <div className="flex flex-wrap items-center gap-2 mb-2.5 pb-2 border-b border-slate-800/60 text-xs text-slate-400">
                      <span>จ่ายเต็ม บาทละ <strong className="text-slate-100 font-mono font-bold">{group.baseRate}</strong></span>
                      <span className="text-slate-600">•</span>
                      <span className="inline-flex items-center space-x-1.5">
                        <span>จ่ายครึ่ง (</span>
                        <span className="inline-flex flex-col items-center justify-center font-mono text-slate-100 font-bold leading-none">
                          <span className="pt-0.5 pb-[5px]">ขีดเส้นใต้</span>
                          <span className="w-full h-[2px] bg-amber-400 rounded-full shrink-0" />
                        </span>
                        <span>) บาทละ <strong className="text-amber-400 font-mono font-bold">{group.halfRate}</strong></span>
                      </span>
                    </div>

                    {/* Price subgroups */}
                    <div className="space-y-3 pl-1">
                      {Object.entries(priceMap).map(([amt, items]) => (
                        <div key={amt} className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 border-b border-slate-800/40 pb-2 last:border-b-0">
                          <div className="flex-1">
                            <span className="text-[11px] text-slate-300 font-semibold block mb-1.5">
                              • ตัวละ {Number(amt).toLocaleString()} บ. ({items.length} ตัว):
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {items.map((item, i) => {
                                const valKey = `${item.number}_${group.type}`;
                                const val = validations[valKey];
                                const isBlocked = val?.isBlocked;
                                const isHalf = val?.isHalfPay;

                                if (isBlocked) {
                                  return (
                                    <div 
                                      key={i} 
                                      className="inline-flex flex-col items-center justify-center min-w-[40px] px-2.5 pt-2 pb-1.5 rounded-xl bg-obsidian-950 border border-red-500/50 shadow-sm"
                                      title="เลขอั้น ไม่รับแทง"
                                    >
                                      <div className="flex items-center space-x-1 font-mono font-bold text-sm text-red-400 line-through leading-none tracking-wider text-center pt-1 pb-[7px]">
                                        <span>{item.number}</span>
                                        <span className="text-[9px] font-sans no-underline text-red-400">(อั้น)</span>
                                      </div>
                                      <div className="w-full h-[2.5px] bg-transparent rounded-full shrink-0" />
                                    </div>
                                  );
                                }

                                if (isHalf) {
                                  // เลขจ่ายครึ่ง: ตัวเลขมี pt-1 pb-[7px] leading-none + เส้นใต้สีทองแยกชิ้นหนา 2.5px อยู่ด้านล่างชัดเจน ไม่ทับตัวเลข 100%
                                  return (
                                    <div 
                                      key={i} 
                                      className="inline-flex flex-col items-center justify-center min-w-[40px] px-2.5 pt-2 pb-1.5 rounded-xl bg-obsidian-950 border border-amber-500/60 shadow-sm"
                                      title={`จ่ายครึ่ง (บาทละ ${group.halfRate})`}
                                    >
                                      <div className="font-mono font-black text-sm text-slate-100 leading-none tracking-wider text-center pt-1 pb-[7px]">
                                        {item.number}
                                      </div>
                                      <div className="w-full h-[2.5px] bg-amber-400 rounded-full shrink-0" />
                                    </div>
                                  );
                                }

                                // เลขจ่ายเต็ม: กึ่งกลางสมดุล ความสูงและระดับสายตาเท่ากันเป๊ะด้วย spacer โปร่งใส
                                return (
                                  <div 
                                    key={i} 
                                    className="inline-flex flex-col items-center justify-center min-w-[40px] px-2.5 pt-2 pb-1.5 rounded-xl bg-obsidian-950 border border-slate-800 shadow-sm"
                                    title={`จ่ายเต็ม (บาทละ ${group.baseRate})`}
                                  >
                                    <div className="font-mono font-bold text-sm text-slate-100 leading-none tracking-wider text-center pt-1 pb-[7px]">
                                      {item.number}
                                    </div>
                                    <div className="w-full h-[2.5px] bg-transparent rounded-full shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono text-slate-400 text-xs self-end sm:self-auto">
                            {(Number(amt) * items.length).toLocaleString()} บ.
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slip Footer: Totals & Payment Status */}
            <div className="border-t border-dashed border-slate-700/80 mt-5 pt-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs text-slate-400 block">สถานะชำระเงิน</span>
                <span className={`inline-flex items-center justify-center text-xs font-bold leading-none px-3.5 pt-1.5 pb-2 rounded-xl mt-0.5 ${
                  isPaid 
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isPaid ? '✓ ชำระเงินแล้ว' : '⏳ ยังไม่ชำระเงิน (ค้างจ่าย)'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block">ยอดรวมทั้งสิ้น ({stagedItems.length} รายการ)</span>
                <span className="text-2xl font-black font-mono text-amber-400">
                  {totalAmount.toLocaleString()} <span className="text-sm font-normal text-slate-300 font-sans">บาท</span>
                </span>
              </div>
            </div>

            {/* Slip Payment Box: PromptPay QR Code or Bank Account Card */}
            {showPaymentInfo && (hasPromptPay || hasBank) && (
              <div className="border-t border-dashed border-slate-700/80 mt-5 pt-4">
                {hasPromptPay ? (
                  /* 1. PromptPay Dynamic Thai QR Payment Card (Centered, No Redundant Amount) */
                  <div className="bg-obsidian-900/90 rounded-2xl p-5 border border-amber-500/30 shadow-lg flex flex-col items-center justify-center text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold mb-3">
                      <QrCode className="w-3.5 h-3.5 text-blue-400" />
                      <span>สแกนจ่ายผ่านพร้อมเพย์</span>
                    </div>

                    {/* QR Code Container with white quiet zone */}
                    <div className="bg-white p-2.5 rounded-2xl shadow-md flex flex-col items-center justify-center mb-3">
                      <QRCodeCanvas
                        value={promptPayPayload}
                        size={136}
                        level="M"
                        includeMargin={true}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                      <div className="text-[9px] font-bold text-slate-700 tracking-wider mt-1 uppercase font-mono flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                        <span>Thai QR Payment</span>
                      </div>
                    </div>

                    {/* PromptPay details - Centered */}
                    <div className="space-y-1">
                      <div className="text-xs text-slate-300">
                        ชื่อบัญชีผู้รับ:{' '}
                        <strong className="text-slate-100 font-bold text-sm">
                          {user?.real_name || user?.display_name}
                        </strong>
                      </div>

                      <div className="text-xs text-slate-300">
                        พร้อมเพย์:{' '}
                        <span className="font-mono font-bold text-amber-400 text-base">
                          {formatPromptPayDisplay(user?.promptpay)}
                        </span>
                      </div>

                      <p className="text-[10px] text-slate-400 pt-1 leading-relaxed">
                        💡 สแกนผ่านแอปธนาคาร ยอดเงินระบุให้อัตโนมัติ
                      </p>
                    </div>
                  </div>
                ) : (
                  /* 2. Bank Account Transfer Card (Centered, No Redundant Amount) */
                  <div className="bg-obsidian-900/90 rounded-2xl p-5 border border-amber-500/30 shadow-lg flex flex-col items-center justify-center text-center">
                    {/* Badge */}
                    <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold mb-2">
                      <Building2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>ช่องทางโอนเงินผ่านบัญชีธนาคาร</span>
                    </div>

                    {/* Bank Name */}
                    <div className="text-sm font-bold text-slate-200 mb-3">
                      {user?.bank_name}
                    </div>

                    {/* Account Number Box */}
                    <div className="w-full max-w-xs bg-obsidian-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col items-center justify-center mb-2.5">
                      <span className="text-[11px] text-slate-400 block mb-0.5">เลขที่บัญชี</span>
                      <span className="font-mono font-black text-xl text-amber-400 tracking-wider">
                        {user?.account_no}
                      </span>
                    </div>

                    {/* Account Owner Name */}
                    <div className="text-xs text-slate-300">
                      ชื่อเจ้าของบัญชี:{' '}
                      <strong className="text-slate-100 font-semibold text-sm">
                        {user?.real_name || user?.display_name}
                      </strong>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
            {/* Feedback notification toast or Toggle Option */}
            <div className="flex items-center space-x-3">
              {copyImgMsg ? (
                <div className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 animate-fade-in">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{copyImgMsg}</span>
                </div>
              ) : null}

              {(hasPromptPay || hasBank) && (
                <label className="inline-flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none bg-obsidian-950 hover:bg-obsidian-900 px-3 py-1.5 rounded-xl border border-slate-750 transition-all">
                  <input
                    type="checkbox"
                    checked={showPaymentInfo}
                    onChange={(e) => setShowPaymentInfo(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500 rounded cursor-pointer"
                  />
                  <span>แนบ QR/ข้อมูลชำระเงิน</span>
                </label>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Secondary: Copy Text */}
              <button
                type="button"
                onClick={handleCopySlip}
                className="px-3.5 py-2.5 bg-obsidian-950 hover:bg-obsidian-850 text-slate-300 hover:text-white border border-slate-750 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-98 shadow-sm"
                title="คัดลอกเป็นข้อความตัวหนังสือสำหรับส่งแชท"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-300 font-bold">คัดลอกข้อความแล้ว</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>คัดลอกข้อความ</span>
                  </>
                )}
              </button>

              {/* Secondary: Download Image File */}
              <button
                type="button"
                onClick={handleDownloadImage}
                className="px-3.5 py-2.5 bg-obsidian-950 hover:bg-obsidian-850 text-slate-300 hover:text-white border border-slate-750 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all active:scale-98 shadow-sm"
                title="บันทึกไฟล์รูปภาพลงในเครื่อง"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>ดาวน์โหลดรูป</span>
              </button>

              {/* Primary: Copy Image to Clipboard directly */}
              <button
                type="button"
                disabled={copyingImg}
                onClick={handleCopyImage}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 text-obsidian-950 font-bold rounded-xl text-xs sm:text-sm flex items-center space-x-2 shadow-lg shadow-amber-500/25 transition-all active:scale-98"
                title="คัดลอกรูปภาพสลิปเพื่อไปกดวาง (Ctrl+V)"
              >
                {imgCopied ? (
                  <>
                    <Check className="w-4 h-4 text-obsidian-950" />
                    <span>คัดลอกรูปภาพแล้ว!</span>
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 text-obsidian-950" />
                    <span>{copyingImg ? 'กำลังสร้างรูป...' : '📸 คัดลอกรูปภาพ'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
