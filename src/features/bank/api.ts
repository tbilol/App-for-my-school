import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AnswerMode, Level, Subject, TaskBankItem, TaskBody, TaskSkill } from '@/types/models'

// Levels + task bank. Reads are RLS-scoped (teachers: active levels only;
// bank and keys: staff only). Writes are admin-only authoring RPCs
// (20261021000000_task_bank_authoring.sql).

async function rows<T>(p: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(error.message)
  return data as T
}
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw new Error(error.message)
  return data as T
}

export const SUBJECTS: Subject[] = ['english', 'math', 'it']

/** Skills each subject's bank may hold — mirrors private.subject_skills. */
export const SUBJECT_SKILLS: Record<Subject, TaskSkill[]> = {
  english: ['grammar', 'reading', 'writing'],
  math: ['math'],
  it: ['it'],
}

/** Default answer mode for a new question of this skill. */
export function defaultMode(skill: TaskSkill): AnswerMode {
  if (skill === 'writing') return 'text'
  return skill === 'math' ? 'exact' : 'choice'
}

/** Answer key as stored in task_bank_keys (choice indices are 0-based). */
export interface TaskKey { correct?: number | number[]; value?: string; values?: string[] }
export interface BankTask extends TaskBankItem { key: TaskKey | null }

export const bankKeys = {
  levels: ['bank', 'levels'] as const,
  tasks: (levelId: string) => ['bank', 'tasks', levelId] as const,
}

/** Every level the caller may see (admin: inactive too), in order. */
export function useLevels() {
  return useQuery({
    queryKey: bankKeys.levels,
    queryFn: () => rows<Level[]>(supabase.from('levels').select('*').order('subject').order('ord')),
  })
}

/** One level's questions with their keys (staff-only tables). */
export function useTasks(levelId: string | undefined) {
  return useQuery({
    queryKey: bankKeys.tasks(levelId ?? ''),
    enabled: !!levelId,
    queryFn: async () => {
      const data = await rows<(TaskBankItem & { task_bank_keys: { answer: TaskKey } | { answer: TaskKey }[] | null })[]>(
        supabase.from('task_bank').select('*, task_bank_keys(answer)').eq('level_id', levelId!).order('created_at'),
      )
      // one-to-one embed: PostgREST returns an object (or an array on older versions)
      return data.map<BankTask>(({ task_bank_keys: k, ...t }) => ({ ...t, key: (Array.isArray(k) ? k[0] : k)?.answer ?? null }))
    },
  })
}

function useBankMutation<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient()
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: ['bank'] }) })
}

export const useCreateLevel = () =>
  useBankMutation((a: { subject: Subject; name: string }) => rpc<Level>('create_level', { p_subject: a.subject, p_name: a.name }))

export const useRenameLevel = () =>
  useBankMutation((a: { id: string; name: string }) => rpc<Level>('rename_level', { p_level: a.id, p_name: a.name }))

export const useSetLevelActive = () =>
  useBankMutation((a: { id: string; active: boolean }) => rpc<Level>('set_level_active', { p_level: a.id, p_active: a.active }))

/** position is 1-based within the subject. */
export const useReorderLevel = () =>
  useBankMutation((a: { id: string; position: number }) => rpc<void>('reorder_level', { p_level: a.id, p_new_ord: a.position }))

export interface TaskInput {
  subject: Subject
  levelId: string
  skill: TaskSkill
  answerMode: AnswerMode
  prompt: string
  body: TaskBody
  /** null for writing (text) items. */
  answer: TaskKey | null
  difficulty: number
}

export const useCreateTask = () =>
  useBankMutation((a: TaskInput) => rpc<string>('create_task', {
    p_subject: a.subject, p_level: a.levelId, p_skill: a.skill, p_answer_mode: a.answerMode,
    p_prompt: a.prompt, p_body: a.body, p_answer: a.answer, p_difficulty: a.difficulty,
  }))

/** Sends every field; the server re-validates and replaces/removes the key to match. */
export const useUpdateTask = () =>
  useBankMutation((a: TaskInput & { id: string }) => rpc<string>('update_task', {
    p_task: a.id, p_level: a.levelId, p_skill: a.skill, p_answer_mode: a.answerMode,
    p_prompt: a.prompt, p_body: a.body, p_answer: a.answer, p_difficulty: a.difficulty,
  }))

export const useSetTaskActive = () =>
  useBankMutation((a: { id: string; active: boolean }) => rpc<void>('set_task_active', { p_task: a.id, p_active: a.active }))
