export const getStored=<T,>(key:string,fallback:T):T=>{try{const v=localStorage.getItem(key);return v?JSON.parse(v) as T:fallback}catch{return fallback}};
export const setStored=<T,>(key:string,value:T)=>localStorage.setItem(key,JSON.stringify(value));
export const uid=(prefix:string)=>{
  const unique = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '').slice(0, 12)
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${unique}`;
};
