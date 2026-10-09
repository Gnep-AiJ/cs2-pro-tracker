"use client";

import CreatorContact from './CreatorContact';
import { useLanguage } from './LanguageProvider';

export default function CommunityPage() {
  const { t } = useLanguage();
  return <div className="community-main creator-contact-page"><h1>{t('Community & contact', '社区与联系')}</h1><CreatorContact /></div>;
}
