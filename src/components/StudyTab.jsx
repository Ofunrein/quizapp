import React, { useState, useEffect } from 'react';
import { RotateCcw, Check, X, Calendar, Brain } from 'lucide-react';
import { useData } from '../contexts/DataContext';

function StudyTab({ topic, savedQuestions, onUpdate }) {
  const { dataService } = useData();
  const [flashcards, setFlashcards] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyStats, setStudyStats] = useState({ known: 0, unknown: 0 });
  const [dueCards, setDueCards] = useState([]);
  const [progressMap, setProgressMap] = useState(new Map());

  useEffect(() => {
    loadFlashcardData();
  }, [savedQuestions, topic.id]);

  const loadFlashcardData = async () => {
    try {
      // Filter flashcards from saved questions
      const savedFlashcards = savedQuestions.filter(q => q.type === 'flashcard');
      
      // Get flashcard progress from Supabase
      const progress = await dataService.getFlashcardProgress(topic.id);
      const progressMap = new Map();
      
      // Convert progress array to map for easier lookup
      progress.forEach(p => {
        progressMap.set(p.question_id, p);
      });
      
      // Filter cards that are due for review
      const now = new Date();
      const dueCandidates = savedFlashcards.filter(card => {
        const cardProgress = progressMap.get(card.id);
        if (!cardProgress || !cardProgress.next_review) return true;
        return new Date(cardProgress.next_review) <= now;
      });
      
      setFlashcards(savedFlashcards);
      setDueCards(dueCandidates);
      setProgressMap(progressMap);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (error) {
      console.error('Failed to load flashcard data:', error);
      // Fallback to just showing all flashcards
      const savedFlashcards = savedQuestions.filter(q => q.type === 'flashcard');
      setFlashcards(savedFlashcards);
      setDueCards(savedFlashcards);
    }
  };

  const handleKnown = async () => {
    if (dueCards.length === 0) return;
    
    try {
      const currentCard = dueCards[currentIndex];
      await dataService.updateFlashcardProgress(topic.id, currentCard.id, true);
      
      setStudyStats(prev => ({ ...prev, known: prev.known + 1 }));
      moveToNext();
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const handleUnknown = async () => {
    if (dueCards.length === 0) return;
    
    try {
      const currentCard = dueCards[currentIndex];
      await dataService.updateFlashcardProgress(topic.id, currentCard.id, false);
      
      setStudyStats(prev => ({ ...prev, unknown: prev.unknown + 1 }));
      moveToNext();
    } catch (error) {
      console.error('Failed to update progress:', error);
    }
  };

  const moveToNext = () => {
    setIsFlipped(false);
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // Refresh the list
      onUpdate();
      loadFlashcardData();
    }
  };

  const resetSession = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setStudyStats({ known: 0, unknown: 0 });
  };

  const getUpcomingReviews = () => {
    const upcoming = [];
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    flashcards.forEach(card => {
      const cardProgress = progressMap.get(card.id);
      if (cardProgress && cardProgress.next_review) {
        const reviewDate = new Date(cardProgress.next_review);
        if (reviewDate > now && reviewDate <= weekFromNow) {
          upcoming.push({ card, date: reviewDate });
        }
      }
    });
    
    return upcoming.sort((a, b) => a.date - b.date);
  };

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <Brain className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No flashcards saved yet</h3>
        <p className="text-gray-600">
          Save some flashcards from the Question Pool to start studying.
        </p>
      </div>
    );
  }

  const currentCard = dueCards[currentIndex];
  const sessionComplete = currentIndex >= dueCards.length || dueCards.length === 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Study Stats */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-indigo-600">{dueCards.length}</p>
            <p className="text-sm text-gray-600">Cards Due</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{studyStats.known}</p>
            <p className="text-sm text-gray-600">Known</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">{studyStats.unknown}</p>
            <p className="text-sm text-gray-600">Unknown</p>
          </div>
        </div>
      </div>

      {/* Flashcard Area */}
      {!sessionComplete ? (
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-lg p-8 min-h-[300px] flex items-center justify-center">
            <div className="text-center w-full">
              {!isFlipped ? (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Question</h3>
                  <p className="text-lg text-gray-800">{currentCard.front}</p>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-semibold mb-4">Answer</h3>
                  <p className="text-lg text-gray-800">{currentCard.back}</p>
                  {currentCard.difficulty && (
                    <span className={`inline-block mt-4 px-3 py-1 text-sm rounded-full ${
                      currentCard.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                      currentCard.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {currentCard.difficulty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 mt-6">
            {!isFlipped ? (
              <button
                onClick={() => setIsFlipped(true)}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <RotateCcw className="h-5 w-5 inline mr-2" />
                Show Answer
              </button>
            ) : (
              <>
                <button
                  onClick={handleUnknown}
                  className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <X className="h-5 w-5 inline mr-2" />
                  Unknown
                </button>
                <button
                  onClick={handleKnown}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Check className="h-5 w-5 inline mr-2" />
                  Known
                </button>
              </>
            )}
          </div>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Progress</span>
              <span>{currentIndex + 1} / {dueCards.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / dueCards.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">Session Complete!</h3>
          <p className="text-gray-600 mb-6">
            You've reviewed all due cards for today.
          </p>
          <button
            onClick={resetSession}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Start New Session
          </button>
        </div>
      )}

      {/* Upcoming Reviews */}
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-indigo-600" />
          Upcoming Reviews
        </h3>
        {getUpcomingReviews().length > 0 ? (
          <div className="space-y-2">
            {getUpcomingReviews().slice(0, 5).map(({ card, date }, index) => (
              <div key={index} className="flex justify-between items-center py-2 border-b last:border-0">
                <p className="text-sm text-gray-700 truncate flex-1">{card.front}</p>
                <span className="text-sm text-gray-500 ml-4">
                  {date.toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No upcoming reviews scheduled</p>
        )}
      </div>
    </div>
  );
}

export default StudyTab; 