import React, { useState } from 'react';
import { Save, Trash2, ChevronDown, ChevronUp, FileText, HelpCircle, Edit3, List } from 'lucide-react';
import { useData } from '../contexts/DataContext';

function QuestionPoolTab({ topic, questions, onQuestionSaved, onUpdate }) {
  const { dataService } = useData();
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [savingItems, setSavingItems] = useState(new Set());
  const [savedItems, setSavedItems] = useState(new Set());

  const toggleExpand = (id) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleSaveQuestion = async (question) => {
    setSavingItems(new Set([...savingItems, question.id]));
    
    try {
      await dataService.saveQuestion(topic.id, question.id);
      setSavedItems(new Set([...savedItems, question.id]));
      onQuestionSaved();
    } catch (error) {
      console.error('Failed to save question:', error);
    } finally {
      setSavingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(question.id);
        return newSet;
      });
    }
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'flashcard':
        return FileText;
      case 'multiple-choice':
        return List;
      case 'open-ended':
        return Edit3;
      case 'fill-in-blank':
        return HelpCircle;
      case 'summary':
        return FileText;
      default:
        return HelpCircle;
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'flashcard':
        return 'Flashcard';
      case 'multiple-choice':
        return 'Multiple Choice';
      case 'open-ended':
        return 'Open-Ended';
      case 'fill-in-blank':
        return 'Fill in the Blank';
      case 'summary':
        return 'Summary';
      default:
        return type;
    }
  };

  const renderQuestionContent = (question) => {
    switch (question.type) {
      case 'flashcard':
        return (
          <div className="space-y-2">
            <div>
              <span className="font-medium text-gray-700">Front:</span>
              <p className="mt-1">{question.front}</p>
            </div>
            {expandedItems.has(question.id) && (
              <div>
                <span className="font-medium text-gray-700">Back:</span>
                <p className="mt-1">{question.back}</p>
                {question.difficulty && (
                  <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
                    question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                    question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {question.difficulty}
                  </span>
                )}
              </div>
            )}
          </div>
        );

      case 'multiple-choice':
        return (
          <div className="space-y-2">
            <p className="font-medium">{question.question}</p>
            {expandedItems.has(question.id) && (
              <>
                <div className="space-y-1 ml-4">
                  {question.options.map((option, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded ${
                        index === question.correctAnswer
                          ? 'bg-green-50 border border-green-300'
                          : 'bg-gray-50'
                      }`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
                {question.explanation && (
                  <div className="mt-2 p-2 bg-blue-50 rounded">
                    <span className="font-medium text-blue-900">Explanation:</span>
                    <p className="text-blue-800 text-sm mt-1">{question.explanation}</p>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case 'open-ended':
        return (
          <div className="space-y-2">
            <p className="font-medium">{question.question}</p>
            {expandedItems.has(question.id) && question.sampleAnswer && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <span className="font-medium text-gray-700">Sample Answer:</span>
                <p className="text-gray-600 text-sm mt-1">{question.sampleAnswer}</p>
              </div>
            )}
          </div>
        );

      case 'fill-in-blank':
        return (
          <div className="space-y-2">
            <p className="font-medium">{question.question}</p>
            {expandedItems.has(question.id) && (
              <>
                <div className="mt-2 p-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">Answers:</span>
                  <p className="text-gray-600 text-sm mt-1">{question.blanks.join(', ')}</p>
                </div>
                {question.context && (
                  <p className="text-sm text-gray-500 italic">{question.context}</p>
                )}
              </>
            )}
          </div>
        );

      case 'summary':
        return (
          <div className="space-y-2">
            <h4 className="font-semibold text-lg">{question.title}</h4>
            <p className="text-gray-700">{question.content}</p>
            {expandedItems.has(question.id) && question.keyPoints && (
              <div className="mt-2">
                <span className="font-medium text-gray-700">Key Points:</span>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  {question.keyPoints.map((point, index) => (
                    <li key={index} className="text-gray-600">{point}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );

      default:
        return <p>{JSON.stringify(question)}</p>;
    }
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-12">
        <HelpCircle className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No questions generated yet</h3>
        <p className="text-gray-600">
          Upload content and click "Generate Content" in the Ingestion tab to create questions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Generated Questions</h3>
        <p className="text-gray-600">
          Review and save questions to use them in study sessions and tests.
        </p>
      </div>

      {questions.map((question) => {
        const Icon = getQuestionIcon(question.type);
        const isExpanded = expandedItems.has(question.id);
        const isSaving = savingItems.has(question.id);
        const isSaved = savedItems.has(question.id) || question.is_saved;

        return (
          <div
            key={question.id}
            className="bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center">
                <Icon className="h-5 w-5 text-indigo-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">
                  {getQuestionTypeLabel(question.type)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleSaveQuestion(question)}
                  disabled={isSaving || isSaved}
                  className={`inline-flex items-center px-3 py-1 rounded text-sm transition-colors ${
                    isSaved
                      ? 'bg-green-100 text-green-800 cursor-default'
                      : 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 disabled:opacity-50'
                  }`}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => toggleExpand(question.id)}
                  className="p-1 text-gray-500 hover:text-gray-700"
                >
                  {isExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-gray-800">
              {renderQuestionContent(question)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default QuestionPoolTab; 