"use client";

import Image from "next/image";
import { useState } from "react";

export default function CommunityPage() {
  const [qrFailed, setQrFailed] = useState(false);
  const [qrAttempt, setQrAttempt] = useState(0);

  return <div className="community-main">
      <section className="community-page" aria-labelledby="community-title">
        <div className="community-copy">
          <span className="community-kicker">CS2 PRO TRACKER 社区</span>
          <h1 id="community-title">
            <span>邀请有兴趣的各位</span>
            <span>加入社区</span>
          </h1>
          <p className="community-lead">
            <span>为后续界面优化和功能开发提供建议</span>
            <span>若项目未来实现盈利</span>
            <span>会回馈参与共建的社区成员</span>
          </p>
        </div>

        <aside className="community-contact" aria-label="微信联系方式">
          <div className="community-contact-head">
            <span>微信联系</span>
            <strong>扫码加入社区</strong>
          </div>
          <div className={`community-qr${qrFailed ? " is-error" : ""}`}>
            <Image key={qrAttempt} src="/wechat-community-qr-v1.png" alt="联系项目发起人的微信二维码" width="679" height="655" sizes="(max-width: 819px) 206px, 250px" loading="eager" fetchPriority="high" decoding="async" unoptimized onLoad={() => setQrFailed(false)} onError={() => setQrFailed(true)} />
            {qrFailed ? <button className="community-qr-retry" type="button" onClick={() => { setQrFailed(false); setQrAttempt(value => value + 1); }}>重新加载二维码</button> : null}
          </div>
          <p>手机端长按识别，或使用微信扫一扫</p>
          <small>添加时请备注「CS2 社区」</small>
        </aside>
      </section>
  </div>;
}
