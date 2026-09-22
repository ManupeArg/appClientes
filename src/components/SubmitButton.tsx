"use client";

import { useFormStatus } from "react-dom";

export default function SubmitButton({ children, className = "btn btn-primary" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Guardando…" : children}
    </button>
  );
}
