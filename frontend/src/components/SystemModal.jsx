import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export default function SystemModal({
  isOpen,
  type = 'info',
  title,
  message,
  subtitle,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  isConfirm = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      } else if (e.key === 'Enter') {
        onConfirm();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          icon: CheckCircle2,
          iconColor: 'text-emerald-400',
          iconBg: 'bg-emerald-500/10 border-emerald-500/30',
          confirmBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30',
          accentBorder: 'border-emerald-500/30',
          glow: 'from-emerald-500/20 to-transparent',
        };
      case 'danger':
      case 'error':
        return {
          icon: AlertCircle,
          iconColor: 'text-rose-400',
          iconBg: 'bg-rose-500/10 border-rose-500/30',
          confirmBtn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/30',
          accentBorder: 'border-rose-500/30',
          glow: 'from-rose-500/20 to-transparent',
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          iconColor: 'text-amber-400',
          iconBg: 'bg-amber-500/10 border-amber-500/30',
          confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold shadow-lg shadow-amber-500/30',
          accentBorder: 'border-amber-500/30',
          glow: 'from-amber-500/20 to-transparent',
        };
      default: // info
        return {
          icon: Info,
          iconColor: 'text-sky-400',
          iconBg: 'bg-sky-500/10 border-sky-500/30',
          confirmBtn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-obsidian-950 font-bold shadow-lg shadow-amber-500/30',
          accentBorder: 'border-amber-500/20',
          glow: 'from-amber-500/10 to-transparent',
        };
    }
  };

  const style = getTypeStyles();
  const Icon = style.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-obsidian-950/80 backdrop-blur-md animate-fade-in">
      {/* Click outside backdrop */}
      <div className="absolute inset-0" onClick={onCancel} />

      {/* Modal Dialog Card */}
      <div className={`relative w-full max-w-md bg-obsidian-900 border ${style.accentBorder} rounded-3xl p-6 shadow-2xl overflow-hidden z-10 transition-all transform scale-100`}>
        
        {/* Background ambient glow */}
        <div className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 bg-gradient-to-b ${style.glow} rounded-full blur-3xl pointer-events-none`} />

        {/* Close 'X' button on top right */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-100 hover:bg-obsidian-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon & Title */}
        <div className="flex flex-col items-center text-center mt-2">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 ${style.iconBg} shadow-md`}>
            <Icon className={`w-7 h-7 ${style.iconColor}`} />
          </div>

          <h3 className="text-lg font-bold text-slate-100 tracking-wide">
            {title}
          </h3>

          {/* Main Message */}
          {message && (
            <div className="mt-2.5 text-sm text-slate-300 leading-relaxed whitespace-pre-line max-h-60 overflow-y-auto px-1">
              {message}
            </div>
          )}

          {/* Optional Subtitle / Warning Note */}
          {subtitle && (
            <div className="mt-2 px-3 py-1.5 rounded-xl bg-obsidian-800/80 border border-slate-700/50 text-xs text-slate-400 text-left w-full whitespace-pre-line">
              {subtitle}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className={`mt-6 flex items-center gap-3 ${isConfirm ? 'justify-between' : 'justify-center'}`}>
          {isConfirm && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2.5 px-4 bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 rounded-xl text-sm font-semibold border border-slate-700/60 transition-colors"
            >
              {cancelText || 'ยกเลิก'}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            className={`${isConfirm ? 'flex-1' : 'w-full'} py-2.5 px-4 rounded-xl text-sm font-bold transition-all transform active:scale-95 flex items-center justify-center ${style.confirmBtn}`}
          >
            {confirmText || 'ตกลง'}
          </button>
        </div>

      </div>
    </div>
  );
}
