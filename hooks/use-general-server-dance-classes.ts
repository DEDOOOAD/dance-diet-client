import type { DanceClass } from '@/data/dances';
import { fetchGeneralServerDanceClasses } from '@/services/dance-classes';
import { useEffect, useState } from 'react';

type Query = {
  search?: string | null;
};

export function useGeneralServerDanceClasses(query: Query = {}) {
  const [classes, setClasses] = useState<DanceClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let isActive = true;
    setLoading(true);

    void fetchGeneralServerDanceClasses(query)
      .then((result) => {
        if (!isActive) {
          return;
        }

        setClasses(result.classes);
        setIsFallback(result.isFallback);
      })
      .finally(() => {
        if (isActive) {
          setLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [query.search]);

  return {
    classes,
    loading,
    isFallback,
  };
}
