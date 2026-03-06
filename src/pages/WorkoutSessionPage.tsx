import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Plus, CheckCircle } from 'lucide-react'
import useWorkouts, { useWorkoutSets } from '@/hooks/useWorkouts'
import useExercises from '@/hooks/useExercises'
import { useAuth } from '@/contexts/AuthContext'
import type { Exercise } from '@/types/database'
import ExerciseBlock from '@/components/logging/ExerciseBlock'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils'

export default function WorkoutSessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { sessions, update: updateSession } = useWorkouts()
  const { sets, addSet, updateSet, removeSet, loading: setsLoading } = useWorkoutSets(id!)
  const { exercises } = useExercises()
  const { profile } = useAuth()
  const preferredUnit = profile?.preferred_weight_unit ?? 'lbs'

  const session = sessions.find((s) => s.id === id)
  const isComplete = !!session?.completed_at

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined)

  useEffect(() => {
    if (!session || isComplete) return
    const startTime = new Date(session.started_at).getTime()
    function tick() {
      setElapsed(Math.floor((Date.now() - startTime) / 1000))
    }
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => clearInterval(timerRef.current)
  }, [session, isComplete])

  // Exercise picker
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedExerciseId, setSelectedExerciseId] = useState('')

  // Which exercises are in this session (by unique exercise_id in sets)
  const sessionExerciseIds = useMemo(
    () => [...new Set(sets.map((s) => s.exercise_id))],
    [sets],
  )

  const sessionExercises = useMemo(
    () => sessionExerciseIds
      .map((eid) => exercises.find((e) => e.id === eid))
      .filter((e): e is Exercise => !!e),
    [sessionExerciseIds, exercises],
  )

  const activeExercises = exercises.filter((e) => !e.is_archived)
  const exerciseOptions = activeExercises.map((e) => ({ value: e.id, label: e.name }))

  async function handleAddExercise() {
    if (!selectedExerciseId) return
    // Add first set for the exercise
    await addSet({
      exercise_id: selectedExerciseId,
      set_number: 1,
    })
    setSelectedExerciseId('')
    setPickerOpen(false)
  }

  async function handleAddSet(exerciseId: string, isWarmup: boolean) {
    const exerciseSets = sets.filter((s) => s.exercise_id === exerciseId)
    const workingSets = exerciseSets.filter((s) => !s.is_warmup)
    const lastWorking = workingSets[workingSets.length - 1]

    await addSet({
      exercise_id: exerciseId,
      set_number: isWarmup ? 0 : workingSets.length + 1,
      is_warmup: isWarmup,
      weight: isWarmup ? null : (lastWorking?.weight ?? null),
      reps: isWarmup ? null : (lastWorking?.reps ?? null),
    })
  }

  async function handleFinish() {
    if (!session) return
    // Compute total weight moved from logged sets (reps × weight per working set)
    const totalWeight = sets
      .filter((s) => !s.is_warmup)
      .reduce((sum, s) => sum + (s.reps ?? 0) * (s.weight ?? 0), 0)
    await updateSession(session.id, {
      completed_at: new Date().toISOString(),
      duration_sec: elapsed,
      total_weight_moved: totalWeight > 0 ? `${Math.round(totalWeight).toLocaleString()} ${preferredUnit}` : null,
    })
    navigate('/workouts')
  }

  if (setsLoading || !session) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to="/workouts" className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-500">
            <ArrowLeft className="h-4 w-4" /> Workouts
          </Link>
          <h1 className="mt-1 text-2xl font-bold">{session.name}</h1>
          <p className="mt-0.5 text-sm font-mono text-surface-500">
            {isComplete
              ? `Completed — ${formatDuration(session.duration_sec ?? 0)}`
              : formatDuration(elapsed)}
          </p>
        </div>
        {!isComplete && (
          <Button onClick={handleFinish} size="sm">
            <CheckCircle className="h-4 w-4" />
            Finish
          </Button>
        )}
      </div>

      {/* Exercise blocks */}
      {sessionExercises.map((exercise) => (
        <ExerciseBlock
          key={exercise.id}
          exercise={exercise}
          sets={sets.filter((s) => s.exercise_id === exercise.id)}
          onAddSet={handleAddSet}
          onUpdateSet={updateSet}
          onRemoveSet={removeSet}
        />
      ))}

      {/* Add exercise */}
      {!isComplete && (
        <Button variant="secondary" className="w-full" onClick={() => setPickerOpen(true)}>
          <Plus className="h-4 w-4" />
          Add Exercise
        </Button>
      )}

      {sessionExercises.length === 0 && !isComplete && (
        <p className="py-8 text-center text-sm text-surface-400">
          Add an exercise to start logging sets.
        </p>
      )}

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Add Exercise">
        <div className="space-y-4">
          <Select
            options={exerciseOptions}
            value={selectedExerciseId}
            onChange={(e) => setSelectedExerciseId(e.target.value)}
            placeholder="Select an exercise..."
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPickerOpen(false)}>Cancel</Button>
            <Button onClick={handleAddExercise} disabled={!selectedExerciseId}>Add</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
