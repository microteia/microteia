import type { PrefixedNameKind } from '../../../../domain/schema/plugin/artifactPrefix';
import { ArtifactPrefixBadge } from '../ArtifactPrefixBadge';
import { S } from './PrefixedNameInput.styles';

export interface PrefixedNameInputProps {
  /** O prefixo do escritório. `null` desenha o campo sem ele — o nome nasce como sempre nasceu. */
  prefix: string | null;
  kind: PrefixedNameKind;
  /** O pedaço DEPOIS do prefixo: é o que a pessoa digita. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

export const PrefixedNameInput = ({
  prefix,
  kind,
  value,
  onChange,
  placeholder,
  disabled,
  hasError,
}: PrefixedNameInputProps) => (
  <S.Group $hasError={hasError} $disabled={disabled}>
    <ArtifactPrefixBadge prefix={prefix} kind={kind} />
    <S.Field
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
    />
  </S.Group>
);
