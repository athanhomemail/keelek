import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useSocket } from '../context/SocketContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import QuickKeypad from '../components/QuickKeypad.jsx';
import BillPreviewModal from '../components/BillPreviewModal.jsx';
import StagedBetsPanel from '../components/StagedBetsPanel.jsx';
import { 
  Plus, Trash2, Clock, CheckCircle, AlertTriangle, XCircle, DollarSign, 
  User, Sparkles, ChevronDown, ChevronUp, Eye, Receipt, Search, 
  ShieldAlert, Ban, Info, X, Zap 
} from 'lucide-react';

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

export default function KeyingPage({ editingBill, onCancelEdit, onEditSuccess }) {
  const { user } = useAuth();
  const { quotaUpdates, rulesUpdates } = useSocket();
  const { showAlert, showConfirm } = useModal();

  const [lotteries, setLotteries] = useState([]);
  const [selectedLotteryId, setSelectedLotteryId] = useState(1);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [countdown, setCountdown] = useState('');

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
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');
  const [isPaid, setIsPaid] = useState(false);

  // Quick Keypad Drawer
  const [keyingMode, setKeyingMode] = useState('MANUAL'); // 'MANUAL' | 'QUICK'

  // Completed Bill for Modal Preview & Download
  const [previewBill, setPreviewBill] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Number Rules (เลขอั้น / เลขจ่ายครึ่ง / จำกัดยอด)
  const [periodRules, setPeriodRules] = useState([]);
  const [rulesSettings, setRulesSettings] = useState(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [isRulesExpanded, setIsRulesExpanded] = useState(true);
  const [rulesSearch, setRulesSearch] = useState('');
  const [rulesFilter, setRulesFilter] = useState('ALL'); // 'ALL' | 'BLOCKED' | 'HALF_PAY' | 'CUSTOM_LIMIT'

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
          setPeriods(periodRes.data.periods);
          const active = periodRes.data.periods.find(p => p.lottery_id === selectedLotteryId) || periodRes.data.periods[0];
          setSelectedPeriod(active || null);
        }
      } catch (err) {
        console.error('Failed to load lotteries:', err);
      }
    };
    fetchData();
  }, []);

  // When lottery selection changes, set active period
  useEffect(() => {
    const active = periods.find(p => p.lottery_id === selectedLotteryId);
    setSelectedPeriod(active || null);
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
    if (!customerName.trim()) {
      setErrorMsg('กรุณากรอกชื่อลูกค้าก่อนออกบิล');
      return;
    }
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
        customerName: customerName.trim(),
        note: note.trim(),
        isPaidByCustomer: isPaid,
        items: stagedItems
      });

      if (res.data.success) {
        setPreviewBill(res.data.bill);
        setStagedItems([]);
        setValidations({});
        setCustomerName('');
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
    if (!customerName.trim()) {
      setErrorMsg('กรุณากรอกชื่อลูกค้าก่อนดูตัวอย่างบิล');
      return;
    }
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
      customerName: customerName.trim() || 'ลูกค้าทั่วไป',
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
    if (!customerName.trim()) {
      setErrorMsg('กรุณากรอกชื่อลูกค้า');
      return;
    }
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
        customerName: customerName.trim(),
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
      setCustomerName(editingBill.customer_name || editingBill.customerName || '');
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
                <span className="text-[10px] bg-amber-500/20 px-2 py-0.5 rounded-full font-mono text-amber-400">
                  ลูกค้า: {editingBill.customer_name || editingBill.customerName}
                </span>
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

      {/* 1. Lottery Type Selector (Thai / Lao - Two Big Buttons) */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {lotteries.map((lot) => {
          const isSelected = selectedLotteryId === lot.id;
          return (
            <button
              key={lot.id}
              onClick={() => setSelectedLotteryId(lot.id)}
              className={`py-4 px-4 rounded-2xl flex items-center justify-center space-x-3 transition-all border shadow-lg ${
                isSelected
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 font-bold border-amber-400 shadow-amber-500/20 scale-[1.02]'
                  : 'bg-obsidian-900 hover:bg-obsidian-850 text-slate-300 border-slate-800'
              }`}
            >
              <span className="text-2xl">{lot.code === 'THAI' ? '🇹🇭' : '🇱🇦'}</span>
              <div className="text-left">
                <div className="text-base font-bold">{lot.name}</div>
                <div className="text-[11px] opacity-80">
                  {lot.code === 'THAI' ? 'ออกวันที่ 1 และ 16' : 'ออกทุก จันทร์/พุธ/ศุกร์'}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* 2. Active Period & Countdown Banner */}
      <div className="bg-obsidian-900 border border-amber-500/20 rounded-2xl p-4 mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs text-amber-400 font-semibold uppercase tracking-wider block">
            งวดปัจจุบันที่เปิดรับ
          </span>
          <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
            {selectedPeriod?.period_name || 'กำลังโหลดงวดหวย...'}
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-xl">
          <Clock className="w-4 h-4 animate-spin-slow" />
          <span>{countdown || 'กำลังเปิดรับแทง'}</span>
        </div>
      </div>

      {/* 2.5 Blocked & Half-Pay Numbers Bulletin (แผงแสดงรายการเลขอั้น / เลขจ่ายครึ่ง ประจำงวด) */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-4 sm:p-5 mb-5 shadow-2xl transition-all">
        {/* Header with Title, Badges & Collapsible Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
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

      {/* 3. Unified Keying Panel (Manual & Quick Modes) */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 mb-5 shadow-2xl border border-amber-500/20">
        
        {/* Panel Header & Mode Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5 mb-4">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner shrink-0">
              {keyingMode === 'MANUAL' ? <Zap className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100">แผงคีย์ตัวเลข</h3>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                  {keyingMode === 'MANUAL' ? 'คีย์ทีละตัว' : 'กรอกด่วน'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {keyingMode === 'MANUAL'
                  ? 'เลือกประเภท กรอกตัวเลข และระบุจำนวนเงิน'
                  : 'ระบบคำนวณ 19 ประตู, รูดหน้า/หลัง, เลขเบิ้ล, กลับ 6 ประตู'}
              </p>
            </div>
          </div>

          {/* Mode Switch Tabs */}
          <div className="flex w-full sm:w-auto bg-obsidian-950 p-1 rounded-2xl border border-slate-800 shadow-inner sm:self-auto">
            <button
              type="button"
              onClick={() => setKeyingMode('MANUAL')}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
                keyingMode === 'MANUAL'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20 scale-[1.01] sm:scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
              }`}
            >
              <span>⌨️ คีย์เลขปกติ</span>
            </button>
            <button
              type="button"
              onClick={() => setKeyingMode('QUICK')}
              className={`flex-1 sm:flex-initial flex items-center justify-center space-x-1.5 px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-xs font-bold transition-all ${
                keyingMode === 'QUICK'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-obsidian-950 shadow-md shadow-amber-500/20 scale-[1.01] sm:scale-[1.02]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-900'
              }`}
            >
              <Sparkles className={`w-3.5 h-3.5 ${keyingMode === 'QUICK' ? 'text-obsidian-950' : 'text-amber-400'}`} />
              <span>กรอกด่วน</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Manual Keying Form */}
        {keyingMode === 'MANUAL' && (
          <form onSubmit={handleAddManualItem} className="space-y-4 animate-fade-in">
          
          {/* Bet Type Selection Grouped by Digits */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-slate-300 font-semibold">
                ประเภทที่ต้องการคีย์:
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
                        ? 'bg-obsidian-950/80 border-amber-500/40 shadow-md shadow-amber-500/10'
                        : 'bg-obsidian-950/30 border-slate-800/60 opacity-60 hover:opacity-90'
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
                <span>เพิ่มเลข</span>
              </button>
            </div>
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
        )}

        {/* Tab 2: Quick Keypad */}
        {keyingMode === 'QUICK' && (
          <div className="animate-fade-in">
            <QuickKeypad
              onApplyNumbers={handleApplyQuickNumbers}
              defaultAmount={Number(inputAmount) || 100}
              onAmountChange={(val) => setInputAmount(String(val))}
            />
          </div>
        )}

      </div>

      {/* 5. Staged Bets Panel (Compact Cards & Capture Slip with Realtime Quota) */}
      <StagedBetsPanel
        stagedItems={stagedItems}
        validations={validations}
        customerName={customerName}
        onCustomerNameChange={setCustomerName}
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

      {/* 6. Customer & Checkout Footer Bar */}
      <div className="glass-panel rounded-3xl p-5 shadow-2xl border border-amber-500/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-xs text-slate-300 block mb-1 font-semibold flex items-center space-x-1">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>ชื่อลูกค้า *</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="เช่น ป้าพร ข้าวแกง หรือ พี่โต้ง"
              className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 block mb-1 font-semibold">หมายเหตุ (ถ้ามี)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="เช่น จ่ายตอนเย็น, โอนเข้าพร้อมเพย์"
              className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between border-t border-slate-800 pt-4 gap-3">
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
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-right mr-2">
              <span className="text-[11px] text-slate-400 block">ยอดรวมทั้งสิ้น</span>
              <span className="text-xl font-bold font-mono text-amber-400">
                {totalAmount.toLocaleString()} <span className="text-xs font-sans text-slate-300">บาท</span>
              </span>
            </div>

            {/* Separate Preview Button */}
            <button
              type="button"
              disabled={!stagedItems.length || hasUnacceptedItems || !customerName.trim() || isValidatingQuota}
              onClick={handlePreviewDraft}
              title={
                !stagedItems.length
                  ? 'กรุณาเพิ่มตัวเลขก่อน'
                  : !customerName.trim()
                  ? 'กรุณากรอกชื่อลูกค้าก่อนดูตัวอย่าง'
                  : hasUnacceptedItems
                  ? 'มีตัวเลขที่ไม่สามารถรับได้ (อั้น หรือ เกินโควตา)'
                  : isValidatingQuota
                  ? 'กำลังตรวจสอบโควตา...'
                  : 'ดูตัวอย่างบิล'
              }
              className="py-3 px-4 bg-obsidian-800 hover:bg-obsidian-750 disabled:opacity-40 disabled:cursor-not-allowed text-amber-300 hover:text-amber-200 border border-amber-500/40 font-bold rounded-2xl text-xs sm:text-sm transition-all flex items-center space-x-1.5 shadow-md active:scale-98"
            >
              <Receipt className="w-4 h-4 text-amber-400" />
              <span>ดูตัวอย่าง (Preview)</span>
            </button>

            {/* Confirm / Submit / Save Edit Button */}
            <button
              type="button"
              disabled={submitting || isValidatingQuota || !stagedItems.length || hasUnacceptedItems || !customerName.trim()}
              onClick={editingBill ? handleSaveEditedBill : handleSubmitBill}
              title={
                !stagedItems.length
                  ? 'กรุณาเพิ่มตัวเลขก่อน'
                  : !customerName.trim()
                  ? 'กรุณากรอกชื่อลูกค้าก่อนออกบิล'
                  : hasUnacceptedItems
                  ? 'มีตัวเลขที่ไม่สามารถรับได้ (อั้น หรือ เกินโควตา)'
                  : isValidatingQuota
                  ? 'กำลังตรวจสอบโควตา...'
                  : editingBill
                  ? 'บันทึกการแก้ไขบิล'
                  : 'ยืนยันออกบิล'
              }
              className="py-3 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-obsidian-950 font-bold rounded-2xl shadow-lg shadow-amber-500/30 text-xs sm:text-sm transition-all active:scale-98 flex items-center space-x-1.5"
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
