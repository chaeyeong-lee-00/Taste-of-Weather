import { GoogleGenAI, Type } from "@google/genai";
import { WeatherCondition, MealTime, FoodPreference, Recommendation, WeatherInfo } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const recommendationSchema = {
  type: Type.OBJECT,
  properties: {
    foodName: {
      type: Type.STRING,
      description: "The name of the recommended Korean food in Korean.",
    },
    reason: {
      type: Type.STRING,
      description: "A short, engaging reason in Korean why this food is recommended for the given conditions.",
    },
    familiarity: {
      type: Type.INTEGER,
      description: "A score from 1 (very exotic) to 5 (very common and familiar) representing how familiar this dish is to a typical Korean.",
    },
  },
  required: ["foodName", "reason", "familiarity"],
};


export const getFoodRecommendation = async (
  weather: WeatherInfo | null,
  mealTime: MealTime,
  foodPreference: FoodPreference,
  familiarityRatings: Record<string, number>
): Promise<Recommendation[]> => {
  const systemInstruction = `You are an expert Korean food recommendation engine. Your task is to suggest 5 suitable Korean dishes based on the provided conditions. The recommendations should be diverse and interesting, like a food world cup. Always respond with a JSON array containing exactly 5 recommendation objects, according to the schema. Do not include any markdown formatting like \`\`\`json.

[USER FAMILIARITY FEEDBACK]
- You may be provided with a 'familiarityTable' which contains the user's personal familiarity score (1-5) for certain foods they have rated before.
- Use this table to understand the user's taste profile. For example, if a user rates many traditional soups highly, they may prefer more classic dishes.
- When you recommend a food that is in the table, your own 'familiarity' score in the response should be influenced by the user's score.
- For new foods not in the table, continue to use the general Korean familiarity score (1=exotic, 5=common).

[WEATHER / FALLBACK ADDENDUM]
목적: 위치 권한 실패/네트워크 오류로 날씨 정보가 없어도 추천이 중단되지 않도록 하는 규칙입니다.

[FAIL-SAFE]
- 'weather' 정보가 제공되지 않으면, 오류를 반환하지 마세요.
- 대신 '수동 모드'로 간주하고, 'mealTime', 'foodPreference', 'familiarityTable'만으로 5개의 음식을 추천해주세요.

[SCORING BEHAVIOR WHEN NO WEATHER]
- 'weather' 정보가 없으면, 날씨 관련 가중치는 중립적으로 처리하세요.

[OUTPUT CONSTRAINT]
- 어떤 상황에서도 설명이나 오류 메시지 없이, 반드시 지정된 JSON 스키마에 맞는 5개의 추천 음식 배열만 응답해야 합니다.`;
  
  const familiarityTableString = Object.keys(familiarityRatings).length > 0
    ? `- User's Familiarity Table: ${JSON.stringify(familiarityRatings)}`
    : "";

  const userPrompt = `Please recommend 5 Korean dishes based on these conditions:
- Meal Time: '${mealTime}'
- Food Preference: '${foodPreference}'
${weather ? `- Weather: '${weather.condition}', Temperature: ${weather.temperature}°C` : "- Weather: Not available"}
${familiarityTableString}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: recommendationSchema,
        },
      },
    });

    const jsonString = response.text;
    const parsedResponse = JSON.parse(jsonString);

    if (!Array.isArray(parsedResponse) || parsedResponse.length === 0) {
      throw new Error("Invalid response format: expected an array.");
    }
    
    // Quick validation of the first item
    const firstItem = parsedResponse[0];
     if (
      !firstItem.foodName ||
      !firstItem.reason ||
      firstItem.familiarity === undefined
    ) {
      throw new Error("Invalid response format from Gemini API");
    }

    return parsedResponse as Recommendation[];

  } catch (error) {
    console.error("Error getting food recommendation:", error);
    throw new Error("Failed to get food recommendation from Gemini API.");
  }
};


export const generateFoodImage = async (foodName: string): Promise<string> => {
  const prompt = `A delicious, high-quality, photorealistic picture of a Korean dish called '${foodName}', beautifully plated in a restaurant setting.`;
  
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: '1:1',
      },
    });

    if (response.generatedImages && response.generatedImages.length > 0) {
      const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
      return `data:image/jpeg;base64,${base64ImageBytes}`;
    } else {
      throw new Error("No image was generated.");
    }
  } catch (error) {
    console.error("Error generating food image:", error);
    throw new Error("Failed to generate food image from Gemini API.");
  }
};

export const getWeatherFromCoordinates = async (lat: number, lon: number): Promise<WeatherInfo> => {
  const prompt = `Based on the current weather at latitude ${lat} and longitude ${lon}, respond with a JSON object containing "condition" and "temperature".
The "condition" must be ONE of the following Korean words: '${WeatherCondition.SUNNY}', '${WeatherCondition.RAINY}', '${WeatherCondition.CLOUDY}', '${WeatherCondition.SNOWY}', '${WeatherCondition.HOT}', '${WeatherCondition.COLD}'.
- Use '${WeatherCondition.HOT}' for hot weather (e.g., above 28°C).
- Use '${WeatherCondition.COLD}' for cold weather (e.g., below 10°C).
- Use '${WeatherCondition.SUNNY}' for sunny or clear conditions.
- Use '${WeatherCondition.CLOUDY}' for cloudy conditions.
- Use '${WeatherCondition.RAINY}' if it is raining.
- Use '${WeatherCondition.SNOWY}' if it is snowing.
The "temperature" must be the current temperature in Celsius as an integer number.
Your response must be ONLY the JSON object, without any other text, explanation, or markdown formatting like \`\`\`json.
Example response: {"condition": "맑음", "temperature": 25}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{googleSearch: {}}],
      },
    });

    const responseText = response.text.trim();
    const jsonString = responseText.replace(/^```json\n/, '').replace(/\n```$/, '');
    const parsed = JSON.parse(jsonString);
    const validWeathers = Object.values(WeatherCondition) as string[];

    if (
      parsed.condition &&
      validWeathers.includes(parsed.condition) &&
      typeof parsed.temperature === 'number'
    ) {
      return {
        condition: parsed.condition as WeatherCondition,
        temperature: Math.round(parsed.temperature),
      };
    } else {
      console.warn(`Unexpected weather response format: "${jsonString}". Falling back.`);
      return { condition: WeatherCondition.CLOUDY, temperature: 20 };
    }
  } catch (error) {
    console.error("Error getting weather from coordinates:", error);
    // Return a default value for a better user experience on failure
    return { condition: WeatherCondition.CLOUDY, temperature: 20 };
  }
};