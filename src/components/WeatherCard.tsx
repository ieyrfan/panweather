/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from "react";
import { Wind, Droplets, Sun, CloudRain, Thermometer, Eye, Gauge, Snowflake, AlertTriangle, Zap, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { DashboardWidget, WeatherAlert } from "../services/orchestrator";

function getIcon(title: string) {
  const t = title.toLowerCase();
  if (t.includes("wind") || t.includes("gust")) return <Wind className="w-3 h-3" />;
  if (t.includes("humid")) return <Droplets className="w-3 h-3" />;
  if (t.includes("uv")) return <Sun className="w-3 h-3" />;
  if (t.includes("rain") || t.includes("precip") || t.includes("shower")) return <CloudRain className="w-3 h-3" />;
  if (t.includes("snow") || t.includes("frost")) return <Snowflake className="w-3 h-3" />;
  if (t.includes("visibility")) return <Eye className="w-3 h-3" />;
  if (t.includes("pressure")) return <Gauge className="w-3 h-3" />;
  return <Thermometer className="w-3 h-3" />;
}

function fmt(v: string | number | undefined | null, dec = 0) {
  if (v === undefined || v === null) return "—";
  if (typeof v === "number") {
    if (isNaN(v)) return "—";
    // If it's a very large number, or very small, just stringify it
    // if the user requests 0 decimals, use Math.round to avoid things like 10.000001 becoming 10
    return v.toFixed(dec);
  }
  return String(v);
}

interface Props {
  city: string | null;
  widgets: DashboardWidget[];
  analysis: string;
  alerts?: WeatherAlert[];
}

function getAlertIcon(severity: string) {
  if (severity === "error") return <AlertTriangle className="w-4 h-4 text-white" />;
  if (severity === "warning") return <Zap className="w-4 h-4 text-white" />;
  return <Info className="w-4 h-4 text-white" />;
}

export const WeatherCard: React.FC<Props> = ({ city, widgets, analysis, alerts = [] }) => {
  const kpis = widgets.filter(w => w.type === "kpi");
  const main = kpis[0];
  const subs = kpis.slice(1, 7); // Show more subs in PanWeather
  const [activeAlert, setActiveAlert] = React.useState<WeatherAlert | null>(null);

  return (
    <div className="w-full flex flex-col xl:flex-row gap-6">
      {/* Left: Main Conditions */}
      <div 
        className="flex-1 p-8 rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden group"
        style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(40px)" }}
      >
        <div className="relative z-10 space-y-12">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="text-sky-400 text-[10px] font-bold uppercase tracking-[0.2em]">Atmospheric Intel</span>
              <h2 className="text-white text-3xl font-bold tracking-tighter">{city || "Unknown Location"}</h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white/60 text-[10px] font-bold uppercase tracking-widest">
                Live Data
              </div>
              {widgets.find(w => w.title.toLowerCase().includes("harmony")) && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-fuchsia-500/20 to-sky-500/20 border border-fuchsia-500/30 flex items-center gap-2 shadow-[0_0_15px_rgba(192,132,252,0.2)]"
                >
                  <div className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-pulse" />
                  <span className="text-fuchsia-100 text-[9px] font-black uppercase tracking-tighter">Harmony: {fmt(widgets.find(w => w.title.toLowerCase().includes("harmony"))?.value, 0)}%</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Main Temperature */}
          {main && main.value !== undefined && (
            <div className="flex items-end gap-2 group-hover:scale-105 transition-transform duration-700 origin-left">
              <span className="text-white text-[120px] font-bold leading-none tracking-tighter drop-shadow-2xl">
                {fmt(main.value, 0)}
              </span>
              <span className="text-white/30 text-4xl font-light mb-4">
                {main.unit}
              </span>
            </div>
          )}

          {/* Sub-metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {subs.map((w, i) => (
              <motion.div
                key={w.id || `sub-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-widest mb-2">
                  {getIcon(w.title)}
                  <span className="truncate">{w.title}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-white text-xl font-bold leading-none">
                    {fmt(w.value, 0)}
                  </span>
                  <span className="text-white/20 text-[10px] font-bold uppercase">
                    {w.unit}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
        
        {/* Abstract background gradient */}
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-sky-500/20 rounded-full blur-[100px] pointer-events-none group-hover:bg-emerald-500/20 transition-colors duration-1000" />
      </div>

      {/* Right: Map Insight */}
      <div className="w-full xl:w-[400px] h-[400px] xl:h-auto rounded-[32px] overflow-hidden border border-white/10 shadow-2xl relative grayscale-[0.5] hover:grayscale-0 transition-all duration-700 group">
        <iframe
          title={`Map of ${city}`}
          src={`https://maps.google.com/maps?q=${encodeURIComponent(city || "weather")}&output=embed&z=10&iwloc=near`}
          className="w-full h-full border-0 absolute inset-0"
          loading="lazy"
        />
        
        {/* Alerts Overlay Layer */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-sky-500/5 mix-blend-overlay" />
          
          {/* Animated Alert Markers */}
          <div className="absolute inset-0 flex items-center justify-center">
            {alerts.slice(0, 3).map((alert, i) => (
              <motion.button
                key={`map-alert-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.5 + i * 0.2 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveAlert(alert);
                }}
                className="pointer-events-auto relative group/marker"
                style={{
                  marginTop: `${(i - 1) * 60}px`,
                  marginLeft: `${(i - 1) * 40}px`
                }}
              >
                <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                  alert.severity === 'error' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                }`} style={{ animationDuration: '3s' }} />
                
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-2xl border-2 border-white/50 transition-transform group-hover/marker:scale-125 ${
                  alert.severity === 'error' ? 'bg-red-500' : alert.severity === 'warning' ? 'bg-amber-500' : 'bg-sky-500'
                }`}>
                  {getAlertIcon(alert.severity)}
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap z-50">
                   <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 text-white shadow-xl">
                      <p className="text-[10px] font-bold uppercase tracking-widest">{alert.title}</p>
                   </div>
                   <div className="w-2 h-2 bg-black/80 rotate-45 mx-auto -mt-1 border-r border-b border-white/10" />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Active Alert Detail Overlay */}
        <AnimatePresence>
          {activeAlert && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="absolute inset-x-0 bottom-0 p-4 z-40"
            >
              <div className="bg-black/80 backdrop-blur-xl rounded-2xl border border-white/20 p-4 shadow-2xl">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${activeAlert.severity === 'error' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    <h4 className="text-white font-bold text-xs uppercase tracking-widest">{activeAlert.title}</h4>
                  </div>
                  <button 
                    onClick={() => setActiveAlert(null)}
                    className="text-white/40 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                <p className="text-white/80 text-[11px] leading-relaxed mb-3">{activeAlert.message}</p>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-sky-400 block mb-1">Protection Protocol</span>
                  <p className="text-white text-[10px] font-medium italic">{activeAlert.recommendation}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-4 left-4 right-4 flex justify-between pointer-events-none">
          <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-white/80 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            Live Intel Layer
          </div>
        </div>
      </div>
    </div>
  );
};
