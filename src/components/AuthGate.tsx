import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { cloudConfigured, getSession, signIn, signUp, supabase } from '../lib/supabase';

export function AuthGate({ children }: { children: (session: Session | null) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!cloudConfigured);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    getSession().then(setSession).catch(e => setError(e.message)).finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  if (!ready) return <div className="authPage"><div className="authCard"><h1>Quotiq</h1><p>Loading secure workspace…</p></div></div>;
  if (!cloudConfigured || session) return <>{children(session)}</>;

  const submit = async () => {
    setError('');
    if (!email || password.length < 6) return setError('Enter a valid email and a password of at least 6 characters.');
    setWorking(true);
    try {
      if (mode === 'signin') await signIn(email, password); else await signUp(email, password);
      if (mode === 'signup') setError('Account created. Check your email if confirmation is enabled.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Authentication failed.'); }
    finally { setWorking(false); }
  };

  return <div className="authPage"><div className="authCard"><div className="authLogo">Q</div><h1>{mode === 'signin' ? 'Welcome to Quotiq' : 'Create your Quotiq account'}</h1><p>Secure estimates, invoices and customer records across your devices.</p><label>Email<input type="email" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>{error && <div className="authError">{error}</div>}<button className="primary authButton" onClick={submit} disabled={working}>{working ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button><button className="linkButton" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>{mode === 'signin' ? 'Create a new account' : 'Already have an account? Sign in'}</button></div></div>;
}
