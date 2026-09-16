import React, { useState } from 'react';
import { useModal } from '../context/ModalContext.jsx';
import { Zap, Layers } from 'lucide-react';

export default function QuickKeypad({ onApplyNumbers, defaultAmount = 100, onAmountChange, className = '' }) {
  const { showAlert } = useModal();
  const [activeCategory, setActiveCategory] = useState('2DIGIT'); // '2DIGIT' | '3DIGIT'
  const [inputDigit, setInputDigit] = useState('');
  const [input3Digits, setInput3Digits] = useState('');
  const [selectedBetTypes2D, setSelectedBetTypes2D] = useState(['2TOP', '2BOTTOM']);
  const [selectedBetTypes3D, setSelectedBetTypes3D] = useState(['3TOP', '3TOD']);
  const [quickAmount, setQuickAmount] = useState(defaultAmount);

  // ซิงค์จำนวนเงินจากหน้าหลัก (เช่น ผู้ใช้เคยพิมพ์ 50 ไว้ในโหมดปกติ)
  React.useEffect(() => {
    if (defaultAmount !== undefined && defaultAmount !== null && defaultAmount !== '') {
      setQuickAmount(defaultAmount);
    }
  }, [defaultAmount]);

  const handleAmountChange = (val) => {
    setQuickAmount(val);
    if (onAmountChange) onAmountChange(val);
  };

  // 19 ประตู (เลข 2 ตัว 19 ตัว)
  const generate19Pratu = (digit) => {
    if (!digit || digit.length !== 1) return [];
    const d = digit;
    const nums = [];
    for (let i = 0; i <= 9; i++) {
      nums.push(`${d}${i}`);
      if (i.toString() !== d) {
        nums.push(`${i}${d}`);
      }
    }
    return Array.from(new Set(nums));
  };

  // รูดหน้า (หลักสิบ)
  const generateRoodFront = (digit) => {
    if (!digit || digit.length !== 1) return [];
    const nums = [];
    for (let i = 0; i <= 9; i++) nums.push(`${digit}${i}`);
    return nums;
  };

  // รูดหลัง (หลักหน่วย)
  const generateRoodBack = (digit) => {
    if (!digit || digit.length !== 1) return [];
    const nums = [];
    for (let i = 0; i <= 9; i++) nums.push(`${i}${digit}`);
    return nums;
  };

  // เลขเบิ้ล 2 ตัว
  const generateDoubleNumbers = () => {
    return ['00', '11', '22', '33', '44', '55', '66', '77', '88', '99'];
  };

  // กลับ 6 ประตู (เลข 3 ตัว)
  const generate6Permutations = (threeDigits) => {
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
  };

  // ส่งผลลัพธ์ตัวเลขที่สร้างกลับไปที่หน้าคีย์เลข
  const handleGenerate2D = (type) => {
    let generatedNumbers = [];
    if (type === '19_PRATU') generatedNumbers = generate19Pratu(inputDigit);
    else if (type === 'ROOD_FRONT') generatedNumbers = generateRoodFront(inputDigit);
    else if (type === 'ROOD_BACK') generatedNumbers = generateRoodBack(inputDigit);
    else if (type === 'DOUBLES') generatedNumbers = generateDoubleNumbers();

    if (!generatedNumbers.length) {
      showAlert('กรุณากรอกเลข 1 หลักในช่องระบุเลข', { type: 'warning' });
      return;
    }

    const itemsToAdd = [];
    for (const num of generatedNumbers) {
      for (const betType of selectedBetTypes2D) {
        itemsToAdd.push({
          number: num,
          betType,
          amount: Number(quickAmount) || 100
        });
      }
    }

    onApplyNumbers(itemsToAdd);
    setInputDigit('');
  };

  const handleGenerate3D = () => {
    const generatedNumbers = generate6Permutations(input3Digits);
    if (!generatedNumbers.length) {
      showAlert('กรุณากรอกเลข 3 หลักให้ครบถ้วน', { type: 'warning' });
      return;
    }

    const itemsToAdd = [];
    for (const num of generatedNumbers) {
      for (const betType of selectedBetTypes3D) {
        itemsToAdd.push({
          number: num,
          betType,
          amount: Number(quickAmount) || 100
        });
      }
    }

    onApplyNumbers(itemsToAdd);
    setInput3Digits('');
  };

  const toggleBetType2D = (bt) => {
    if (selectedBetTypes2D.includes(bt)) {
      if (selectedBetTypes2D.length > 1) setSelectedBetTypes2D(selectedBetTypes2D.filter(t => t !== bt));
    } else {
      setSelectedBetTypes2D([...selectedBetTypes2D, bt]);
    }
  };

  const toggleBetType3D = (bt) => {
    if (selectedBetTypes3D.includes(bt)) {
      if (selectedBetTypes3D.length > 1) setSelectedBetTypes3D(selectedBetTypes3D.filter(t => t !== bt));
    } else {
      setSelectedBetTypes3D([...selectedBetTypes3D, bt]);
    }
  };

  return (
    <div className={`w-full ${className}`}>
      
      {/* Header with Category Tabs */}
      <div className="flex flex-wrap items-center justify-between mb-3.5 border-b border-slate-800/80 pb-2.5 gap-2">
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="font-bold text-xs sm:text-sm text-slate-200">เลือกรูปแบบช่วยกระจายเลข:</span>
        </div>

        <div className="flex bg-obsidian-950 p-1 rounded-xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveCategory('2DIGIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === '2DIGIT'
                ? 'bg-amber-500 text-obsidian-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            หมวด 2 ตัว (รูด/19 ประตู/เบิ้ล)
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('3DIGIT')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeCategory === '3DIGIT'
                ? 'bg-amber-500 text-obsidian-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            หมวด 3 ตัว (กลับ 6 ประตู)
          </button>
        </div>
      </div>

      {/* 2-DIGIT HELPER */}
      {activeCategory === '2DIGIT' && (
        <>
          {/* Bet Type Multiselect (2 บน, 2 ล่าง) */}
          <div className="mb-3">
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">
              ประเภทหมวด 2 ตัว (กดเลือกพร้อมกันได้):
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: '2TOP', label: '2 ตัวบน' },
                { id: '2BOTTOM', label: '2 ตัวล่าง' }
              ].map((item) => {
                const isSelected = selectedBetTypes2D.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleBetType2D(item.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20 scale-[1.01]'
                        : 'bg-obsidian-800 text-slate-400 hover:text-white border border-slate-700/50'
                    }`}
                  >
                    {isSelected ? `✓ ${item.label}` : item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                ใส่เลข 1 หลัก (สำหรับรูด):
              </label>
              <input
                type="text"
                maxLength={1}
                value={inputDigit}
                onChange={(e) => setInputDigit(e.target.value.replace(/\D/g, ''))}
                placeholder="เช่น 5"
                className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-center text-lg font-bold text-amber-400 outline-none transition-all"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">
                ยอดเงินต่อเลข (บาท):
              </label>
              <input
                type="number"
                value={quickAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-center text-lg font-bold text-slate-100 outline-none transition-all tabular-numbers"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => handleGenerate2D('19_PRATU')}
              className="p-2.5 bg-obsidian-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            >
              <span className="font-bold text-xs">19 ประตู</span>
              <span className="text-[10px] text-slate-400">19 ตัวเลข</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerate2D('ROOD_FRONT')}
              className="p-2.5 bg-obsidian-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            >
              <span className="font-bold text-xs">รูดหน้า (สิบ)</span>
              <span className="text-[10px] text-slate-400">10 ตัวเลข</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerate2D('ROOD_BACK')}
              className="p-2.5 bg-obsidian-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            >
              <span className="font-bold text-xs">รูดหลัง (หน่วย)</span>
              <span className="text-[10px] text-slate-400">10 ตัวเลข</span>
            </button>

            <button
              type="button"
              onClick={() => handleGenerate2D('DOUBLES')}
              className="p-2.5 bg-obsidian-800 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-xl flex flex-col items-center justify-center transition-all hover:scale-[1.02]"
            >
              <span className="font-bold text-xs">เลขเบิ้ล</span>
              <span className="text-[10px] text-slate-400">00-99 (10 ตัว)</span>
            </button>
          </div>
        </>
      )}

      {/* 3-DIGIT HELPER (6 PERMUTATIONS) */}
      {activeCategory === '3DIGIT' && (
        <>
          <div className="mb-3">
            <label className="text-[11px] text-slate-400 block mb-1 font-medium">
              ประเภทหมวด 3 ตัว (กดเลือกพร้อมกันได้):
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: '3TOP', label: '3 ตัวบน' },
                { id: '3TOD', label: '3 ตัวโต๊ด' }
              ].map((item) => {
                const isSelected = selectedBetTypes3D.includes(item.id);
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => toggleBetType3D(item.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-obsidian-950 shadow-md shadow-amber-500/20 scale-[1.01]'
                        : 'bg-obsidian-800 text-slate-400 hover:text-white border border-slate-700/50'
                    }`}
                  >
                    {isSelected ? `✓ ${item.label}` : item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-5">
              <label className="text-[11px] text-slate-400 block mb-1">
                ใส่เลข 3 หลัก:
              </label>
              <input
                type="text"
                maxLength={3}
                value={input3Digits}
                onChange={(e) => setInput3Digits(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="เช่น 729"
                className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-center text-lg font-bold text-amber-400 outline-none transition-all"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="text-[11px] text-slate-400 block mb-1">
                ยอดเงินต่อเลข (บาท):
              </label>
              <input
                type="number"
                value={quickAmount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-500 rounded-xl px-3 py-2 text-center text-lg font-bold text-slate-100 outline-none transition-all tabular-numbers"
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleGenerate3D}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1 shadow-md transition-all"
              >
                <span>กลับ 6 ประตู</span>
              </button>
            </div>
          </div>
        </>
      )}

    </div>
  );
}
