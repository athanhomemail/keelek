import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import BillPreviewModal from '../components/BillPreviewModal.jsx';
import { FileText, CheckCircle2, Clock, AlertCircle, Trophy, DollarSign, Download, Eye, Upload, Filter, Pencil, Ban } from 'lucide-react';

export default function BillSummaryPage({ onEditBill }) {
  const { user, role } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const [bills, setBills] = useState([]);
  const [summary, setSummary] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [prizeFilter, setPrizeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingEditId, setLoadingEditId] = useState(null);
  const [cancellingBillId, setCancellingBillId] = useState(null);
  const [updatingPayment, setUpdatingPayment] = useState({});

  // Selected Bill for Modal View
  const [selectedBill, setSelectedBill] = useState(null);

  // Load Draw Periods
  useEffect(() => {
    const fetchPeriods = async () => {
      try {
        const res = await axios.get('/api/draw-periods');
        if (res.data.success) {
          setPeriods(res.data.periods);
          if (res.data.periods.length) {
            setSelectedPeriodId(res.data.periods[0].id.toString());
          }
        }
      } catch (err) {
        console.error('Failed to load periods:', err);
      }
    };
    fetchPeriods();
  }, []);

  // Fetch Bills (supports silent background sync to prevent unmounting/scroll jumps)
  const fetchBills = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      let url = `/api/bills?`;
      if (selectedPeriodId) url += `drawPeriodId=${selectedPeriodId}&`;
      if (paymentFilter) url += `customerPaymentStatus=${paymentFilter}&`;
      if (prizeFilter) url += `prizePayoutStatus=${prizeFilter}&`;
      if (statusFilter) url += `status=${statusFilter}&`;

      const res = await axios.get(url);
      if (res.data.success) {
        setBills(res.data.bills);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error('Failed to fetch bills:', err);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.room_id || role === 'ADMIN') {
      fetchBills();
    }
  }, [selectedPeriodId, paymentFilter, prizeFilter, statusFilter, user]);

  // Update payment status (3-tier: CUSTOMER -> MEMBER -> DEALER) with Optimistic UI & Silent Sync
  const handleTogglePayment = async (billId, stage, currentStatus) => {
    const newStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    const field = stage === 'CUSTOMER' ? 'customer_payment_status' : stage === 'MEMBER' ? 'member_payment_status' : 'dealer_payment_status';
    const key = `${billId}_${stage}`;

    // 1. Optimistic update: instantly reflect the new status in local state
    setBills(prev => prev.map(b => b.id === billId ? { ...b, [field]: newStatus } : b));
    setUpdatingPayment(prev => ({ ...prev, [key]: true }));

    try {
      const res = await axios.patch(`/api/bills/${billId}/payment-status`, {
        stage,
        status: newStatus
      });
      if (res.data.success) {
        // 2. Silent background sync for accurate totals without unmounting the list or resetting scroll position
        await fetchBills(true);
      }
    } catch (err) {
      // Revert on error
      setBills(prev => prev.map(b => b.id === billId ? { ...b, [field]: currentStatus } : b));
      showAlert(err.response?.data?.message || 'ไม่สามารถอัปเดตสถานะได้', { type: 'error' });
    } finally {
      setUpdatingPayment(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Update Prize Payout Status & Slip
  const handleUpdatePrizeStatus = async (billId, status) => {
    try {
      const slipPrompt = status !== 'PENDING' ? prompt('ใส่ลิงก์รูปภาพสลิปโอนเงินรางวัล (หรือปล่อยว่าง):', 'https://example.com/slip.jpg') : null;
      await axios.patch(`/api/bills/${billId}/prize-payout`, {
        prizePayoutStatus: status,
        prizeSlipUrl: slipPrompt
      });
      fetchBills(true);
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถอัปเดตสถานะรางวัลได้', { type: 'error' });
    }
  };

  // View Bill Detail Modal
  const handleViewBill = async (billId) => {
    try {
      const res = await axios.get(`/api/bills/${billId}`);
      if (res.data.success) {
        setSelectedBill(res.data.bill);
      }
    } catch (err) {
      showAlert('ไม่สามารถโหลดรายละเอียดบิลได้', { type: 'error' });
    }
  };

  // Edit Bill
  const handleEditBill = async (bill) => {
    if (!onEditBill) return;
    try {
      setLoadingEditId(bill.id);
      const res = await axios.get(`/api/bills/${bill.id}`);
      if (res.data.success) {
        onEditBill(res.data.bill);
      } else {
        showAlert(res.data.message || 'ไม่สามารถดึงข้อมูลบิลสำหรับแก้ไขได้', { type: 'error' });
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการเปิดบิลเพื่อแก้ไข', { type: 'error' });
    } finally {
      setLoadingEditId(null);
    }
  };

  // Cancel Bill (Only for unpaid bills in open periods)
  const handleCancelBill = async (bill) => {
    const ok = await showConfirm(`คุณต้องการยกเลิกบิล ${bill.bill_no} (ลูกค้า: ${bill.customer_name}) ใช่หรือไม่?`, {
      subtitle: '* การยกเลิกจะคืนโควตาตัวเลขเข้าระบบทันที และไม่สามารถย้อนกลับได้',
      type: 'danger',
      confirmText: 'ยืนยันยกเลิกบิล',
      cancelText: 'ปิด'
    });
    if (!ok) return;

    setCancellingBillId(bill.id);
    // Optimistic update: mark as CANCELLED immediately
    setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'CANCELLED' } : b));

    try {
      const res = await axios.patch(`/api/bills/${bill.id}/cancel`);
      if (res.data.success) {
        // Silent sync to update KPI summary numbers in background
        await fetchBills(true);
      }
    } catch (err) {
      // Revert on error
      setBills(prev => prev.map(b => b.id === bill.id ? { ...b, status: 'ACTIVE' } : b));
      showAlert(err.response?.data?.message || 'ไม่สามารถยกเลิกบิลได้', { type: 'error' });
    } finally {
      setCancellingBillId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 pb-24">
      
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center space-x-2">
            <FileText className="w-6 h-6 text-amber-400" />
            <span>สรุปบิลและบัญชีการเงิน</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {role === 'LEADER'
              ? 'ดูบิลทั้งหมดในห้อง ติดตามยอดค้างชำระ และกำไรสุทธิ'
              : 'ดูเฉพาะบิลของตัวเอง และอัปเดตสถานะการจ่ายเงินของลูกค้า'}
          </p>
        </div>

        {/* Period Selector Filter */}
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-amber-400" />
          <select
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            className="bg-obsidian-900 border border-slate-700 focus:border-amber-400 text-xs font-semibold rounded-xl px-3 py-2 text-slate-200 outline-none"
          >
            <option value="">ทุกงวดหวย</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.period_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ยอดขายรวม ({summary.billCount} บิล)</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-slate-100">
              {summary.totalSales.toLocaleString()} <span className="text-xs font-sans text-slate-400">บ.</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">
              {role === 'LEADER' ? 'กำไรเจ้ามืองวดนี้' : 'ค่าคอมมิชชั่นของฉัน'}
            </span>
            <div className={`text-lg sm:text-xl font-bold font-mono ${
              role === 'LEADER' ? (summary.dealerProfit >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-amber-400'
            }`}>
              {role === 'LEADER'
                ? summary.dealerProfit.toLocaleString()
                : summary.totalCommission.toLocaleString()}{' '}
              <span className="text-xs font-sans text-slate-400">บ.</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ยอดถูกรางวัลรวม</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-300">
              {summary.totalWon.toLocaleString()} <span className="text-xs font-sans text-slate-400">บ.</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ยอดค้างชำระ (ลูกค้า)</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-red-400">
              {summary.totalUnpaidCustomer.toLocaleString()} <span className="text-xs font-sans text-slate-400">บ.</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <span className="text-slate-400 font-medium">กรองสถานะ:</span>
        <button
          type="button"
          onClick={() => { setPaymentFilter(''); setStatusFilter(''); }}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            paymentFilter === '' && statusFilter === '' ? 'bg-amber-500 text-obsidian-950 font-bold' : 'bg-obsidian-900 text-slate-300'
          }`}
        >
          ทั้งหมด
        </button>
        <button
          type="button"
          onClick={() => { setPaymentFilter('UNPAID'); setStatusFilter('ACTIVE'); }}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            paymentFilter === 'UNPAID' && statusFilter === 'ACTIVE' ? 'bg-red-500 text-white font-bold' : 'bg-obsidian-900 text-slate-300'
          }`}
        >
          ลูกค้าค้างจ่าย
        </button>
        <button
          type="button"
          onClick={() => { setPaymentFilter('PAID'); setStatusFilter('ACTIVE'); }}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            paymentFilter === 'PAID' && statusFilter === 'ACTIVE' ? 'bg-emerald-500 text-obsidian-950 font-bold' : 'bg-obsidian-900 text-slate-300'
          }`}
        >
          ลูกค้าจ่ายแล้ว
        </button>
        <button
          type="button"
          onClick={() => { setPaymentFilter(''); setStatusFilter('CANCELLED'); }}
          className={`px-3 py-1.5 rounded-xl font-medium transition-all ${
            statusFilter === 'CANCELLED' ? 'bg-rose-600 text-white font-bold' : 'bg-obsidian-900 text-slate-300'
          }`}
        >
          🚫 บิลที่ยกเลิก
        </button>
      </div>

      {/* Bills List / Table */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[300px]">
        {loading && bills.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">กำลังโหลดข้อมูลบิล...</div>
        ) : bills.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>ไม่พบรายการบิลตามเงื่อนไขที่เลือก</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {bills.map((b) => {
              const isCancelled = b.status === 'CANCELLED';
              const isWon = !isCancelled && Number(b.total_win_amount) > 0;
              const isPeriodStillOpen = b.period_status === 'OPEN' && (!b.close_time || new Date().getTime() <= new Date(b.close_time).getTime());
              const canEditOrCancel = !isCancelled && b.customer_payment_status === 'UNPAID' && isPeriodStillOpen && (user?.id === b.user_id || role === 'LEADER' || role === 'ADMIN');

              return (
                <div key={b.id} className={`p-4 sm:p-5 transition-colors ${isCancelled ? 'bg-obsidian-950/40 opacity-75' : 'hover:bg-obsidian-850/50'}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                    
                    {/* Bill Header info */}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className={`font-mono font-bold text-sm sm:text-base ${isCancelled ? 'text-slate-500 line-through' : 'text-amber-400'}`}>
                          {b.bill_no}
                        </span>
                        {isWon && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center">
                            <Trophy className="w-3 h-3 mr-1 text-amber-400" /> ถูกรางวัล {Number(b.total_win_amount).toLocaleString()} บ.
                          </span>
                        )}
                        {isCancelled && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center space-x-1">
                            <span>🚫 ยกเลิกบิลแล้ว (คืนโควตา)</span>
                          </span>
                        )}
                        {!isCancelled && canEditOrCancel && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-300/90 border border-amber-500/20">
                            แก้ไข/ยกเลิกได้ (ยังไม่ชำระ)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                        <span>ลูกค้า: <strong className={isCancelled ? 'text-slate-400 line-through' : 'text-slate-200'}>{b.customer_name}</strong></span>
                        {role === 'LEADER' && (
                          <span>ผู้คีย์: <strong className="text-amber-300">{b.member_name}</strong></span>
                        )}
                        <span>{new Date(b.created_at).toLocaleString('th-TH')}</span>
                      </div>
                    </div>

                    {/* Total & Action Buttons */}
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="text-right font-mono">
                        <div className={`text-sm sm:text-base font-bold ${isCancelled ? 'text-slate-500 line-through' : 'text-slate-100'}`}>
                          {Number(b.total_amount).toLocaleString()} บ.
                        </div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          {isCancelled ? 'ยกเลิกแล้ว' : `คอมฯ ${Number(b.commission_amount).toLocaleString()} บ.`}
                        </div>
                      </div>

                      {/* Edit Bill Button */}
                      {canEditOrCancel && (
                        <button
                          type="button"
                          disabled={loadingEditId === b.id}
                          onClick={() => handleEditBill(b)}
                          className="px-2.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 rounded-xl border border-amber-500/30 transition-all flex items-center space-x-1 text-xs font-semibold shadow-sm active:scale-95"
                          title="แก้ไขบิลนี้ (ปรับปรุงตัวเลขและยอดเงิน)"
                        >
                          <Pencil className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">
                            {loadingEditId === b.id ? 'กำลังเปิด...' : 'แก้ไขบิล'}
                          </span>
                        </button>
                      )}

                      {/* Cancel Bill Button */}
                      {canEditOrCancel && (
                        <button
                          type="button"
                          disabled={cancellingBillId === b.id}
                          onClick={() => handleCancelBill(b)}
                          className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/25 text-rose-400 rounded-xl border border-rose-500/30 transition-all flex items-center space-x-1 text-xs font-semibold shadow-sm active:scale-95"
                          title="ยกเลิกบิลนี้ (คืนโควตา)"
                        >
                          <Ban className="w-3.5 h-3.5 text-rose-400" />
                          <span className="hidden sm:inline">
                            {cancellingBillId === b.id ? 'กำลังยกเลิก...' : 'ยกเลิกบิล'}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleViewBill(b.id)}
                        className="p-2 bg-obsidian-800 hover:bg-amber-500/20 hover:text-amber-400 text-slate-300 rounded-xl border border-slate-700/60 transition-colors"
                        title="ดูบิล & โหลดรูปภาพ"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                  </div>

                  {/* 3-Tier Payment Status Controls */}
                  {isCancelled ? (
                    <div className="bg-obsidian-950/60 rounded-2xl p-2.5 px-3 border border-rose-500/20 text-xs text-rose-300/80 flex items-center justify-between">
                      <span>⚠️ บิลนี้ถูกยกเลิกแล้ว — คืนโควตาตัวเลขกลับสู่ระบบแล้ว และไม่มียอดค้างชำระ</span>
                      <span className="text-[11px] font-mono text-slate-500">สถานะ: ยกเลิก</span>
                    </div>
                  ) : (
                  <div className="bg-obsidian-950/80 rounded-2xl p-3 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                    
                    {/* Stage 1: Customer -> Member */}
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 font-medium">1. ลูกค้า:</span>
                      <button
                        type="button"
                        disabled={Boolean(updatingPayment[`${b.id}_CUSTOMER`])}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTogglePayment(b.id, 'CUSTOMER', b.customer_payment_status);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          b.customer_payment_status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-red-500/20 text-red-300 border border-red-500/40'
                        } ${updatingPayment[`${b.id}_CUSTOMER`] ? 'opacity-50 cursor-wait' : 'active:scale-95'}`}
                      >
                        {b.customer_payment_status === 'PAID' ? '✓ จ่ายแล้ว' : '⏳ ค้างจ่าย'}
                      </button>
                    </div>

                    {/* Stage 2: Member -> Dealer */}
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400 font-medium">2. ลูกทีมส่งหัว:</span>
                      <button
                        type="button"
                        disabled={Boolean(updatingPayment[`${b.id}_MEMBER`])}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTogglePayment(b.id, 'MEMBER', b.member_payment_status);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          b.member_payment_status === 'PAID'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        } ${updatingPayment[`${b.id}_MEMBER`] ? 'opacity-50 cursor-wait' : 'active:scale-95'}`}
                      >
                        {b.member_payment_status === 'PAID' ? '✓ ส่งเงินแล้ว' : 'ยังไม่ส่ง'}
                      </button>
                    </div>

                    {/* Stage 3: Dealer Received (Leader Only) */}
                    {role === 'LEADER' && (
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-400 font-medium">3. หัวหน้ารับเงิน:</span>
                        <button
                          type="button"
                          disabled={Boolean(updatingPayment[`${b.id}_DEALER`])}
                          onClick={(e) => {
                            e.preventDefault();
                            handleTogglePayment(b.id, 'DEALER', b.dealer_payment_status);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                            b.dealer_payment_status === 'PAID'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-slate-800 text-slate-400 border border-slate-700'
                          } ${updatingPayment[`${b.id}_DEALER`] ? 'opacity-50 cursor-wait' : 'active:scale-95'}`}
                        >
                          {b.dealer_payment_status === 'PAID' ? '✓ ได้รับแล้ว' : 'รอยืนยัน'}
                        </button>
                      </div>
                    )}

                    {/* Prize Payout Status (If Won) */}
                    {isWon && (
                      <div className="flex items-center space-x-2 border-l border-slate-800 pl-3">
                        <span className="text-amber-400 font-medium">จ่ายรางวัล:</span>
                        <select
                          value={b.prize_payout_status}
                          onChange={(e) => handleUpdatePrizeStatus(b.id, e.target.value)}
                          className="bg-obsidian-900 border border-amber-500/30 text-amber-300 text-xs rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="PENDING">รอดำเนินการ</option>
                          <option value="PAID_BY_MEMBER">ลูกทีมโอนให้แล้ว</option>
                          <option value="PAID_BY_DEALER">หัวหน้าโอนให้แล้ว</option>
                        </select>
                        {b.prize_slip_url && (
                          <a
                            href={b.prize_slip_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-blue-400 underline"
                          >
                            ดูสลิป
                          </a>
                        )}
                      </div>
                    )}

                  </div>
                  )}

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bill Preview Modal */}
      {selectedBill && (
        <BillPreviewModal
          bill={selectedBill}
          onClose={() => setSelectedBill(null)}
        />
      )}

    </div>
  );
}
