"use client";
import {useState} from 'react';
import {Sparkles} from 'lucide-react';
import {useLanguage} from './LanguageProvider';
export default function PlayerInsight({lookup,limit}:{lookup:string;limit:number}){
  const {t,language}=useLanguage();const [busy,setBusy]=useState(false),[result,setResult]=useState<{summary:string;generated:boolean}|null>(null),[error,setError]=useState(false);
  async function load(){setBusy(true);setError(false);try{const response=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({domain:'faceit',names:[lookup],language,limit})});if(!response.ok)throw new Error('unavailable');setResult(await response.json());}catch{setError(true);}finally{setBusy(false);}}
  return <div className="player-insight"><button className="secondary-button" type="button" disabled={busy} onClick={()=>void load()}><Sparkles size={14}/>{busy?t('Analyzing…','分析中…'):t('Analyze this sample','分析当前样本')}</button>{result&&<p><small>{result.generated?'AI':t('Data summary','数据摘要')}</small> {result.summary}</p>}{error&&<p role="status">{t('Analysis unavailable. Retry.','分析暂不可用，可重试。')}</p>}</div>;
}
