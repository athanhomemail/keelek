import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useModal } from '../context/ModalContext.jsx';
import { Settings, Plus, Trash2, Save, AlertTriangle, XCircle, ShieldCheck, DollarSign } from 'lucide-react';

export default function SettingsPage() {
  const { showAlert, showConfirm } = useModal();
  const [settingsList, setSettingsList] = useState([]);
  const [rules, setRules] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Rule Form Modal/Panel
  const [showAddRule, setShowAddRule] = useState(false);
  const [rulePeriodId, setRulePeriodId] = useState('');
  const [ruleNumber, setRuleNumber] = useState('');
  const [ruleBetType, setRuleBetType] = useState('ALL');
  const [ruleType, setRuleType] = useState('BLOCKED'); // 'BLOCKED' | 'HALF_PAY' | 'CUSTOM_LIMIT'
  const [ruleLimit, setRuleLimit] = useState('');
  const [ruleNote, setRuleNote] = useState('');

  const fetchSettings = async () => {
    try {
      const [settingRes, periodRes] = await Promise.all([
        axios.get('/api/settings'),
        axios.get('/api/draw-periods?status=OPEN')
      ]);
      if (settingRes.data.success) {
        setSettingsList(settingRes.data.settings);
        setRules(settingRes.data.rules);
      }
      if (periodRes.data.success) {
        setPeriods(periodRes.data.periods);
        if (periodRes.data.periods.length) {
          setRulePeriodId(periodRes.data.periods[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSettingChange = (lotteryId, field, value) => {
    setSettingsList(prev => prev.map(s => {
      if (s.lottery_id === lotteryId) {
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await axios.put('/api/settings', { settingsList });
      if (res.data.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถบันทึกการตั้งค่าได้', { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (e) => {
    e.preventDefault();
    if (!ruleNumber || !rulePeriodId) return;

    try {
      const res = await axios.post('/api/settings/number-rule', {
        drawPeriodId: rulePeriodId,
        number: ruleNumber.trim(),
        betType: ruleBetType,
        ruleType,
        customLimit: ruleType === 'CUSTOM_LIMIT' ? Number(ruleLimit) : null,
        note: ruleNote.trim()
      });
      if (res.data.success) {
        setShowAddRule(false);
        setRuleNumber('');
        setRuleLimit('');
        setRuleNote('');
        fetchSettings();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถเพิ่มกฎตัวเลขได้', { type: 'error' });
    }
  };

  const handleDeleteRule = async (ruleId) => {
    const ok = await showConfirm('ต้องการลบกฎของเลขนี้ใช่หรือไม่?', {
      type: 'danger',
      confirmText: 'ลบกฎตัวเลข',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.delete(`/api/settings/number-rule/${ruleId}`);
      if (res.data.success) {
        fetchSettings();
      }
    } catch (err) {
      showAlert('ไม่สามารถลบกฎได้', { type: 'error' });
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">กำลังโหลดการตั้งค่า...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 pb-24 space-y-8">
      
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <Settings className="w-6 h-6 text-amber-400" />
            <span>ตั้งค่าอัตราจ่ายและเลขอั้น (หัวหน้าห้อง)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            กำหนดบาทละ, % ค่าคอมมิชชั่นลูกทีม, เลขอั้นไม่รับ, และเลขจ่ายครึ่ง
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="py-2.5 px-5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-xs flex items-center space-x-1.5 transition-all"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-300 text-xs flex items-center space-x-2">
          <span>✓ บันทึกการตั้งค่าอัตราจ่ายเรียบร้อยแล้ว</span>
        </div>
      )}

      {/* 1. Payout Rates & Commission per Lottery Type */}
      <div className="space-y-6">
        {settingsList.map((lot) => (
          <div key={lot.lottery_id} className="bg-obsidian-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{lot.lottery_code === 'THAI' ? '🇹🇭' : '🇱🇦'}</span>
                <h3 className="font-bold text-base text-amber-300">{lot.lottery_name}</h3>
              </div>
              
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(lot.is_enabled)}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'is_enabled', e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-obsidian-950 border-slate-700"
                />
                <span>เปิดรับส่งตัวเลขของหวยนี้</span>
              </label>
            </div>

            {/* Payout Rates Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">3 ตัวบน (บาทละ):</label>
                <input
                  type="number"
                  value={lot.rate_3top}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_3top', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">3 ตัวโต๊ด (บาทละ):</label>
                <input
                  type="number"
                  value={lot.rate_3tod}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_3tod', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">2 ตัวบน (บาทละ):</label>
                <input
                  type="number"
                  value={lot.rate_2top}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_2top', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">2 ตัวล่าง (บาทละ):</label>
                <input
                  type="number"
                  value={lot.rate_2bottom}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_2bottom', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">วิ่งบน (บาทละ):</label>
                <input
                  type="number"
                  step="0.1"
                  value={lot.rate_run_top}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_run_top', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">วิ่งล่าง (บาทละ):</label>
                <input
                  type="number"
                  step="0.1"
                  value={lot.rate_run_bottom}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'rate_run_bottom', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-amber-400 outline-none tabular-numbers"
                />
              </div>
            </div>

            {/* Commission & Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  % ส่วนแบ่งลูกทีม (Commission %):
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={lot.commission_rate}
                    onChange={(e) => handleSettingChange(lot.lottery_id, 'commission_rate', e.target.value)}
                    className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-emerald-400 outline-none tabular-numbers"
                  />
                  <span className="absolute right-3 top-2 text-slate-500 font-bold">%</span>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  เพดานรับซื้อสูงสุดต่อเลข (ค่าเริ่มต้น บ.):
                </label>
                <input
                  type="number"
                  value={lot.default_limit_per_number}
                  onChange={(e) => handleSettingChange(lot.lottery_id, 'default_limit_per_number', e.target.value)}
                  className="w-full bg-obsidian-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3 py-2 text-sm font-bold font-mono text-slate-100 outline-none tabular-numbers"
                />
              </div>
            </div>

          </div>
        ))}
      </div>

      {/* 2. Blocked & Half-Pay Numbers Rules */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-100">กฎตัวเลขเฉพาะงวด (เลขอั้น / เลขจ่ายครึ่ง)</h3>
            <p className="text-xs text-slate-400">กำหนดตัวเลขที่ไม่รับ หรือจ่ายครึ่งราคาในงวดนั้นๆ</p>
          </div>

          <button
            onClick={() => setShowAddRule(!showAddRule)}
            className="py-2 px-3.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center space-x-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>เพิ่มเลขอั้น / จ่ายครึ่ง</span>
          </button>
        </div>

        {/* Add Rule Form */}
        {showAddRule && (
          <form onSubmit={handleAddRule} className="bg-obsidian-950 border border-amber-500/30 rounded-2xl p-4 mb-4 space-y-3">
            <h4 className="text-xs font-bold text-amber-400">เพิ่มกฎตัวเลขใหม่</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">งวดหวย:</label>
                <select
                  value={rulePeriodId}
                  onChange={(e) => setRulePeriodId(e.target.value)}
                  className="w-full bg-obsidian-900 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 outline-none"
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.period_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">ตัวเลข:</label>
                <input
                  type="text"
                  required
                  value={ruleNumber}
                  onChange={(e) => setRuleNumber(e.target.value)}
                  placeholder="เช่น 89 หรือ 729"
                  className="w-full bg-obsidian-900 border border-slate-700 text-xs font-bold font-mono rounded-xl px-2.5 py-2 text-amber-300 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">ประเภท:</label>
                <select
                  value={ruleBetType}
                  onChange={(e) => setRuleBetType(e.target.value)}
                  className="w-full bg-obsidian-900 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 outline-none"
                >
                  <option value="ALL">ทุกประเภท</option>
                  <option value="2TOP">2 ตัวบน</option>
                  <option value="2BOTTOM">2 ตัวล่าง</option>
                  <option value="3TOP">3 ตัวบน</option>
                  <option value="3TOD">3 ตัวโต๊ด</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">เงื่อนไข:</label>
                <select
                  value={ruleType}
                  onChange={(e) => setRuleType(e.target.value)}
                  className="w-full bg-obsidian-900 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 outline-none"
                >
                  <option value="BLOCKED">🚫 อั้นไม่รับทุกกรณี</option>
                  <option value="HALF_PAY">⚠️ จ่ายครึ่งราคา</option>
                  <option value="CUSTOM_LIMIT">📊 จำกัดยอดรับซื้อ</option>
                </select>
              </div>
            </div>

            {ruleType === 'CUSTOM_LIMIT' && (
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">ยอดรับซื้อสูงสุด (บาท):</label>
                <input
                  type="number"
                  value={ruleLimit}
                  onChange={(e) => setRuleLimit(e.target.value)}
                  placeholder="เช่น 1000"
                  className="w-full bg-obsidian-900 border border-slate-700 text-xs font-mono rounded-xl px-2.5 py-2 text-slate-100 outline-none"
                />
              </div>
            )}

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">หมายเหตุ:</label>
              <input
                type="text"
                value={ruleNote}
                onChange={(e) => setRuleNote(e.target.value)}
                placeholder="เช่น เลขดังอาจารย์ ก."
                className="w-full bg-obsidian-900 border border-slate-700 text-xs rounded-xl px-2.5 py-2 text-slate-200 outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddRule(false)}
                className="px-3 py-1.5 bg-obsidian-800 text-slate-400 hover:text-white rounded-xl text-xs"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 bg-amber-500 text-obsidian-950 font-bold rounded-xl text-xs"
              >
                บันทึกกฎ
              </button>
            </div>
          </form>
        )}

        {/* Rules Table */}
        {rules.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            ยังไม่มีเลขอั้นหรือจ่ายครึ่งที่กำหนดไว้
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {rules.map((r) => (
              <div key={r.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="font-mono font-bold text-base text-amber-400">{r.number}</span>
                  <span className="text-slate-400">({r.bet_type})</span>
                  
                  {r.rule_type === 'BLOCKED' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/20 text-red-300 border border-red-500/40">
                      🚫 อั้นไม่รับ
                    </span>
                  )}
                  {r.rule_type === 'HALF_PAY' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-300 border border-orange-500/40">
                      ⚠️ จ่ายครึ่ง
                    </span>
                  )}
                  {r.rule_type === 'CUSTOM_LIMIT' && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40">
                      จำกัด {Number(r.custom_limit).toLocaleString()} บ.
                    </span>
                  )}

                  {r.note && <span className="text-[11px] text-slate-500 italic">- {r.note}</span>}
                </div>

                <button
                  onClick={() => handleDeleteRule(r.id)}
                  className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}
