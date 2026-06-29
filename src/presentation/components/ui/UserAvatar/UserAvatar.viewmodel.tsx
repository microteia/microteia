import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type React from 'react';

export interface UserAvatarProps {
  src?: string | null;
  name: string;
  size?: number;
  showBorder?: boolean;
  referrerPolicy?: React.ImgHTMLAttributes<HTMLImageElement>['referrerPolicy'];
}

export interface UserAvatarViewModel {
  initial: string;
  loaded: boolean;
  errored: boolean;
  imgRef: React.RefObject<HTMLImageElement | null>;
  handleLoad: () => void;
  handleError: () => void;
}

const imageCache = new Set<string>();

export const useUserAvatarViewModel = (props: UserAvatarProps): UserAvatarViewModel => {
  const { src } = props;

  const [loaded, setLoaded] = useState(() => !!src && imageCache.has(src));
  const [errored, setErrored] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting error/loaded state synchronously on src change is architecturally required
    setErrored(false);

    if (!src) {
      setLoaded(false);
      return;
    }

    if (imageCache.has(src)) {
      setLoaded(true);
      return;
    }

    setLoaded(false);

    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      imageCache.add(src);
      setLoaded(true);
    }
  }, [src]);

  const initial = useMemo(() => props.name.trim().charAt(0).toUpperCase(), [props.name]);

  const handleLoad = useCallback(() => {
    if (src) imageCache.add(src);
    setLoaded(true);
  }, [src]);

  const handleError = useCallback(() => {
    setErrored(true);
    setLoaded(false);
  }, []);

  return { initial, loaded, errored, imgRef, handleLoad, handleError };
};
