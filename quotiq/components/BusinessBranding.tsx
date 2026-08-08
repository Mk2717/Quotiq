import { useId, useState } from 'react';
import { Building2, Check, FileImage, ImagePlus, LayoutTemplate, PenLine, Save, Trash2 } from 'lucide-react';
import type { Business, DocumentTemplate } from '../types';

type Props={business:Business;setBusiness:(business:Business)=>void};

const templates:Array<{id:DocumentTemplate;name:string;description:string}>=[
  {id:'modern',name:'Signature Blue',description:'Bold, clear and client-friendly.'},
  {id:'classic',name:'Executive Navy',description:'Formal with a premium gold accent.'},
  {id:'minimal',name:'Clean Minimal',description:'Quiet, spacious and monochrome.'},
  {id:'emerald',name:'Emerald Ledger',description:'Fresh green with polished financial detail.'},
  {id:'sunset',name:'Sunset Studio',description:'Warm coral and amber for memorable proposals.'},
  {id:'industrial',name:'Industrial Pro',description:'Strong charcoal styling built for field work.'},
  {id:'royal',name:'Royal Violet',description:'Premium violet with a refined modern finish.'},
];

const acceptedImageTypes=['image/png','image/jpeg','image/webp'];

function prepareImage(file:File,label:string,limit=720):Promise<string>{
  return new Promise((resolve,reject)=>{
    if(!acceptedImageTypes.includes(file.type)){reject(new Error(`Use a PNG, JPG or WebP ${label}.`));return}
    if(file.size>5*1024*1024){reject(new Error(`Choose a ${label} smaller than 5 MB.`));return}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error(`Quotiq could not read this ${label}.`));
    reader.onload=()=>{
      const image=new Image();
      image.onerror=()=>reject(new Error('This image could not be opened.'));
      image.onload=()=>{
        const scale=Math.min(1,limit/Math.max(image.naturalWidth,image.naturalHeight));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
        canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
        const context=canvas.getContext('2d');
        if(!context){reject(new Error('Logo processing is unavailable in this browser.'));return}
        context.clearRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const dataUrl=canvas.toDataURL('image/webp',.9);
        if(dataUrl.length>1_400_000){reject(new Error(`This ${label} is still too large. Try a simpler or smaller image.`));return}
        resolve(dataUrl);
      };
      image.src=String(reader.result||'');
    };
    reader.readAsDataURL(file);
  });
}

export default function BusinessBranding({business,setBusiness}:Props){
  const inputId=useId(),signatureInputId=useId();
  const[draft,setDraft]=useState<Business>(()=>({...business,documentTemplate:business.documentTemplate||'modern'}));
  const[logoError,setLogoError]=useState('');
  const[signatureError,setSignatureError]=useState('');
  const[saved,setSaved]=useState(false);
  const[processing,setProcessing]=useState(false),[signatureProcessing,setSignatureProcessing]=useState(false);

  const update=(key:keyof Business,value:string)=>{setSaved(false);setDraft(current=>({...current,[key]:value}))};
  const chooseTemplate=(template:DocumentTemplate)=>{setSaved(false);setDraft(current=>({...current,documentTemplate:template}))};
  const upload=async(file?:File)=>{
    if(!file)return;
    setLogoError('');setProcessing(true);
    try{const logo=await prepareImage(file,'logo');setDraft(current=>({...current,logo}));setSaved(false)}
    catch(reason){setLogoError(reason instanceof Error?reason.message:'The logo could not be added.')}
    finally{setProcessing(false)}
  };
  const uploadSignature=async(file?:File)=>{
    if(!file)return;
    setSignatureError('');setSignatureProcessing(true);
    try{const signature=await prepareImage(file,'signature',1000);setDraft(current=>({...current,signature}));setSaved(false)}
    catch(reason){setSignatureError(reason instanceof Error?reason.message:'The signature could not be added.')}
    finally{setSignatureProcessing(false)}
  };
  const save=()=>{setBusiness({...draft,documentTemplate:draft.documentTemplate||'modern'});setSaved(true);setTimeout(()=>setSaved(false),2600)};
  const selected=draft.documentTemplate||'modern';

  return <div className="brandSettings">
    <section className="brandSettingsHero">
      <div><span>COMPANY BRANDING</span><h2>Make every document unmistakably yours</h2><p>Upload your company logo once and choose the document style clients will see on estimates, invoices and payment receipts.</p></div>
      <div className="brandCoverage"><Check/><div><b>One brand, everywhere</b><span>Saved to this contractor workspace and cloud backup.</span></div></div>
    </section>

    <div className="brandSettingsGrid">
      <section className="brandPanel brandLogoPanel">
        <header><i><ImagePlus/></i><div><span>01 · COMPANY LOGO</span><h3>Upload your logo</h3><p>Transparent PNG or a clean square logo works best.</p></div></header>
        <div className="brandLogoWorkspace">
          <div className={`brandLogoPreview ${draft.logo?'hasLogo':''}`}>{draft.logo?<img src={draft.logo} alt="Company logo preview"/>:<><Building2/><b>{draft.name||'Your business'}</b><span>Logo preview</span></>}</div>
          <div className="brandLogoActions">
            <label className="brandUploadButton" htmlFor={inputId}><FileImage/>{processing?'Preparing logo…':draft.logo?'Replace logo':'Choose logo'}</label>
            <input id={inputId} className="brandFileInput" type="file" accept="image/png,image/jpeg,image/webp" disabled={processing} onChange={event=>{void upload(event.target.files?.[0]);event.currentTarget.value=''}}/>
            {draft.logo&&<button type="button" className="brandRemoveLogo" onClick={()=>{setDraft(current=>({...current,logo:undefined}));setSaved(false)}}><Trash2/>Remove</button>}
            <small>Quotiq automatically resizes the image so documents stay fast and work offline.</small>
            {logoError&&<p className="brandError">{logoError}</p>}
          </div>
        </div>
      </section>

      <section className="brandPanel brandTemplatePanel">
        <header><i><LayoutTemplate/></i><div><span>02 · DOCUMENT STYLE</span><h3>Choose a template</h3><p>The same style is used for estimates, invoices and receipts.</p></div></header>
        <div className="brandTemplateChoices">{templates.map(template=><button type="button" key={template.id} className={`brandTemplateChoice ${template.id} ${selected===template.id?'selected':''}`} onClick={()=>chooseTemplate(template.id)} aria-pressed={selected===template.id}>
          <div className="brandTemplateMini"><div className="miniHead"><i>{draft.logo?<img src={draft.logo} alt=""/>:'Q'}</i><span/><b/></div><div className="miniRule"/><div className="miniRows"><span/><span/><span/></div><div className="miniTotal"/></div>
          <div><b>{template.name}</b><span>{template.description}</span></div>{selected===template.id&&<Check/>}
        </button>)}</div>
      </section>
    </div>

    <section className="brandPanel brandSignaturePanel">
      <header><i><PenLine/></i><div><span>03 · AUTHORISED SIGNATURE</span><h3>Sign every document professionally</h3><p>Add the authorised person’s name and optionally upload a transparent signature image.</p></div></header>
      <div className="brandSignatureWorkspace">
        <div className={`brandSignaturePreview ${draft.signature?'hasSignature':'typedSignature'}`}>
          {draft.signature?<img src={draft.signature} alt="Authorised signature preview"/>:<strong>{draft.authorizedName||draft.name||'Authorised representative'}</strong>}
          <span>{draft.authorizedTitle||'Authorised representative'}</span>
        </div>
        <div className="brandSignatureFields">
          <label>Authorised person<input value={draft.authorizedName||''} onChange={e=>update('authorizedName',e.target.value)} placeholder="e.g. Michael Adu Gyamfi"/></label>
          <label>Title / position<input value={draft.authorizedTitle||''} onChange={e=>update('authorizedTitle',e.target.value)} placeholder="e.g. Managing Director"/></label>
          <div className="brandSignatureActions"><label className="brandUploadButton" htmlFor={signatureInputId}><PenLine/>{signatureProcessing?'Preparing signature…':draft.signature?'Replace signature':'Upload signature'}</label><input id={signatureInputId} className="brandFileInput" type="file" accept="image/png,image/jpeg,image/webp" disabled={signatureProcessing} onChange={event=>{void uploadSignature(event.target.files?.[0]);event.currentTarget.value=''}}/>{draft.signature&&<button type="button" className="brandRemoveLogo" onClick={()=>{setDraft(current=>({...current,signature:undefined}));setSaved(false)}}><Trash2/>Use typed name</button>}</div>
          <small>A typed signature is created automatically when no image is uploaded, so the authorised area is never empty.</small>
          {signatureError&&<p className="brandError">{signatureError}</p>}
        </div>
      </div>
    </section>

    <section className="brandPanel brandBusinessPanel">
      <header><i><Building2/></i><div><span>04 · BUSINESS DETAILS</span><h3>Details printed on documents</h3><p>Keep client-facing information accurate and professional.</p></div></header>
      <div className="brandFormGrid">
        <label>Business name<input value={draft.name||''} onChange={e=>update('name',e.target.value)} placeholder="Your business name"/></label>
        <label>Email address<input type="email" value={draft.email||''} onChange={e=>update('email',e.target.value)} placeholder="hello@company.com"/></label>
        <label>Phone number<input type="tel" value={draft.phone||''} onChange={e=>update('phone',e.target.value)} placeholder="024 000 0000"/></label>
        <label>Business address<input value={draft.address||''} onChange={e=>update('address',e.target.value)} placeholder="Town, region or full address"/></label>
        <label>Tax / registration ID<input value={draft.taxId||''} onChange={e=>update('taxId',e.target.value)} placeholder="Optional"/></label>
        <label>Currency<select value={draft.currency||'GHS'} onChange={e=>update('currency',e.target.value)}><option value="GHS">GHS · Ghana cedi</option><option value="USD">USD · US dollar</option><option value="GBP">GBP · British pound</option><option value="EUR">EUR · Euro</option><option value="NGN">NGN · Nigerian naira</option><option value="ZAR">ZAR · South African rand</option></select></label>
        <label>Estimate prefix<input value={draft.estimatePrefix||''} maxLength={8} onChange={e=>update('estimatePrefix',e.target.value.toUpperCase())} placeholder="EST"/></label>
        <label>Invoice prefix<input value={draft.invoicePrefix||''} maxLength={8} onChange={e=>update('invoicePrefix',e.target.value.toUpperCase())} placeholder="INV"/></label>
      </div>
    </section>

    <section className="brandPanel brandBusinessPanel">
      <header><i><FileImage/></i><div><span>05 · PAYMENT & TERMS</span><h3>Receipt and payment information</h3><p>These details are shown on invoices and receipts where appropriate.</p></div></header>
      <div className="brandFormGrid">
        <label>Mobile Money number<input value={draft.mobileMoney||''} onChange={e=>update('mobileMoney',e.target.value)} placeholder="Number and account name"/></label>
        <label>Bank name<input value={draft.bank||''} onChange={e=>update('bank',e.target.value)} placeholder="Bank name"/></label>
        <label>Account name<input value={draft.accountName||''} onChange={e=>update('accountName',e.target.value)} placeholder="Account holder"/></label>
        <label>Account number<input value={draft.accountNumber||''} onChange={e=>update('accountNumber',e.target.value)} placeholder="Account number"/></label>
        <label className="brandFullField">Default terms<textarea rows={4} value={draft.terms||''} onChange={e=>update('terms',e.target.value)} placeholder="Payment terms, estimate validity and other standard conditions."/></label>
      </div>
    </section>

    <div className="brandSaveBar"><div><b>{draft.name||'Your business'}</b><span>{templates.find(template=>template.id===selected)?.name} · Logo {draft.logo?'ready':'not added'} · Signature {draft.signature?'uploaded':'typed'}</span></div><button className="primary" onClick={save}><Save/>{saved?'Settings saved':'Save branding & templates'}</button></div>
  </div>;
}
