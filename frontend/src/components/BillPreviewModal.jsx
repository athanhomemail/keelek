import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { useModal } from '../context/ModalContext.jsx';
import { Download, X, CheckCircle2, AlertCircle, Share2, Receipt, Keyboard } from 'lucide-react';

export default function BillPreviewModal({ bill, onClose }) {
  const { showAlert } = useModal();
  const billRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  if (!bill) return null;

  const handleDownloadImage = async () => {
    if (!billRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(billRef.current, {
        scale: 2.5,
        backgroundColor: '#0d1117',
        useCORS: true
      });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Bill-${bill.billNo || 'KeeLek'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export bill image:', err);
      showAlert('เกิดข้อผิดพลาดในการสร้างรูปภาพบิล', { type: 'error' });
    } finally {
      setDownloading(false);
    }
  };

  const formatBetType = (t) => {
    switch (t) {
      case '3TOP': return '3 ตัวบน';
      case '3TOD': return '3 ตัวโต๊ด';
      case '2TOP': return '2 ตัวบน';
      case '2BOTTOM': return '2 ตัวล่าง';
      case 'RUN_TOP': return 'วิ่งบน';
      case 'RUN_BOTTOM': return 'วิ่งล่าง';
      default: return t;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-md w-full my-8 bg-obsidian-900 border border-amber-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header Bar */}
        <div className="px-5 py-3.5 bg-obsidian-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-400">
            <Receipt className="w-5 h-5" />
            <span className="font-bold text-sm">ตัวอย่างใบสรุปส่งลูกค้า (Preview)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Bill Area (Captured by html2canvas) */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[70vh]">
          <div
            ref={billRef}
            className="bg-obsidian-950 border border-amber-500/40 rounded-2xl p-5 shadow-2xl text-slate-100 font-sans"
            style={{ minWidth: '320px' }}
          >
            {/* Bill Header */}
            <div className="text-center border-b border-dashed border-amber-500/30 pb-4 mb-4">
              <h2 className="text-xl font-bold text-amber-300 tracking-wide mb-1">
                {bill.memberName || bill.member_name || 'ใบสรุปรายการตัวเลข'}
              </h2>
              <p className="text-xs text-slate-300 font-medium tracking-wide">ใบสรุปรายการตัวเลข</p>
              <div className="mt-2 text-[11px] text-slate-400 flex flex-col space-y-0.5">
                <span>เลขที่บิล: <strong className="text-slate-200 font-mono">{bill.billNo || bill.bill_no}</strong></span>
                <span>งวด: <strong className="text-amber-300">{bill.periodName || bill.period_name}</strong></span>
                <span>วันที่: {new Date(bill.createdAt || bill.created_at || Date.now()).toLocaleString('th-TH')}</span>
              </div>
              {bill.status === 'CANCELLED' && (
                <div className="mt-2.5 py-1 px-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-xs tracking-wider">
                  🚫 บิลนี้ถูกยกเลิกแล้ว (คืนโควตา)
                </div>
              )}
            </div>

            {/* Keyed by & Note info */}
            <div className="bg-obsidian-900/90 rounded-xl p-3 mb-4 text-xs space-y-1 border border-slate-800">
              <div className="flex justify-between">
                <span className="text-slate-400">ผู้คีย์บิล:</span>
                <span className="text-slate-200">{bill.memberName || bill.member_name || 'สมาชิก'}</span>
              </div>
              {Boolean(bill.customerName || bill.customer_name) && (bill.customerName !== '-' && bill.customer_name !== '-') && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ชื่อลูกค้า:</span>
                  <span className="font-bold text-amber-300">{bill.customerName || bill.customer_name}</span>
                </div>
              )}
              {bill.note && (
                <div className="flex justify-between">
                  <span className="text-slate-400">หมายเหตุ:</span>
                  <span className="text-amber-400 font-medium">{bill.note}</span>
                </div>
              )}
            </div>

            {/* Bet Items Table */}
            <div className="border-t border-b border-slate-800 py-2 mb-4">
              <div className="grid grid-cols-12 text-[11px] font-bold text-amber-400/90 pb-2 border-b border-slate-800">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-4 text-center">เลข</div>
                <div className="col-span-4">ประเภท</div>
                <div className="col-span-3 text-right">ยอด (บ.)</div>
              </div>

              <div className="divide-y divide-slate-800/40 text-xs">
                {(bill.items || []).map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 py-1.5 items-center">
                    <div className="col-span-1 text-center text-[10px] text-slate-500 font-mono">{idx + 1}</div>
                    <div className="col-span-4 text-center font-mono font-bold text-base text-amber-400">
                      {item.number}
                    </div>
                    <div className="col-span-4 text-[11px] text-slate-300">
                      <div>{formatBetType(item.betType || item.bet_type)}</div>
                      <div className="text-[10px] text-slate-500">
                        {item.isHalfPay || item.is_half_pay ? '⚠️ จ่ายครึ่ง' : `จ่าย ${Number(item.payRate || item.pay_rate)}`}
                      </div>
                    </div>
                    <div className="col-span-3 text-right font-mono font-bold text-slate-100">
                      {Number(item.amount).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bill Summary */}
            <div className="space-y-1.5 text-xs mb-4">
              <div className="flex justify-between text-slate-300">
                <span>จำนวนรายการ:</span>
                <span className="font-mono font-bold">{(bill.items || []).length} รายการ</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-slate-800">
                <span className="text-slate-200">ยอดรวมทั้งสิ้น:</span>
                <span className="text-base text-amber-400 font-mono">
                  {Number(bill.totalAmount || bill.total_amount).toLocaleString()} บาท
                </span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span className="text-slate-400">สถานะบิล:</span>
                {bill.status === 'CANCELLED' ? (
                  <span className="text-rose-400 font-bold flex items-center">
                    🚫 ยกเลิกบิลแล้ว (คืนโควตา)
                  </span>
                ) : (bill.customerPaymentStatus || bill.customer_payment_status) === 'PAID' ? (
                  <span className="text-emerald-400 font-bold flex items-center">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> ชำระเงินแล้ว
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center">
                    <AlertCircle className="w-3.5 h-3.5 mr-1" /> ยังไม่ชำระเงิน (ค้างจ่าย)
                  </span>
                )}
              </div>
            </div>

            {/* Footer Warning & Kee-Lek Watermark */}
            <div className="border-t border-slate-900 pt-3">
              <p className="text-center text-[10px] text-slate-500">กรุณาตรวจสอบความถูกต้องของตัวเลขทันทีที่ได้รับบิล</p>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2 pt-1 border-t border-slate-900/60">
                <span>ขอบคุณที่ใช้บริการ 🙏</span>
                <span className="text-[10px] font-mono tracking-widest text-slate-600 font-medium">Kee-Lek</span>
              </div>
            </div>

          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-4 bg-obsidian-850 border-t border-slate-800 flex flex-col sm:flex-row items-center gap-2">
          <button
            onClick={handleDownloadImage}
            disabled={downloading}
            className="w-full sm:flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 transition-all active:scale-98"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'กำลังบันทึกรูป...' : 'บันทึกรูปภาพส่งลูกค้า'}</span>
          </button>
          
          <button
            onClick={onClose}
            className="w-full sm:w-auto py-2.5 px-5 bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition-colors"
          >
            ปิด
          </button>
        </div>

      </div>
    </div>
  );
}
