import { ArrowLeft, Construction } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function EstimateReset(){
  const navigate=useNavigate();
  return (
    <main style={{minHeight:'100dvh',background:'#f4f7fb',display:'grid',placeItems:'center',padding:'24px',fontFamily:'Inter,system-ui,sans-serif'}}>
      <section style={{width:'min(560px,100%)',background:'#fff',border:'1px solid #dfe6f0',borderRadius:'22px',padding:'36px',boxShadow:'0 18px 50px rgba(15,23,42,.08)',textAlign:'center'}}>
        <div style={{width:58,height:58,borderRadius:16,margin:'0 auto 18px',display:'grid',placeItems:'center',background:'#eef2ff',color:'#3156f5'}}><Construction size={28}/></div>
        <p style={{margin:0,color:'#3156f5',fontSize:12,fontWeight:800,letterSpacing:'.12em'}}>ESTIMATES</p>
        <h1 style={{margin:'8px 0 10px',fontSize:'clamp(28px,5vw,40px)',color:'#0f172a'}}>Estimate panel removed</h1>
        <p style={{margin:'0 0 24px',color:'#64748b',lineHeight:1.6}}>The previous estimate and quotation builder has been removed. This section is ready to be rebuilt from a clean foundation.</p>
        <button onClick={()=>navigate('/')} style={{display:'inline-flex',alignItems:'center',gap:8,border:0,borderRadius:12,padding:'12px 16px',background:'#3156f5',color:'#fff',fontWeight:800,cursor:'pointer'}}><ArrowLeft size={18}/>Back to dashboard</button>
      </section>
    </main>
  );
}
