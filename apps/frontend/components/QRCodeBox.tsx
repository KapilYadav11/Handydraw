"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodeBox({ value, size = 160 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#14171B", light: "#F3EFE6" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-xl bg-white/5 text-xs text-[#F3EFE6]/30"
      >
        Loading...
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Room QR code"
      width={size}
      height={size}
      className="rounded-xl"
    />
  );
}