export enum WeatherCondition {
  SUNNY = '맑음',
  RAINY = '비',
  CLOUDY = '흐림',
  SNOWY = '눈',
  HOT = '더움',
  COLD = '추움',
}

export enum MealTime {
  BREAKFAST = '아침',
  LUNCH = '점심',
  DINNER = '저녁',
  SNACK = '간식',
}

export enum FoodPreference {
  SPICY = '매운 것',
  MILD = '순한 것',
  SOUP = '국물 있는 것',
  LIGHT = '가벼운 것',
  HEAVY = '든든한 것',
}

export interface Recommendation {
  foodName: string;
  reason: string;
  familiarity: number;
}

export interface FinalRecommendation extends Recommendation {
  imageUrl: string;
}

export interface WeatherInfo {
  condition: WeatherCondition;
  temperature: number;
}

export type AppStep = 'welcome' | 'gettingWeather' | 'manualWeather' | 'preferences' | 'loading' | 'result' | 'error';