import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useModal } from '../context/ModalContext.jsx';
import { ShieldCheck, CheckCircle2, XCircle, Clock, Play, Calendar, AlertCircle, RefreshCw, PlusCircle, Trash2, CalendarDays, Lock, Unlock, Pencil } from 'lucide-react';

export default function AdminPage() {
  const { showAlert, showConfirm } = useModal();
  const [overview, setOverview] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);

  // Create / Edit Draw Period form states
  const [editingPeriod, setEditingPeriod] = useState(null);
  const [newLotteryId, setNewLotteryId] = useState('1');
  const [newPeriodDate, setNewPeriodDate] = useState('2026-10-01');
  const [newPeriodName, setNewPeriodName] = useState('หวยไทย งวดประจำวันที่ 01/10/2026');
  const [newCloseTime, setNewCloseTime] = useState('2026-10-01T15:30');
  const [creatingPeriod, setCreatingPeriod] = useState(false);

  // Scraper simulator form
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [scrape3top, setScrape3top] = useState('');
  const [scrape2top, setScrape2top] = useState('');
  const [scrape2bottom, setScrape2bottom] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeResult, setScrapeResult] = useState(null);

  const fetchAdminData = async () => {
    try {
      const [ovRes, roomRes, periodRes] = await Promise.all([
        axios.get('/api/admin/overview'),
        axios.get('/api/admin/rooms'),
        axios.get('/api/draw-periods')
      ]);
      if (ovRes.data.success) setOverview(ovRes.data.overview);
      if (roomRes.data.success) setRooms(roomRes.data.rooms);
      if (periodRes.data.success) {
        setPeriods(periodRes.data.periods);
        if (periodRes.data.periods.length) {
          setSelectedPeriodId(periodRes.data.periods[0].id.toString());
        }
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleApproveRoom = async (roomId, days = 365) => {
    try {
      const res = await axios.post('/api/admin/rooms/approve', { roomId, days });
      if (res.data.success) {
        showAlert(res.data.message, { type: 'success' });
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการอนุมัติห้อง', { type: 'error' });
    }
  };

  const handleRejectRoom = async (roomId) => {
    const ok = await showConfirm('ต้องการปฏิเสธคำขอเปิดห้องนี้ใช่หรือไม่?', {
      type: 'danger',
      confirmText: 'ปฏิเสธคำขอ',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.post('/api/admin/rooms/reject', { roomId });
      if (res.data.success) {
        fetchAdminData();
      }
    } catch (err) {
      showAlert('ไม่สามารถปฏิเสธได้', { type: 'error' });
    }
  };

  const handleToggleRoomStatus = async (roomId, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'DISBANDED' : 'ACTIVE';
    try {
      await axios.patch('/api/admin/rooms/status', { roomId, status: nextStatus });
      fetchAdminData();
    } catch (err) {
      showAlert('ไม่สามารถเปลี่ยนสถานะห้องได้', { type: 'error' });
    }
  };

  // Handle Lottery type or Date change to auto-suggest period name and close time
  const handleLotteryOrDateChange = (lotId, dateStr) => {
    setNewLotteryId(lotId);
    setNewPeriodDate(dateStr);
    const parts = dateStr.split('-');
    const formatted = parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    const name = lotId === '1'
      ? `หวยไทย งวดประจำวันที่ ${formatted}`
      : `หวยลาว งวดประจำวันที่ ${formatted}`;
    setNewPeriodName(name);
    setNewCloseTime(`${dateStr}T${lotId === '1' ? '15:30' : '20:00'}`);
  };

  // Create new draw period
  const handleCreatePeriod = async (e) => {
    e.preventDefault();
    setCreatingPeriod(true);
    try {
      const res = await axios.post('/api/admin/draw-periods', {
        lotteryId: newLotteryId,
        periodDate: newPeriodDate,
        periodName: newPeriodName,
        closeTime: newCloseTime ? newCloseTime.replace('T', ' ') + ':00' : undefined
      });
      if (res.data.success) {
        showAlert(res.data.message, { type: 'success' });
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการสร้างงวด', { type: 'error' });
    } finally {
      setCreatingPeriod(false);
    }
  };

  // Start editing a draw period
  const handleStartEditPeriod = (p) => {
    setEditingPeriod(p);
    setNewLotteryId(String(p.lottery_id));
    const dateFormatted = p.period_date ? p.period_date.split('T')[0] : '';
    setNewPeriodDate(dateFormatted);
    setNewPeriodName(p.period_name || '');
    let closeFormatted = '';
    if (p.close_time) {
      const dt = new Date(p.close_time);
      const YYYY = dt.getFullYear();
      const MM = String(dt.getMonth() + 1).padStart(2, '0');
      const DD = String(dt.getDate()).padStart(2, '0');
      const hh = String(dt.getHours()).padStart(2, '0');
      const mm = String(dt.getMinutes()).padStart(2, '0');
      closeFormatted = `${YYYY}-${MM}-${DD}T${hh}:${mm}`;
    }
    setNewCloseTime(closeFormatted);
    // Smooth scroll to form
    const el = document.getElementById('draw-period-form');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // Cancel editing period
  const handleCancelEditPeriod = () => {
    setEditingPeriod(null);
    handleLotteryOrDateChange('1', '2026-10-01');
  };

  // Submit update for draw period
  const handleUpdatePeriod = async (e) => {
    e.preventDefault();
    if (!editingPeriod) return;
    setCreatingPeriod(true);
    try {
      const res = await axios.put(`/api/admin/draw-periods/${editingPeriod.id}`, {
        lotteryId: newLotteryId,
        periodDate: newPeriodDate,
        periodName: newPeriodName,
        closeTime: newCloseTime ? newCloseTime.replace('T', ' ') + ':00' : undefined
      });
      if (res.data.success) {
        showAlert(res.data.message, { type: 'success' });
        setEditingPeriod(null);
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการแก้ไขงวด', { type: 'error' });
    } finally {
      setCreatingPeriod(false);
    }
  };

  // Toggle Period Status (OPEN / CLOSED)
  const handleTogglePeriodStatus = async (periodId, currentStatus) => {
    const nextStatus = currentStatus === 'OPEN' ? 'CLOSED' : 'OPEN';
    try {
      const res = await axios.patch(`/api/admin/draw-periods/${periodId}/status`, { status: nextStatus });
      if (res.data.success) {
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถเปลี่ยนสถานะงวดได้', { type: 'error' });
    }
  };

  // Delete Period
  const handleDeletePeriod = async (periodId) => {
    const ok = await showConfirm('ยืนยันที่จะลบงวดนี้ออกจากระบบหรือไม่?', {
      type: 'danger',
      confirmText: 'ลบงวดหวย',
      cancelText: 'ยกเลิก'
    });
    if (!ok) return;
    try {
      const res = await axios.delete(`/api/admin/draw-periods/${periodId}`);
      if (res.data.success) {
        showAlert(res.data.message, { type: 'success' });
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'ไม่สามารถลบงวดหวยได้', { type: 'error' });
    }
  };

  // Randomize mock lottery result for testing
  const handleRandomizeResult = () => {
    const r3 = Math.floor(100 + Math.random() * 900).toString();
    const r2 = Math.floor(10 + Math.random() * 90).toString();
    setScrape3top(r3);
    setScrape2top(r3.slice(-2));
    setScrape2bottom(r2);
  };

  // Trigger Scraper and Win Calculation
  const handleTriggerScraper = async (e) => {
    e.preventDefault();
    if (!selectedPeriodId) return;
    setScraping(true);
    setScrapeResult(null);
    try {
      const res = await axios.post('/api/admin/scraper/trigger', {
        periodId: selectedPeriodId,
        result3top: scrape3top || undefined,
        result2top: scrape2top || undefined,
        result2bottom: scrape2bottom || undefined
      });
      if (res.data.success) {
        setScrapeResult(res.data);
        fetchAdminData();
      }
    } catch (err) {
      showAlert(err.response?.data?.message || 'เกิดข้อผิดพลาดในการดึงผลหวย', { type: 'error' });
    } finally {
      setScraping(false);
    }
  };

  if (loading) {
    return <div className="text-center py-16 text-slate-400">กำลังโหลดระบบ Admin...</div>;
  }

  const pendingRooms = rooms.filter(r => r.status === 'PENDING');
  const activeRooms = rooms.filter(r => r.status !== 'PENDING');

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 pb-24 space-y-8">
      
      {/* Admin Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center space-x-2">
          <ShieldCheck className="w-6 h-6 text-purple-400" />
          <span>แผงควบคุมผู้ดูแลระบบสูงสุด (Super Admin)</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          อนุมัติห้องเจ้ามือหวย, ควบคุมอายุการใช้งาน, และจัดการ Scraper ผลสลาก
        </p>
      </div>

      {/* 1. Platform KPIs */}
      {overview && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ยอดเงินหมุนเวียนทั้งระบบ</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-amber-400">
              {Number(overview.finances?.total_turnover || 0).toLocaleString()} <span className="text-xs font-sans text-slate-400">บ.</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ห้องที่เปิดใช้งานอยู่</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-emerald-400">
              {overview.rooms?.active_rooms || 0} <span className="text-xs font-sans text-slate-400">ห้อง</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">คำขอเปิดห้องรออนุมัติ</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-orange-400">
              {overview.rooms?.pending_rooms || 0} <span className="text-xs font-sans text-slate-400">คำขอ</span>
            </div>
          </div>

          <div className="bg-obsidian-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
            <span className="text-xs text-slate-400 block mb-1">ผู้ใช้ทั้งหมดในระบบ</span>
            <div className="text-lg sm:text-xl font-bold font-mono text-purple-400">
              {overview.users?.total_users || 0} <span className="text-xs font-sans text-slate-400">คน</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Pending Room Creation Requests */}
      <div className="bg-obsidian-900 border border-amber-500/30 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm sm:text-base mb-3">
          <AlertCircle className="w-5 h-5" />
          <span>คำขอเปิดห้องคีย์ใหม่รออนุมัติ ({pendingRooms.length} รายการ)</span>
        </div>

        {pendingRooms.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            ไม่มีคำขอเปิดห้องที่รออนุมัติในขณะนี้
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {pendingRooms.map((r) => (
              <div key={r.id} className="py-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-sm text-slate-100">{r.name}</div>
                  <div className="text-slate-400 mt-1">
                    ผู้ขอ: <strong className="text-amber-300">{r.real_name || r.leader_name}</strong> | โทร: {r.phone}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    ธนาคาร: {r.bank_name} เลขที่ {r.account_no} (พร้อมเพย์: {r.promptpay || '-'})
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleApproveRoom(r.id, 365)}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-obsidian-950 font-bold rounded-xl text-xs flex items-center space-x-1 shadow-md"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>อนุมัติ (1 ปี)</span>
                  </button>
                  <button
                    onClick={() => handleApproveRoom(r.id, 30)}
                    className="px-3 py-2 bg-obsidian-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs"
                  >
                    อนุมัติ (30 วัน)
                  </button>
                  <button
                    onClick={() => handleRejectRoom(r.id)}
                    className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Draw Periods Management (กำหนดงวดหวยและวันออกผล) */}
      <div className="bg-obsidian-900 border border-amber-500/30 rounded-3xl p-5 shadow-2xl space-y-5">
        <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-3 gap-2">
          <div>
            <h3 className="font-bold text-base text-amber-300 flex items-center space-x-2">
              <CalendarDays className="w-5 h-5 text-amber-400" />
              <span>กำหนดงวดหวยและวันออกผล (Draw Periods)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Admin สามารถเปิดงวดใหม่, กำหนดวันออกผล (เช่น วันที่ 1 หรือ 16 ของเดือน), และเปิด-ปิดรับส่งเลขได้ที่นี่
            </p>
          </div>
          <div className="text-xs text-amber-400 font-medium bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
            💡 หวยไทยปกติออกวันที่ 1 และ 16 ของทุกเดือน
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 mr-1">ปุ่มตั้งค่างวดด่วน:</span>
          <button
            type="button"
            onClick={() => handleLotteryOrDateChange('1', '2026-09-16')}
            className="px-2.5 py-1 bg-obsidian-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700/60 rounded-lg text-xs transition-all"
          >
            🇹🇭 หวยไทย (16 ก.ย. 2026)
          </button>
          <button
            type="button"
            onClick={() => handleLotteryOrDateChange('1', '2026-10-01')}
            className="px-2.5 py-1 bg-obsidian-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700/60 rounded-lg text-xs transition-all"
          >
            🇹🇭 หวยไทย (1 ต.ค. 2026)
          </button>
          <button
            type="button"
            onClick={() => handleLotteryOrDateChange('1', '2026-10-16')}
            className="px-2.5 py-1 bg-obsidian-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300 border border-slate-700/60 rounded-lg text-xs transition-all"
          >
            🇹🇭 หวยไทย (16 ต.ค. 2026)
          </button>
          <button
            type="button"
            onClick={() => handleLotteryOrDateChange('2', '2026-09-16')}
            className="px-2.5 py-1 bg-obsidian-800 hover:bg-blue-500/20 text-slate-200 hover:text-blue-300 border border-slate-700/60 rounded-lg text-xs transition-all"
          >
            🇱🇦 หวยลาว (16 ก.ย. 2026)
          </button>
        </div>

        {/* Create / Edit Period Form */}
        <form 
          id="draw-period-form" 
          onSubmit={editingPeriod ? handleUpdatePeriod : handleCreatePeriod} 
          className={`p-4 rounded-2xl border transition-all space-y-3 text-xs ${
            editingPeriod 
              ? 'bg-purple-950/20 border-purple-500/50 shadow-lg shadow-purple-500/10' 
              : 'bg-obsidian-950 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="font-bold text-xs flex items-center space-x-1.5">
              {editingPeriod ? (
                <>
                  <Pencil className="w-4 h-4 text-purple-400" />
                  <span className="text-purple-300">แก้ไขงวดหวย ID: #{editingPeriod.id}</span>
                  <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full text-[10px]">
                    โหมดแก้ไข
                  </span>
                </>
              ) : (
                <>
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-200">สร้างงวดหวยใหม่ / เปิดรับส่งเลข</span>
                </>
              )}
            </div>

            {editingPeriod && (
              <button
                type="button"
                onClick={handleCancelEditPeriod}
                className="text-slate-400 hover:text-white text-xs underline"
              >
                ยกเลิกการแก้ไข
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">ประเภทหวย:</label>
              <select
                value={newLotteryId}
                onChange={(e) => handleLotteryOrDateChange(e.target.value, newPeriodDate)}
                className="w-full bg-obsidian-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-amber-500"
              >
                <option value="1">หวยรัฐบาลไทย (THAI)</option>
                <option value="2">หวยพัฒนาลาว (LAO)</option>
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">วันที่หวยออก (YYYY-MM-DD):</label>
              <input
                type="date"
                value={newPeriodDate}
                onChange={(e) => handleLotteryOrDateChange(newLotteryId, e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ชื่องวดที่แสดงในระบบ:</label>
              <input
                type="text"
                value={newPeriodName}
                onChange={(e) => setNewPeriodName(e.target.value)}
                placeholder="เช่น หวยไทย งวดประจำวันที่ 16/09/2026"
                className="w-full bg-obsidian-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">เวลาปิดรับส่งเลข:</label>
              <input
                type="datetime-local"
                value={newCloseTime}
                onChange={(e) => setNewCloseTime(e.target.value)}
                className="w-full bg-obsidian-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none focus:border-amber-500 font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end items-center space-x-2 pt-1">
            {editingPeriod && (
              <button
                type="button"
                onClick={handleCancelEditPeriod}
                className="px-4 py-2.5 bg-obsidian-850 hover:bg-obsidian-800 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              >
                ยกเลิก
              </button>
            )}

            <button
              type="submit"
              disabled={creatingPeriod}
              className={`w-full sm:w-auto px-6 py-2.5 font-bold rounded-xl shadow-md transition-all text-xs flex items-center justify-center space-x-1.5 ${
                editingPeriod
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-500/20'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950'
              }`}
            >
              {editingPeriod ? <Pencil className="w-4 h-4" /> : <PlusCircle className="w-4 h-4" />}
              <span>
                {creatingPeriod
                  ? 'กำลังบันทึก...'
                  : editingPeriod
                  ? 'บันทึกการแก้ไขงวด'
                  : 'บันทึกและเปิดรับงวดนี้'}
              </span>
            </button>
          </div>
        </form>

        {/* Existing Periods Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">หวย</th>
                <th className="py-2.5 px-3">ชื่องวด</th>
                <th className="py-2.5 px-3">วันที่หวยออก</th>
                <th className="py-2.5 px-3">เวลาปิดรับ</th>
                <th className="py-2.5 px-3 text-center">สถานะ</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {periods.map((p) => (
                <tr key={p.id} className="hover:bg-obsidian-850/50 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-400">#{p.id}</td>
                  <td className="py-3 px-3 font-semibold text-slate-200">
                    {p.lottery_name || (p.lottery_id === 1 ? 'หวยรัฐบาลไทย' : 'หวยพัฒนาลาว')}
                  </td>
                  <td className="py-3 px-3 font-medium text-amber-300">{p.period_name}</td>
                  <td className="py-3 px-3 font-mono text-slate-300">
                    {p.period_date ? new Date(p.period_date).toLocaleDateString('th-TH') : '-'}
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-400">
                    {p.close_time ? new Date(p.close_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : '-'}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      p.status === 'OPEN'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : p.status === 'CLOSED'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    }`}>
                      {p.status === 'OPEN' ? '🟢 กำลังเปิดรับ' : p.status === 'CLOSED' ? '🟡 ปิดรับแล้ว' : '🟣 ออกผลแล้ว'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center space-x-1.5">
                      {p.status !== 'SETTLED' && (
                        <button
                          onClick={() => handleStartEditPeriod(p)}
                          title="แก้ไขข้อมูลและเวลาปิดรับของงวดนี้"
                          className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>แก้ไข</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleTogglePeriodStatus(p.id, p.status)}
                        title={p.status === 'OPEN' ? 'คลิกเพื่อปิดรับ' : 'คลิกเพื่อเปิดรับ'}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-all ${
                          p.status === 'OPEN'
                            ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {p.status === 'OPEN' ? (
                          <>
                            <Lock className="w-3 h-3" />
                            <span>ปิดรับ</span>
                          </>
                        ) : (
                          <>
                            <Unlock className="w-3 h-3" />
                            <span>เปิดรับ</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleDeletePeriod(p.id)}
                        title="ลบงวดนี้"
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Lottery Scraper & Win Calculation Control Console */}
      <div className="bg-obsidian-900 border border-purple-500/30 rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="font-bold text-base text-purple-300 flex items-center space-x-2">
              <Play className="w-4 h-4" />
              <span>แผงบันทึกผลรางวัล & คำนวณบิลทั้งระบบ</span>
            </h3>
            <p className="text-xs text-slate-400">
              ระบุผลสลากงวดที่ต้องการ บันทึกผล และสั่งคำนวณบิลที่ถูกรางวัลแบบ Realtime ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={handleRandomizeResult}
            className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold flex items-center space-x-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>สุ่มผลเลขตัวอย่าง</span>
          </button>
        </div>

        <form onSubmit={handleTriggerScraper} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">เลือกงวดที่จะออกผล:</label>
              <select
                value={selectedPeriodId}
                onChange={(e) => setSelectedPeriodId(e.target.value)}
                className="w-full bg-obsidian-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 outline-none"
              >
                {periods.map(p => (
                  <option key={p.id} value={p.id}>{p.period_name} ({p.status})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ผล 3 ตัวบน:</label>
              <input
                type="text"
                maxLength={3}
                value={scrape3top}
                onChange={(e) => setScrape3top(e.target.value)}
                placeholder="เช่น 729"
                className="w-full bg-obsidian-950 border border-slate-700 text-amber-300 font-bold font-mono text-center rounded-xl px-3 py-2 outline-none text-base"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ผล 2 ตัวบน:</label>
              <input
                type="text"
                maxLength={2}
                value={scrape2top}
                onChange={(e) => setScrape2top(e.target.value)}
                placeholder="เช่น 29"
                className="w-full bg-obsidian-950 border border-slate-700 text-amber-300 font-bold font-mono text-center rounded-xl px-3 py-2 outline-none text-base"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ผล 2 ตัวล่าง:</label>
              <input
                type="text"
                maxLength={2}
                value={scrape2bottom}
                onChange={(e) => setScrape2bottom(e.target.value)}
                placeholder="เช่น 95"
                className="w-full bg-obsidian-950 border border-slate-700 text-amber-300 font-bold font-mono text-center rounded-xl px-3 py-2 outline-none text-base"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={scraping}
            className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 text-sm transition-all"
          >
            {scraping ? 'กำลังประมวลผลรางวัล...' : '⚡ บันทึกผลรางวัล & คำนวณบิลรางวัลทั้งระบบทันที'}
          </button>
        </form>

        {scrapeResult && (
          <div className="mt-4 p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl text-xs space-y-1 text-purple-200">
            <div className="font-bold text-sm text-purple-300">✓ ประมวลผลรางวัลเรียบร้อยแล้ว!</div>
            <div>- ตรวจสอบบิลทั้งหมด: {scrapeResult.data?.totalBillsChecked} บิล</div>
            <div>- ยอดจ่ายรางวัลรวมทั้งสิ้น: {Number(scrapeResult.data?.totalPayout || 0).toLocaleString()} บาท</div>
            <div>- ส่งแจ้งเตือน Real-time ให้ผู้ใช้ทุกคนเรียบร้อยแล้ว</div>
          </div>
        )}
      </div>

      {/* 4. Active Rooms Management Table */}
      <div className="bg-obsidian-900 border border-slate-800 rounded-3xl p-5 shadow-2xl">
        <h3 className="font-bold text-base text-slate-100 mb-3">ห้องคีย์หวยทั้งหมดในระบบ ({activeRooms.length} ห้อง)</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-medium">
                <th className="py-2.5 px-3">รหัสห้อง</th>
                <th className="py-2.5 px-3">ชื่อห้อง</th>
                <th className="py-2.5 px-3">หัวหน้า</th>
                <th className="py-2.5 px-3 text-center">สมาชิก</th>
                <th className="py-2.5 px-3 text-right">ยอดรวม (บ.)</th>
                <th className="py-2.5 px-3 text-center">สถานะ</th>
                <th className="py-2.5 px-3 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {activeRooms.map((r) => (
                <tr key={r.id} className="hover:bg-obsidian-850/50 transition-colors">
                  <td className="py-3 px-3 font-bold text-amber-400">{r.code}</td>
                  <td className="py-3 px-3 font-sans text-slate-200 font-semibold">{r.name}</td>
                  <td className="py-3 px-3 font-sans text-slate-400">{r.leader_name}</td>
                  <td className="py-3 px-3 text-center text-slate-300">{r.member_count} คน</td>
                  <td className="py-3 px-3 text-right font-bold text-slate-100">
                    {Number(r.total_turnover || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      r.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}>
                      {r.status === 'ACTIVE' ? 'เปิดใช้งาน' : 'ถูกระงับ'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center font-sans">
                    <button
                      onClick={() => handleToggleRoomStatus(r.id, r.status)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        r.status === 'ACTIVE'
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                          : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400'
                      }`}
                    >
                      {r.status === 'ACTIVE' ? 'สั่งปิดห้อง' : 'เปิดห้อง'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
