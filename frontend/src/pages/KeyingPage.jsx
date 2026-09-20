import React, { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import BillPreviewModal from '../components/BillPreviewModal.jsx';
import StagedBetsPanel from '../components/StagedBetsPanel.jsx';
import LotteryFlag from '../components/LotteryFlag.jsx';
import { 
  Plus, Trash2, Clock, CheckCircle, AlertTriangle, XCircle, DollarSign, 
  User, Sparkles, ChevronDown, ChevronUp, Eye, Receipt, Search, 
  ShieldAlert, Ban, Info, X, Zap, FileText, Clipboard, ArrowLeft
} from 'lucide-react';
import {
  parseLotteryText,
  generate19Pratu,
  generateRoodFront,
  generateRoodBack,
  generateDoubleNumbers,
  generate6Permutations,
  generateTripleNumbers
} from '../utils/lotteryParser.js';

const BET_TYPE_LABELS = {
  'ALL': 'ทุกประเภท',
  '3TOP': '3 ตัวบน',
  '3TOD': '3 ตัวโต๊ด',
  '2TOP': '2 ตัวบน',
  '2BOTTOM': '2 ตัวล่าง',
  'RUN_TOP': 'วิ่งบน',
  'RUN_BOTTOM': 'วิ่งล่าง'
};

const RULE_TYPE_INFO = {
  'BLOCKED': {
    label: 'เลขอั้น ไม่รับแทง',
    badge: '🚫 อั้นไม่รับ',
    shortLabel: 'อั้นไม่รับ',
    cardBg: 'bg-red-500/10 hover:bg-red-500/15 border-red-500/40 text-red-300',
    chipBg: 'bg-red-500/20 text-red-300 border-red-500/40',
    numberColor: 'text-red-400'
  },
  'HALF_PAY': {
    label: 'เลขจ่ายครึ่งราคา',
    badge: '⚠️ จ่ายครึ่ง',
    shortLabel: 'จ่ายครึ่ง',
    cardBg: 'bg-amber-500/10 hover:bg-amber-500/15 border-amber-500/40 text-amber-300',
    chipBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    numberColor: 'text-amber-400'
  },
  'CUSTOM_LIMIT': {
    label: 'จำกัดยอดรับรวม',
    badge: '📉 จำกัดยอด',
    shortLabel: 'จำกัดยอด',
    cardBg: 'bg-cyan-500/10 hover:bg-cyan-500/15 border-cyan-500/40 text-cyan-300',
    chipBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    numberColor: 'text-cyan-400'
  }
};

export default function KeyingPage({ editingBill, onCancelEdit, onEditSuccess, keyingFocusTrigger }) {
  const { user } = useAuth();
  const { quotaUpdates, rulesUpdates } = useSocket();
  const { showAlert, showConfirm } = useModal();

  const [lotteries, setLotteries] = useState([]);
  const [selectedLotteryId, setSelectedLotteryId] = useState(editingBill ? (editingBill.lottery_id || null) : null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [countdown, setCountdown] = useState('');

  const selectedLottery = useMemo(() => {
    return lotteries.find(l => l.id === selectedLotteryId) || null;
  }, [lotteries, selectedLotteryId]);

  // สลับกลับไปหน้าเลือกประเภทหวย
  const handleBackToLotterySelect = async () => {
    if (stagedItems.length > 0) {
      const ok = await showConfirm(
        'เปลี่ยนประเภทหวย?',
        'มีรายการตัวเลขในบิลปัจจุบันที่ยังไม่ได้บันทึก หากเปลี่ยนประเภทหวย รายการตัวเลขจะถูกเคลียร์ ยืนยันการเปลี่ยนหรือไม่?'
      );
      if (!ok) return;
      setStagedItems([]);
    }
    setSelectedLotteryId(null);
  };

  // Bet Categories configuration
  const BET_CATEGORIES = {
    '2DIGIT': {
      id: '2DIGIT',
      name: 'หมวด 2 ตัว',
      digits: 2,
      placeholder: 'เช่น 89',
      types: [
        { id: '2TOP', label: '2 บน' },
        { id: '2BOTTOM', label: '2 ล่าง' }
      ]
    },
    '3DIGIT': {
      id: '3DIGIT',
      name: 'หมวด 3 ตัว',
      digits: 3,
      placeholder: 'เช่น 729',
      types: [
        { id: '3TOP', label: '3 บน' },
        { id: '3TOD', label: '3 โต๊ด' }
      ]
    },
    'RUN': {
      id: 'RUN',
      name: 'หมวดเลขวิ่ง',
      digits: 1,
      placeholder: 'เช่น 5',
      types: [
        { id: 'RUN_TOP', label: 'วิ่งบน' },
        { id: 'RUN_BOTTOM', label: 'วิ่งล่าง' }
      ]
    }
  };

  // Keying input row
  const [activeCategory, setActiveCategory] = useState('2DIGIT');
  const [selectedBetTypes, setSelectedBetTypes] = useState(['2TOP', '2BOTTOM']); // Default multi-selected: 2 บน + 2 ล่าง
  const [inputNumber, setInputNumber] = useState('');
  const [inputAmount, setInputAmount] = useState('100');
  const [autoReverse, setAutoReverse] = useState(false); // กลับเลขอัตโนมัติ
  const [mergedNotice, setMergedNotice] = useState(null);

  // Staged bet list
  const [stagedItems, setStagedItems] = useState([]);
  const [validations, setValidations] = useState({});
  const [isValidatingQuota, setIsValidatingQuota] = useState(false);

  // Customer & Bill info
  const [note, setNote] = useState('');
  const [isPaid, setIsPaid] = useState(false);

  // Smart Text Paste State (วางข้อความโพยหวยยาว)
  const [pasteText, setPasteText] = useState('');
  const [pasteDigitFilter, setPasteDigitFilter] = useState('2DIGIT'); // '2DIGIT' | '3DIGIT' | 'ALL'
  const [pasteAutoReverse, setPasteAutoReverse] = useState(false);
  const [pasteAmountTop, setPasteAmountTop] = useState('50');
  const [pasteAmountBottom, setPasteAmountBottom] = useState('50');
  const [syncTopBottomAmount, setSyncTopBottomAmount] = useState(true);
  const pasteInputRef = useRef(null);
  const pasteAmountTopRef = useRef(null);

  // Completed Bill for Modal Preview & Download
  const [previewBill, setPreviewBill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Number Rules (เลขอั้น / เลขจ่ายครึ่ง / จำกัดยอด) - Default เป็นย่อไว้ตามต้องการ
  const [periodRules, setPeriodRules] = useState([]);
  const [rulesSettings, setRulesSettings] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);
  const [rulesSearch, setRulesSearch] = useState('');
  const [rulesFilter, setRulesFilter] = useState('ALL'); // 'ALL' | 'BLOCKED' | 'HALF_PAY' | 'CUSTOM_LIMIT'

  // Refs & Highlight State สำหรับการโฟกัสการ์ดแผงคีย์ตัวเลขและช่องกรอกตัวเลข
  const keyingCardRef = useRef(null);
  const inputNumberRef = useRef(null);
  const [isCardFocused, setIsCardFocused] = useState(false);

  // ซิงค์หมวดตัวเลขโพยวางตามหมวดที่เลือกคีย์อัตโนมัติ
  useEffect(() => {
    if (activeCategory === '2DIGIT' || activeCategory === '3DIGIT') {
      setPasteDigitFilter(activeCategory);
    }
  }, [activeCategory]);

  // เมื่อเข้าสู่หน้าคีย์ (หลังจากเลือกประเภทหวย) ให้ focus ช่องวางข้อความโพยหวย (Smart Paste) ทันที
  useEffect(() => {
    if (selectedLotteryId && pasteInputRef.current) {
      const timer = setTimeout(() => {
        pasteInputRef.current?.focus({ preventScroll: true });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedLotteryId]);

  // เมื่อผู้ใช้คลิกเมนู "คีย์เลข" ให้ Scroll ไปยังการ์ดแผงคีย์ตัวเลข และ Focus ที่ช่องวางข้อความโพยหวย (Smart Paste)
  useEffect(() => {
    if (keyingFocusTrigger > 0 && selectedLotteryId) {
      // Smooth scroll ไปยังการ์ดแผงคีย์
      if (keyingCardRef.current) {
        keyingCardRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }

      // แสดงเอฟเฟกต์ไฮไลต์กรอบสีทองที่ตัวการ์ดแผงคีย์
      setIsCardFocused(true);
      const timerHighlight = setTimeout(() => {
        setIsCardFocused(false);
      }, 1500);

      // Focus ช่องวางข้อความโพยหวย (Smart Paste) ทันที
      if (pasteInputRef.current) {
        pasteInputRef.current.focus({ preventScroll: true });
      }

      // Re-focus หลังจาก animation
      const timerFocus = setTimeout(() => {
        if (pasteInputRef.current) {
          pasteInputRef.current.focus({ preventScroll: true });
        }
      }, 100);

      return () => {
        clearTimeout(timerHighlight);
        clearTimeout(timerFocus);
      };
    }
  }, [keyingFocusTrigger, selectedLotteryId]);

  const currentCategoryObj = BET_CATEGORIES[activeCategory];
  const maxDigits = currentCategoryObj.digits;

  // Toggle or switch bet types
  const handleToggleBetType = (categoryKey, typeId) => {
    if (activeCategory !== categoryKey) {
      // สลับหมวดหมู่ -> เปลี่ยนเป็นหมวดใหม่และเลือกตัวแรก
      setActiveCategory(categoryKey);
      setSelectedBetTypes([typeId]);
      // ปรับความยาวตัวเลขให้ไม่เกินหมวดใหม่
      const targetDigits = BET_CATEGORIES[categoryKey].digits;
      if (inputNumber.length > targetDigits) {
        setInputNumber(inputNumber.slice(0, targetDigits));
      }
    } else {
      // หมวดเดิม -> รองรับเลือกพร้อมกันหลายประเภท เช่น 2 บน + 2 ล่าง
      if (selectedBetTypes.includes(typeId)) {
        if (selectedBetTypes.length > 1) {
          setSelectedBetTypes(selectedBetTypes.filter(t => t !== typeId));
        }
      } else {
        setSelectedBetTypes([...selectedBetTypes, typeId]);
      }
    }
  };

  // 1. Fetch Lotteries & Active Periods
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [lotteryRes, periodRes] = await Promise.all([
          axios.get('/api/lotteries'),
          axios.get('/api/draw-periods?status=OPEN')
        ]);
        if (lotteryRes.data.success) setLotteries(lotteryRes.data.lotteries);
        if (periodRes.data.success) {
          const openPeriods = periodRes.data.periods;
          setPeriods(openPeriods);
          if (editingBill) {
            const billPeriodId = editingBill.draw_period_id || editingBill.drawPeriodId;
            const active = openPeriods.find(p => p.id === billPeriodId || p.lottery_id === editingBill.lottery_id);
            if (active) {
              setSelectedLotteryId(active.lottery_id);
              setSelectedPeriod(active);
            }
          }
        }
      } catch (err) {
        console.error('Failed to load lotteries:', err);
      }
    };
    fetchData();
  }, [editingBill]);

  // When lottery selection changes, set active period
  useEffect(() => {
    if (selectedLotteryId) {
      const active = periods.find(p => p.lottery_id === selectedLotteryId);
      setSelectedPeriod(active || null);
    } else {
      setSelectedPeriod(null);
    }
  }, [selectedLotteryId, periods]);

  // Countdown timer
  useEffect(() => {
    if (!selectedPeriod || !selectedPeriod.close_time) return;
    const updateCountdown = () => {
      const now = new Date().getTime();
      const close = new Date(selectedPeriod.close_time).getTime();
      const distance = close - now;

      if (distance <= 0) {
        setCountdown('⛔ ปิดรับแทงแล้ว');
      } else {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        if (days > 0) {
          setCountdown(`ปิดรับในอีก: ${days} วัน ${hours} ชม. ${minutes} นาที ${seconds} วินาที`);
        } else {
          setCountdown(`ปิดรับในอีก: ${hours} ชม. ${minutes} นาที ${seconds} วินาที`);
        }
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [selectedPeriod]);

  // ดึงรายการเลขอั้น / เลขจ่ายครึ่ง / จำกัดยอด ของงวดปัจจุบัน
  const fetchNumberRules = async () => {
    if (!selectedPeriod) return;
    setLoadingRules(true);
    try {
      const res = await axios.get(`/api/bets/number-rules?drawPeriodId=${selectedPeriod.id}`);
      if (res.data.success) {
        setPeriodRules(res.data.rules || []);
        setRulesSettings(res.data.settings || null);
      }
    } catch (err) {
      console.warn('Failed to load period number rules:', err.message);
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchNumberRules();
  }, [selectedPeriod, rulesUpdates]);

  // รวมกลุ่มกฎตามตัวเลขและประเภทเงื่อนไข เพื่อให้แสดงผลเป็นการ์ดที่กระชับ สวยงาม
  const groupedRules = useMemo(() => {
    const groups = {};
    periodRules.forEach(r => {
      const key = `${r.number}_${r.rule_type}`;
      if (!groups[key]) {
        groups[key] = {
          number: r.number,
          rule_type: r.rule_type,
          betTypes: [r.bet_type],
          notes: r.note ? [r.note] : [],
          custom_limit: r.custom_limit,
          effectiveRate: r.effectiveRate,
          baseRate: r.baseRate
        };
      } else {
        if (!groups[key].betTypes.includes(r.bet_type)) {
          groups[key].betTypes.push(r.bet_type);
        }
        if (r.note && !groups[key].notes.includes(r.note)) {
          groups[key].notes.push(r.note);
        }
      }
    });
    return Object.values(groups);
  }, [periodRules]);

  // สรุปยอดจำนวนแต่ละประเภทสำหรับป้ายหัวข้อ
  const blockedCount = groupedRules.filter(r => r.rule_type === 'BLOCKED').length;
  const halfPayCount = groupedRules.filter(r => r.rule_type === 'HALF_PAY').length;
  const customLimitCount = groupedRules.filter(r => r.rule_type === 'CUSTOM_LIMIT').length;

  // กรองกฎตามแท็บและคำค้นหา
  const filteredRules = groupedRules.filter(item => {
    if (rulesFilter !== 'ALL' && item.rule_type !== rulesFilter) return false;
    if (rulesSearch.trim()) {
      const q = rulesSearch.trim();
      const matchNum = item.number.includes(q);
      const matchNote = item.notes.some(n => n.toLowerCase().includes(q.toLowerCase()));
      const matchType = item.betTypes.some(t => (BET_TYPE_LABELS[t] || t).includes(q));
      return matchNum || matchNote || matchType;
    }
    return true;
  });

  // ตัวเลขที่กำลังกรอกใน inputNumber ตรงกับกฎใดในงวดนี้หรือไม่
  const matchedInputRules = useMemo(() => {
    if (!inputNumber) return [];
    const num = inputNumber.trim();
    return periodRules.filter(r => r.number === num);
  }, [inputNumber, periodRules]);

  // ฟังก์ชันคลิกเลือกเลขจากการ์ดเลขอั้น/จ่ายครึ่ง เพื่อนำมาใส่ในช่องคีย์ทันที
  const handleSelectRuleNumber = (ruleItem) => {
    const num = ruleItem.number;
    setInputNumber(num);

    // ปรับหมวดหมู่อัตโนมัติตามความยาวของตัวเลข
    if (num.length === 2) {
      setActiveCategory('2DIGIT');
    } else if (num.length === 3) {
      setActiveCategory('3DIGIT');
    } else if (num.length === 1) {
      setActiveCategory('RUN');
    }

    // ปรับประเภทแทงถ้าไม่ใช่ ALL
    const validBetTypes = ruleItem.betTypes.filter(t => t !== 'ALL');
    if (validBetTypes.length > 0) {
      setSelectedBetTypes(validBetTypes);
    }

    // เลื่อนจอไปที่แผงคีย์และ focus ช่องตัวเลข
    if (keyingCardRef.current) {
      keyingCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setTimeout(() => {
      inputNumberRef.current?.focus();
    }, 100);
  };

  // Realtime Quota Validation whenever staged items change or socket event received (Debounced)
  useEffect(() => {
    if (!selectedPeriod || !stagedItems.length) {
      setIsValidatingQuota(false);
      return;
    }
    setIsValidatingQuota(true);
    const timer = setTimeout(async () => {
      try {
        const res = await axios.post('/api/bets/check-quota', {
          drawPeriodId: selectedPeriod.id,
          items: stagedItems
        });
        if (res.data.success) {
          const map = {};
          res.data.validations.forEach(v => {
            map[`${v.number}_${v.betType}`] = v;
          });
          setValidations(map);
        }
      } catch (err) {
        console.warn('Quota check error:', err.message);
      } finally {
        setIsValidatingQuota(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [stagedItems, selectedPeriod, quotaUpdates]);

  // Helper: รวมยอดรายการที่ซ้ำ (Merge) ป้องกันไม่ให้มีเลขเดียวกันประเภทเดียวกันซ้ำในบิล
  const addOrMergeItems = (itemsToAdd) => {
    setStagedItems(prev => {
      let updated = [...prev];
      let mergedNumbers = [];

      for (const newItem of itemsToAdd) {
        const existingIdx = updated.findIndex(
          item => item.number === newItem.number && item.betType === newItem.betType
        );

        if (existingIdx !== -1) {
          // พบเลขเดิมประเภทเดิม -> รวมยอดเงินอัตโนมัติ!
          const oldAmount = Number(updated[existingIdx].amount);
          const newAmount = oldAmount + Number(newItem.amount);
          updated[existingIdx] = {
            ...updated[existingIdx],
            amount: newAmount
          };
          mergedNumbers.push(`${newItem.number} (${newItem.betType}) รวมเป็น ${newAmount} บ.`);
        } else {
          // เลขใหม่ -> เพิ่มที่ด้านบน
          updated.unshift(newItem);
        }
      }

      if (mergedNumbers.length > 0) {
        setMergedNotice(`รวมยอดเลขเดิมให้เรียบร้อยแล้ว: ${mergedNumbers.join(', ')}`);
        setTimeout(() => setMergedNotice(null), 4000);
      }

      return updated;
    });
  };

  // Add numbers from QuickKeypad
  const handleApplyQuickNumbers = (items) => {
    addOrMergeItems(items);
    if (items.length > 0) {
      setMergedNotice(`✨ เพิ่มรายการด่วนเรียบร้อยแล้ว (${items.length} รายการ)`);
      setTimeout(() => setMergedNotice(null), 3500);
    }
  };

  // --- เครื่องมือกระจายเลขด่วน (Instant Quick Action Buttons) ---
  // 1. 19 ประตู (ใช้เลข 1 ตัวในช่องกรอกตัวเลข)
  const handleQuick19Pratu = () => {
    if (!inputNumber || inputNumber.length !== 1) {
      showAlert('กรุณากรอกเลข 1 หลักในช่องตัวเลข (เช่น 5) เพื่อสร้าง 19 ประตู', { type: 'warning' });
      inputNumberRef.current?.focus();
      return;
    }
    const nums = generate19Pratu(inputNumber);
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่ม 19 ประตูของเลข "${inputNumber}" (${nums.length} ตัวเลข) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
    setInputNumber('');
  };

  // 2. รูดหน้า (หลักสิบ)
  const handleQuickRoodFront = () => {
    if (!inputNumber || inputNumber.length !== 1) {
      showAlert('กรุณากรอกเลข 1 หลักในช่องตัวเลข (เช่น 5) เพื่อรูดหน้า', { type: 'warning' });
      inputNumberRef.current?.focus();
      return;
    }
    const nums = generateRoodFront(inputNumber);
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มรูดหน้าของเลข "${inputNumber}" (${nums.length} ตัวเลข: ${inputNumber}0 - ${inputNumber}9) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
    setInputNumber('');
  };

  // 3. รูดหลัง (หลักหน่วย)
  const handleQuickRoodBack = () => {
    if (!inputNumber || inputNumber.length !== 1) {
      showAlert('กรุณากรอกเลข 1 หลักในช่องตัวเลข (เช่น 5) เพื่อรูดหลัง', { type: 'warning' });
      inputNumberRef.current?.focus();
      return;
    }
    const nums = generateRoodBack(inputNumber);
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มรูดหลังของเลข "${inputNumber}" (${nums.length} ตัวเลข: 0${inputNumber} - 9${inputNumber}) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
    setInputNumber('');
  };

  // 4. เลขเบิ้ล 2 ตัว (00 - 99)
  const handleQuickDoubles = () => {
    const nums = generateDoubleNumbers();
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มเลขเบิ้ล 10 หมายเลข (00-99) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
  };

  // 5. กลับ 6 ประตู (เลข 3 ตัว)
  const handleQuick6Permutations = () => {
    if (!inputNumber || inputNumber.length !== 3) {
      showAlert('กรุณากรอกเลข 3 หลักในช่องตัวเลข (เช่น 729) เพื่อกลับ 6 ประตู', { type: 'warning' });
      inputNumberRef.current?.focus();
      return;
    }
    const nums = generate6Permutations(inputNumber);
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มกลับ 6 ประตูของเลข "${inputNumber}" (${nums.length} หมายเลข) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
    setInputNumber('');
  };

  // 6. เลขตอง 3 ตัว (000 - 999)
  const handleQuickTriples = () => {
    const nums = generateTripleNumbers();
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มเลขตอง 10 หมายเลข (000-999) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
  };

  // 7. วิ่งทุกตัว (0 - 9)
  const handleQuickRunAll = () => {
    const nums = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const amt = Math.max(1, Number(inputAmount) || 100);
    const items = [];
    for (const n of nums) {
      for (const bt of selectedBetTypes) {
        items.push({ number: n, betType: bt, amount: amt });
      }
    }
    addOrMergeItems(items);
    setMergedNotice(`⚡ เพิ่มเลขวิ่งทุกตัว (0-9) เรียบร้อยแล้ว`);
    setTimeout(() => setMergedNotice(null), 3500);
  };

  // --- แผงวางข้อความโพยหวยยาว (Smart Text Paste & Auto Parser) ---
  const liveParsed = useMemo(() => {
    if (!pasteText.trim()) return null;
    return parseLotteryText(pasteText, {
      digitFilter: pasteDigitFilter,
      fallbackAmount: Math.max(1, Number(inputAmount) || 100),
      customAmountTop: Number(pasteAmountTop) || 50,
      customAmountBottom: Number(pasteAmountBottom) || 50,
      autoReverse: pasteAutoReverse,
      distinct: true,
      selectedBetTypes2D: selectedBetTypes.some(t => t === '2TOP' || t === '2BOTTOM') ? selectedBetTypes : ['2TOP', '2BOTTOM'],
      selectedBetTypes3D: selectedBetTypes.some(t => t === '3TOP' || t === '3TOD') ? selectedBetTypes : ['3TOP', '3TOD']
    });
  }, [pasteText, pasteDigitFilter, pasteAutoReverse, inputAmount, pasteAmountTop, pasteAmountBottom, selectedBetTypes]);

  const handleApplyPastedText = () => {
    if (!pasteText.trim()) {
      showAlert('กรุณาวางข้อความตัวเลข เช่น 23,45,76,23,46 หรือ 53 36 60 36 = 50', { type: 'warning' });
      return;
    }

    const parsed = parseLotteryText(pasteText, {
      digitFilter: pasteDigitFilter,
      fallbackAmount: Math.max(1, Number(inputAmount) || 100),
      customAmountTop: Number(pasteAmountTop) || 50,
      customAmountBottom: Number(pasteAmountBottom) || 50,
      autoReverse: pasteAutoReverse,
      distinct: true,
      selectedBetTypes2D: selectedBetTypes.some(t => t === '2TOP' || t === '2BOTTOM') ? selectedBetTypes : ['2TOP', '2BOTTOM'],
      selectedBetTypes3D: selectedBetTypes.some(t => t === '3TOP' || t === '3TOD') ? selectedBetTypes : ['3TOP', '3TOD']
    });

    if (!parsed.items.length) {
      const modeName = pasteDigitFilter === '2DIGIT' ? '2 หลัก' : pasteDigitFilter === '3DIGIT' ? '3 หลัก' : 'ที่เลือก';
      showAlert(`ไม่พบตัวเลขที่ตรงกับหมวด "${modeName}" ในข้อความที่วาง`, { type: 'warning' });
      return;
    }

    addOrMergeItems(parsed.items);
    setMergedNotice(`✨ ดึงโพยสำเร็จ! พบ ${parsed.detectedNumbers.length} หมายเลข (${parsed.items.length} รายการ ยอดรวม ${parsed.stats.totalAmount.toLocaleString()} บ.)`);
    setTimeout(() => setMergedNotice(null), 4000);
    setPasteText('');
  };

  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setPasteText(text);
          const parsed = parseLotteryText(text);
          if (!parsed.isPriceDetected) {
            setTimeout(() => pasteAmountTopRef.current?.focus(), 150);
          }
          return;
        }
      }
      pasteInputRef.current?.focus();
    } catch (err) {
      console.warn('Cannot read clipboard:', err);
      pasteInputRef.current?.focus();
    }
  };

  // Add items from manual form
  const handleAddManualItem = (e) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!inputNumber || !inputAmount) return;

    const num = inputNumber.trim();
    const amount = Number(inputAmount);

    if (amount <= 0) {
      setErrorMsg('กรุณาระบุจำนวนเงินที่มากกว่า 0');
      return;
    }

    // ตรวจสอบจำนวนหลักให้ตรงกับหมวดที่เลือก
    if (num.length !== maxDigits) {
      setErrorMsg(`⚠️ ${currentCategoryObj.name} ต้องกรอกตัวเลขให้ครบ ${maxDigits} หลัก (คุณกรอก ${num.length} หลัก)`);
      return;
    }

    const itemsToMerge = [];

    // เพิ่มตามประเภทที่เลือกทั้งหมด (เช่น 2 บน และ 2 ล่าง พร้อมกัน)
    for (const betType of selectedBetTypes) {
      itemsToMerge.push({ number: num, betType, amount });

      // ตรวจสอบการกลับเลขอัตโนมัติ
      if (autoReverse) {
        if (activeCategory === '2DIGIT') {
          const reversed = num.split('').reverse().join('');
          if (reversed !== num) {
            itemsToMerge.push({ number: reversed, betType, amount });
          }
        } else if (activeCategory === '3DIGIT') {
          // สลับเลข 6 ประตู
          const chars = num.split('');
          const perms = new Set([
            chars[0] + chars[1] + chars[2],
            chars[0] + chars[2] + chars[1],
            chars[1] + chars[0] + chars[2],
            chars[1] + chars[2] + chars[0],
            chars[2] + chars[0] + chars[1],
            chars[2] + chars[1] + chars[0]
          ]);
          perms.forEach(p => {
            if (p !== num) itemsToMerge.push({ number: p, betType, amount });
          });
        }
      }
    }

    addOrMergeItems(itemsToMerge);
    setInputNumber('');
  };

  const handleRemoveItem = (index) => {
    setStagedItems(prev => prev.filter((_, i) => i !== index));
  };

  // ปรับยอดเงินของรายการตัวเลขเฉพาะตัว
  const handleUpdateItemAmount = (index, newAmount) => {
    setStagedItems(prev => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], amount: Math.max(0, newAmount) };
      }
      return next;
    });
  };

  // ปรับยอดเงินยกหมวดประเภทแทง (เช่น ปรับ 2 ตัวบน ทุกตัวเป็น 50 บ.)
  const handleBatchUpdateCategory = (betType, newAmount) => {
    const amt = Math.max(0, Number(newAmount) || 0);
    setStagedItems(prev => prev.map(item => {
      if (item.betType === betType) {
        return { ...item, amount: amt };
      }
      return item;
    }));
  };

  const handleClearAll = async () => {
    const ok = await showConfirm('คุณต้องการล้างรายการทั้งหมดใช่หรือไม่?', {
      type: 'warning',
      confirmText: 'ล้างรายการ',
      cancelText: 'ยกเลิก'
    });
    if (ok) {
      setStagedItems([]);
      setValidations({});
    }
  };

  // Submit bill to DB and open preview modal
  const handleSubmitBill = async () => {
    if (!stagedItems.length) {
      setErrorMsg('กรุณาเพิ่มรายการตัวเลขอย่างน้อย 1 รายการ');
      return;
    }

    // Check if any item is blocked or exceeds quota
    if (hasUnacceptedItems) {
      const unacceptedList = unacceptedItems.map(it => `${it.number} (${BET_TYPE_LABELS[it.betType] || it.betType})`).join(', ');
      setErrorMsg(`มีตัวเลขที่ไม่สามารถรับซื้อได้ (${unacceptedList}) กรุณาลบออกหรือปรับยอดก่อนออกบิล`);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await axios.post('/api/bets/submit', {
        drawPeriodId: selectedPeriod.id,
        note: note.trim(),
        isPaidByCustomer: isPaid,
        items: stagedItems
      });

      if (res.data.success) {
        setPreviewBill(res.data.bill);
        setStagedItems([]);
        setValidations({});
        setNote('');
        setIsPaid(false);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'เกิดข้อผิดพลาดในการออกบิล');
    } finally {
      setSubmitting(false);
    }
  };

  // Preview draft bill before submitting
  const handlePreviewDraft = () => {
    if (!stagedItems.length) {
      setErrorMsg('กรุณาเพิ่มรายการตัวเลขอย่างน้อย 1 รายการเพื่อดูตัวอย่าง');
      return;
    }
    if (hasUnacceptedItems) {
      const unacceptedList = unacceptedItems.map(it => `${it.number} (${BET_TYPE_LABELS[it.betType] || it.betType})`).join(', ');
      setErrorMsg(`มีตัวเลขที่ไม่สามารถรับได้ (${unacceptedList}) กรุณาลบออกหรือปรับยอดก่อนดูตัวอย่างบิล`);
      return;
    }
    const draft = {
      billNo: editingBill ? (editingBill.bill_no || editingBill.billNo) : 'DRAFT-' + Math.floor(1000 + Math.random() * 9000),
      periodName: selectedPeriod?.period_name || 'งวดปัจจุบัน',
      memberName: user?.display_name || user?.nickname || 'ผู้คีย์ส่งเลข',
      note: note || '',
      items: stagedItems.map(it => ({
        number: it.number,
        betType: it.betType,
        amount: it.amount,
        payRate: it.payRate || (it.isHalfPay ? (it.baseRate / 2) : (it.baseRate || 95)),
        isHalfPay: it.isHalfPay
      })),
      totalAmount: totalAmount,
      customerPaymentStatus: isPaid ? 'PAID' : 'UNPAID',
      createdAt: new Date().toISOString()
    };
    setPreviewBill(draft);
  };

  // Save edited bill (for existing bills)
  const handleSaveEditedBill = async () => {
    if (!stagedItems.length) {
      setErrorMsg('กรุณาเพิ่มรายการตัวเลขอย่างน้อย 1 รายการ');
      return;
    }
    if (hasUnacceptedItems) {
      const unacceptedList = unacceptedItems.map(it => `${it.number} (${BET_TYPE_LABELS[it.betType] || it.betType})`).join(', ');
      setErrorMsg(`มีตัวเลขที่ไม่สามารถรับซื้อได้ (${unacceptedList}) กรุณาลบออกหรือปรับยอดก่อนบันทึกการแก้ไขบิล`);
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const res = await axios.put(`/api/bills/${editingBill.id}`, {
        note: note.trim(),
        items: stagedItems
      });
      if (res.data.success) {
        await showAlert('บันทึกการแก้ไขบิลเรียบร้อยแล้ว!', { type: 'success' });
        if (onEditSuccess) {
          onEditSuccess();
        }
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกการแก้ไขบิล');
    } finally {
      setSubmitting(false);
    }
  };

  // Populate data when editing an existing bill
  useEffect(() => {
    if (editingBill) {
      setNote(editingBill.note || '');
      setIsPaid((editingBill.customer_payment_status || editingBill.customerPaymentStatus) === 'PAID');
      if (editingBill.items && Array.isArray(editingBill.items)) {
        setStagedItems(editingBill.items.map(it => ({
          id: Math.random().toString(36).substring(2, 9),
          number: it.number,
          betType: it.bet_type || it.betType,
          amount: Number(it.amount),
          baseRate: Number(it.pay_rate || it.payRate || 95),
          payRate: Number(it.pay_rate || it.payRate || 95),
          isHalfPay: Boolean(it.is_half_pay || it.isHalfPay)
        })));
      }
    }
  }, [editingBill]);

  const totalAmount = stagedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  // ตรวจสอบตัวเลขที่รับไม่ได้ (เลขอั้น หรือ เกินโควตา/canAccept เป็น false หรือยอดเงินไม่ถูกต้อง)
  const unacceptedItems = useMemo(() => {
    return stagedItems.filter(item => {
      if (!item.amount || Number(item.amount) <= 0) return true;
      const v = validations[`${item.number}_${item.betType}`];
      return v && (!v.canAccept || v.isBlocked || (v.remainingQuota !== undefined && Number(item.amount || 0) > Number(v.remainingQuota)));
    });
  }, [stagedItems, validations]);

  const hasUnacceptedItems = unacceptedItems.length > 0;

  // STEP 1: หน้าเลือกประเภทหวย (แยกแสดงเดี่ยวๆ ก่อนเข้าไปคีย์)
  if (!selectedLotteryId) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24 animate-fade-in">
        {/* Editing Mode Banner */}
        {editingBill && (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300 shadow-xl">
            <div className="flex items-center space-x-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="font-bold text-sm text-amber-300">
                  กำลังแก้ไขบิล: {editingBill.bill_no || editingBill.billNo}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  กรุณาเลือกประเภทหวยของบิลนี้เพื่อเริ่มแก้ไข
                </p>
              </div>
            </div>
            {onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="px-3.5 py-1.5 bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>
        )}

        {/* Header Title */}
        <div className="text-center mb-8 pt-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 text-obsidian-950 shadow-xl shadow-amber-500/20 mb-3">
            <Receipt className="w-7 h-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
            เลือกประเภทหวย
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 max-w-md mx-auto">
            กรุณาเลือกประเภทหวยที่ต้องการเพื่อเริ่มคีย์โพย
          </p>
        </div>

        {/* Grid of Lottery Type Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          {lotteries.map((lot) => {
            const activePeriod = periods.find(p => p.lottery_id === lot.id);
            const isOpen = activePeriod && activePeriod.status === 'OPEN';

            return (
              <div
                key={lot.id}
                onClick={() => {
                  setSelectedLotteryId(lot.id);
                  setSelectedPeriod(activePeriod || null);
                }}
                className="group relative bg-obsidian-900 hover:bg-obsidian-850 border border-slate-800 hover:border-amber-400 rounded-3xl p-5 sm:p-6 transition-all duration-300 shadow-xl hover:shadow-2xl hover:shadow-amber-500/10 hover:scale-[1.02] cursor-pointer flex flex-col justify-between"
              >
                {/* Top: Flag + Draw Schedule */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 bg-obsidian-950 rounded-2xl border border-slate-800 shadow-inner group-hover:border-amber-500/40 transition-colors">
                    <LotteryFlag code={lot.code} className="w-14 h-9 rounded-lg shadow-md object-cover" />
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 bg-obsidian-950 px-3 py-1.5 rounded-full border border-slate-800">
                    {lot.code === 'THAI' ? 'ออกวันที่ 1 และ 16' : 'ออกทุก จันทร์/พุธ/ศุกร์'}
                  </span>
                </div>

                {/* Lottery Info */}
                <div className="mb-5">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                    {lot.name}
                  </h3>
                  <div className="mt-2.5 flex items-center space-x-2 text-xs">
                    {activePeriod ? (
                      <span className="text-slate-300 font-mono bg-obsidian-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px]">
                        งวด: {activePeriod.period_name}
                      </span>
                    ) : (
                      <span className="text-slate-500 text-xs italic">
                        ยังไม่มีงวดเปิดรับ
                      </span>
                    )}

                    {isOpen ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>เปิดรับแทง</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                        ปิดรับ
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom CTA Bar */}
                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-amber-400 group-hover:text-amber-300 transition-colors">
                  <span>เข้าสู่หน้าคีย์โพย</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-500/15 group-hover:bg-amber-500 group-hover:text-obsidian-950 border border-amber-500/30 flex items-center justify-center transition-all shadow-sm">
                    ➔
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {lotteries.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">
            กำลังโหลดประเภทหวย...
          </div>
        )}
      </div>
    );
  }

  // STEP 2: หน้าคีย์เลขของประเภทหวยที่เลือก
  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24">
      
      {/* Editing Mode Banner */}
      {editingBill && (
        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 mb-4 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-300 shadow-xl animate-pulse">
          <div className="flex items-center space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-amber-300 flex items-center space-x-1.5">
                <span>กำลังแก้ไขบิล: {editingBill.bill_no || editingBill.billNo}</span>
                {editingBill.note && (
                  <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-sans text-amber-300">
                    หมายเหตุ: {editingBill.note}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                คุณสามารถเพิ่ม/ลบรายการตัวเลข และกด "บันทึกการแก้ไขบิล" เพื่ออัปเดตยอดเงินใหม่ได้ทันที
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3.5 py-1.5 bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>
      )}

      {/* Top Bar: Change Lottery Type + Selected Lottery Info + Countdown Banner */}
      <div className="bg-obsidian-900 border border-amber-500/20 rounded-2xl p-3.5 sm:p-4 mb-5 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleBackToLotterySelect}
            className="px-3 py-1.5 bg-obsidian-950 hover:bg-obsidian-800 text-slate-300 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 group"
            title="กลับไปเลือกประเภทหวยอื่น"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-amber-400 group-hover:-translate-x-0.5 transition-transform" />
            <span>เปลี่ยนประเภทหวย</span>
          </button>

          <div className="h-6 w-[1px] bg-slate-800 hidden sm:block"></div>

          <div className="flex items-center space-x-2.5">
            <LotteryFlag code={selectedLottery?.code} className="w-7 h-5 rounded shadow-sm" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 leading-tight">
                {selectedLottery?.name || 'หวย'}
              </h2>
              <span className="text-[11px] text-amber-400/90 font-mono">
                {selectedPeriod?.period_name || 'กำลังโหลดงวด...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl ml-auto">
          <Clock className="w-4 h-4 animate-spin-slow" />
          <span>{countdown || 'กำลังเปิดรับแทง'}</span>
        </div>
      </div>

      {/* 2.5 Blocked & Half-Pay Numbers Bulletin (แผงแสดงรายการเลขอั้น / เลขจ่ายครึ่ง ประจำงวด) */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-2xl transition-all">
        {/* Header with Title, Badges & Collapsible Button */}
        <div className={`flex flex-wrap items-center justify-between gap-3 ${isRulesExpanded ? 'border-b border-slate-800/80 pb-3' : ''}`}>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100 flex items-center space-x-2">
                  <span>เลขอั้น / เลขจ่ายครึ่ง ประจำงวด</span>
                  {loadingRules && (
                    <span className="text-[10px] text-amber-400 font-normal animate-pulse">กำลังโหลด...</span>
                  )}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                ตัวเลขที่มีเงื่อนไขพิเศษของ {selectedPeriod?.period_name || 'งวดปัจจุบัน'}
              </p>
            </div>
          </div>

          {/* Count Badges & Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {blockedCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/40 flex items-center space-x-1 shadow-sm">
                <span>🚫 เลขอั้น</span>
                <span className="font-mono bg-red-500/30 px-1.5 py-0.2 rounded-full">{blockedCount}</span>
              </span>
            )}
            {halfPayCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center space-x-1 shadow-sm">
                <span>⚠️ จ่ายครึ่ง</span>
                <span className="font-mono bg-amber-500/30 px-1.5 py-0.2 rounded-full">{halfPayCount}</span>
              </span>
            )}
            {customLimitCount > 0 && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center space-x-1 shadow-sm">
                <span>📉 จำกัดยอด</span>
                <span className="font-mono bg-cyan-500/30 px-1.5 py-0.2 rounded-full">{customLimitCount}</span>
              </span>
            )}
            {groupedRules.length === 0 && !loadingRules && (
              <span className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                ✨ งวดนี้ไม่มีเลขอั้น
              </span>
            )}

            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="py-1.5 px-3 bg-obsidian-950 hover:bg-obsidian-850 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700/80 transition-all flex items-center space-x-1.5 shadow-sm active:scale-95"
            >
              <span>{isRulesExpanded ? 'ย่อแผงเลข' : `ดูรายการ (${groupedRules.length})`}</span>
              {isRulesExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-400" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-400" />}
            </button>
          </div>
        </div>

        {/* Expanded Content */}
        {isRulesExpanded && (
          <div className="mt-3.5 space-y-3 animate-fade-in">
            {/* Search Bar & Filter Tabs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                <input
                  type="text"
                  value={rulesSearch}
                  onChange={(e) => setRulesSearch(e.target.value)}
                  placeholder="🔍 ค้นหาตัวเลข เช่น 89 หรือหมายเหตุ..."
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-200 outline-none font-mono placeholder:font-sans placeholder:text-slate-500"
                />
                {rulesSearch && (
                  <button
                    onClick={() => setRulesSearch('')}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs no-scrollbar">
                <button
                  type="button"
                  onClick={() => setRulesFilter('ALL')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                    rulesFilter === 'ALL'
                      ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20'
                      : 'bg-obsidian-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  ทั้งหมด ({groupedRules.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRulesFilter('BLOCKED')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                    rulesFilter === 'BLOCKED'
                      ? 'bg-red-500 text-white shadow-md shadow-red-500/20'
                      : 'bg-obsidian-950 text-red-400/80 hover:text-red-300 border border-slate-800'
                  }`}
                >
                  🚫 เลขอั้น ({blockedCount})
                </button>
                <button
                  type="button"
                  onClick={() => setRulesFilter('HALF_PAY')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                    rulesFilter === 'HALF_PAY'
                      ? 'bg-orange-500 text-obsidian-950 shadow-md shadow-orange-500/20'
                      : 'bg-obsidian-950 text-orange-400/80 hover:text-orange-300 border border-slate-800'
                  }`}
                >
                  ⚠️ จ่ายครึ่ง ({halfPayCount})
                </button>
                {customLimitCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setRulesFilter('CUSTOM_LIMIT')}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 ${
                      rulesFilter === 'CUSTOM_LIMIT'
                        ? 'bg-cyan-500 text-obsidian-950 shadow-md shadow-cyan-500/20'
                        : 'bg-obsidian-950 text-cyan-400/80 hover:text-cyan-300 border border-slate-800'
                    }`}
                  >
                    📉 จำกัดยอด ({customLimitCount})
                  </button>
                )}
              </div>
            </div>

            {/* Number Cards Grid */}
            {filteredRules.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs bg-obsidian-950/60 rounded-2xl border border-slate-800/80">
                {periodRules.length === 0 ? (
                  <div className="space-y-1">
                    <span className="text-2xl block mb-1">🎉</span>
                    <p className="font-semibold text-slate-200">งวดนี้ไม่มีเลขอั้นและเลขจ่ายครึ่ง</p>
                    <p className="text-[11px] text-slate-500">สามารถรับแทงได้เต็มจำนวนตามเพดานปกติทุกตัวเลข</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <p className="font-semibold text-slate-300">ไม่พบตัวเลขที่ตรงกับ "{rulesSearch}"</p>
                    <button
                      type="button"
                      onClick={() => { setRulesSearch(''); setRulesFilter('ALL'); }}
                      className="text-[11px] text-amber-400 hover:underline"
                    >
                      ล้างคำค้นหาและตัวกรอง
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {filteredRules.map((item, idx) => {
                  const info = RULE_TYPE_INFO[item.rule_type] || RULE_TYPE_INFO.BLOCKED;
                  const betTypeStr = item.betTypes.map(t => BET_TYPE_LABELS[t] || t).join(', ');
                  const isBlocked = item.rule_type === 'BLOCKED';

                  return (
                    <div
                      key={idx}
                      onClick={() => !isBlocked && handleSelectRuleNumber(item)}
                      className={`p-3 rounded-2xl border transition-all shadow-md ${info.cardBg} ${
                        isBlocked
                          ? 'cursor-default'
                          : 'cursor-pointer group hover:scale-[1.02]'
                      }`}
                      title={isBlocked ? 'เลขอั้น ไม่สามารถรับแทงได้' : 'คลิกเพื่อนำเลขนี้ไปใส่ในช่องคีย์ทันที'}
                    >
                      <div className="flex items-start justify-between mb-1">
                        <span className={`text-2xl font-bold font-mono tracking-wider ${info.numberColor}`}>
                          {item.number}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${info.chipBg}`}>
                          {info.shortLabel}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-300 font-medium truncate mb-1">
                        {betTypeStr}
                      </div>

                      {item.rule_type === 'HALF_PAY' && (
                        <div className="text-[10px] text-amber-400 font-mono mb-1">
                          จ่ายบาทละ <strong>{item.effectiveRate || 'ครึ่งราคา'}</strong>
                        </div>
                      )}

                      {item.rule_type === 'CUSTOM_LIMIT' && item.custom_limit && (
                        <div className="text-[10px] text-cyan-400 font-mono mb-1">
                          รับไม่เกิน <strong>{Number(item.custom_limit).toLocaleString()}</strong> บ.
                        </div>
                      )}

                      {item.notes.length > 0 && (
                        <div className="text-[10px] text-slate-400 italic line-clamp-1">
                          {item.notes.join(' / ')}
                        </div>
                      )}

                      {/* แสดง 'แตะเพื่อคีย์' เฉพาะเลขที่สามารถรับแทงได้ (ไม่ใช่เลขอั้น) */}
                      {!isBlocked ? (
                        <div className="mt-2 pt-1.5 border-t border-slate-700/40 flex items-center justify-between text-[10px] text-slate-400 group-hover:text-amber-300 transition-colors">
                          <span>แตะเพื่อคีย์</span>
                          <span className="font-bold text-amber-400">➔</span>
                        </div>
                      ) : (
                        <div className="mt-2 pt-1.5 border-t border-red-500/20 flex items-center justify-between text-[10px] text-red-400/80">
                          <span>งดรับแทง</span>
                          <span>⛔</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Notice when duplicate numbers merged */}
      {mergedNotice && (
        <div className="mb-4 p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-300 text-xs flex items-center space-x-2 animate-fade-in shadow-lg">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="font-medium">{mergedNotice}</span>
        </div>
      )}

      {/* 3. Unified Keying Panel (Manual Keying, Instant Quick Tools & Smart Paste) */}
      <div 
        ref={keyingCardRef}
        className={`glass-panel rounded-3xl p-4 sm:p-6 mb-5 shadow-2xl border transition-all duration-300 scroll-mt-20 md:scroll-mt-24 ${
          isCardFocused
            ? 'border-amber-400 ring-4 ring-amber-400/30 shadow-amber-500/20'
            : 'border-amber-500/20'
        }`}
      >
        
        {/* Panel Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-5">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base sm:text-lg text-slate-100">แผงคีย์ตัวเลข & เครื่องมือด่วน</h3>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center space-x-1">
                  <Sparkles className="w-3 h-3" />
                  <span>คีย์เร็ว + วางโพย</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="text-amber-400 font-mono font-bold bg-obsidian-950 px-3 py-1.5 rounded-xl border border-slate-800">
              งวด: {selectedPeriod?.period_name || '...'}
            </span>
          </div>
        </div>

        {/* SECTION 1: Smart Long-Text Paste (วางข้อความโพยหวย) */}
        <div className="mb-6 pb-6 border-b border-slate-800/90 animate-fade-in">
          
          {/* Header of Paste Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Clipboard className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                  <span>วางข้อความโพยหวย (Smart Paste)</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 rounded-full font-bold">
                    วางแล้วกด Enter ↵
                  </span>
                </h4>
              </div>
            </div>

            {/* Filter Tabs (2 หลัก, 3 หลัก, ทั้งหมด) */}
            <div className="flex items-center bg-obsidian-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto shadow-inner">
              <button
                type="button"
                onClick={() => setPasteDigitFilter('2DIGIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pasteDigitFilter === '2DIGIT'
                    ? 'bg-amber-500 text-obsidian-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2 หลัก
              </button>
              <button
                type="button"
                onClick={() => setPasteDigitFilter('3DIGIT')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pasteDigitFilter === '3DIGIT'
                    ? 'bg-amber-500 text-obsidian-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3 หลัก
              </button>
              <button
                type="button"
                onClick={() => setPasteDigitFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pasteDigitFilter === 'ALL'
                    ? 'bg-amber-500 text-obsidian-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="ดึงทั้งเลข 2 ตัว และ 3 ตัวออกจากข้อความพร้อมกัน"
              >
                ทั้งหมด
              </button>
            </div>
          </div>

          {/* Quick explanation pill */}
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1 text-[11px] text-slate-400">
            <span className="flex items-center space-x-1.5 flex-wrap">
              <span className="text-amber-400 font-semibold">💡 ตัวอย่าง:</span>
              <span className="text-slate-300 text-[11px]">
                23,45,76 หรือ 53 36 60 = 50 (รองรับขึ้นบรรทัดใหม่)
              </span>
            </span>
            <span className="text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-[10px]">
              ✨ ตัดเลขซ้ำอัตโนมัติ
            </span>
          </div>

          {/* Textarea Input */}
          <div className="relative">
            <textarea
              ref={pasteInputRef}
              rows={2}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              onPaste={(e) => {
                const pasted = e.clipboardData?.getData('text') || '';
                if (pasted) {
                  const parsed = parseLotteryText(pasted);
                  if (!parsed.isPriceDetected) {
                    setTimeout(() => pasteAmountTopRef.current?.focus(), 150);
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleApplyPastedText();
                }
              }}
              placeholder="วางข้อความโพยหวย เช่น 23,45,76 หรือ 53 36 60 = 50 (กด Enter เพื่อเพิ่มเข้าบิล)"
              className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-2xl p-3.5 pr-24 text-sm font-mono text-amber-200 outline-none transition-all placeholder:font-sans placeholder:text-slate-600 placeholder:text-xs shadow-inner resize-y min-h-[72px]"
            />

            {/* Quick paste button inside textarea top-right */}
            <div className="absolute right-2.5 top-2.5 flex items-center space-x-1.5">
              {pasteText && (
                <button
                  type="button"
                  onClick={() => setPasteText('')}
                  className="px-2 py-1 text-[11px] text-slate-400 hover:text-white bg-obsidian-900 hover:bg-obsidian-800 rounded-lg border border-slate-700 transition-colors"
                  title="ล้างข้อความ"
                >
                  ล้าง
                </button>
              )}
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg border border-amber-500/40 flex items-center space-x-1 transition-colors"
                title="คลิกเพื่อวางข้อความจากคลิปบอร์ด"
              >
                <Clipboard className="w-3 h-3" />
                <span>วาง</span>
              </button>
            </div>
          </div>

          {/* Missing Price: Explicit Amount Inputs & Quick Preset Buttons */}
          {pasteText.trim().length > 0 && liveParsed && !liveParsed.isPriceDetected && (
            <div className="mt-2.5 p-3.5 rounded-2xl bg-amber-500/10 border-2 border-amber-500/40 text-xs animate-fade-in shadow-xl backdrop-blur-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <span className="font-bold text-amber-300 flex items-center space-x-1.5 text-xs sm:text-sm">
                  <DollarSign className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>ข้อความนี้ไม่ได้ระบุยอดเงิน — กรุณากรอกยอดเงินสำหรับโพยนี้:</span>
                </span>
                {/* Quick preset chips */}
                <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                  <span className="text-[10px] text-slate-400 mr-1 hidden sm:inline">ยอดด่วน:</span>
                  {['20*20', '50*50', '100*100', '200*200'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        const [t, b] = preset.split('*');
                        setPasteAmountTop(t);
                        setPasteAmountBottom(b);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-obsidian-950 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                      title={`ตั้งค่ายอด ${preset}`}
                    >
                      {preset}
                    </button>
                  ))}
                  {['20', '50', '100'].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => {
                        setPasteAmountTop(val);
                        setPasteAmountBottom(val);
                      }}
                      className="px-2 py-1 rounded-lg bg-obsidian-900 hover:bg-amber-500/20 text-slate-300 hover:text-amber-200 border border-slate-700 text-[11px] font-mono font-bold transition-all"
                      title={`ใส่ยอดเท่ากัน ${val} บ.`}
                    >
                      {val} บ.
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-obsidian-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-amber-300 font-bold flex items-center space-x-1">
                      <span>{pasteDigitFilter === '3DIGIT' ? '🎯 3 บน / เต็ง (บาท)' : '🎯 2 บน (บาท)'}</span>
                    </label>
                    <span className="text-[10px] text-slate-400">กด Enter เพื่อเพิ่มบิล</span>
                  </div>
                  <input
                    ref={pasteAmountTopRef}
                    type="number"
                    min="1"
                    value={pasteAmountTop}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPasteAmountTop(val);
                      if (syncTopBottomAmount) {
                        setPasteAmountBottom(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyPastedText();
                      }
                    }}
                    placeholder="50"
                    className="w-full bg-obsidian-900 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg px-3 py-2 text-center font-bold text-amber-300 outline-none text-base shadow-inner tabular-numbers"
                  />
                </div>

                <div className="bg-obsidian-950/80 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-amber-300 font-bold flex items-center space-x-1">
                      <span>{pasteDigitFilter === '3DIGIT' ? '🎯 3 โต๊ด (บาท)' : '🎯 2 ล่าง (บาท)'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSyncTopBottomAmount(!syncTopBottomAmount)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${
                        syncTopBottomAmount 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                          : 'bg-obsidian-900 text-slate-400 border-slate-700 hover:text-slate-200'
                      }`}
                      title="กดเพื่อล็อคยอดบนและล่างให้เท่ากันอัตโนมัติ"
                    >
                      {syncTopBottomAmount ? '🔗 ล็อคยอดเท่ากัน' : '🔓 แยกยอดอิสระ'}
                    </button>
                  </div>
                  <input
                    type="number"
                    min="1"
                    value={pasteAmountBottom}
                    onChange={(e) => {
                      setPasteAmountBottom(e.target.value);
                      if (syncTopBottomAmount) {
                        setSyncTopBottomAmount(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyPastedText();
                      }
                    }}
                    placeholder="50"
                    className="w-full bg-obsidian-900 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 rounded-lg px-3 py-2 text-center font-bold text-amber-300 outline-none text-base shadow-inner tabular-numbers"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Live Detection Summary Bar */}
          {liveParsed && liveParsed.detectedNumbers.length > 0 && (
            <div className={`mt-2.5 p-3 rounded-2xl text-xs animate-fade-in shadow-md ${
              liveParsed.isPriceDetected
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
            }`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="font-bold flex items-center space-x-1.5">
                    <span>{liveParsed.isPriceDetected ? '✅' : '🔎'} สแกนพบ {liveParsed.detectedNumbers.length} หมายเลข</span>
                    <span className="text-[10px] font-normal px-1.5 py-0.5 rounded bg-obsidian-950/60 border border-slate-800">
                      ตัดเลขซ้ำแล้ว (Distinct)
                    </span>
                    <span className="text-[11px] font-normal text-slate-300">
                      ({liveParsed.priceSummary})
                    </span>
                  </span>
                </div>
                <div className="font-bold text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                  รวม {liveParsed.items.length} รายการ ({liveParsed.stats.totalAmount.toLocaleString()} บาท)
                </div>
              </div>

              {/* Chips of detected numbers */}
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-20 overflow-y-auto no-scrollbar">
                {liveParsed.detectedNumbers.map((num, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-lg bg-obsidian-950 border border-amber-500/30 font-mono text-[11px] font-bold text-amber-300"
                  >
                    {num}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Row below Textarea */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3">
            {/* Auto reverse checkbox for pasted text */}
            <label className="flex items-center space-x-2 cursor-pointer select-none text-xs text-slate-300">
              <input
                type="checkbox"
                checked={pasteAutoReverse}
                onChange={(e) => setPasteAutoReverse(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-obsidian-900 cursor-pointer accent-amber-500"
              />
              <span>กลับเลขอัตโนมัติสำหรับตัวเลขที่ดึงได้</span>
            </label>

            {/* Submit Paste Button */}
            <button
              type="button"
              disabled={!pasteText.trim() || !liveParsed?.items.length}
              onClick={handleApplyPastedText}
              className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 disabled:cursor-not-allowed text-obsidian-950 font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 text-xs sm:text-sm transition-all active:scale-95 whitespace-nowrap ml-auto"
            >
              <span>เพิ่มเข้าบิล ({liveParsed?.items.length || 0} รายการ)</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-obsidian-950/40 text-obsidian-950 rounded font-mono font-bold">
                Enter
              </kbd>
            </button>
          </div>

        </div>

        {/* SECTION 2: Manual Keying Form & Instant Quick Action Buttons */}
        <form onSubmit={handleAddManualItem} className="space-y-4">
          
          {/* Bet Type Selection Grouped by Digits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-semibold flex items-center space-x-1.5">
                <span>เลือกหมวดและประเภทแทง:</span>
              </label>
              <span className="text-[11px] text-slate-400 bg-obsidian-950 px-2 py-0.5 rounded-full border border-slate-800">
                หมวดปัจจุบัน: <strong className="text-amber-300">{currentCategoryObj.name} ({maxDigits} หลัก)</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {Object.entries(BET_CATEGORIES).map(([catKey, cat]) => {
                const isCurrentCategory = activeCategory === catKey;
                return (
                  <div
                    key={catKey}
                    className={`p-2.5 rounded-2xl border transition-all ${
                      isCurrentCategory
                        ? 'bg-obsidian-950/90 border-amber-500/50 shadow-md shadow-amber-500/10'
                        : 'bg-obsidian-950/40 border-slate-800/60 opacity-70 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5 px-1">
                      <span>{cat.name} ({cat.digits} หลัก)</span>
                      {isCurrentCategory && (
                        <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded font-bold">
                          ใช้งานอยู่
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {cat.types.map((t) => {
                        const isSelected = isCurrentCategory && selectedBetTypes.includes(t.id);
                        return (
                          <button
                            type="button"
                            key={t.id}
                            onClick={() => handleToggleBetType(catKey, t.id)}
                            className={`py-2 px-2 rounded-xl text-xs font-bold transition-all ${
                              isSelected
                                ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20 scale-[1.02]'
                                : isCurrentCategory
                                ? 'bg-obsidian-900 text-slate-200 hover:text-white border border-amber-500/30'
                                : 'bg-obsidian-900 text-slate-500 hover:text-slate-300 border border-slate-800'
                            }`}
                          >
                            {isSelected ? `✓ ${t.label}` : t.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Number, Amount, Auto Reverse & Add Button Row */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
            {/* 1. Number Input */}
            <div className="flex-1 min-w-[140px]">
              <div className="flex justify-between items-center mb-1.5 px-0.5">
                <label className="text-xs text-slate-300 font-semibold">ตัวเลข:</label>
                <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-1.5 py-0.2 rounded">
                  จำกัด {maxDigits} หลัก ({inputNumber.length}/{maxDigits})
                </span>
              </div>
              <input
                ref={inputNumberRef}
                type="text"
                maxLength={maxDigits}
                value={inputNumber}
                onChange={(e) => setInputNumber(e.target.value.replace(/\D/g, '').slice(0, maxDigits))}
                placeholder={currentCategoryObj.placeholder}
                className="w-full h-[52px] bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-2xl px-4 text-xl font-bold font-mono text-amber-300 outline-none text-center transition-all placeholder:font-sans placeholder:text-slate-600 placeholder:font-normal shadow-inner"
              />
            </div>

            {/* 2. Amount Input */}
            <div className="flex-1 min-w-[130px]">
              <div className="flex justify-between items-center mb-1.5 px-0.5">
                <label className="text-xs text-slate-300 font-semibold">จำนวนเงิน (บาท):</label>
              </div>
              <input
                type="number"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                placeholder="100"
                className="w-full h-[52px] bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-2xl px-4 text-xl font-bold font-mono text-slate-100 outline-none text-center tabular-numbers transition-all placeholder:font-sans placeholder:text-slate-600 placeholder:font-normal shadow-inner"
              />
            </div>

            {/* 3. Auto Reverse Checkbox (Only for 2 and 3 digits) */}
            {activeCategory !== 'RUN' && (
              <div className="shrink-0 flex flex-col justify-end">
                <label 
                  htmlFor="autoRev" 
                  className="h-[52px] px-3.5 flex items-center space-x-2.5 bg-obsidian-950 border border-slate-700/80 hover:border-amber-500/50 rounded-2xl cursor-pointer transition-all select-none shadow-sm"
                  title="กลับเลขอัตโนมัติและเพิ่มเข้ารายการพร้อมกัน"
                >
                  <input
                    type="checkbox"
                    id="autoRev"
                    checked={autoReverse}
                    onChange={(e) => setAutoReverse(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-amber-500 bg-obsidian-900 cursor-pointer accent-amber-500"
                  />
                  <div className="text-xs font-semibold text-slate-200">
                    <span>กลับเลขอัตโนมัติ</span>
                    <span className="text-[10px] text-amber-400 block sm:inline sm:ml-1">
                      ({activeCategory === '2DIGIT' ? 'กลับ 2 ตัว' : 'กลับ 6 ประตู'})
                    </span>
                  </div>
                </label>
              </div>
            )}

            {/* 4. Add Number Button */}
            <div className="shrink-0 flex flex-col justify-end">
              <button
                type="submit"
                className="w-full lg:w-auto h-[52px] px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-extrabold rounded-2xl shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-1.5 text-sm transition-all active:scale-95 whitespace-nowrap"
              >
                <Plus className="w-5 h-5 stroke-[2.5]" />
                <span>เพิ่มเลข (Enter)</span>
              </button>
            </div>
          </div>

          {/* Quick Action Shortcuts Bar (แถบเครื่องมือกรอกด่วนในหน้าเดียวกัน) */}
          <div className="bg-obsidian-950/70 border border-slate-800/80 rounded-2xl p-3 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 px-1">
              <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>เครื่องมือกรอกด่วน (ใช้ยอด {Number(inputAmount) || 100} บ. และประเภทที่เลือกไว้):</span>
              </span>
              <span className="text-[10px] text-slate-400">
                {activeCategory === '2DIGIT' ? (
                  inputNumber.length > 1 ? (
                    <span className="text-amber-400 font-semibold bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 animate-fade-in">
                      ⚠️ กรอกเกิน 1 หลัก (ปุ่มด่วนปิดใช้งาน)
                    </span>
                  ) : (
                    'พิมพ์เลข 1 หลักในช่องตัวเลขแล้วกดปุ่ม'
                  )
                ) : activeCategory === '3DIGIT' ? (
                  'พิมพ์เลข 3 หลักในช่องตัวเลขแล้วกดปุ่ม'
                ) : (
                  'กดปุ่มเพื่อเพิ่มเลขวิ่งทันที'
                )}
              </span>
            </div>

            {/* 2-Digit Quick Buttons */}
            {activeCategory === '2DIGIT' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  disabled={inputNumber.length > 1}
                  onClick={handleQuick19Pratu}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-obsidian-900 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 disabled:hover:border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title={inputNumber.length > 1 ? 'ปิดใช้งานเมื่อกรอกเกิน 1 หลัก' : 'ใส่เลข 1 หลักในช่องตัวเลข (เช่น 5) แล้วกด จะได้เลข 19 ตัว'}
                >
                  <span className="font-bold text-xs">⚡ 19 ประตู</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">
                    {inputNumber.length > 1 ? 'ปิดใช้งาน' : '19 ตัวเลข (ใช้เลข 1 ตัว)'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={inputNumber.length > 1}
                  onClick={handleQuickRoodFront}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-obsidian-900 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 disabled:hover:border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title={inputNumber.length > 1 ? 'ปิดใช้งานเมื่อกรอกเกิน 1 หลัก' : 'ใส่เลข 1 หลักในช่องตัวเลข (เช่น 5) เพื่อรูดหน้า 50-59'}
                >
                  <span className="font-bold text-xs">⚡ รูดหน้า (สิบ)</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">
                    {inputNumber.length > 1 ? 'ปิดใช้งาน' : '10 ตัวเลข (ใช้เลข 1 ตัว)'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={inputNumber.length > 1}
                  onClick={handleQuickRoodBack}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-obsidian-900 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 disabled:hover:border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title={inputNumber.length > 1 ? 'ปิดใช้งานเมื่อกรอกเกิน 1 หลัก' : 'ใส่เลข 1 หลักในช่องตัวเลข (เช่น 5) เพื่อรูดหลัง 05-95'}
                >
                  <span className="font-bold text-xs">⚡ รูดหลัง (หน่วย)</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">
                    {inputNumber.length > 1 ? 'ปิดใช้งาน' : '10 ตัวเลข (ใช้เลข 1 ตัว)'}
                  </span>
                </button>

                <button
                  type="button"
                  disabled={inputNumber.length > 1}
                  onClick={handleQuickDoubles}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-obsidian-900 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 disabled:hover:border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title={inputNumber.length > 1 ? 'ปิดใช้งานเมื่อกรอกเกิน 1 หลัก' : 'เพิ่มเลขเบิ้ล 00 ถึง 99 ทั้งหมด 10 ตัวเลขเข้าบิลทันที'}
                >
                  <span className="font-bold text-xs">⚡ เลขเบิ้ล</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">
                    {inputNumber.length > 1 ? 'ปิดใช้งาน' : '00 - 99 (10 ตัวเลข)'}
                  </span>
                </button>
              </div>
            )}

            {/* 3-Digit Quick Buttons */}
            {activeCategory === '3DIGIT' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleQuick6Permutations}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title="ใส่เลข 3 หลักในช่องตัวเลข (เช่น 729) แล้วกดเพื่อสลับเลขครบ 6 ประตู"
                >
                  <span className="font-bold text-xs">⚡ กลับ 6 ประตู</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">สลับตำแหน่งเลข 3 หลักครบชุด</span>
                </button>

                <button
                  type="button"
                  onClick={handleQuickTriples}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                  title="เพิ่มเลขตอง 000 ถึง 999 ทั้งหมด 10 ตัวเลขเข้าบิลทันที"
                >
                  <span className="font-bold text-xs">⚡ เลขตอง</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">000 - 999 (10 ตัวเลข)</span>
                </button>
              </div>
            )}

            {/* RUN Quick Buttons */}
            {activeCategory === 'RUN' && (
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleQuickRunAll}
                  className="py-2.5 px-3 bg-obsidian-900 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-500/60 rounded-xl flex items-center justify-center space-x-2 transition-all hover:scale-[1.01] active:scale-98 shadow-sm group"
                >
                  <span className="font-bold text-xs">⚡ เลขวิ่งครบทุกตัว</span>
                  <span className="text-[10px] text-slate-400 group-hover:text-amber-200">(0 ถึง 9 ทั้งหมด 10 ตัว)</span>
                </button>
              </div>
            )}
          </div>

          {/* Live Warning when typing number matches any rule */}
          {inputNumber && matchedInputRules.length > 0 && (
            <div className="space-y-2 pt-1 animate-fade-in">
              {matchedInputRules.map((rule, idx) => {
                const isSelectedType = rule.bet_type === 'ALL' || selectedBetTypes.includes(rule.bet_type);
                const typeLabel = BET_TYPE_LABELS[rule.bet_type] || rule.bet_type;

                if (rule.rule_type === 'BLOCKED') {
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
                        isSelectedType
                          ? 'bg-red-500/20 border-red-500/60 text-red-200 animate-pulse shadow-lg shadow-red-500/10'
                          : 'bg-red-500/10 border-red-500/30 text-red-300 opacity-80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Ban className="w-4 h-4 text-red-400 shrink-0" />
                        <div>
                          <div className="font-bold flex items-center space-x-1.5">
                            <span>🚫 เลข {rule.number} เป็นเลขอั้น ({typeLabel})</span>
                            <span className="text-[10px] bg-red-500/30 px-2 py-0.2 rounded-full">
                              {isSelectedType ? 'ไม่รับแทงในงวดนี้' : 'ประเภทอื่นยังรับได้'}
                            </span>
                          </div>
                          {rule.note && (
                            <p className="text-[11px] text-red-300/80 mt-0.5 italic">{rule.note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (rule.rule_type === 'HALF_PAY') {
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
                        isSelectedType
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 shadow-lg shadow-amber-500/10'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-300 opacity-80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <div>
                          <div className="font-bold flex items-center space-x-1.5">
                            <span>⚠️ เลข {rule.number} เป็นเลขจ่ายครึ่ง ({typeLabel})</span>
                            <span className="text-[10px] bg-amber-500/30 px-2 py-0.2 rounded-full font-mono">
                              จ่ายบาทละ {rule.effectiveRate || 'ครึ่งราคา'}
                            </span>
                          </div>
                          {rule.note && (
                            <p className="text-[11px] text-amber-300/80 mt-0.5 italic">{rule.note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (rule.rule_type === 'CUSTOM_LIMIT') {
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
                        isSelectedType
                          ? 'bg-cyan-500/20 border-cyan-500/60 text-cyan-200 shadow-lg shadow-cyan-500/10'
                          : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 opacity-80'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5">
                        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="font-bold flex items-center space-x-1.5">
                            <span>📉 เลข {rule.number} จำกัดยอดรับรวม ({typeLabel})</span>
                            <span className="text-[10px] bg-cyan-500/30 px-2 py-0.2 rounded-full font-mono">
                              รับไม่เกิน {Number(rule.custom_limit).toLocaleString()} บาท
                            </span>
                          </div>
                          {rule.note && (
                            <p className="text-[11px] text-cyan-300/80 mt-0.5 italic">{rule.note}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

        </form>


      </div>

      {/* 5. Staged Bets Panel (Compact Cards & Capture Slip with Realtime Quota) */}
      <StagedBetsPanel
        stagedItems={stagedItems}
        validations={validations}
        note={note}
        periodName={selectedPeriod?.period_name}
        isPaid={isPaid}
        hasUnacceptedItems={hasUnacceptedItems}
        unacceptedItems={unacceptedItems}
        isValidatingQuota={isValidatingQuota}
        onUpdateItemAmount={handleUpdateItemAmount}
        onBatchUpdateGroup={handleBatchUpdateCategory}
        onRemoveItem={handleRemoveItem}
        onClearAll={handleClearAll}
      />

      {/* 6. Checkout Footer Bar */}
      <div className="glass-panel rounded-3xl p-5 shadow-2xl border border-amber-500/30">
        <div className="mb-4">
          <label className="text-xs text-slate-300 block mb-1 font-semibold flex items-center space-x-1.5">
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>หมายเหตุ (จะกรอกหรือไม่กรอกก็ได้)</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น จ่ายตอนเย็น, โอนเข้าพร้อมเพย์ หรือเว้นว่างไว้"
            className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none transition-colors"
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-t border-slate-800 pt-4 gap-3">
          {/* Paid / Unpaid Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-300">สถานะเงิน:</span>
            <button
              type="button"
              onClick={() => setIsPaid(!isPaid)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                isPaid
                  ? 'bg-emerald-500 text-obsidian-950 shadow-md shadow-emerald-500/20'
                  : 'bg-obsidian-800 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isPaid ? '✓ จ่ายเงินแล้ว' : '⏳ ยังไม่จ่าย (ค้างไว้ก่อน)'}
            </button>
          </div>

          {/* Actions & Total */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
            {/* Total Amount (Right-aligned) */}
            <div className="text-right sm:mr-2">
              <span className="text-[11px] text-slate-400 block">ยอดรวมทั้งสิ้น</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {totalAmount.toLocaleString()} <span className="text-xs font-sans text-slate-300">บาท</span>
              </span>
            </div>

            {/* Separate Preview Button (Full width on mobile) */}
            <button
              type="button"
              disabled={!stagedItems.length || hasUnacceptedItems || isValidatingQuota}
              onClick={handlePreviewDraft}
              title={
                !stagedItems.length
                  ? 'กรุณาเพิ่มตัวเลขก่อน'
                  : hasUnacceptedItems
                  ? 'มีตัวเลขที่ไม่สามารถรับได้ (อั้น หรือ เกินโควตา)'
                  : isValidatingQuota
                  ? 'กำลังตรวจสอบโควตา...'
                  : 'ดูตัวอย่างบิล'
              }
              className="w-full sm:w-auto py-3 px-4 bg-obsidian-800 hover:bg-obsidian-750 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 hover:text-amber-200 border border-amber-500/40 font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center justify-center space-x-1.5 shadow-md active:scale-98"
            >
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>ดูตัวอย่าง (Preview)</span>
            </button>

            {/* Confirm / Submit / Save Edit Button (Full width on mobile) */}
            <button
              type="button"
              disabled={submitting || isValidatingQuota || !stagedItems.length || hasUnacceptedItems}
              onClick={editingBill ? handleSaveEditedBill : handleSubmitBill}
              title={
                !stagedItems.length
                  ? 'กรุณาเพิ่มตัวเลขก่อน'
                  : hasUnacceptedItems
                  ? 'มีตัวเลขที่ไม่สามารถรับได้ (อั้น หรือ เกินโควตา)'
                  : isValidatingQuota
                  ? 'กำลังตรวจสอบโควตา...'
                  : editingBill
                  ? 'บันทึกการแก้ไขบิล'
                  : 'ยืนยันออกบิล'
              }
              className="w-full sm:w-auto py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-obsidian-950 font-bold rounded-2xl shadow-lg shadow-amber-500/30 text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center space-x-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              <span>
                {submitting
                  ? 'กำลังบันทึก...'
                  : isValidatingQuota
                  ? 'กำลังตรวจโควตา...'
                  : editingBill
                  ? 'บันทึกการแก้ไขบิล'
                  : 'ยืนยันออกบิล'}
              </span>
            </button>
          </div>
        </div>

        {hasUnacceptedItems && (
          <div className="mt-3 p-3 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-xs flex items-center space-x-2 animate-fade-in">
            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              มีตัวเลขที่ไม่สามารถรับซื้อได้ <strong>({unacceptedItems.length} รายการ: {unacceptedItems.map(it => `${it.number} [${validations[`${it.number}_${it.betType}`]?.isBlocked ? 'อั้น' : 'เกินโควตา'}]`).join(', ')})</strong> กรุณาลบออกหรือปรับยอดให้พอดีโควตาก่อนออกบิลหรือดูตัวอย่าง
            </span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-xs">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Bill Preview & Download Modal */}
      {previewBill && (
        <BillPreviewModal
          bill={previewBill}
          onClose={() => setPreviewBill(null)}
        />
      )}

    </div>
  );
}
