'use client';

import type { VoiceController } from '@/hooks/useVoiceChat';

export function VoiceDiagnostics({ voice }: { voice: VoiceController }) {
  const peerEntries = Object.entries(voice.debug.peerDetails ?? {});
  if (!voice.joined && !voice.error) return null;

  return (
    <details className="fixed bottom-16 left-2 z-[80] max-w-[92vw] rounded-xl border border-gold-500/25 bg-black/70 px-2 py-1 text-[10px] text-slate-200 shadow-2xl backdrop-blur sm:bottom-20 sm:left-4 sm:max-w-sm sm:text-[11px]">
      <summary className="cursor-pointer select-none font-bold text-gold-300">
        Voice diag · {voice.status} · peers {voice.peerIds.length}
      </summary>
      <div className="mt-1 space-y-1 font-mono leading-snug">
        <div>mic: {voice.debug.mic}</div>
        <div>capture: {voice.micOn && !voice.micLocked ? 'enabled' : 'muted/locked'} · {voice.channelLabel}</div>
        <div>ice: {voice.debug.ice}</div>
        <div>playback: {voice.debug.playback}</div>
        {voice.error && <div className="text-blood-300">error: {voice.error}</div>}
        {voice.debug.lastError && <div className="text-blood-300">last: {voice.debug.lastError}</div>}
        <div className="max-h-28 overflow-y-auto border-t border-white/10 pt-1 sm:max-h-40">
          {peerEntries.length === 0 ? (
            <div>no voice peers yet</div>
          ) : (
            peerEntries.map(([peerId, peer]) => (
              <div key={peerId} className="border-b border-white/5 py-0.5 last:border-0">
                <div className="truncate text-gold-200">{peerId}</div>
                <div>pc {peer.connection} · ice {peer.ice} · sig {peer.signaling}</div>
                <div>track {peer.remoteTrack ? 'yes' : 'no'} · audio {peer.remoteAudio}</div>
                {peer.lastError && <div className="text-blood-300">err {peer.lastError}</div>}
              </div>
            ))
          )}
        </div>
      </div>
    </details>
  );
}
