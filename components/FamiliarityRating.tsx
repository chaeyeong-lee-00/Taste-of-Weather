import React from 'react';

interface FamiliarityRatingProps {
  score: number;
  onScoreChange?: (newScore: number) => void;
}

const FamiliarityRating: React.FC<FamiliarityRatingProps> = ({ score, onScoreChange }) => {
  const maxScore = 5;
  const labels = ['매우 생소함', '생소함', '보통', '익숙함', '매우 익숙함'];

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onScoreChange) {
      onScoreChange(Number(event.target.value));
    }
  };

  const isInteractive = !!onScoreChange;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm font-medium text-gray-600">
          {isInteractive ? '이 음식, 얼마나 익숙하세요?' : '익숙함 정도'}
        </span>
        <span className="text-sm font-semibold text-pink-600">
          {labels[score - 1]}
        </span>
      </div>
      {isInteractive ? (
        <input
          type="range"
          min="1"
          max={maxScore}
          value={score}
          onChange={handleSliderChange}
          className="w-full h-2.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-pink-500"
          aria-label="Familiarity rating slider"
        />
      ) : (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div 
            className="bg-pink-500 h-2.5 rounded-full" 
            style={{ width: `${(score / maxScore) * 100}%` }}
          ></div>
        </div>
      )}
    </div>
  );
};

export default FamiliarityRating;