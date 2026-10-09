"use client";
import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import Modal from './Modal';
import CreatorContact from './CreatorContact';
import { useLanguage } from './LanguageProvider';

export default function ContactAccess() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" className="contact-access" aria-haspopup="dialog" onClick={() => setOpen(true)}><MessageCircle size={18} /><span>{t('Contact & support', '联系与打赏')}</span></button>
    <Modal open={open} onClose={() => setOpen(false)} title={t('Contact & support', '联系与打赏')} id="contact-title" className="contact-dialog"><CreatorContact /></Modal>
  </>;
}
