import { DanceDetailModalView } from '@/components/dance-detail-modal-view';
import {
  DanceDetailModalProps,
  useDanceDetailModalController,
} from '@/hooks/use-dance-detail-modal-controller';

export function DanceDetailModal(props: DanceDetailModalProps) {
  const controller = useDanceDetailModalController(props);

  return <DanceDetailModalView {...controller} />;
}
