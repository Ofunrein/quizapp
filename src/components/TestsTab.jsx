import React, { useState } from 'react';
import { Play, Check, AlertCircle, Clock, FileText } from 'lucide-react';
import { useData } from '../contexts/DataContext';

function TestsTab({ topic, savedQuestions, onUpdate }) {
  const { dataService } = useData();
  const [questionCount, setQuestionCount] = useState(10);
  const [activeTest, setActiveTest] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const availableQuestions = savedQuestions.filter(q => 
    ['multiple-choice', 'open-ended', 'fill-in-blank'].includes(q.type)
  );

  const handleCreateTest = async () => {
    setLoading(true);
    try {
      const test = await dataService.createPracticeTest(
        topic.id, 
        Math.min(questionCount, availableQuestions.length)
      );
      setActiveTest(test);
      setCurrentQuestionIndex(0);
      setAnswers({});
      setTestResults(null);
    } catch (error) {
      console.error('Failed to create test:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < activeTest.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmitTest = async () => {
    setLoading(true);
    try {
      // Calculate score locally for now
      const results = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        correct: Math.random() > 0.5, // Simulated grading
        userAnswer: answer
      }));
      
      const score = Math.round((results.filter(r => r.correct).length / results.length) * 100);
      
      const testResults = {
        testId: activeTest.id,
        score,
        results,
        completedAt: new Date().toISOString()
      };
      
      // Submit to database
      await dataService.submitTestResults(activeTest.id, answers, score);
      
      setTestResults(testResults);
      onUpdate();
    } catch (error) {
      console.error('Failed to submit test:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestion = (question) => {
    const answer = answers[question.id];

    switch (question.type) {
      case 'multiple-choice':
        return (
          <div className="space-y-3">
            <p className="text-lg font-medium mb-4">{question.question}</p>
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <label
                  key={index}
                  className={`block p-3 rounded-lg border cursor-pointer transition-colors ${
                    answer === index
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={index}
                    checked={answer === index}
                    onChange={() => handleAnswerChange(question.id, index)}
                    className="sr-only"
                  />
                  <span className="text-gray-800">{option}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 'open-ended':
        return (
          <div className="space-y-3">
            <p className="text-lg font-medium mb-4">{question.question}</p>
            <textarea
              value={answer || ''}
              onChange={(e) => handleAnswerChange(question.id, e.target.value)}
              className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              rows="6"
              placeholder="Type your answer here..."
            />
          </div>
        );

      case 'fill-in-blank':
        return (
          <div className="space-y-3">
            <p className="text-lg font-medium mb-4">{question.question}</p>
            <div className="space-y-2">
              {question.blanks.map((_, index) => (
                <input
                  key={index}
                  type="text"
                  value={answer?.[index] || ''}
                  onChange={(e) => {
                    const newAnswer = [...(answer || [])];
                    newAnswer[index] = e.target.value;
                    handleAnswerChange(question.id, newAnswer);
                  }}
                  className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={`Blank ${index + 1}`}
                />
              ))}
            </div>
            {question.context && (
              <p className="text-sm text-gray-600 italic mt-2">{question.context}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (availableQuestions.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No test questions available</h3>
        <p className="text-gray-600">
          Save some questions from the Question Pool to create practice tests.
        </p>
      </div>
    );
  }

  if (testResults) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <div className="text-center mb-8">
            <Check className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-2">Test Complete!</h2>
            <p className="text-5xl font-bold text-indigo-600 mb-4">{testResults.score}%</p>
            <p className="text-gray-600">
              You got {testResults.results.filter(r => r.correct).length} out of {testResults.results.length} questions correct
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold mb-2">Results by Question</h3>
            {testResults.results.map((result, index) => {
              const question = activeTest.questions.find(q => q.id === result.questionId);
              return (
                <div
                  key={result.questionId}
                  className={`p-4 rounded-lg border ${
                    result.correct ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium mb-1">Question {index + 1}</p>
                      <p className="text-sm text-gray-700">{question?.question || question?.front}</p>
                    </div>
                    <span className={`ml-4 ${result.correct ? 'text-green-600' : 'text-red-600'}`}>
                      {result.correct ? '✓ Correct' : '✗ Incorrect'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => {
                setActiveTest(null);
                setTestResults(null);
                setAnswers({});
              }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Create New Test
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTest) {
    const currentQuestion = activeTest.questions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / activeTest.questions.length) * 100;
    const allAnswered = activeTest.questions.every(q => answers[q.id] !== undefined);

    return (
      <div className="max-w-4xl mx-auto">
        {/* Test Header */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold">Practice Test</h3>
            <div className="flex items-center text-gray-600">
              <Clock className="h-5 w-5 mr-2" />
              <span>{activeTest.duration / 60} minutes</span>
            </div>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Question {currentQuestionIndex + 1} of {activeTest.questions.length}
          </p>
        </div>

        {/* Question Area */}
        <div className="bg-white rounded-lg shadow p-8 mb-6">
          {renderQuestion(currentQuestion)}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center">
          <button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>

          <div className="flex gap-2">
            {activeTest.questions.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentQuestionIndex(index)}
                className={`w-10 h-10 rounded-full transition-colors ${
                  index === currentQuestionIndex
                    ? 'bg-indigo-600 text-white'
                    : answers[activeTest.questions[index].id] !== undefined
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-200 text-gray-600'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {currentQuestionIndex === activeTest.questions.length - 1 ? (
            <button
              onClick={handleSubmitTest}
              disabled={!allAnswered || loading}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Test'}
            </button>
          ) : (
            <button
              onClick={handleNextQuestion}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Next
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow p-8">
        <h3 className="text-2xl font-bold mb-4">Create Practice Test</h3>
        <p className="text-gray-600 mb-6">
          Generate a practice test from your saved questions. You have {availableQuestions.length} questions available.
        </p>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Number of Questions
          </label>
          <input
            type="number"
            min="1"
            max={availableQuestions.length}
            value={questionCount}
            onChange={(e) => setQuestionCount(parseInt(e.target.value) || 1)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Maximum: {availableQuestions.length} questions
          </p>
        </div>

        <button
          onClick={handleCreateTest}
          disabled={loading || questionCount > availableQuestions.length}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Test...' : (
            <>
              <Play className="h-5 w-5 inline mr-2" />
              Start Test
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default TestsTab; 