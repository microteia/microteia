import React from 'react';
import { useUserAvatarViewModel } from './UserAvatar.viewmodel';
import type { UserAvatarProps } from './UserAvatar.viewmodel';
import { S } from './UserAvatar.styles';

export const UserAvatar: React.FC<UserAvatarProps> = (props) => {
  const vm = useUserAvatarViewModel(props);
  const { src, name, size = 36, showBorder = false, referrerPolicy } = props;
  const hasImage = !!src && !vm.errored;

  /* eslint-disable react-hooks/refs -- vm ViewModel exposes imgRef only for DOM passing; no ref.current is read during render */
  return (
    <S.Container $size={size} $showBorder={showBorder}>
      {hasImage ? (
        <>
          <S.Image
            ref={vm.imgRef}
            src={src}
            alt={name}
            referrerPolicy={referrerPolicy}
            onLoad={vm.handleLoad}
            onError={vm.handleError}
            $visible={vm.loaded}
          />
          {!vm.loaded && <S.Skeleton />}
        </>
      ) : (
        <S.Initial $size={size}>{vm.initial}</S.Initial>
      )}
    </S.Container>
  );
  /* eslint-enable react-hooks/refs */
};
