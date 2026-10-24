"use client";
import { useEffect, useState } from "react";
import { validateImage } from "./helpers";

export default function MenuImageField({ imageUrl, disabled, onChange }: {
  imageUrl?: string | null;
  disabled: boolean;
  onChange: (file: File | null) => void;
}) {
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return <div className="owner-menu-image-field">
    <label className="owner-category-field">Foto menu (opsional)
      <input type="file" accept="image/jpeg,image/png,image/webp" disabled={disabled} onChange={(event) => {
        const file = event.target.files?.[0] || null;
        try {
          if (file) validateImage(file, 2 * 1024 * 1024, "Foto menu");
          setError("");
          setPreview(file ? URL.createObjectURL(file) : "");
          onChange(file);
        } catch (err) {
          event.target.value = "";
          setPreview("");
          onChange(null);
          setError(err instanceof Error ? err.message : "Foto tidak valid.");
        }
      }} />
      <small>JPG, PNG, atau WebP, maksimal 2 MB.</small>
    </label>
    {error && <p role="alert">{error}</p>}
    {(preview || imageUrl) && <img src={preview || imageUrl!} alt="Pratinjau foto menu" className="owner-menu-image-preview" />}
  </div>;
}
