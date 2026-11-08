import { useEffect } from 'react';

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} | RideWave` : 'RideWave — Your journey. Your way.';
  }, [title]);
}
