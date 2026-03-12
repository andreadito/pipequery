import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import SourceNode from './SourceNode';
import ResultNode from './ResultNode';
import PipelineConnector from './PipelineConnector';
import StepCard from './StepCard';
import {
  type PipeQueryBuilderProps,
  type PipelineStep,
  type OperationType,
  type StepConfig,
  createDefaultConfig,
  generateQuery,
} from './types';

export default function PipeQueryBuilder({
  orientation,
  source,
  onSourceChange,
  availableSources,
  availableFields,
  onQueryChange,
  compact = false,
  maxSteps,
  initialSteps,
  showResult = true,
  joinSources = [],
  rowCount,
}: PipeQueryBuilderProps) {
  const [steps, setSteps] = useState<PipelineStep[]>(() => initialSteps ?? []);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const nextId = useRef(1);
  const isH = orientation === 'horizontal';

  const generatedQuery = useMemo(
    () => generateQuery(source, steps),
    [source, steps],
  );

  useEffect(() => {
    onQueryChange(generatedQuery);
  }, [generatedQuery, onQueryChange]);

  const insertStepAt = useCallback((index: number, type: OperationType) => {
    if (maxSteps != null && steps.length >= maxSteps) return;
    const newId = `pq_${nextId.current++}`;
    setSteps(prev => {
      const next = [...prev];
      next.splice(index, 0, { id: newId, step: createDefaultConfig(type) });
      return next;
    });
    setExpandedId(newId);
  }, [maxSteps, steps.length]);

  const removeStep = useCallback((id: string) => {
    setSteps(prev => prev.filter(s => s.id !== id));
    setExpandedId(prev => prev === id ? null : prev);
  }, []);

  const moveStep = useCallback((id: string, direction: 'prev' | 'next') => {
    setSteps(prev => {
      const idx = prev.findIndex(s => s.id === id);
      if (idx < 0) return prev;
      const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  }, []);

  const updateStep = useCallback((id: string, newStep: StepConfig) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, step: newStep } : s));
  }, []);

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: isH ? 'row' : 'column',
      alignItems: isH ? 'stretch' : 'center',
      overflowX: isH ? 'auto' : 'visible',
      overflowY: isH ? 'visible' : 'auto',
      flex: 1,
      py: compact ? 0.5 : 1,
      gap: 0,
      '&::-webkit-scrollbar': { height: 4 },
      '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.15)', borderRadius: 2 },
    }}>
      <Box sx={{
        display: 'flex',
        flexDirection: isH ? 'row' : 'column',
        alignItems: isH ? 'stretch' : 'stretch',
        ...(isH ? {} : { width: '100%', maxWidth: compact ? 360 : 520 }),
      }}>
        {/* Source */}
        <SourceNode
          source={source}
          onSourceChange={onSourceChange}
          availableSources={availableSources}
          rowCount={rowCount}
          orientation={orientation}
          compact={compact}
        />

        {/* Connector before first step */}
        <PipelineConnector
          orientation={orientation}
          compact={compact}
          onInsert={(type) => insertStepAt(0, type)}
        />

        {/* Step Cards */}
        {steps.map((step, idx) => (
          <Box
            key={step.id}
            sx={{
              display: 'flex',
              flexDirection: isH ? 'row' : 'column',
              alignItems: isH ? 'stretch' : 'stretch',
            }}
          >
            <StepCard
              step={step}
              isFirst={idx === 0}
              isLast={idx === steps.length - 1}
              expanded={expandedId === step.id}
              onToggleExpand={() => setExpandedId(expandedId === step.id ? null : step.id)}
              availableFields={availableFields}
              joinSources={joinSources}
              onUpdate={(newStep) => updateStep(step.id, newStep)}
              onRemove={() => removeStep(step.id)}
              onMoveUp={() => moveStep(step.id, 'prev')}
              onMoveDown={() => moveStep(step.id, 'next')}
              orientation={orientation}
              compact={compact}
            />
            <PipelineConnector
              orientation={orientation}
              compact={compact}
              onInsert={(type) => insertStepAt(idx + 1, type)}
            />
          </Box>
        ))}

        {/* Result */}
        {showResult && (
          <ResultNode
            query={generatedQuery}
            orientation={orientation}
            compact={compact}
          />
        )}
      </Box>
    </Box>
  );
}
