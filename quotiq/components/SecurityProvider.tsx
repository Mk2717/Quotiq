'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LockKeyhole, ShieldCheck } from 'lucide-react';

export type QuotiqIdentity = { displayName: string; email: string; fullName: string | null };
type DeviceSecurity = { enabled: boolean; pinHash: string; salt: string; autoLockMinutes: number };
type SecurityContextValue = { user: QuotiqIdentity; settings: DeviceSecurity; locked: boolean; configurePin: (pin: string, minutes: number) => Promise<void>; disablePin: () => void; lock: () => void };

const KEY = 'q-device-security';
const UNLOCKED = 'q-device-unlocked';
const defaults: DeviceSecurity = { enabled: false, pinHash: '', salt: '', autoLockMinutes: 15 };
const SecurityContext = createContext<SecurityContextValue | null>(null);

const loadSettings = (): DeviceSecurity => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return defaults; }
};

const hashPin = async (pin: string, salt: string) => {
  const bytes = new TextEncoder().encode(`${salt}:${pin}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
};

const addEvent = (action: string) => {
  try {
    const events = JSON.parse(localStorage.getItem('q-security-events') || '[]');
    localStorage.setItem('q-security-events', JSON.stringify([{ id: crypto.randomUUID(), action, date: new Date().toISOString() }, ...events].slice(0, 40)));
  } catch { /* keep security controls usable when storage is unavailable */ }
};

export function SecurityProvider({ user, children }: { user: QuotiqIdentity; children: ReactNode }) {
  const [settings, setSettings] = useState<DeviceSecurity>(loadSettings);
  const [locked, setLocked] = useState(() => loadSettings().enabled && sessionStorage.getItem(UNLOCKED) !== 'yes');

  useEffect(() => {
    if (!settings.enabled || locked) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { sessionStorage.removeItem(UNLOCKED); setLocked(true); addEvent('Workspace locked automatically'); }, settings.autoLockMinutes * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach(name => window.addEventListener(name, reset, { passive: true }));
    reset();
    return () => { clearTimeout(timer); events.forEach(name => window.removeEventListener(name, reset)); };
  }, [settings.enabled, settings.autoLockMinutes, locked]);

  const value = useMemo<SecurityContextValue>(() => ({
    user, settings, locked,
    configurePin: async (pin, minutes) => {
      const salt = crypto.randomUUID();
      const next = { enabled: true, pinHash: await hashPin(pin, salt), salt, autoLockMinutes: minutes };
      localStorage.setItem(KEY, JSON.stringify(next)); sessionStorage.setItem(UNLOCKED, 'yes'); setSettings(next); setLocked(false); addEvent('Device PIN protection enabled');
    },
    disablePin: () => { localStorage.setItem(KEY, JSON.stringify(defaults)); sessionStorage.removeItem(UNLOCKED); setSettings(defaults); setLocked(false); addEvent('Device PIN protection disabled'); },
    lock: () => { if (!settings.enabled) return; sessionStorage.removeItem(UNLOCKED); setLocked(true); addEvent('Workspace locked manually'); },
  }), [user, settings, locked]);

  return <SecurityContext.Provider value={value}>{locked ? <UnlockScreen settings={settings} unlock={() => { sessionStorage.setItem(UNLOCKED, 'yes'); setLocked(false); addEvent('Workspace unlocked with device PIN'); }} /> : children}</SecurityContext.Provider>;
}

function UnlockScreen({ settings, unlock }: { settings: DeviceSecurity; unlock: () => void }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState('');
  const submit = async () => {
    if (await hashPin(pin, settings.salt) === settings.pinHash) { unlock(); return; }
    setPin(''); setError('Incorrect PIN. Please try again.'); addEvent('Incorrect device PIN attempt');
  };
  return <main className="deviceLock"><section><img src="/quotiq-mark.svg" alt="Quotiq"/><i><LockKeyhole/></i><span>DEVICE PROTECTION</span><h1>Quotiq is locked</h1><p>Enter your 4-digit device PIN to open this workspace.</p><label>Device PIN<input autoFocus inputMode="numeric" type="password" maxLength={4} value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && submit()} /></label>{error && <b>{error}</b>}<button onClick={submit} disabled={pin.length !== 4}><ShieldCheck/>Unlock workspace</button><small>This PIN protects Quotiq on this device when you are online or offline.</small></section></main>;
}

export const useSecurity = () => {
  const context = useContext(SecurityContext);
  if (!context) throw new Error('SecurityProvider is missing');
  return context;
};
