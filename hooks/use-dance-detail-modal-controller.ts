import { DanceClass, levelColors } from '@/data/dances';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo } from 'react';

export type DanceDetailModalProps = {
  dance: DanceClass | null;
  visible: boolean;
  onClose: () => void;
  onStart: (dance: DanceClass) => void;
};

export type DanceDetailQuickStat = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

export function useDanceDetailModalController({ dance, visible, onClose, onStart }: DanceDetailModalProps) {
  const quickStats = useMemo<DanceDetailQuickStat[]>(
    () =>
      dance
        ? [
            { icon: 'time-outline', label: dance.duration },
            { icon: 'flame-outline', label: `${dance.kcal} kcal` },
            { icon: 'people-outline', label: dance.students.toLocaleString() },
          ]
        : [],
    [dance]
  );

  // 선택된 춤의 대표 색을 기반으로 상세 모달에서 재사용할 스타일 값을 계산한다.
  const heroBackgroundColor = dance ? `${dance.color}20` : 'transparent';
  const genreBorderColor = dance ? `${dance.color}50` : 'transparent';
  const levelColor = dance ? levelColors[dance.level] : undefined;
  const levelBackgroundColor = levelColor ? `${levelColor}20` : 'transparent';
  const levelBorderColor = levelColor ? `${levelColor}40` : 'transparent';

  const handleStart = useCallback(() => {
    // dance가 선택된 경우에만 부모로 시작 이벤트를 전달한다.
    if (!dance) {
      return;
    }

    onStart(dance);
  }, [dance, onStart]);

  return {
    dance,
    visible,
    quickStats,
    heroBackgroundColor,
    genreBorderColor,
    levelColor,
    levelBackgroundColor,
    levelBorderColor,
    handleStart,
    handleClose: onClose,
  };
}
