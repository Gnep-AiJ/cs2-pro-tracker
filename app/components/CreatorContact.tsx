"use client";
import { useState } from 'react';
import Image from 'next/image';
import { ArrowUpRight, Heart, MessageCircle } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export default function CreatorContact() {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'contact' | 'support'>('contact');
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const support = mode === 'support';
  const src = support ? '/wechat-support-qr.png' : '/wechat-community-qr-v1.png';
  return <>
    <div className="creator-contact-tabs" role="group" aria-label={t('Contact or support', '联系与打赏')}>
      <button type="button" aria-pressed={!support} onClick={() => { setMode('contact'); setFailed(false); }}><MessageCircle size={16} />{t('Contact', '联系我')}</button>
      <button type="button" aria-pressed={support} onClick={() => { setMode('support'); setFailed(false); }}><Heart size={16} />{t('Support', '打赏')}</button>
    </div>
    <div className="creator-contact">
    <div className="creator-contact-copy">
      {support ? <Heart size={26} aria-hidden="true" /> : <MessageCircle size={26} aria-hidden="true" />}
      <h3>{support ? t('WeChat support', '微信打赏') : t('WeChat', '微信联系')}</h3>
      <p>{support ? t('Support project maintenance.', '支持项目维护') : t('Report a problem or suggest a feature.', '问题反馈、功能建议')}</p>
      {!support && <p className="creator-contact-note">{t('Add a note: “CS2 社区”', '添加时备注「CS2 社区」')}</p>}
      <a className="arena-text-link" href={src} target="_blank" rel="noreferrer">{t('Open QR image', '查看二维码原图')}<ArrowUpRight size={14} /></a>
    </div>
    <div className="creator-contact-code">
      <div className="contact-qr"><Image key={`${mode}-${attempt}`} src={src} alt={support ? t('WeChat payment QR code for supporting the creator', '项目发起人的微信打赏收款码') : t('Creator’s WeChat contact QR code', '项目发起人的微信联系二维码')} width={support ? 431 : 679} height={support ? 424 : 655} loading="eager" unoptimized onError={() => setFailed(true)} onLoad={() => setFailed(false)} /></div>
      {failed ? <button type="button" className="arena-button" onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>{t('Reload QR code', '重新加载二维码')}</button> : <p>{t('Scan with WeChat or long press to recognize.', '微信扫一扫，或长按识别')}</p>}
    </div>
  </div></>;
}
