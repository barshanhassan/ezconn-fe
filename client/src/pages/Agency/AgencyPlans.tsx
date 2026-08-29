import React, { useEffect } from 'react';
import { Sparkles } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const AgencyPlans = () => {
  const { mode } = useTheme();
  const dark = mode === "dark";
  const { t } = useTranslation();

  // Force hide all scrollbars for this page
  useEffect(() => {
    const targets: { el: HTMLElement; orig: string }[] = [];

    const hide = (el: HTMLElement | null) => {
      if (!el) return;
      targets.push({ el, orig: el.style.overflowY });
      el.style.overflowY = 'hidden';
    };

    hide(document.documentElement as HTMLElement);
    hide(document.body);

    let node = document.querySelector('main') as HTMLElement | null;
    while (node) {
      hide(node);
      node = node.parentElement as HTMLElement | null;
    }

    return () => {
      targets.forEach(({ el, orig }) => { el.style.overflowY = orig; });
    };
  }, []);
  
  const bg     = dark ? 'bg-[#0b1120]'  : 'bg-slate-50/80';
  const card   = dark ? 'bg-[#0f1829]'  : 'bg-white';
  const border = dark ? 'border-slate-800' : 'border-slate-200';
  const text   = dark ? 'text-white'    : 'text-slate-900';
  const sub    = dark ? 'text-slate-500' : 'text-slate-400';

  return (
    <div className={cn("h-screen overflow-hidden transition-colors flex flex-col items-center justify-center font-sans", bg)}>
      
      {/* ── Main Content Area ── */}
      <div className={cn("relative p-12 rounded-[40px] shadow-2xl border flex flex-col items-center justify-center max-w-lg w-full text-center overflow-hidden transition-all duration-500",
        card, border)}>
        
        {/* Decorative Background Glows */}
        <div className={cn("absolute -top-32 -right-32 w-72 h-72 rounded-full blur-[100px] opacity-20 pointer-events-none", 
          "bg-primary")} />
        <div className={cn("absolute -bottom-32 -left-32 w-72 h-72 rounded-full blur-[100px] opacity-10 pointer-events-none", 
          "bg-blue-500")} />

        {/* Icon Container */}
        <div className={cn("w-20 h-20 rounded-3xl flex items-center justify-center mb-8 z-10 shadow-lg transition-transform hover:scale-110 duration-300",
          dark ? "bg-slate-900/50 border border-slate-800" : "bg-white border border-slate-100")}>
          <Sparkles className="w-10 h-10 text-primary" strokeWidth={1.5} />
        </div>
        
        {/* Text Content */}
        <h1 className={cn("text-4xl font-black mb-4 z-10 tracking-tight", text)}>
          {t("agency_plans_page.title")}
        </h1>

        <div className="space-y-4 px-4 z-10">
          <p className={cn("font-bold text-[16px] leading-relaxed", dark ? "text-slate-300" : "text-slate-700")}>
            {t("agency_plans_page.subtitle")}
          </p>
          <p className={cn("text-[13px] font-medium leading-relaxed opacity-80", sub)}>
            {t("agency_plans_page.desc")}
          </p>
        </div>

        {/* Bottom Decorative Element */}
        <div className="mt-10 flex items-center gap-2 opacity-50 z-10">
          <div className="w-2 h-2 rounded-full bg-primary" />
          <div className="w-2 h-2 rounded-full bg-primary opacity-50" />
          <div className="w-2 h-2 rounded-full bg-primary opacity-20" />
        </div>

      </div>
      
    </div>
  );
};

export default AgencyPlans;
