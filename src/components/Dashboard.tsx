/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Loader2, ArrowRight, CalendarDays, AlertTriangle } from "lucide-react";
import { generateDashboardConfig, DashboardResponse, DashboardWidget } from "../services/orchestrator";
import { WeatherCard } from "./WeatherCard";
import { DynamicChart } from "./DynamicChart";
import { KPICard } from "./KPICard";
import { ThreeWeatherVis } from "./ThreeWeatherVis";
import { cn } from "../lib/utils";
import { exportToCSV } from "../lib/csvParser";
import { Download } from "lucide-react";

const SUGGESTIONS = [
  "Comprehensive weather overview for Tokyo",
  "Is it a good week for surfing in Santa Cruz?",
  "Detailed humidity and UV trends for Singapore",
  "Compare London, Paris and Berlin's winter extremes",
];

const POPULAR_CITIES = [
  { name: "Tokyo", query: "Current weather in Tokyo" },
  { name: "New York", query: "Weather in New York today" },
  { name: "London", query: "London forecast" },
  { name: "Paris", query: "Paris weather overview" },
  { name: "Dubai", query: "How hot is it in Dubai?" },
  { name: "Sydney", query: "Sydney weather now" },
];

function formatDateFocus(dateStr: string): string {
  if (!dateStr) return "";
  // Check if it looks like a standard YYYY-MM-DD or similar date we can parse
  // If it's a range or natural language (like "Feb 20-27, 2026"), leave it as is
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    try {
      const date = new Date(dateStr);
      // Ensure we don't get timezone shifts by using UTC methods if it's strictly a date
      const day = date.getUTCDate();
      const monthStr = date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
      const year = date.getUTCFullYear();
      return `${day} ${monthStr}, ${year}`;
    } catch (e) {
      return dateStr;
    }
  }
  return dateStr;
}

function getGradient(q: string): string {
  const s = q.toLowerCase();
  if (s.includes("rain") || s.includes("drizzle") || s.includes("shower"))
    return "from-slate-600 via-slate-500 to-blue-400";
  if (s.includes("snow") || s.includes("frost") || s.includes("blizzard"))
    return "from-blue-200 via-slate-100 to-white";
  if (s.includes("storm") || s.includes("thunder"))
    return "from-slate-800 via-slate-700 to-slate-500";
  if (s.includes("fog") || s.includes("mist"))
    return "from-slate-400 via-slate-300 to-slate-200";
  if (s.includes("sun") || s.includes("clear") || s.includes("warm") || s.includes("hot"))
    return "from-amber-400 via-sky-400 to-sky-200";
  if (s.includes("cold") || s.includes("freez"))
    return "from-blue-700 via-blue-500 to-blue-300";
  return "from-sky-400 via-sky-300 to-emerald-200";
}

export const Dashboard: React.FC = () => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const isLanding = !dashboardData && !isLoading && !error;

  // Animate the suggestions only on the landing page and when query is empty
  useEffect(() => {
    if (!isLanding || query.length > 0) return;

    const interval = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % SUGGESTIONS.length);
    }, 4000); // Change suggestion every 4 seconds

    return () => clearInterval(interval);
  }, [isLanding, query]);

  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const landingTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const adjustHeight = (ref: React.RefObject<HTMLTextAreaElement | null>) => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      const newHeight = ref.current.scrollHeight;
      // Add a tiny buffer to prevent clipping in some browsers
      ref.current.style.height = `${newHeight + 1}px`;
    }
  };

  React.useLayoutEffect(() => {
    adjustHeight(textareaRef);
  }, [query, isLanding, dashboardData, isLoading, error, activeQuery]);

  React.useLayoutEffect(() => {
    adjustHeight(landingTextareaRef);
  }, [query, isLanding, dashboardData, isLoading, error, activeQuery]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
      handleSearch(query);
    }
  };

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setIsLoading(true);
    setError(null);
    
    // Start timing the total search latency
    console.time("Total Search Latency");
    
    // Clear the old dashboard data so we transition back to the main loading spinner
    setDashboardData(null);
    setActiveQuery(searchQuery);

    // Scroll back to the top smoothly when a new search starts
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }

    try {
      const result = await generateDashboardConfig(searchQuery);
      setDashboardData(result);
      
      // Stop the timer and print the result
      console.timeEnd("Total Search Latency");
      
      // Ensure we hit the absolute top after the new data renders and layout shifts
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }, 100);
    } catch (err: any) {
      console.timeEnd("Total Search Latency");
      setError(err.message || "Something went wrong.");
      setDashboardData(null); // Clear on error
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    handleSearch(query);
  };

  const gradient = getGradient(activeQuery);
  const hasWeatherCard = dashboardData?.widgets.some(w => w.type === "weather") ?? false;

  const renderWidget = (widget: DashboardWidget, i: number) => {
    if (widget.type === "kpi" && hasWeatherCard) return null;

    return (
      <motion.div
        key={widget.id || `widget-${i}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.08 + 0.35 }}
        className={widget.type === "kpi" || widget.type === "weather" ? "w-full max-w-[600px] mx-auto" : "h-[320px] "}
      >
        {widget.type === "kpi" ? (
          <KPICard widget={widget} />
        ) : widget.type === "weather" ? (
          <WeatherCard
            city={dashboardData?.resolvedCity || null}
            widgets={dashboardData?.widgets || []}
            analysis={dashboardData?.analysis || ""}
            alerts={dashboardData?.alerts || []}
          />
        ) : widget.type === "3d" ? (
          <ThreeWeatherVis widget={widget} />
        ) : (
          <DynamicChart widget={widget} />
        )}
      </motion.div>
    );
  };

  return (
    <div className={`fixed inset-0 bg-gradient-to-br transition-colors duration-[1200ms] ${gradient}`}>
      {/* Soft overlay */}
      <div className="absolute inset-0 bg-black/10 pointer-events-none" />

      {/* Header */}
      <div className="absolute top-0 left-0 w-full p-6 z-50 flex justify-between items-center pointer-events-none">
        <button 
          onClick={() => {
            setDashboardData(null);
            setQuery("");
            setActiveQuery("");
            setError(null);
          }}
          className="text-white hover:text-white font-bold text-lg tracking-tighter transition-colors pointer-events-auto flex items-center gap-2"
        >
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
            <div className="w-4 h-4 bg-sky-500 rounded-full animate-pulse" />
          </div>
          PanWeather
        </button>
        <div className="hidden md:flex gap-6 pointer-events-auto">
          {["Forecast", "Historical", "Maps", "AI Insights"].map(item => (
            <span key={item} className="text-white/40 text-[10px] font-bold uppercase tracking-widest cursor-default hover:text-white/80 transition-colors">
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="absolute inset-0 overflow-y-auto pt-20" ref={scrollContainerRef}>
        <div className="flex flex-col items-center px-4 pb-20">

          <AnimatePresence mode="wait">
            {/* Landing state */}
            {isLanding && (
              <motion.div 
                key="landing"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15, transition: { duration: 0.3 } }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="flex flex-col items-center justify-center min-h-[75vh] w-full max-w-[1000px] mx-auto space-y-12"
              >
                <div className="text-center space-y-4">
                  <h1 className="text-white text-[48px] md:text-[72px] font-bold tracking-tighter leading-[0.9] px-4 drop-shadow-2xl">
                    Weather for<br/><span className="text-white/40 italic">Manything.</span>
                  </h1>
                  <p className="text-white/60 text-lg md:text-xl font-medium max-w-[500px] mx-auto">
                    AI-powered intelligence for every corner of the sky.
                  </p>
                </div>
                
                <div className="w-full max-w-[700px] px-6">
                  {/* Search input */}
                  <form onSubmit={onSubmit} className="relative w-full">
                    {/* Animated Placeholder Layer */}
                    {!query && !isLoading && (
                      <div className="absolute inset-0 z-20 pointer-events-none flex items-center pl-8 pr-16 overflow-hidden h-full">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={suggestionIndex}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.5 }}
                            className="text-white/30 text-lg truncate whitespace-nowrap italic"
                          >
                            Try "{SUGGESTIONS[suggestionIndex]}"
                          </motion.div>
                        </AnimatePresence>
                      </div>
                    )}
                    
                    <textarea
                      ref={landingTextareaRef}
                      rows={1}
                      className="w-full pl-8 pr-16 py-6 rounded-[32px] text-white text-xl font-medium focus:outline-none transition-all resize-none overflow-hidden block leading-relaxed relative z-10 placeholder-white/50 shadow-2xl"
                      style={{
                        background: "rgba(255,255,255,0.1)",
                        backdropFilter: "blur(40px)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        minHeight: '80px'
                      }}
                      placeholder=""
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={onKeyDown}
                      disabled={isLoading}
                    />
                    <button
                      type="submit"
                      disabled={!query.trim() || isLoading}
                      className="absolute bottom-3 right-3 p-4 rounded-full bg-white text-sky-600 hover:bg-sky-50 shadow-xl transition-all disabled:opacity-20 flex items-center justify-center z-20 group"
                    >
                      <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </form>

                  <div className="mt-12 flex flex-wrap justify-center gap-3">
                    {POPULAR_CITIES.map((city) => (
                      <button
                        key={city.name}
                        onClick={() => {
                          setQuery(city.query);
                          handleSearch(city.query);
                        }}
                        className="px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-bold uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all"
                      >
                        {city.name}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 text-center">
                    <a 
                      href="https://open-meteo.com/" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-white/20 hover:text-white/40 text-[10px] font-bold tracking-widest uppercase transition-colors"
                    >
                      Data Source: Open-Meteo.com
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Main App State */}
            {!isLanding && (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-[1200px] mx-auto flex flex-col items-center"
              >
                {/* Loading States */}
                {isLoading && !dashboardData && (
                  <div className="mt-24 space-y-4 flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-white/20 animate-spin" />
                    <p className="text-white/40 text-sm font-bold uppercase tracking-widest animate-pulse">Analyzing Atmospheric Patterns...</p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div
                    className="max-w-[600px] w-full rounded-[24px] px-8 py-6 text-center shadow-2xl"
                    style={{ background: "rgba(220,38,38,0.2)", backdropFilter: "blur(20px)" }}
                  >
                    <p className="text-white text-lg font-medium">{error}</p>
                    <button 
                      onClick={() => setError(null)}
                      className="mt-4 text-white/60 hover:text-white border-b border-white/20 text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                )}

                {/* Main content */}
                <AnimatePresence mode="wait">
                  {dashboardData && !error && (
                    <motion.div
                      key="card"
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full space-y-8"
                    >
                      {/* Panoramic Header */}
                      <div className="text-center space-y-2 px-4">
                        <motion.h2 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-white text-4xl md:text-5xl font-bold tracking-tighter"
                        >
                          {dashboardData.resolvedCity || "Global Intelligence"}
                        </motion.h2>
                        {dashboardData.resolvedDate && (
                          <p className="text-white/40 text-sm font-bold uppercase tracking-[0.2em]">Snapshot: {formatDateFocus(dashboardData.resolvedDate)}</p>
                        )}
                        
                        <motion.button
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            const data = dashboardData.widgets[0]?.customData || [];
                            if (data.length > 0) {
                              exportToCSV(data, `panweather_${dashboardData.resolvedCity?.toLowerCase() || 'data'}.csv`);
                            }
                          }}
                          className="mt-4 px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white/60 text-[10px] font-bold uppercase tracking-widest hover:bg-white/20 hover:text-white transition-all pointer-events-auto flex items-center gap-2 mx-auto"
                        >
                          <Download className="w-3 h-3" />
                          Export CSV
                        </motion.button>
                      </div>

                      {/* AI Mentor Box */}
                      {dashboardData.analysis && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.2 }}
                          className="w-full max-w-[800px] mx-auto p-8 rounded-[32px] shadow-2xl relative overflow-hidden group"
                          style={{ background: "rgba(255,255,255,0.05)", backdropFilter: "blur(40px)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-sky-400 to-emerald-400" />
                          <div className="flex flex-col gap-4">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
                              <span className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest">AI Weather Mentor</span>
                            </div>
                            <p className="text-white text-xl md:text-2xl font-medium leading-tight">
                              {dashboardData.analysis}
                            </p>
                          </div>
                        </motion.div>
                      )}

                      {/* Real-time Alerts */}
                      {dashboardData.alerts && dashboardData.alerts.length > 0 && (
                        <div className="w-full max-w-[800px] mx-auto space-y-4">
                          {dashboardData.alerts.map((alert, i) => (
                            <motion.div
                              key={`alert-${i}`}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.3 + (i * 0.1) }}
                              className={cn(
                                "p-6 rounded-[24px] border flex gap-6 relative overflow-hidden",
                                alert.severity === "error" ? "bg-red-500/10 border-red-500/20 text-red-100" :
                                alert.severity === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-100" :
                                "bg-sky-500/10 border-sky-500/20 text-sky-100"
                              )}
                            >
                              <div className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                                alert.severity === "error" ? "bg-red-500" :
                                alert.severity === "warning" ? "bg-amber-500" :
                                "bg-sky-500"
                              )}>
                                <AlertTriangle className="w-6 h-6 text-white" />
                              </div>
                              <div className="space-y-1">
                                <h4 className="font-bold text-lg leading-tight uppercase tracking-tighter">{alert.title}</h4>
                                <p className="text-sm opacity-80 leading-relaxed font-medium">{alert.message}</p>
                                <div className="pt-2">
                                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-1">AI Recommendation</p>
                                  <p className="text-[13px] font-bold italic">{alert.recommendation}</p>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {dashboardData.widgets.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
                          {dashboardData.widgets.map((widget, i) => {
                            const element = renderWidget(widget, i);
                            const gridClass = (widget.type === "weather" || widget.type === "3d" || i === 0) ? "md:col-span-2 lg:col-span-2" : "";
                            return element ? (
                              <div key={widget.id || `w-${i}`} className={gridClass}>
                                {element}
                              </div>
                            ) : null;
                          })}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Persistent Search Bar */}
                {!isLanding && !isLoading && (
                  <div className="w-full max-w-[700px] mt-16 px-4">
                    <form onSubmit={onSubmit} className="relative group">
                      <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-white/30 group-focus-within:text-white/60 transition-colors" />
                      </div>
                      <textarea
                        ref={textareaRef}
                        rows={1}
                        className="w-full pl-14 pr-16 py-5 rounded-[28px] text-white text-lg placeholder-white/30 focus:outline-none transition-all resize-none shadow-2xl backdrop-blur-3xl"
                        style={{
                          background: "rgba(0,0,0,0.2)",
                          border: "1px solid rgba(255,255,255,0.1)",
                          minHeight: '64px'
                        }}
                        placeholder="Explore another location or timeframe…"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onKeyDown={onKeyDown}
                      />
                      <button
                        type="submit"
                        disabled={!query.trim()}
                        className="absolute bottom-2 right-2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-20 shadow-lg"
                      >
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </form>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>
      </div>
    </div>
  );
};
