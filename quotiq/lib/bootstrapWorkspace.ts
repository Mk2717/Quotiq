const arrayKeys=['q-customers','q-estimates','q-invoices','q-projects','q-inventory','q-expenses','q-team'] as const;

const readArray=(key:string):any[]=>{try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):[]}catch{return[]}};
const writeArray=(key:string,value:any[])=>localStorage.setItem(key,JSON.stringify(value));

export function bootstrapWorkspace(){
 if(typeof window==='undefined')return;
 for(const key of arrayKeys){if(localStorage.getItem(key)===null)writeArray(key,[])}
 const customers=readArray('q-customers').filter(c=>!(c?.id==='CUS-1001'&&c?.name==='Ama Serwaa'));
 const projects=readArray('q-projects').filter(p=>!(p?.id==='PRJ-1001'&&p?.customerId==='CUS-1001'));
 const inventory=readArray('q-inventory').filter(i=>!(i?.id==='STK-1001'&&i?.sku==='CAM-HIK-2MP'));
 const expenses=readArray('q-expenses').filter(e=>!(e?.id==='EXP-1001'&&e?.projectId==='PRJ-1001'));
 writeArray('q-customers',customers);
 writeArray('q-projects',projects);
 writeArray('q-inventory',inventory);
 writeArray('q-expenses',expenses);
}

bootstrapWorkspace();
