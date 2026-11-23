import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'

export interface QuestionRow {
  id: string
  course_id: string
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic: string | null
  status: 'pending_review' | 'approved' | 'rejected'
  created_at: string
  courses?: {
    id: string
    title: string
    code: string
    academic_levels?: {
      code: string
      name: string
    }
  }
}

export interface CourseOption {
  id: string
  title: string
  code: string
  level_code: string
}

export interface AcademicLevelOption {
  id: string
  name: string
  code: string
}

export function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [academicLevels, setAcademicLevels] = useState<AcademicLevelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all')
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all')
  const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState<string>('all')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all')

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [isCreateCourseOpen, setIsCreateCourseOpen] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState<QuestionRow | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // New Course Form State
  const [courseFormData, setCourseFormData] = useState({
    title: '',
    code: '',
    description: '',
    level_id: '',
  })

  // Single Question Form State
  const [formData, setFormData] = useState({
    course_id: '',
    topic: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_answer: 'A' as 'A' | 'B' | 'C' | 'D',
    explanation: '',
    status: 'approved' as 'approved' | 'pending_review',
  })

  // Bulk CSV/JSON State
  const [bulkInput, setBulkInput] = useState('')
  const [bulkFormat, setBulkFormat] = useState<'json' | 'csv'>('csv')
  const [bulkCourseId, setBulkCourseId] = useState('')
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFileName(file.name)
    if (file.name.endsWith('.json')) {
      setBulkFormat('json')
    } else {
      setBulkFormat('csv')
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (content) {
        setBulkInput(content)
        toast.success(`Loaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`)
      }
    }
    reader.onerror = () => {
      toast.error('Failed to read selected file.')
    }
    reader.readAsText(file)
  }

  // 1. Fetch courses & academic levels for selectors & filters
  const loadCoursesAndLevels = async () => {
    try {
      const [coursesRes, levelsRes] = await Promise.all([
        supabase
          .from('courses')
          .select('id, title, code, level_id, academic_levels(code, name)')
          .order('code'),
        supabase
          .from('academic_levels')
          .select('id, name, code')
          .order('code'),
      ])

      if (levelsRes.data) {
        setAcademicLevels(levelsRes.data)
        if (levelsRes.data.length > 0 && !courseFormData.level_id) {
          setCourseFormData((prev) => ({ ...prev, level_id: levelsRes.data[0].id }))
        }
      }

      if (coursesRes.data) {
        const mapped: CourseOption[] = coursesRes.data.map((item: any) => ({
          id: item.id,
          title: item.title,
          code: item.code,
          level_code: item.academic_levels?.code || '300',
        }))
        setCourses(mapped)
        if (mapped.length > 0 && !formData.course_id) {
          setFormData((prev) => ({ ...prev, course_id: mapped[0].id }))
          setBulkCourseId(mapped[0].id)
        }
      }
    } catch (err: any) {
      console.error('Error loading courses/levels:', err)
    }
  }

  useEffect(() => {
    void loadCoursesAndLevels()
  }, [])

  // Create New Course Handler
  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!courseFormData.title.trim() || !courseFormData.code.trim()) {
      toast.error('Course title and code are required.')
      return
    }
    if (!courseFormData.level_id) {
      toast.error('Please assign an academic cohort level.')
      return
    }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from('courses')
        .insert({
          title: courseFormData.title.trim(),
          code: courseFormData.code.trim().toUpperCase(),
          description: courseFormData.description.trim() || null,
          level_id: courseFormData.level_id,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (error) throw error

      toast.success(`Course "${courseFormData.code}" created successfully!`)
      setIsCreateCourseOpen(false)
      setCourseFormData({
        title: '',
        code: '',
        description: '',
        level_id: academicLevels[0]?.id || '',
      })
      await loadCoursesAndLevels()
      if (data?.id) {
        setFormData((prev) => ({ ...prev, course_id: data.id }))
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create course.')
    } finally {
      setIsSaving(false)
    }
  }

  // 2. Fetch questions list (robust fallback for join schemas)
  const loadQuestions = async () => {
    setIsLoading(true)
    try {
      // First attempt: full join with courses and academic_levels
      const { data, error } = await supabase
        .from('questions')
        .select(`
          id,
          course_id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          explanation,
          difficulty,
          topic,
          status,
          created_at,
          courses (
            id,
            title,
            code,
            academic_levels (
              code,
              name
            )
          )
        `)
        .order('created_at', { ascending: false })
        .limit(300)

      if (!error && data) {
        setQuestions((data as unknown as QuestionRow[]) || [])
        return
      }

      // Fallback attempt: query questions directly without deep nested foreign joins
      console.warn('Joined query notice, trying flat fetch:', error?.message)
      const { data: flatData, error: flatError } = await supabase
        .from('questions')
        .select('id, course_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, difficulty, topic, status, created_at')
        .order('created_at', { ascending: false })
        .limit(300)

      if (flatError) throw flatError

      if (flatData) {
        // Map with loaded courses
        const augmented: QuestionRow[] = flatData.map((q: any) => {
          const matchedCourse = courses.find((c) => c.id === q.course_id)
          return {
            ...q,
            courses: matchedCourse
              ? {
                  id: matchedCourse.id,
                  title: matchedCourse.title,
                  code: matchedCourse.code,
                  academic_levels: {
                    code: matchedCourse.level_code,
                    name: `Level ${matchedCourse.level_code}`,
                  },
                }
              : undefined,
          }
        })
        setQuestions(augmented)
      }
    } catch (err: any) {
      console.error('Failed to load questions:', err)
      toast.error(err.message || 'Failed to load questions.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadQuestions()
  }, [])

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter((q) => {
      // Search
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch =
        !searchQuery ||
        q.question_text.toLowerCase().includes(searchLower) ||
        (q.topic && q.topic.toLowerCase().includes(searchLower)) ||
        (q.courses?.title && q.courses.title.toLowerCase().includes(searchLower)) ||
        (q.courses?.code && q.courses.code.toLowerCase().includes(searchLower))

      // Course Filter
      const matchesCourse =
        selectedCourseFilter === 'all' || q.course_id === selectedCourseFilter

      // Level Filter
      const qLevel = q.courses?.academic_levels?.code || ''
      const matchesLevel =
        selectedLevelFilter === 'all' || qLevel === selectedLevelFilter

      // Difficulty Filter
      const matchesDiff =
        selectedDifficultyFilter === 'all' || q.difficulty === selectedDifficultyFilter

      // Status Filter
      const matchesStatus =
        selectedStatusFilter === 'all' || q.status === selectedStatusFilter

      return matchesSearch && matchesCourse && matchesLevel && matchesDiff && matchesStatus
    })
  }, [questions, searchQuery, selectedCourseFilter, selectedLevelFilter, selectedDifficultyFilter, selectedStatusFilter])

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingQuestion(null)
    setFormData({
      course_id: courses[0]?.id || '',
      topic: '',
      difficulty: 'medium',
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_answer: 'A',
      explanation: '',
      status: 'approved',
    })
    setIsCreateOpen(true)
  }

  // Open Edit Modal
  const handleOpenEdit = (q: QuestionRow) => {
    setEditingQuestion(q)
    setFormData({
      course_id: q.course_id,
      topic: q.topic || '',
      difficulty: q.difficulty,
      question_text: q.question_text,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      status: q.status === 'rejected' ? 'pending_review' : q.status,
    })
    setIsCreateOpen(true)
  }

  // Save Single Question (Create or Update)
  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.question_text.trim()) {
      toast.error('Question text is required.')
      return
    }
    if (!formData.option_a.trim() || !formData.option_b.trim() || !formData.option_c.trim() || !formData.option_d.trim()) {
      toast.error('All 4 options (A, B, C, D) are required.')
      return
    }
    if (!formData.course_id) {
      toast.error('Please assign a course.')
      return
    }

    setIsSaving(true)
    try {
      if (editingQuestion) {
        // Update
        const { error } = await supabase
          .from('questions')
          .update({
            course_id: formData.course_id,
            topic: formData.topic.trim() || null,
            difficulty: formData.difficulty,
            question_text: formData.question_text.trim(),
            option_a: formData.option_a.trim(),
            option_b: formData.option_b.trim(),
            option_c: formData.option_c.trim(),
            option_d: formData.option_d.trim(),
            correct_answer: formData.correct_answer,
            explanation: formData.explanation.trim(),
            status: formData.status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingQuestion.id)

        if (error) throw error
        toast.success('Question updated successfully!')
      } else {
        // Insert
        const { error } = await supabase
          .from('questions')
          .insert({
            course_id: formData.course_id,
            topic: formData.topic.trim() || null,
            difficulty: formData.difficulty,
            question_text: formData.question_text.trim(),
            option_a: formData.option_a.trim(),
            option_b: formData.option_b.trim(),
            option_c: formData.option_c.trim(),
            option_d: formData.option_d.trim(),
            correct_answer: formData.correct_answer,
            explanation: formData.explanation.trim(),
            status: formData.status,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })

        if (error) throw error
        toast.success('Question created and added to bank!')
      }

      setIsCreateOpen(false)
      void loadQuestions()
    } catch (err: any) {
      toast.error(err.message || 'Failed to save question.')
    } finally {
      setIsSaving(false)
    }
  }

  // Delete Question
  const handleDeleteQuestion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return
    try {
      const { error } = await supabase.from('questions').delete().eq('id', id)
      if (error) throw error
      toast.success('Question removed.')
      setQuestions((prev) => prev.filter((q) => q.id !== id))
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete question.')
    }
  }

  // Quick Approve Status
  const handleQuickApprove = async (id: string) => {
    try {
      const { error } = await supabase
        .from('questions')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      toast.success('Question approved!')
      setQuestions((prev) =>
        prev.map((q) => (q.id === id ? { ...q, status: 'approved' } : q))
      )
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve question.')
    }
  }

  // Bulk Import Handler
  const handleBulkImport = async () => {
    if (!bulkInput.trim()) {
      toast.error('Please provide JSON or CSV data.')
      return
    }
    if (!bulkCourseId) {
      toast.error('Please select a course for the import batch.')
      return
    }

    setIsSaving(true)
    try {
      let rowsToInsert: any[] = []

      if (bulkFormat === 'json') {
        const parsed = JSON.parse(bulkInput)
        if (!Array.isArray(parsed)) throw new Error('JSON must be an array of questions.')
        rowsToInsert = parsed.map((item) => ({
          course_id: item.course_id || bulkCourseId,
          topic: item.topic || 'General Practice',
          difficulty: ['easy', 'medium', 'hard'].includes(item.difficulty) ? item.difficulty : 'medium',
          question_text: item.question_text || item.question,
          option_a: item.option_a || item.a,
          option_b: item.option_b || item.b,
          option_c: item.option_c || item.c,
          option_d: item.option_d || item.d,
          correct_answer: (item.correct_answer || item.answer || 'A').toUpperCase(),
          explanation: item.explanation || item.rationale || '',
          status: 'approved',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }))
      } else {
        // Advanced RFC-4180 compliant CSV parser: handles quoted fields with internal commas, double quotes, and newlines
        const parseCSVRows = (text: string): string[][] => {
          const rows: string[][] = []
          let currentRow: string[] = []
          let currentField = ''
          let inQuotes = false

          for (let i = 0; i < text.length; i++) {
            const char = text[i]
            const nextChar = text[i + 1]

            if (char === '"') {
              if (inQuotes && nextChar === '"') {
                currentField += '"'
                i++ // Skip escaped quote
              } else {
                inQuotes = !inQuotes
              }
            } else if (char === ',' && !inQuotes) {
              currentRow.push(currentField.trim())
              currentField = ''
            } else if ((char === '\r' || char === '\n') && !inQuotes) {
              if (char === '\r' && nextChar === '\n') i++
              currentRow.push(currentField.trim())
              if (currentRow.some((col) => col.length > 0)) {
                rows.push(currentRow)
              }
              currentRow = []
              currentField = ''
            } else {
              currentField += char
            }
          }
          if (currentField.length > 0 || currentRow.length > 0) {
            currentRow.push(currentField.trim())
            if (currentRow.some((col) => col.length > 0)) {
              rows.push(currentRow)
            }
          }
          return rows
        }

        const rawParsedRows = parseCSVRows(bulkInput)
        if (rawParsedRows.length === 0) throw new Error('CSV is empty.')

        // Filter out preamble/title/metadata rows before the actual table header
        // Find index of row containing column headers like 'question_text' or 'question' or 'item_no'
        let headerRowIndex = -1
        for (let i = 0; i < Math.min(rawParsedRows.length, 10); i++) {
          const rowLower = rawParsedRows[i].map((col) => col.toLowerCase())
          if (
            rowLower.includes('question_text') ||
            rowLower.includes('question') ||
            rowLower.includes('item_no') ||
            (rowLower.includes('option_a') && rowLower.includes('correct_answer'))
          ) {
            headerRowIndex = i
            break
          }
        }

        let colMap: Record<string, number> = {}
        let dataRows: string[][] = []

        if (headerRowIndex !== -1) {
          const headerRow = rawParsedRows[headerRowIndex].map((h) => h.toLowerCase().trim())
          headerRow.forEach((colName, idx) => {
            colMap[colName] = idx
          })
          dataRows = rawParsedRows.slice(headerRowIndex + 1)
        } else {
          // No recognizable header row found, treat entire array as data rows with standard schema
          dataRows = rawParsedRows
        }

        for (const parts of dataRows) {
          if (parts.length < 5) continue

          let question_text = ''
          let option_a = ''
          let option_b = ''
          let option_c = ''
          let option_d = ''
          let correct_answer = 'A'
          let topic = 'General Practice'
          let difficulty: 'easy' | 'medium' | 'hard' = 'medium'
          let explanation = ''

          if (headerRowIndex !== -1) {
            // Header-mapped extraction
            const getVal = (names: string[]) => {
              for (const n of names) {
                if (colMap[n] !== undefined && parts[colMap[n]] !== undefined) {
                  return parts[colMap[n]]
                }
              }
              return ''
            }

            question_text = getVal(['question_text', 'question', 'stem'])
            option_a = getVal(['option_a', 'option a', 'a'])
            option_b = getVal(['option_b', 'option b', 'b'])
            option_c = getVal(['option_c', 'option c', 'c'])
            option_d = getVal(['option_d', 'option d', 'd'])
            correct_answer = getVal(['correct_answer', 'correct answer', 'answer', 'correct']) || 'A'
            topic = getVal(['topic', 'subject', 'category']) || 'General Practice'
            const rawDiff = getVal(['difficulty', 'level']).toLowerCase()
            difficulty = ['easy', 'medium', 'hard'].includes(rawDiff) ? (rawDiff as any) : 'medium'
            explanation = getVal(['explanation', 'rationale', 'reason'])
          } else {
            // Positional fallback: check if first column is numeric item_no (e.g. 1, 2, 3...)
            const hasItemNo = /^\d+$/.test(parts[0])
            const offset = hasItemNo ? 1 : 0

            question_text = parts[offset] || ''
            option_a = parts[offset + 1] || ''
            option_b = parts[offset + 2] || ''
            option_c = parts[offset + 3] || ''
            option_d = parts[offset + 4] || ''
            correct_answer = parts[offset + 5] || 'A'
            topic = parts[offset + 6] || 'General Practice'
            const rawDiff = (parts[offset + 7] || 'medium').toLowerCase().trim()
            difficulty = ['easy', 'medium', 'hard'].includes(rawDiff) ? (rawDiff as any) : 'medium'
            explanation = parts[offset + 8] || ''
          }

          if (!question_text.trim()) continue

          const cleanCorrect = (correct_answer || 'A').toUpperCase().trim()
          const validCorrect = ['A', 'B', 'C', 'D'].includes(cleanCorrect) ? cleanCorrect : 'A'

          rowsToInsert.push({
            course_id: bulkCourseId,
            question_text: question_text.trim(),
            option_a: option_a.trim(),
            option_b: option_b.trim(),
            option_c: option_c.trim(),
            option_d: option_d.trim(),
            correct_answer: validCorrect,
            topic: topic.trim() || 'General Practice',
            difficulty,
            explanation: explanation.trim(),
            status: 'approved',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
        }
      }

      if (rowsToInsert.length === 0) {
        throw new Error('No valid questions parsed from input.')
      }

      const { error } = await supabase.from('questions').insert(rowsToInsert)
      if (error) throw error

      toast.success(`Successfully imported ${rowsToInsert.length} questions!`)
      setIsBulkOpen(false)
      setBulkInput('')
      void loadQuestions()
    } catch (err: any) {
      toast.error(err.message || 'Failed to parse or import data.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-accent">
              Curriculum & Examination Bank
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {questions.length} Total
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Questions Studio
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5">
            Create, audit, filter, and bulk-import multiple-choice questions across academic cohorts.
          </p>
        </div>

        {/* Action Triggers */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsCreateCourseOpen(true)}
            className="border border-border hover:border-accent bg-surface text-text px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl motion-safe:transition-transform motion-safe:active:scale-95 inline-flex items-center gap-1.5"
          >
            <span className="text-accent font-black">+</span>
            <span>New Course</span>
          </button>
          <button
            type="button"
            onClick={() => setIsBulkOpen(true)}
            className="border border-border hover:border-accent bg-surface text-text px-3.5 py-2 text-xs sm:text-sm font-bold rounded-xl motion-safe:transition-transform motion-safe:active:scale-95 inline-flex items-center gap-1.5"
          >
            <span>☷ Bulk Import</span>
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="bg-primary text-on-primary hover:opacity-95 px-4 py-2 text-xs sm:text-sm font-bold rounded-xl shadow-xs motion-safe:transition-transform motion-safe:active:scale-95 inline-flex items-center gap-1.5"
          >
            <span>+ Add Question</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="border border-border bg-surface p-4 rounded-2xl space-y-3 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search bar */}
          <div className="lg:col-span-2">
            <label htmlFor="q-search" className="sr-only">Search questions</label>
            <input
              id="q-search"
              type="text"
              placeholder="Search by stem, topic, or course..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3.5 py-2 text-xs sm:text-sm font-medium text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Course filter */}
          <div>
            <select
              aria-label="Filter by course"
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </div>

          {/* Academic Level */}
          <div>
            <select
              aria-label="Filter by academic level"
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Levels</option>
              <option value="200">Level 200</option>
              <option value="300">Level 300</option>
              <option value="400">Level 400</option>
            </select>
          </div>

          {/* Difficulty Filter */}
          <div>
            <select
              aria-label="Filter by difficulty"
              value={selectedDifficultyFilter}
              onChange={(e) => setSelectedDifficultyFilter(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/60 text-xs">
          <span className="text-muted font-bold mr-1">Status:</span>
          {(['all', 'approved', 'pending_review'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatusFilter(st)}
              className={`px-2.5 py-1 rounded-lg font-bold motion-safe:transition-all ${
                selectedStatusFilter === st
                  ? 'bg-primary text-on-primary'
                  : 'bg-bg border border-border text-muted hover:text-text'
              }`}
            >
              {st === 'all' ? 'All' : st === 'approved' ? 'Approved' : 'Pending Review'}
            </button>
          ))}
          <span className="ml-auto text-xs font-semibold text-muted">
            Showing <strong className="text-text">{filteredQuestions.length}</strong> questions
          </span>
        </div>
      </div>

      {/* Questions Data Table */}
      <div className="border border-border bg-surface rounded-2xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs sm:text-sm text-muted font-medium">Loading question bank...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="py-16 text-center space-y-3 p-6">
            <div className="text-3xl">📝</div>
            <h3 className="font-extrabold text-lg">No questions match your filter</h3>
            <p className="text-xs sm:text-sm text-muted max-w-sm mx-auto">
              Try adjusting your search terms or course selection, or click "+ Add Question" to seed a new question.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-bg/50 text-[11px] font-bold text-muted uppercase tracking-wider">
                  <th scope="col" className="py-3 px-4 sm:px-6">Question Stem</th>
                  <th scope="col" className="py-3 px-3">Course / Topic</th>
                  <th scope="col" className="py-3 px-3 text-center">Correct</th>
                  <th scope="col" className="py-3 px-3 text-center">Difficulty</th>
                  <th scope="col" className="py-3 px-3 text-center">Status</th>
                  <th scope="col" className="py-3 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-bg/40 motion-safe:transition-colors">
                    <td className="py-3.5 px-4 sm:px-6 max-w-md">
                      <p className="font-bold text-text line-clamp-2 leading-snug">
                        {q.question_text}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                        <span className="truncate">A: {q.option_a.slice(0, 30)}...</span>
                        <span>•</span>
                        <span className="truncate">B: {q.option_b.slice(0, 30)}...</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-xs text-text">
                        {q.courses?.code || 'Course'}
                      </div>
                      <div className="text-[11px] text-muted truncate max-w-[140px]">
                        {q.topic || 'General Topic'}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className="w-6 h-6 rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-xs inline-flex items-center justify-center border border-emerald-500/30">
                        {q.correct_answer}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        q.difficulty === 'easy'
                          ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
                          : q.difficulty === 'medium'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                          : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
                      }`}>
                        {q.difficulty}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        q.status === 'approved'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                      }`}>
                        {q.status === 'approved' ? 'Approved' : 'Pending'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap space-x-1">
                      {q.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleQuickApprove(q.id)}
                          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(q)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg border border-border hover:border-accent bg-bg text-text"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(q.id)}
                        className="px-2 py-1 text-xs font-bold rounded-lg text-rose-600 hover:bg-rose-500/10"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* SINGLE QUESTION CREATION / EDIT MODAL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isCreateOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    {editingQuestion ? 'Edit Question' : 'Add New Question'}
                  </h2>
                  <p className="text-xs text-muted">
                    Enter the clinical question stem, four choices, correct key, and rationale.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="p-1.5 rounded-xl border border-border hover:border-accent bg-bg text-text"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveQuestion} className="space-y-4 text-xs sm:text-sm">
                {/* Course & Topic */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-muted block mb-1">Course Assignment</label>
                    <select
                      value={formData.course_id}
                      onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          [{c.level_code}] {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-muted block mb-1">Topic / Domain</label>
                    <input
                      type="text"
                      placeholder="e.g. Dosage Calculations, Labor Stages"
                      value={formData.topic}
                      onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Question Stem */}
                <div>
                  <label className="font-bold text-muted block mb-1">Question Stem (Clinical Case)</label>
                  <textarea
                    rows={3}
                    placeholder="Enter full clinical question prompt..."
                    value={formData.question_text}
                    onChange={(e) => setFormData({ ...formData, question_text: e.target.value })}
                    required
                    className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                </div>

                {/* 4 Choices */}
                <div className="space-y-2">
                  <label className="font-bold text-muted block">Options & Correct Answer Selection</label>
                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                    const fieldName = `option_${key.toLowerCase()}` as keyof typeof formData
                    const isCorrect = formData.correct_answer === key

                    return (
                      <div
                        key={key}
                        className={`p-2.5 rounded-xl border flex items-center gap-3 ${
                          isCorrect ? 'border-emerald-500 bg-emerald-500/10' : 'border-border bg-bg'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, correct_answer: key })}
                          className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 motion-safe:transition-all ${
                            isCorrect ? 'bg-emerald-600 text-white shadow-xs' : 'bg-surface text-muted border border-border hover:text-text'
                          }`}
                        >
                          {key}
                        </button>
                        <input
                          type="text"
                          placeholder={`Option ${key} text`}
                          value={formData[fieldName] as string}
                          onChange={(e) => setFormData({ ...formData, [fieldName]: e.target.value })}
                          required
                          className="w-full bg-transparent border-0 focus:outline-none font-medium text-text text-xs sm:text-sm"
                        />
                        {isCorrect && (
                          <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 shrink-0">
                            ✓ Correct Key
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Explanation / Rationale */}
                <div>
                  <label className="font-bold text-muted block mb-1">Clinical Rationale (Explanation)</label>
                  <textarea
                    rows={3}
                    placeholder="Explain why the correct answer is indicated and why other options are contraindicated..."
                    value={formData.explanation}
                    onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                </div>

                {/* Difficulty & Status */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-muted block mb-1">Difficulty</label>
                    <select
                      value={formData.difficulty}
                      onChange={(e) => setFormData({ ...formData, difficulty: e.target.value as any })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="easy">Easy (Knowledge Recall)</option>
                      <option value="medium">Medium (Clinical Analysis)</option>
                      <option value="hard">Hard (Licensure Scenario)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-muted block mb-1">Publish Status</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="approved">Approved & Live in Exams</option>
                      <option value="pending_review">Pending Review</option>
                    </select>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-bg font-bold text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : editingQuestion ? 'Update Question' : 'Save Question'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ==================================================================== */}
      {/* BULK JSON/CSV IMPORTER MODAL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isBulkOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBulkOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-2xl bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Bulk Import Questions
                  </h2>
                  <p className="text-xs text-muted">
                    Paste an array of questions in JSON or comma-separated CSV format.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsBulkOpen(false)}
                  className="p-1.5 rounded-xl border border-border hover:border-accent bg-bg text-text"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-xs sm:text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-muted block mb-1">Target Course</label>
                    <select
                      value={bulkCourseId}
                      onChange={(e) => setBulkCourseId(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-muted block mb-1">Data Format</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBulkFormat('json')}
                        className={`py-2 rounded-xl font-bold border text-xs ${
                          bulkFormat === 'json' ? 'bg-primary text-on-primary border-primary' : 'bg-bg border-border text-muted'
                        }`}
                      >
                        JSON Array
                      </button>
                      <button
                        type="button"
                        onClick={() => setBulkFormat('csv')}
                        className={`py-2 rounded-xl font-bold border text-xs ${
                          bulkFormat === 'csv' ? 'bg-primary text-on-primary border-primary' : 'bg-bg border-border text-muted'
                        }`}
                      >
                        CSV Format
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  {/* File Upload Zone */}
                  <div className="mb-4">
                    <label className="font-bold text-muted block mb-1.5">
                      Upload File (.csv or .json)
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border hover:border-primary/50 bg-bg hover:bg-border/10 rounded-2xl p-4 sm:p-5 text-center cursor-pointer transition-colors flex flex-col items-center justify-center gap-1.5"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.txt,.json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                        📁
                      </div>
                      <div className="text-xs">
                        {selectedFileName ? (
                          <span className="font-bold text-emerald-400">
                            ✓ Selected: {selectedFileName}
                          </span>
                        ) : (
                          <>
                            <span className="font-bold text-text underline">Click to choose a file</span>{' '}
                            <span className="text-muted">or drop your CSV / JSON here</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-muted">
                        Supports standard CSV files exported from spreadsheets or AI prompts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-1">
                    <label className="font-bold text-muted block">
                      {bulkFormat === 'json' ? 'Or Paste JSON Payload' : 'Or Paste / Review CSV Data'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (bulkFormat === 'json') {
                          setBulkInput(`[\n  {\n    "question_text": "What is the primary action of furosemide?",\n    "option_a": "Inhibits loop sodium resorption",\n    "option_b": "Beta blocker",\n    "option_c": "ACE inhibitor",\n    "option_d": "Calcium blocker",\n    "correct_answer": "A",\n    "explanation": "Furosemide is a loop diuretic.",\n    "topic": "Diuretics",\n    "difficulty": "medium"\n  }\n]`)
                        } else {
                          setBulkInput(`"What is the normal blood potassium range?","3.5-5.0 mEq/L","1.0-2.0 mEq/L","7.0-9.0 mEq/L","12-15 mEq/L","A","Electrolytes","Normal potassium is 3.5 to 5.0 mEq/L."`)
                        }
                      }}
                      className="text-accent text-xs font-bold hover:underline"
                    >
                      Fill Example Template
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    placeholder={
                      bulkFormat === 'json'
                        ? '[ { "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_answer": "A", "explanation": "..." } ]'
                        : '"Question stem","Option A","Option B","Option C","Option D","A","Topic","Explanation"'
                    }
                    value={bulkInput}
                    onChange={(e) => setBulkInput(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-3 font-mono text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsBulkOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-bg font-bold text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkImport}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? 'Importing Batch...' : 'Import Questions'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* ==================================================================== */}
      {/* NEW COURSE CREATION MODAL */}
      {/* ==================================================================== */}
      <AnimatePresence>
        {isCreateCourseOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateCourseOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              aria-hidden="true"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-surface border border-border rounded-3xl p-6 sm:p-8 shadow-2xl z-10 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Create New Course
                  </h2>
                  <p className="text-xs text-muted">
                    Add a course to your curriculum and assign it to an academic cohort level.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateCourseOpen(false)}
                  className="p-1.5 rounded-xl border border-border hover:border-accent bg-bg text-text"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateCourse} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="font-bold text-muted block mb-1">Academic Cohort Level</label>
                  <select
                    value={courseFormData.level_id}
                    onChange={(e) => setCourseFormData({ ...courseFormData, level_id: e.target.value })}
                    required
                    className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-bold text-text focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {academicLevels.map((lvl) => (
                      <option key={lvl.id} value={lvl.id}>
                        {lvl.name} (Code: {lvl.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-muted block mb-1">Course Code</label>
                    <input
                      type="text"
                      placeholder="e.g. NUR 301, PHA 302"
                      value={courseFormData.code}
                      onChange={(e) => setCourseFormData({ ...courseFormData, code: e.target.value })}
                      required
                      className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-bold text-text uppercase focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted block mb-1">Course Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Medical-Surgical Nursing"
                      value={courseFormData.title}
                      onChange={(e) => setCourseFormData({ ...courseFormData, title: e.target.value })}
                      required
                      className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-muted block mb-1">Description (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of the clinical domain covered in this course..."
                    value={courseFormData.description}
                    onChange={(e) => setCourseFormData({ ...courseFormData, description: e.target.value })}
                    className="w-full bg-bg border border-border rounded-xl px-3.5 py-2.5 font-medium text-text focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                  />
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsCreateCourseOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-border bg-bg font-bold text-muted hover:text-text"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-95 shadow-xs disabled:opacity-50"
                  >
                    {isSaving ? 'Creating...' : 'Create Course'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
