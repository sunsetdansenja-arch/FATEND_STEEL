import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { Flame, Delete, AlertCircle, ArrowRight, ShieldCheck, Lock } from 'lucide-react';

export const PinLoginModal: React.FC = () => {
  const { session, loginWithPin } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const submitPin = useCallback((pinToTest: string) => {
    if (!pinToTest) {
      setError('Masukkan 4 digit PIN Anda.');
      return;
    }
    const res = loginWithPin(pinToTest);
    if (res.success) {
      setPin('');
      setError('');
    } else {
      setError(res.message || 'PIN yang Anda masukkan salah. Silakan coba lagi.');
      // Reset pin on incorrect entry so user can re-try easily
      setTimeout(() => {
        setPin('');
      }, 700);
    }
  }, [loginWithPin]);

  const handleDigit = useCallback((digit: string) => {
    setError('');
    setPin((prev) => {
      if (prev.length >= 6) return prev;
      const next = prev + digit;
      if (next.length === 4) {
        // Trigger submit asynchronously outside the state updater to avoid setState in render warning
        setTimeout(() => {
          submitPin(next);
        }, 50);
      }
      return next;
    });
  }, [submitPin]);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  // Listen to physical keyboard events (0-9, Backspace, Enter, Esc)
  useEffect(() => {
    if (session) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submitPin(pin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session, pin, handleDigit, handleDelete, handleClear, submitPin]);

  if (session) return null; // Already logged in

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="w-full max-w-sm bg-[#16181d] border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-500/10 overflow-hidden flex flex-col">
        {/* Top Industrial Accent Header */}
        <div className="h-2.5 bg-hazard-stripes w-full" />

        <div className="p-6 flex flex-col items-center text-center">
          {/* Logo Badge */}
          <div className="w-18 h-18 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-xl shadow-amber-500/20 mb-3 border border-amber-500/40 overflow-hidden shrink-0">
            <img
              src="/logo.jpg"
              alt="Logo CV. Fatend Jaya Teknik Sinergi"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="font-industrial text-xl sm:text-2xl font-bold tracking-wider text-white">
            CV. FATEND JAYA TEKNIK SINERGI
          </h1>
          <p className="text-xs uppercase tracking-widest text-amber-400 font-semibold mt-0.5">
            Welding & Construction Specialist
          </p>

          <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5 justify-center">
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
            <span>Masukkan 4-digit PIN keamanan Anda untuk masuk</span>
          </p>

          {/* PIN Display Dots */}
          <div className="my-5 flex items-center justify-center gap-3.5">
            {[0, 1, 2, 3].map((idx) => {
              const filled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 border ${
                    filled
                      ? 'bg-amber-400 border-amber-300 scale-110 shadow-sm shadow-amber-400'
                      : 'bg-zinc-800 border-zinc-700'
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <div className="mb-3 px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-800 text-red-300 text-xs flex items-center gap-2 w-full text-left animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[260px]">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => handleDigit(d)}
                className="h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-amber-500 active:text-black active:scale-95 border border-zinc-800 text-lg font-bold text-zinc-100 transition-all shadow-sm font-mono-num cursor-pointer"
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={handleClear}
              className="h-12 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 active:scale-95 border border-zinc-800 text-xs font-semibold text-zinc-400 transition-all cursor-pointer"
            >
              HAPUS
            </button>
            <button
              type="button"
              onClick={() => handleDigit('0')}
              className="h-12 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 active:bg-amber-500 active:text-black active:scale-95 border border-zinc-800 text-lg font-bold text-zinc-100 transition-all shadow-sm font-mono-num cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="h-12 rounded-xl bg-zinc-900/50 hover:bg-zinc-800 active:scale-95 border border-zinc-800 flex items-center justify-center text-zinc-300 transition-all cursor-pointer"
              aria-label="Hapus digit"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => submitPin(pin)}
            className="w-full mt-5 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm tracking-wide transition-all shadow-md shadow-amber-500/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>MASUK SISTEM</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Secure Info Footer */}
          <div className="w-full mt-5 pt-3.5 border-t border-zinc-800/80 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Sistem Terenkripsi & Terlindungi PIN</span>
          </div>
        </div>
      </div>
    </div>
  );
};
