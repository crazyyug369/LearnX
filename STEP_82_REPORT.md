=== STEP 82 FULL INVESTIGATION REPORT ===

1. Exact location of "velocityGain"
- Frontend State: `src/components/TeacherDashboard.tsx` (Line ~87: `const [velocityGain, setVelocityGain] = useState<number>(38);`)
- Frontend Display: `src/components/TeacherDashboard.tsx` (Line ~862: `<h3 className="text-2xl font-serif font-semibold text-[#114B43] tracking-tight">+{velocityGain}%</h3>`)
- Backend Calculation: `src/serverDb.ts` (Line ~1886: `let velocityGain = 38;` and later injected into payload).

2. Current calculation/source
- The backend queries `quiz_attempts`: `SELECT user_id, MIN(score) as minScore, MAX(score) as maxScore FROM quiz_attempts GROUP BY user_id HAVING COUNT(*) >= 2'`.
- It calculates `(maxScore - minScore)` averaged across all qualified students and ensures a strict minimum floor of `15`. 
- This formula is mathematically invalid as a proxy for "learning velocity" because it groups purely by `user_id`. It subtracts a poor score on one concept (e.g. Algebra) from a high score on an unrelated concept (e.g. Geometry), resulting in astronomical, meaningless "gains" totally unrelated to mastery improvement.

3. Whether it is hardcoded
- Yes. Because test and production initial phases rarely have students submitting greater than 2 cross-concept quizzes continuously, the query commonly returns `[]`. The system then violently falls back to the static `velocityGain = 38` block in all error cases and non-calculable empty scenarios. 

4. Existing authoritative data that could support it
- The MySQL `quiz_attempts` table reliably stores `user_id`, `concept_id`, `score`, and timestamped `created_at` data which could hypothetically calculate intra-concept test improvement.
- However, currently, the DB contains only 6 recorded test attempts across the entire architecture, and only 2 repeated concept combinations. The data density is drastically too low to present an authoritative unified "Velocity Gain" metric bounding the entire classroom.

5. Recommended classification: A, B, or C
- **C — Insufficient authoritative data**
- There is neither sufficient historical history nor a mathematically sound backend aggregation to warrant displaying this number.

6. If B, proposed exact formula
- N/A

7. If C, recommended honest empty-state wording
- Recommendation: Since the UI is tightly packed inside a dashboard telemetry box, change the `<h2>` text strictly from `+{velocityGain}%` to `"Insufficient data"` or `"N/A"`, retaining the subtext `"Requires repeated student practice"`. We should redesign the `TeacherDashboard.tsx` state to default to `null` or a string explicitly triggering this empty state.

8. Any other static/fabricated teacher analytics discovered
- **Fabricated Learning Bottlenecks**: In `src/serverDb.ts` inside `getCurriculumBottlenecksFromDb()`, the system actively monitors for real struggles. However, if less than 3 struggling areas are found, it iterates and INJECTS fabricated `defaults` (such as "Quadratic Equations" with a `failureRate: 38` and `affectedLearnersCount: 2`). 
- This actively sabotages the application codebase. `TeacherDashboard.tsx` already contains a robust, polished Empty State (`<h4 className="...">No critical learning bottlenecks detected</h4>`), but it is permanently invisible in production because the backend invents fake bottlenecks out of thin air.
- **atRiskCount Error Block**: The primary `catch (err)` block in `serverDb.ts` manually returns an `atRiskCount: 2` (though the UI ignores this specific prop).

9. Smallest safe next implementation step
- Step 1: Strip the fabricated `defaults` array injection and the flawed `velocityGain` computation completely from `src/serverDb.ts`, allowing the backend to legitimately transmit `bottlenecks: []` when analytics are pristine.
- Step 2: Remove the 38 fallback from `TeacherDashboard.tsx` and adjust the UI rendering block for Velocity Gain to natively fallback to an honest `"Insufficient data"` rendering element when the backend no longer supplies it.
