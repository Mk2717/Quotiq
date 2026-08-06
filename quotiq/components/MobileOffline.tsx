'use client';

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, CloudOff, Download, HardDriveDownload, RefreshCw, Share2, Smartphone, X } from 'lucide-react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

const BACKUP_KEYS = [
  'q-business', 'q-customers', 'q-estimates', 'q-invoices', 'q-projects',
  'q-inventory', 'q-expenses', 'q-team', 'q-automation-settings', 'q-reminder-log',
];

export default function MobileOffline() {
  const [online, setOnline] = useState(() => typeof navigator === 'undefined' ? true : navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [panel, setPanel] = useState(false);
  const [message, setMessage] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const onInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      if (localStorage.getItem('q-install-dismissed') !== 'yes') setShowInstall(true);
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('beforeinstallprompt', onInstall);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setShowInstall(false);
    setInstallPrompt(null);
  };

  const dismissInstall = () => {
    localStorage.setItem('q-install-dismissed', 'yes');
    setShowInstall(false);
  };

  const exportBackup = () => {
    const records = Object.fromEntries(BACKUP_KEYS.map(key => [key, localStorage.getItem(key)]));
    const blob = new Blob([JSON.stringify({ app: 'Quotiq', version: 1, exportedAt: new Date().toISOString(), records }, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `quotiq-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage('Backup downloaded safely.');
  };

  const restoreBackup = async (file?: File) => {
    if (!file) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.app !== 'Quotiq' || !backup?.records) throw new Error('Invalid backup');
      BACKUP_KEYS.forEach(key => {
        const value = backup.records[key];
        if (typeof value === 'string') localStorage.setItem(key, value);
      });
      setMessage('Backup restored. Reloading your workspace…');
      window.setTimeout(() => window.location.reload(), 700);
    } catch {
      setMessage('That file is not a valid Quotiq backup.');
    }
  };

  return <>
    <button className={`connectivity-chip ${online ? 'is-online' : 'is-offline'}`} onClick={() => setPanel(true)} aria-label="Open offline and backup tools">
      {online ? <CheckCircle2 /> : <CloudOff />}
      <span>{online ? 'Online · saved locally' : 'Offline · work is saving'}</span>
    </button>

    {showInstall && <aside className="install-card" aria-label="Install Quotiq">
      <button className="install-close" onClick={dismissInstall} aria-label="Dismiss install prompt"><X /></button>
      <div className="install-icon"><Smartphone /></div>
      <div><strong>Put Quotiq on your home screen</strong><p>Open jobs faster and keep working when the internet drops.</p></div>
      <button className="install-action" onClick={install}><Download /> Install</button>
    </aside>}

    {panel && <div className="offline-modal" role="dialog" aria-modal="true" aria-label="Mobile and offline tools">
      <button className="offline-backdrop" onClick={() => setPanel(false)} aria-label="Close panel" />
      <section className="offline-sheet">
        <header><div><small>FIELD READY</small><h2>Mobile & offline</h2></div><button onClick={() => setPanel(false)} aria-label="Close"><X /></button></header>
        <div className={`network-status ${online ? 'online' : 'offline'}`}>
          {online ? <CheckCircle2 /> : <CloudOff />}
          <div><strong>{online ? 'Internet connected' : 'You are working offline'}</strong><span>{online ? 'Your device copy is ready if connection is lost.' : 'New changes remain saved on this device.'}</span></div>
        </div>
        <div className="offline-actions">
          {installPrompt && <button onClick={install}><Smartphone /><span><b>Install Quotiq</b><small>Add the app to this device</small></span></button>}
          <button onClick={exportBackup}><HardDriveDownload /><span><b>Download backup</b><small>Save customers, jobs and documents</small></span></button>
          <button onClick={() => importRef.current?.click()}><RefreshCw /><span><b>Restore backup</b><small>Recover a previous Quotiq workspace</small></span></button>
          <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={e => restoreBackup(e.target.files?.[0])} />
        </div>
        <div className="ios-tip"><Share2 /><p><b>Using iPhone or iPad?</b><span>Tap Share in Safari, then choose “Add to Home Screen”.</span></p></div>
        {message && <p className="offline-message">{message}</p>}
        <p className="offline-note">Quotiq saves your work on this device automatically. Download a backup regularly before changing phones or clearing browser data.</p>
      </section>
    </div>}
  </>;
}
