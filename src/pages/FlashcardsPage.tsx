import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

interface Flashcard {
  id: string
  question_text: string
  correct_answer: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  explanation: string | null
  topic: string | null
}

export function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [loading, setLoading] = useState(true)
  const [knownCount, setKnownCount] = useState(0)
  const [learningCount, setLearningCount] = useState(0)
  const [courses, setCourses] = useState<Array<{ id: string; title: string; code: string }>>([])
  const [selectedCourseId, setSelectedCourseId] = useState<string>('')

  useEffect(() => {
    const fetchCourses = async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, code')
        .eq('is_active', true)
        .order('code')
      if (data) {
        setCourses(data)
      }
    }
    void fetchCourses()
  }, [])

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true)
      let query = supabase
        .from('questions')
        .select('id, question_text, correct_answer, option_a, option_b, option_c, option_d, explanation, topic')
        .eq('status', 'approved')
        .limit(50)

      if (selectedCourseId) {
        query = query.eq('course_id', selectedCourseId)
      }

      const { data } = await query
      if (data && data.length > 0) {
        // Shuffle cards for recall practice
        const shuffled = [...data].sort(() => Math.random() - 0.5)
        setCards(shuffled)
        setCurrentIndex(0)
        setIsFlipped(false)
      } else {
        setCards([])
      }
      setLoading(false)
    }

    void fetchCards()
  }, [selectedCourseId])

  const currentCard = cards[currentIndex]

  const getAnswerText = (card: Flashcard) => {
    const key = `option_${card.correct_answer.toLowerCase()}` as keyof Flashcard
    return (card[key] as string) || card.correct_answer
  }

  const handleNext = (known: boolean) => {
    if (known) setKnownCount((k) => k + 1)
    else setLearningCount((l) => l + 1)

    setIsFlipped(false)
    setTimeout(() => {
      if (currentIndex < cards.length - 1) {
        setCurrentIndex((i) => i + 1)
      } else {
        setCurrentIndex(cards.length) // completed state
      }
    }, 150)
  }

  const handleRestart = () => {
    setCurrentIndex(0)
    setIsFlipped(false)
    setKnownCount(0)
    setLearningCount(0)
    // reshuffle
    setCards((prev) => [...prev].sort(() => Math.random() - 0.5))
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            to="/app"
            className="text-xs font-semibold text-muted hover:text-text transition-colors flex items-center gap-1.5 mb-2"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-extrabold tracking-tight">Clinical Flashcards Deck</h1>
          <p className="text-xs text-muted">
            Rapid active recall for clinical pharmacology, anatomy, and nursing diagnoses.
          </p>
        </div>

        {/* Course Filter */}
        <select
          value={selectedCourseId}
          onChange={(e) => setSelectedCourseId(e.target.value)}
          className="border border-border bg-surface text-text px-3 py-2 text-xs font-semibold rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">All Courses Bank</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} - {c.title}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="border border-border bg-surface rounded-3xl p-12 text-center animate-pulse space-y-4">
          <div className="h-6 w-1/3 bg-border/60 mx-auto rounded-full" />
          <div className="h-40 w-full max-w-md bg-border/30 mx-auto rounded-2xl" />
        </div>
      ) : cards.length === 0 ? (
        <div className="border border-border bg-surface rounded-3xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center font-bold text-xl">
            🗂️
          </div>
          <h2 className="text-lg font-bold">No Flashcards Found</h2>
          <p className="text-xs text-muted max-w-sm mx-auto">
            There are currently no approved questions in this course deck. Check back after questions are imported!
          </p>
          <Link
            to="/app"
            className="inline-block px-4 py-2 bg-primary text-black font-bold text-xs rounded-xl"
          >
            Return to Dashboard
          </Link>
        </div>
      ) : currentIndex >= cards.length ? (
        /* Completed Deck Summary */
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="border border-border bg-surface rounded-3xl p-8 text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center text-3xl font-extrabold">
            ✓
          </div>
          <div>
            <h2 className="text-xl font-extrabold">Deck Complete!</h2>
            <p className="text-xs text-muted mt-1">Great job practicing clinical active recall.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto">
            <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 rounded-2xl">
              <span className="text-2xl font-black text-emerald-400">{knownCount}</span>
              <span className="block text-[11px] font-semibold text-emerald-400/80 uppercase">Mastered</span>
            </div>
            <div className="border border-amber-500/30 bg-amber-500/10 p-4 rounded-2xl">
              <span className="text-2xl font-black text-amber-400">{learningCount}</span>
              <span className="block text-[11px] font-semibold text-amber-400/80 uppercase">Needs Review</span>
            </div>
          </div>

          <div className="flex justify-center gap-3 pt-4">
            <button
              type="button"
              onClick={handleRestart}
              className="px-5 py-2.5 bg-primary text-black font-bold text-xs rounded-xl hover:opacity-90"
            >
              Practice Again ↺
            </button>
            <Link
              to="/app"
              className="px-5 py-2.5 border border-border bg-surface text-text font-bold text-xs rounded-xl hover:border-accent"
            >
              Back to Dashboard
            </Link>
          </div>
        </motion.div>
      ) : (
        /* Flashcard Active View */
        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="flex items-center justify-between text-xs font-semibold text-muted">
            <span>
              Card {currentIndex + 1} of {cards.length}
            </span>
            <span>
              {Math.round(((currentIndex + 1) / cards.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
            />
          </div>

          {/* 3D Flip Card */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer select-none perspective-1000 min-h-[320px] flex items-center justify-center"
          >
            <motion.div
              animate={{ rotateY: isFlipped ? 180 : 0 }}
              transition={{ duration: 0.4 }}
              style={{ transformStyle: 'preserve-3d' }}
              className="w-full relative min-h-[320px] border border-border bg-surface hover:border-primary/50 transition-colors rounded-3xl p-8 flex flex-col justify-between shadow-lg"
            >
              {/* Front Side */}
              <div
                style={{ backfaceVisibility: 'hidden' }}
                className={`absolute inset-0 p-8 flex flex-col justify-between ${
                  isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {currentCard.topic || 'Clinical Prompt'}
                  </span>
                  <span className="text-xs text-muted font-medium">Click card to reveal answer</span>
                </div>

                <div className="my-auto py-6">
                  <p className="text-lg font-bold text-text leading-relaxed">
                    {currentCard.question_text}
                  </p>
                </div>

                <div className="text-center text-xs text-muted/60 font-semibold uppercase tracking-widest">
                  Tap to flip ↷
                </div>
              </div>

              {/* Back Side */}
              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                className={`absolute inset-0 p-8 flex flex-col justify-between bg-surface rounded-3xl ${
                  !isFlipped ? 'pointer-events-none' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Correct Answer: Option {currentCard.correct_answer}
                  </span>
                  <span className="text-xs text-muted font-medium">Clinical Recall</span>
                </div>

                <div className="my-auto py-4 space-y-3">
                  <p className="text-lg font-bold text-emerald-400">
                    {getAnswerText(currentCard)}
                  </p>
                  {currentCard.explanation && (
                    <div className="p-3.5 rounded-xl bg-border/20 border border-border/50 text-xs text-muted leading-relaxed">
                      <strong className="text-text block mb-1">Clinical Rationale:</strong>
                      {currentCard.explanation}
                    </div>
                  )}
                </div>

                <div className="text-center text-xs text-muted/60 font-semibold uppercase tracking-widest">
                  Tap to flip back ↶
                </div>
              </div>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => handleNext(false)}
              className="flex-1 py-3 px-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white font-bold text-xs transition-all shadow-xs"
            >
              Still Learning (Review Again)
            </button>
            <button
              type="button"
              onClick={() => handleNext(true)}
              className="flex-1 py-3 px-4 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-black font-bold text-xs transition-all shadow-xs"
            >
              Mastered It (Next Card) →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
