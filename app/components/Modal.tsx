"use client";
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from './LanguageProvider';

export default function Modal({ open, onClose, title, id, children, className = '' }: { open: boolean; onClose: () => void; title: string; id: string; children: React.ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { t } = useLanguage();
  useEffect(() => {
    const element = dialog.current;
    if (open && !element?.open) element?.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  return <dialog ref={dialog} className={`arena-dialog ${className}`} aria-labelledby={id} onClose={onClose} onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
    <div className="arena-dialog-content"><div className="arena-dialog-heading"><h2 id={id}>{title}</h2><button type="button" className="arena-icon-button" aria-label={t('Close', '关闭')} onClick={() => dialog.current?.close()}><X size={20} /></button></div>{open && children}</div>
  </dialog>;
}
