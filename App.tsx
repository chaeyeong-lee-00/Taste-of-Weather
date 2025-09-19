import React, { useState, useCallback, useEffect } from 'react';
import { 
  MealTime, 
  FoodPreference, 
  FinalRecommendation,
  AppStep,
  WeatherInfo,
  WeatherCondition,
} from './types';
import { getFoodRecommendation, generateFoodImage, getWeatherFromCoordinates } from './services/geminiService';
import FamiliarityRating from './components/FamiliarityRating';
import { SunnyIcon, RainyIcon, CloudyIcon, SnowyIcon, HotIcon, ColdIcon } from './components/icons';

const weatherIcons: Record<WeatherCondition, React.ComponentType<{ className?: string }>> = {
  [WeatherCondition.SUNNY]: SunnyIcon,
  [WeatherCondition.RAINY]: RainyIcon,
  [WeatherCondition.CLOUDY]: CloudyIcon,
  [WeatherCondition.SNOWY]: SnowyIcon,
  [WeatherCondition.HOT]: HotIcon,
  [WeatherCondition.COLD]: ColdIcon,
};

const SelectionButton = <T,>({ value, label, onSelect, isSelected, icon: Icon }: { value: T, label: string, onSelect: (value: T) => void, isSelected: boolean, icon?: React.ComponentType<{className?: string}> }) => (
  <button
    onClick={() => onSelect(value)}
    className={`
      flex flex-col items-center justify-center p-4 sm:p-6 border-2 rounded-xl transition-all duration-200
      w-full h-full min-h-[100px] sm:min-h-[120px]
      ${isSelected 
        ? 'bg-pink-500 border-pink-500 text-white scale-105 shadow-lg' 
        : 'bg-white border-gray-300 text-gray-800 shadow-sm hover:border-pink-400 hover:shadow-lg hover:scale-[1.02]'
      }
    `}
  >
    {Icon && (
      <div className="mb-2">
        <Icon className={`w-8 h-8 sm:w-10 sm:h-10 ${isSelected ? 'text-white' : 'text-pink-500'}`} />
      </div>
    )}
    <span className="font-semibold text-sm sm:text-base text-center">{label}</span>
  </button>
);


const GettingWeatherScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center p-8">
    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-pink-500 mb-6"></div>
    <h2 className="text-2xl font-bold text-gray-800 mb-2">현재 위치의 날씨를 확인하고 있어요...</h2>
    <p className="text-gray-600">잠시만 기다려 주세요!</p>
  </div>
);

const LoadingScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center text-center p-8">
    <div className="animate-spin rounded-full h-20 w-20 border-t-4 border-b-4 border-pink-500 mb-6"></div>
    <h2 className="text-2xl font-bold text-gray-800 mb-2">맛있는 음식을 찾고 있어요...</h2>
    <p className="text-gray-600">날씨와 취향에 맞는 최고의 메뉴를 추천해 드릴게요!</p>
  </div>
);

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>('welcome');
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [mealTime, setMealTime] = useState<MealTime | null>(null);
  const [foodPreference, setFoodPreference] = useState<FoodPreference | null>(null);
  const [recommendations, setRecommendations] = useState<FinalRecommendation[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [familiarityRatings, setFamiliarityRatings] = useState<Record<string, number>>({});
  const [currentUserRating, setCurrentUserRating] = useState<number | null>(null);

  const handleStart = () => {
    setStep('gettingWeather');
  };

  useEffect(() => {
    if (step !== 'gettingWeather') return;

    if (!navigator.geolocation) {
      console.warn("Geolocation is not supported. Proceeding to manual weather selection.");
      setStep('manualWeather');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const weatherInfo = await getWeatherFromCoordinates(latitude, longitude);
          setWeather(weatherInfo);
          setStep('preferences');
        } catch (err) {
          console.error("Failed to fetch weather from API:", err);
          setStep('manualWeather');
        }
      },
      (geoError) => {
        console.warn("Geolocation error, proceeding to manual selection:", geoError.message);
        setStep('manualWeather');
      }
    );
  }, [step]);

  const handleManualWeatherSelect = (condition: WeatherCondition) => {
    let temperature = 20; // Default neutral temperature
    switch (condition) {
      case WeatherCondition.HOT:
        temperature = 30;
        break;
      case WeatherCondition.COLD:
        temperature = 5;
        break;
      case WeatherCondition.SNOWY:
        temperature = -2;
        break;
      case WeatherCondition.RAINY:
        temperature = 15;
        break;
    }
    setWeather({ condition, temperature });
    setStep('preferences');
  };
  
  const handlePreferencesSubmit = useCallback(async () => {
    if (!mealTime || !foodPreference) return;

    setStep('loading');
    setError(null);

    try {
      const textRecommendations = await getFoodRecommendation(weather, mealTime, foodPreference, familiarityRatings);
      if (!textRecommendations || textRecommendations.length === 0) {
        throw new Error("Received no recommendations.");
      }
      
      const primaryRecommendation = textRecommendations[0];
      setCurrentUserRating(primaryRecommendation.familiarity);
      
      const imageUrl = await generateFoodImage(primaryRecommendation.foodName);
      
      const finalRecommendations: FinalRecommendation[] = textRecommendations.map((rec, index) => ({
        ...rec,
        imageUrl: index === 0 ? imageUrl : '',
      }));
      
      setRecommendations(finalRecommendations);
      setStep('result');
    } catch (err) {
      console.error(err);
      setError('추천을 생성하는 데 실패했습니다. 잠시 후 다시 시도해 주세요.');
      setStep('error');
    }
  }, [weather, mealTime, foodPreference, familiarityRatings]);

  const resetAndSaveRating = () => {
    if (recommendations && recommendations.length > 0 && currentUserRating !== null) {
      const foodName = recommendations[0].foodName;
      setFamiliarityRatings(prevRatings => ({
        ...prevRatings,
        [foodName]: currentUserRating,
      }));
    }

    setStep('welcome');
    setWeather(null);
    setMealTime(null);
    setFoodPreference(null);
    setRecommendations(null);
    setCurrentUserRating(null);
    setError(null);
  };

  const resetFromError = () => {
    setStep('welcome');
    setWeather(null);
    setMealTime(null);
    setFoodPreference(null);
    setRecommendations(null);
    setCurrentUserRating(null);
    setError(null);
  };

  const renderContent = () => {
    switch (step) {
      case 'welcome':
        return (
          <div className="text-center p-8">
            <h1 className="text-5xl font-extrabold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
              날씨의 맛
            </h1>
            <p className="text-lg text-gray-600 mb-8">오늘 날씨에 딱 맞는 음식을 추천해드려요!</p>
            <button
              onClick={handleStart}
              className="px-8 py-4 bg-pink-500 text-white font-bold rounded-full shadow-lg hover:bg-pink-600 transform hover:scale-105 transition-all duration-300"
            >
              음식 추천받기
            </button>
          </div>
        );

      case 'gettingWeather':
        return <GettingWeatherScreen />;

      case 'manualWeather':
        const weatherOptions = Object.values(WeatherCondition);
        return (
          <div className="w-full max-w-2xl p-4 sm:p-8 text-center animate-fade-in">
            <h2 className="text-3xl font-bold mb-2 text-gray-800">날씨를 알려주세요</h2>
            <p className="text-gray-500 mb-8">
              위치 정보를 가져올 수 없었어요. <br />
              현재 날씨를 직접 선택해주시면 음식을 추천해드릴게요!
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {weatherOptions.map(wc => (
                  <SelectionButton 
                    key={wc} 
                    value={wc} 
                    label={wc} 
                    onSelect={handleManualWeatherSelect} 
                    isSelected={false}
                    icon={weatherIcons[wc]}
                  />
                )
              )}
            </div>
          </div>
        );

      case 'preferences':
        const mealTimeOptions = Object.values(MealTime);
        const foodPrefOptions = Object.values(FoodPreference);
        return (
          <div className="w-full max-w-2xl p-4 sm:p-8">
            <h2 className="text-3xl font-bold text-center mb-2 text-gray-800">어떤 음식을 원하세요?</h2>
            <p className="text-center text-gray-500 mb-8">
              {weather
                ? <>오늘 날씨는 <span className="font-bold text-pink-500">{weather.condition} ({weather.temperature}°C)</span>!</>
                : "오늘의 취향에 맞춰 추천해드릴게요!"}
            </p>
            <div className="mb-8">
              <h3 className="text-xl font-semibold mb-4 text-gray-700">식사 시간</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {mealTimeOptions.map(mt => (
                  <SelectionButton key={mt} value={mt} label={mt} onSelect={setMealTime} isSelected={mealTime === mt} />
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4 text-gray-700">음식 취향</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {foodPrefOptions.map(fp => (
                  <SelectionButton key={fp} value={fp} label={fp} onSelect={setFoodPreference} isSelected={foodPreference === fp} />
                ))}
              </div>
            </div>
            <div className="mt-10 text-center">
              <button
                onClick={handlePreferencesSubmit}
                disabled={!mealTime || !foodPreference}
                className="px-8 py-4 bg-pink-500 text-white font-bold rounded-full shadow-lg hover:bg-pink-600 disabled:bg-gray-400 disabled:cursor-not-allowed transform hover:scale-105 transition-all duration-300"
              >
                결과 보기
              </button>
            </div>
          </div>
        );
      
      case 'loading':
        return <LoadingScreen />;

      case 'result':
        if (!recommendations || recommendations.length === 0 || currentUserRating === null) return null;
        const primary = recommendations[0];
        const others = recommendations.slice(1);
        return (
          <div className="w-full max-w-md p-6 bg-white rounded-2xl shadow-2xl animate-fade-in">
            <div className="text-center mb-4">
              <p className="text-gray-600">
                {weather 
                  ? `${weather.condition} (${weather.temperature}°C) 날씨, ${mealTime}으로 추천!`
                  : `${mealTime}으로 추천!`}
              </p>
              <h2 className="text-5xl font-extrabold text-pink-500">{primary.foodName}!</h2>
            </div>
            <img 
              src={primary.imageUrl} 
              alt={primary.foodName} 
              className="w-full h-64 object-cover rounded-xl mb-4 shadow-lg"
            />
            <div className="bg-pink-50 p-4 rounded-lg mb-4">
              <p className="text-center text-gray-800 font-medium">"{primary.reason}"</p>
            </div>
            
            <div className="mb-4">
              <FamiliarityRating 
                score={currentUserRating}
                onScoreChange={setCurrentUserRating}
              />
            </div>

            {others.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-bold text-gray-700 text-center border-b pb-2 mb-4">다른 추천 메뉴</h3>
                <ul className="space-y-3">
                  {others.map((rec) => (
                    <li key={rec.foodName} className="p-3 bg-slate-100 rounded-lg flex flex-col gap-2">
                      <div>
                        <p className="font-semibold text-gray-800">{rec.foodName}</p>
                        <p className="text-sm text-gray-600 italic">"{rec.reason}"</p>
                      </div>
                      <FamiliarityRating score={rec.familiarity} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <button
              onClick={resetAndSaveRating}
              className="w-full mt-8 px-6 py-3 bg-gray-700 text-white font-bold rounded-full shadow-md hover:bg-gray-800 transition-colors duration-200"
            >
              평가 저장하고 다시 추천받기
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center p-8 bg-red-50 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-red-600 mb-4">오류 발생</h2>
            <p className="text-red-800 mb-6">{error}</p>
            <button
              onClick={resetFromError}
              className="px-6 py-2 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors"
            >
              처음으로
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-pink-50 via-slate-50 to-violet-50 p-4">
      <main className="w-full flex items-center justify-center">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;