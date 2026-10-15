import Image from "next/image";

export default function MarketingLoading() {
  return (
    <aside
      className="mkt-loading-overlay"
      role="status"
      aria-live="polite"
      aria-label="Memuat data..."
    >
      <div className="mkt-loading-card">
        <Image
          src="/okesih-logo-animated.svg"
          alt="Loading OKESIH"
          width={72}
          height={72}
          priority
          unoptimized
        />
        <div className="mkt-loading-progress">
          <i />
        </div>
      </div>
    </aside>
  );
}
