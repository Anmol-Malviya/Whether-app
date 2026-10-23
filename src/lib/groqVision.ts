/**
 * Groq Vision & Intelligence Service
 * Uses Groq API with Llama 3.2 Vision to analyze uploaded weather photographs:
 * 1. Checks if it's an authentic outdoor/weather photo or fake/indoor/meme
 * 2. Detects waterlogging, flood depth, rain severity, and cloud formations
 * 3. Performs OCR on street signboards or landmarks
 * 4. Generates an executive incident summary for emergency triage
 */

export interface GroqVisionAnalysis {
  isValidWeatherPhoto: boolean;
  incidentType: "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal";
  severityLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE";
  skyCondition: string;
  waterloggingDetected: boolean;
  waterDepthEstimate?: "none" | "ankle_deep" | "knee_deep" | "submerged_vehicles";
  ocrExtractedText: string;
  detectedHazards: string[];
  aiSummary: string;
  confidenceScore: number; // 0 - 100
}

export async function analyzeWeatherMomentWithGroq(
  imageBase64OrUrl: string,
  userCaption: string = "",
  userLocation: string = ""
): Promise<GroqVisionAnalysis | null> {
  const apiKey =
    process.env.GROQ_API_KEY ||
    process.env.GROQ_API ||
    process.env.GROQ_api ||
    "";

  if (!apiKey) {
    console.warn("[Groq Vision] No GROQ API key found in environment variables.");
    return null;
  }

  const prompt = `You are an expert meteorological and disaster management AI for WeatherPulse India.
Analyze this crowdsourced weather photo submitted by a citizen from "${userLocation}" with caption "${userCaption}".

Evaluate:
1. Is this a genuine outdoor weather/sky/street photo? (Return false if it's a selfie, indoor room, computer screen, random meme, or food photo).
2. Is there waterlogging, flooded roads, or submerged vehicles?
3. What is the sky condition (clear, overcast, rainy, thunderstorm, dark monsoon clouds)?
4. Any visible OCR text on street signs, shop boards, or milestones?
5. What is the estimated hazard severity for municipal officers?

Respond ONLY with valid, raw JSON (no markdown formatting, no code block backticks):
{
  "isValidWeatherPhoto": true,
  "incidentType": "waterlogging" | "heavy_rain" | "storm" | "cloudy" | "normal",
  "severityLevel": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "skyCondition": "string (e.g. Dark overcast with active rainfall)",
  "waterloggingDetected": true | false,
  "waterDepthEstimate": "none" | "ankle_deep" | "knee_deep" | "submerged_vehicles",
  "ocrExtractedText": "any text seen on street signs or milestones or empty string",
  "detectedHazards": ["waterlogged road", "poor visibility", etc],
  "aiSummary": "A concise 1-2 sentence assessment for municipal officers",
  "confidenceScore": 85
}`;

  try {
    // Format image URL or base64 data URI
    const imageUrl = imageBase64OrUrl.startsWith("http")
      ? imageBase64OrUrl
      : `data:image/jpeg;base64,${imageBase64OrUrl}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.2-11b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 600,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Groq Vision] API error response:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const rawContent = data.choices?.[0]?.message?.content?.trim() || "";

    // Clean any accidental markdown backticks
    const cleaned = rawContent
      .replace(/^```json/i, "")
      .replace(/^```/i, "")
      .replace(/```$/i, "")
      .trim();

    const parsed: GroqVisionAnalysis = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error("[Groq Vision] Analysis failed:", err);
    return null;
  }
}
