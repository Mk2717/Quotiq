import { useEffect, useState } from 'react';
import { ChevronLeft, X } from 'lucide-react';

export default function EstimatePanelControls(){
  const [visible,setVisible]=useState(false);

  useEffect(()=>{
    const check=()=>setVisible(Boolean(document.querySelector('.estimateMount .builderPage')));
    check();
    const observer=new MutationObserver(check);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==='Escape'&&document.querySelector('.estimateMount .builderPage')) closeBuilder();
    };
    window.addEventListener('hashchange',check);
    window.addEventListener('keydown',onKey);
    return()=>{
      observer.disconnect();
      window.removeEventListener('hashchange',check);
      window.removeEventListener('keydown',onKey);
    };
  },[]);

  const closeBuilder=()=>{
    const builtInBack=document.querySelector<HTMLButtonElement>('.estimateMount .builderTop > button');
    if(builtInBack){builtInBack.click();return;}
    window.location.hash='#/estimates';
  };

  if(!visible)return null;
  return <div className="estimatePanelControls" role="navigation" aria-label="Estimate editor controls">
    <button className="estimatePanelBack" onClick={closeBuilder}><ChevronLeft size={18}/><span>Back to estimates</span></button>
    <button className="estimatePanelClose" onClick={closeBuilder} aria-label="Close estimate editor" title="Close estimate editor"><X size={21}/></button>
  </div>;
}
