/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from "@google/genai";
import { fetchLiveWeatherData, formatOpenMeteoData, OpenMeteoParams, fetchAirQualityData } from "./weatherService";

// Initialize Gemini
// @ts-ignore
const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "";
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export interface DashboardWidget {
  id: string;
  type: "line" | "bar" | "area" | "pie" | "kpi" | "text" | "scatter" | "3d" | "composed" | "radar" | "weather";
  title: string;
  description?: string;
  dataSource: "weather" | "air_quality";
  customData?: any[];
  xAxisKey?: string;
  dataKeys?: string[];
  seriesKey?: string;
  aggregate?: "sum" | "avg" | "max" | "min";
  value?: string | number;
  trend?: number;
  xLabel?: string;
  yLabel?: string;
  unit?: string;
}

export interface WeatherAlert {
  severity: "info" | "warning" | "error";
  title: string;
  message: string;
  recommendation: string;
}

export interface DashboardResponse {
  analysis: string;
  widgets: DashboardWidget[];
  layout: "grid" | "single" | "compare";
  apiParams: OpenMeteoParams | OpenMeteoParams[]; // The API parameters used to fetch data for the widgets
  resolvedCity?: string | null;
  resolvedDate?: string | null;
  alerts?: WeatherAlert[];
}

const apiSystemPrompt = `
You are the API engine for PanWeather, a comprehensive weather intelligence platform.
Your goal is to analyze the user's natural language query and generate a JSON object containing the exact API parameters needed to answer the user's question using Open-Meteo.

PARAMETERS REQUIRED:
- "latitude": number (e.g. 40.71)
- "longitude": number (e.g. -74.00)
- "city": string (e.g. "New York")
- "forecast_days": number (optional, default is 7). Use 1-16.
- "daily": array of string variables (optional). 
- "hourly": array of string variables (optional). 

RULES:
- Respond with a JSON object ONLY containing the parameters above.
- IMPORTANT: For forecasts or "this week" queries, ensure "hourly" variables are included and forecast_days is set accordingly (default is 7).
- PanWeather aims to be "all-encompassing", so always include a broad set of variables: temperature_2m, relative_humidity_2m, apparent_temperature, precipitation_probability, weather_code, wind_speed_10m, visibility.
- Use your internal knowledge to resolve the city name to latitude and longitude.
`;

const layoutSystemPrompt = `
You are the UI Architect for PanWeather.
Your goal is to analyze the weather data (including 7-day hourly trends) and generate a "Panoramic" dashboard that focuses on "Weather Harmony".

INSTRUCTIONS:

1. "analysis": Write a detailed, personalized summary as the "PanWeather Mentor". 
   - MUST be a single string. Do NOT return an object.
   - Analyze the 7-day "Weather Harmony Index" trends. Identify the "Perfect Moment" (the day/hour with highest harmony).
   - EXPLAIN THE "FEEL": Use apparent_temperature to describe Heat Index/Wind Chill.
   - ACTIVITY ADVICE: Provide recommendations for Outdoor Sports, Leisure, Health, and Clothing.

2. "alerts": Generate an array of alerts for severe conditions in the data (weather_code 95+, extreme temps, high AQI > 150, high UV > 8).

3. "widgets": Build a dense, high-resolution layout.
   - Use "weather" for main summary.
   - Use "area" or "line" charts for 7-day hourly trends of "weather_harmony" and "temperature_2m".
   - Use "3d" for a dramatic view of the 7-day "weather_harmony" or temperature curve.
   - Use "kpi" for specific current metrics, including "Weather Harmony Index".

DATA MAPPING:
- "weather_harmony": A score (0-100) representing overall weather perfection.
- "temperature_2m" and "apparent_temperature" for trend charts.
- "date" is the primary xAxisKey for time-series charts.

RULES:
- For 7-day hourly data, charts should be wide and detailed.
- Use "unit" correctly: °C, %, km/h, mm, hPa, m, index.
- Response MUST be valid JSON.
`;

function calculateHarmony(row: any) {
  let score = 100;
  
  // Temp penalty (ideal 22°C)
  const temp = row.temperature_2m;
  if (temp !== undefined) {
    const diff = Math.abs(temp - 22);
    score -= diff * 1.5;
  }
  
  // Humidity penalty (ideal 45%)
  const hum = row.relative_humidity_2m;
  if (hum !== undefined) {
    const diff = Math.abs(hum - 45);
    score -= diff * 0.3;
  }
  
  // Wind penalty
  const wind = row.wind_speed_10m;
  if (wind !== undefined) {
    score -= (wind > 12 ? (wind - 12) * 2 : 0);
  }
  
  // Rain penalty
  const rain = row.precipitation_probability;
  if (rain !== undefined) {
    score -= (rain * 0.6);
  }
  
  // AQI penalty 
  const aqi = row.us_aqi;
  if (aqi !== undefined) {
    score -= (aqi > 50 ? (aqi - 50) * 0.4 : 0);
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function generateDashboardConfig(query: string): Promise<DashboardResponse> {
  if (!ai) {
    throw new Error("No API key found. AI features are unavailable.");
  }

  try {
    const baseContext = `
      User Query: "${query}"
      Current Date: ${new Date().toISOString().split('T')[0]}
    `;

    // Part 1: Generate API Parameters
    const paramsResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview", 
      contents: [
        { role: "user", parts: [{ text: apiSystemPrompt + "\n" + baseContext }] }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });
    
    const paramsResponseText = (typeof (paramsResponse as any).text === 'function') ? (paramsResponse as any).text() : (paramsResponse as any).text;
    if (!paramsResponseText) throw new Error("No response from AI for API parameter generation");
    
    const parsedParams = JSON.parse(paramsResponseText);
    const paramsArray: OpenMeteoParams[] = Array.isArray(parsedParams) ? parsedParams : [parsedParams];
    
    let queryResult: any[] = [];
    let airQualityData: any[] = [];

    try {
      const fetchPromises = paramsArray.map(async (params) => {
        if (params.latitude && params.longitude) {
          // Fetch Weather
          const rawWeatherData = await fetchLiveWeatherData(params);
          const formattedWeather = formatOpenMeteoData(rawWeatherData, params.city);
          
          // Fetch Air Quality
          try {
            const rawAQData = await fetchAirQualityData({ latitude: params.latitude, longitude: params.longitude });
            if (rawAQData.hourly) {
               const timeArray = rawAQData.hourly.time;
               const aqRows = timeArray.map((timeStr: string, index: number) => {
                 const row: any = { date: timeStr, city: params.city || "Unknown" };
                 for (const key of Object.keys(rawAQData.hourly)) {
                   if (key !== "time") row[key] = rawAQData.hourly[key][index];
                 }
                 return row;
               });
               airQualityData = [...airQualityData, ...aqRows];
            }
          } catch (aqError) {
            console.warn("Failed to fetch AQI", aqError);
          }

          return formattedWeather;
        }
        return [];
      });
      const resultsArray = await Promise.all(fetchPromises);
      queryResult = resultsArray.flat();
    } catch (apiError) {
      console.error("Error fetching live weather data:", paramsArray, apiError);
    }

    // Merge AQ data and calculate Harmony
    const fullQueryResult = queryResult.map(wRow => {
      const aqMatch = airQualityData.find(aRow => aRow.date === wRow.date && aRow.city === wRow.city);
      const combined = { ...wRow, ...aqMatch };
      return { ...combined, weather_harmony: calculateHarmony(combined) };
    });

    const dataSummary: Record<string, any> = {};
    if (fullQueryResult.length > 0) {
      const keys = Object.keys(fullQueryResult[0]).filter(k => typeof fullQueryResult[0][k] === 'number');
      keys.forEach(key => {
        const validRows = fullQueryResult.filter(r => r[key] !== undefined && r[key] !== null);
        if (validRows.length > 0) {
          const vals = validRows.map(r => r[key]);
          dataSummary[key] = {
            min: Math.min(...vals),
            max: Math.max(...vals),
            avg: Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
          };
        }
      });
    }

    const dataContext = `
      API Parameters Used: ${JSON.stringify(paramsArray)}
      Data Summary (Latest/Avg Conditions):
      ${JSON.stringify(dataSummary, null, 2)}
      
      Note: weather_harmony (0-100) is your unique "Good Weather Index".
      apparent_temperature is the Wind Chill/Heat Index.
      US AQI: 0-50 Good, 51-100 Moderate, 101-150 Unhealthy Sensitive, 151+ Unhealthy.
    `;

    // Part 2: Generate Layout and Widgets
    const layoutResponse = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview", 
      contents: [
        { role: "user", parts: [{ text: layoutSystemPrompt + "\n" + baseContext + "\n" + dataContext }] }
      ],
      config: {
        responseMimeType: "application/json",
      }
    });

    const layoutResponseText = (typeof (layoutResponse as any).text === 'function') ? (layoutResponse as any).text() : (layoutResponse as any).text;
    if (!layoutResponseText) throw new Error("No response from AI for layout generation");

    const parsedLayoutResponse = JSON.parse(layoutResponseText) as DashboardResponse;
    parsedLayoutResponse.apiParams = paramsArray;

    // Fix: AI sometimes returns an object for analysis instead of a string
    if (typeof parsedLayoutResponse.analysis === 'object' && parsedLayoutResponse.analysis !== null) {
      const a = parsedLayoutResponse.analysis as any;
      parsedLayoutResponse.analysis = [
        a.mentor_summary, 
        a.feel, 
        a.activity_advice
      ].filter(Boolean).join('\n\n');
      
      // Fallback if keys are different
      if (!parsedLayoutResponse.analysis && Object.values(a).length > 0) {
        parsedLayoutResponse.analysis = Object.values(a).filter(v => typeof v === 'string').join('\n\n');
      }
    }

    parsedLayoutResponse.widgets = parsedLayoutResponse.widgets.map(widget => {
      let value = widget.value;
      if (widget.type === 'kpi' && widget.dataKeys && widget.dataKeys.length > 0 && fullQueryResult.length > 0) {
        const key = widget.dataKeys[0];
        const values = fullQueryResult.map(row => Number(row[key])).filter(n => !isNaN(n));
        
        if (values.length > 0) {
          if (widget.aggregate === "sum") value = values.reduce((a, b) => a + b, 0);
          else if (widget.aggregate === "avg") value = values.reduce((a, b) => a + b, 0) / values.length;
          else if (widget.aggregate === "max") value = Math.max(...values);
          else if (widget.aggregate === "min") value = Math.min(...values);
          else value = fullQueryResult[0][key]; // Default to latest
        }
      }

      return {
        ...widget,
        value,
        customData: fullQueryResult
      };
    });

    if (!parsedLayoutResponse.resolvedCity && fullQueryResult.length > 0 && fullQueryResult[0].city) {
      parsedLayoutResponse.resolvedCity = fullQueryResult[0].city;
    }

    return parsedLayoutResponse;

  } catch (error) {
    console.error("Error generating dashboard with AI:", error);
    throw error;
  }
}
