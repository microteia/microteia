import React from 'react';
import { FcGoogle } from 'react-icons/fc';
import { FaApple, FaFacebookF, FaGithub, FaMicrosoft } from 'react-icons/fa';
import { RiMailLine, RiShieldKeyholeLine } from 'react-icons/ri';
import type { AuthProviderKind } from '../../../domain/schema/auth';
import { getScreenIcon } from '../screenIcons';

/**
 * A MARCA de cada meio de entrada. Sai da espécie, e não de `screenIcons`, por uma razão de conteúdo:
 * o conjunto curado é de ícones de TELA, monocromáticos e com um rótulo traduzível cada — a marca do
 * Google não é um ícone de tela, e pôr o logotipo colorido ali chamaria uma marca de "ícone".
 *
 * Como `AuthProviderKind` é uma união fechada, a tabela é exaustiva: uma espécie nova não compila até
 * ganhar a marca dela aqui. É o mesmo desenho de `workflowEventIcons`.
 *
 * `oidc` e `saml` são a exceção deliberada: ali a marca é do escritório, e nós não a conhecemos —
 * quem declara escolhe um ícone do conjunto curado, e o cadeado é só o padrão.
 */
const BRAND_MARKS: Record<AuthProviderKind, React.FC<{ size?: number }>> = {
  password: RiMailLine,
  google: FcGoogle,
  facebook: FaFacebookF,
  microsoft: FaMicrosoft,
  apple: FaApple,
  github: FaGithub,
  oidc: RiShieldKeyholeLine,
  saml: RiShieldKeyholeLine,
};

export const getAuthProviderIcon = (
  kind: AuthProviderKind,
  icon: string | undefined,
  size = 20,
): React.ReactNode => {
  if (icon) return getScreenIcon(icon, size);
  const Mark = BRAND_MARKS[kind];
  return <Mark size={size} />;
};
