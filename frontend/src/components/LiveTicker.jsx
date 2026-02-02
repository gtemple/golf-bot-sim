import React from 'react';

export default function LiveTicker({ events }) {
  // Use latest 15 events
  const latestEvents = (events || []).slice(0, 15);

  if (!latestEvents.length) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t-2 border-green-500 text-white z-40 h-10 flex items-center shadow-2xl">
      <div className="bg-green-600 px-4 h-full flex items-center z-50 font-black italic tracking-tighter shadow-lg shrink-0">
        LIVE
      </div>
      <div className="ticker-container flex-1 overflow-hidden relative h-full bg-gray-900">
         <div className="ticker-text h-full flex items-center whitespace-nowrap animate-ticker pl-[100%]">
            {latestEvents.map((ev, i) => (
                <div key={`${ev.id}-${i}`} className="inline-flex items-center px-6 border-r border-gray-800">
                    {ev.importance >= 3 && (
                        <span className="text-yellow-400 font-bold mr-2 animate-pulse text-xs uppercase tracking-wider">
                            ★ Breaking
                        </span>
                    )}
                    <span className={`text-sm font-medium ${ev.importance >= 3 ? 'text-white' : 'text-gray-300'}`}>
                        {ev.text}
                    </span>
                    <span className="text-gray-600 text-xs ml-3 font-mono">
                      {new Date(ev.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </span>
                </div>
            ))}
         </div>
      </div>
    </div>
  );
}
