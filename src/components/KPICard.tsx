/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from "react";
import { DashboardWidget } from "../services/orchestrator";
import { cn } from "../lib/utils";
import { TrendingUp, TrendingDown, Minus, Wind, Droplets, Sun, CloudRain, Thermometer, Eye, Gauge, Snowflake, Zap } from "lucide-react";

interface KPICardProps {
  widget: DashboardWidget;
}

// Internal icon helper for KPI
function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("wind") || t.includes("gust")) return <Wind className="w-4 h-4 text-sky-400" />;
  if (t.includes("humid")) return <Droplets className="w-4 h-4 text-sky-400" />;
  if (t.includes("uv")) return <Sun className="w-4 h-4 text-amber-400" />;
  if (t.includes("rain") || t.includes("precip") || t.includes("shower")) return <CloudRain className="w-4 h-4 text-sky-400" />;
  if (t.includes("snow") || t.includes("frost")) return <Snowflake className="w-4 h-4 text-white" />;
  if (t.includes("visibility")) return <Eye className="w-4 h-4 text-sky-400" />;
  if (t.includes("pressure")) return <Gauge className="w-4 h-4 text-sky-400" />;
  if (t.includes("aqi") || t.includes("quality")) return <Zap className="w-4 h-4 text-emerald-400" />;
  if (t.includes("harmony")) return <Zap className="w-4 h-4 text-fuchsia-400 animate-pulse" />;
  return <Thermometer className="w-4 h-4 text-rose-400" />;
}

export const KPICard: React.FC<KPICardProps> = ({ widget }) => {
  const trend = widget.trend || 0;
  const isPositive = trend > 0;
  const isNegative = trend < 0;
  const isHarmony = widget.title.toLowerCase().includes("harmony");

  const trendColor = isPositive ? "text-emerald-300" : isNegative ? "text-sky-300" : "text-white/50";

  return (
    <div className={cn(
      "backdrop-blur-[40px] bg-white/5 rounded-[32px] border border-white/10 text-white p-8 group transition-all duration-500 shadow-2xl h-full flex flex-col justify-between",
      isHarmony ? "hover:bg-fuchsia-500/10 border-fuchsia-500/30" : "hover:bg-white/10"
    )}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold uppercase tracking-widest text-white/40">{widget.title}</h3>
          <div className={cn(
            "w-8 h-8 rounded-full bg-white/5 flex items-center justify-center",
            isHarmony && "bg-fuchsia-500/20 shadow-[0_0_15px_rgba(192,132,252,0.5)]"
          )}>
            {getIcon(widget.title)}
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn(
            "text-6xl font-bold tracking-tighter text-white group-hover:scale-105 transition-transform duration-500 origin-left",
            isHarmony && "text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-sky-400"
          )}>
            {typeof widget.value === 'number'
              ? widget.value.toLocaleString('en-US', { maximumFractionDigits: 1 })
              : (widget.value !== undefined ? widget.value : "--")}
          </span>
          {widget.unit && <span className="text-xl text-white/30 font-medium">{widget.unit}</span>}
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {widget.trend !== undefined && (
          <div className="flex items-center gap-2">
              <div className={cn("flex items-center px-2 py-1 rounded-full text-[10px] font-bold tracking-wider", isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-sky-500/10 text-sky-400")}>
                  {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : isNegative ? <TrendingDown className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
                  <span>{Math.abs(trend)}%</span>
              </div>
              <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest leading-none">Trend</span>
          </div>
        )}

        {widget.description && (
          <p className="text-[11px] text-white/30 leading-relaxed font-medium line-clamp-2 italic">{widget.description}</p>
        )}
      </div>
    </div>
  );
};
