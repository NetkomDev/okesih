import Image from "next/image";

export default function MarketingLoading({ error }: { error?: string }) {
  return (
    <main className="mkt-loading" role="status" aria-label="Memuat portal marketing OKESIH">
      <div className="mkt-loading-brand">
        <span className="mkt-loading-halo" />
        <Image
          src="/okesih-logo-animated.svg"
          alt="OKESIH.COM"
          width={84}
          height={84}
          priority
          unoptimized
        />
        <div className="mkt-loading-wordmark">
          <b>OKESIH</b>
          <small>.COM</small>
        </div>
        <div className="mkt-loading-progress">
          <i />
        </div>
        <span className="mkt-splash-text">
          {error || "Portal Mitra Marketing"}
        </span>
      </div>
    </main>
  );
}
