import { Select } from './Select'
import { groupCompetitionsByDate } from '../utils/competitionUtils'
import type { Competition, RaceClass, Club } from '../types/live-results'

const buttonBase =
  'rounded-lg px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]'

type CompetitionSelectorProps = {
  competitions: Competition[]
  classes: RaceClass[]
  clubs: Club[]
  competitionId: number | null
  className: string
  clubName: string
  selectionMode: 'class' | 'club'
  onCompetitionChange: (id: number | null) => void
  onClassNameChange: (name: string) => void
  onClubNameChange: (name: string) => void
  onSelectionModeChange: (mode: 'class' | 'club') => void
}

export function CompetitionSelector({
  competitions,
  classes,
  clubs,
  competitionId,
  className,
  clubName,
  selectionMode,
  onCompetitionChange,
  onClassNameChange,
  onClubNameChange,
  onSelectionModeChange,
}: CompetitionSelectorProps) {
  return (
    <section class="mb-4 rounded-2xl bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">Select event</h2>
        <span class="text-xs text-slate-500">Competition → Class or Club</span>
      </div>
      <div class="mt-3 grid gap-3">
        <Select
          label="Competition"
          value={competitionId?.toString() || ''}
          placeholder="Choose competition"
          onChange={(val) => onCompetitionChange(val ? Number(val) : null)}
          options={groupCompetitionsByDate(competitions).map((group) => ({
            label: group.label,
            options: group.competitions.map((c) => ({
              value: c.id.toString(),
              label: `${c.name} (${c.organizer})`,
            })),
          }))}
        />
        <div class="flex gap-2 text-sm">
          <button
            class={`${buttonBase} flex-1 ${selectionMode === 'class' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => {
              onSelectionModeChange('class')
              onClubNameChange('')
            }}
          >
            Select by Class
          </button>
          <button
            class={`${buttonBase} flex-1 ${selectionMode === 'club' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            onClick={() => {
              onSelectionModeChange('club')
              onClassNameChange('')
            }}
          >
            Select by Club
          </button>
        </div>
        {selectionMode === 'class' && (
          <Select
            label="Class"
            value={className}
            placeholder={
              classes.length === 0 && competitionId
                ? 'No classes available'
                : 'Choose class'
            }
            onChange={onClassNameChange}
            disabled={!competitionId}
            options={classes.map((c) => ({
              value: c.className,
              label: c.className,
            }))}
          />
        )}
        {selectionMode === 'club' && (
          <Select
            label="Club"
            value={clubName}
            placeholder={
              clubs.length === 0 && competitionId ? 'No clubs available' : 'Choose club'
            }
            onChange={onClubNameChange}
            disabled={!competitionId}
            options={[...clubs]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((club) => ({
                value: club.name,
                label: `${club.name} (${club.runners})`,
              }))}
          />
        )}
      </div>
    </section>
  )
}
