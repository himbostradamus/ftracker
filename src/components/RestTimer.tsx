import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Minus, Plus, X } from 'lucide-react';

interface RestTimerProps {
  duration: number;
  onDismiss: () => void;
}

export function RestTimer({ duration, onDismiss }: RestTimerProps) {
  // The deadline is the source of truth; timeLeft is just a display projection.
  // This makes the timer self-correct after browser background-tab throttling
  // and avoids drift, instead of trying to count down by -1 every interval tick.
  const deadlineRef = useRef(Date.now() + duration * 1000);
  const [timeLeft, setTimeLeft] = useState(duration);

  useEffect(() => {
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    const handle = setInterval(tick, 250);
    return () => clearInterval(handle);
  }, []);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const adjust = (deltaSec: number) => {
    // Always keep at least 1s on the clock so a -15 from a near-zero state doesn't bottom out instantly.
    deadlineRef.current = Math.max(Date.now() + 1000, deadlineRef.current + deltaSec * 1000);
    // Force an immediate redraw rather than waiting up to 250ms.
    setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
  };

  const isDone = timeLeft <= 0;

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className="fixed bottom-[50px] left-0 right-0 flex justify-center z-50 px-3 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="max-w-[375px] w-full bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl p-3 flex items-center gap-3 shadow-2xl">
        <span className="text-[10px] text-[#888] tracking-widest uppercase">Rest</span>
        <button onClick={() => adjust(-15)} className="w-7 h-7 rounded-md border border-[#333] text-[#888] flex items-center justify-center active:bg-[#222]">
          <Minus size={14} />
        </button>
        <div className={`flex-1 text-center text-2xl font-bold tracking-widest ${isDone ? 'text-success animate-pulse' : 'text-primary'}`}>
          {isDone ? 'GO' : formatTime(timeLeft)}
        </div>
        <button onClick={() => adjust(15)} className="w-7 h-7 rounded-md border border-[#333] text-[#888] flex items-center justify-center active:bg-[#222]">
          <Plus size={14} />
        </button>
        <button onClick={onDismiss} className="text-[#555] p-1">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
}
