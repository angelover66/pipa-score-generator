'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAppState } from '@/store/AppContext';
import { ScoreData, Difficulty } from '@/engine/types';
import ScoreRenderer from '@/components/score/ScoreRenderer';

export default function ScorePage() {
  const { id } = useParams<{ id: string }>();
  const { state, dispatch } = useAppState();
  const [scores, setScores] = useState<Record<Difficulty, ScoreData>>();

  useEffect(() => {
    const easy = sessionStorage.getItem('scores-easy');
    const medium = sessionStorage.getItem('scores-medium');
    const hard = sessionStorage.getItem('scores-hard');
    if (easy && medium && hard) {
      const data = {
        easy: JSON.parse(easy) as ScoreData,
        medium: JSON.parse(medium) as ScoreData,
        hard: JSON.parse(hard) as ScoreData,
      };
      setScores(data);
      dispatch({
        type: 'ADD_TO_LIBRARY',
        payload: {
          id: data.medium.id,
          title: data.medium.title,
          difficulty: 'medium',
          createdAt: data.medium.createdAt,
          sourceType: data.medium.sourceType,
          scoreData: data.medium,
        },
      });
    }
  }, [id, dispatch]);

  if (!scores) return <div className="text-center py-20 text-ink-faded">加载中...</div>;
  return <ScoreRenderer score={scores.medium} scores={scores} />;
}
