import { DanceVisionPracticeModalView } from '@/components/dance-vision-practice-modal-view';
import {
  DanceVisionPracticeModalProps,
  useDanceVisionPracticeModalController,
} from '@/hooks/use-dance-vision-practice-modal-controller';

export function DanceVisionPracticeModal(props: DanceVisionPracticeModalProps) {
  const controller = useDanceVisionPracticeModalController(props);

  return <DanceVisionPracticeModalView {...controller} />;
}
