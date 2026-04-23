import { useEffect, useState } from "react";

export type UploadToastStatus = "checking" | "success" | "error";

interface Props {
  status: UploadToastStatus;
  errorMessage?: string;
  onDone: () => void;
}

export default function UploadToast({ status, errorMessage, onDone }: Props) {
  const [exiting, setExiting] = useState(false);

  // Auto-dismiss 2 s after reaching a terminal state, then fade out
  useEffect(() => {
    if (status !== "checking") {
      const fadeTimer  = setTimeout(() => setExiting(true), 2000);
      const closeTimer = setTimeout(() => onDone(), 2600);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(closeTimer);
      };
    }
  }, [status, onDone]);

  const borderColor =
    status === "success"
      ? "border-emerald-500/40"
      : status === "error"
      ? "border-red-500/40"
      : "border-slate-600/40";

  return (
    <div
      className={[
        "fixed bottom-6 right-6 z-50",
        "flex items-start gap-4 px-5 py-4 rounded-2xl",
        "bg-slate-800/95 backdrop-blur-sm border shadow-2xl",
        "min-w-[300px] max-w-[360px]",
        "transition-all duration-500 ease-in-out",
        borderColor,
        exiting
          ? "opacity-0 translate-y-3 scale-95 pointer-events-none"
          : "opacity-100 translate-y-0 scale-100",
      ].join(" ")}
    >
      {/* ── Icon ── */}
      <div className="flex-shrink-0 mt-0.5">
        {status === "checking" && (
          <div className="w-8 h-8 rounded-full border-[3px] border-slate-600 border-t-emerald-400 animate-spin" />
        )}

        {status === "success" && (
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center
                          animate-[scale-in_0.25s_ease-out]">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {status === "error" && (
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center
                          animate-[scale-in_0.25s_ease-out]">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        )}
      </div>

      {/* ── Text ── */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug">
          {status === "checking" && "Validating document…"}
          {status === "success" && "File uploaded successfully"}
          {status === "error"   && "Upload rejected"}
        </p>

        <p className={`text-xs mt-1 leading-relaxed ${
          status === "error" ? "text-red-300" : "text-slate-400"
        }`}>
          {status === "checking" && "Running background checks on your PDF…"}
          {status === "success"  && "Your research paper has been added to the library."}
          {status === "error"    && (errorMessage ?? "This file is not a research paper.")}
        </p>
      </div>
    </div>
  );
}
