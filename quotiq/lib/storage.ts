export const getStored=<T,>(key:string,fallback:T):T=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback}};
export const setStored=<T,>(key:string,value:T)=>{
  localStorage.setItem(key,JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('quotiq:storage',{detail:{key}}));
};
export const uid=(prefix:string)=>{
  const unique = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${unique}`;
};
export const uuid=()=>{
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function')return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;
  const value=Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('');
  return`${value.slice(0,8)}-${value.slice(8,12)}-${value.slice(12,16)}-${value.slice(16,20)}-${value.slice(20)}`;
};
