"use client";

interface LoginTriggerButtonProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export default function LoginTriggerButton({ className, style, children }: LoginTriggerButtonProps) {
  const handleClick = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("okesih:open-login"));
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className || "btn-primary"}
      style={style}
    >
      {children || (
        <>
          <span>Masuk ke Sistem</span>
          <span>→</span>
        </>
      )}
    </button>
  );
}
