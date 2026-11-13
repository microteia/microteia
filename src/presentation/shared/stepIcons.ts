import { isScreenIconKey } from '../../domain/schema/ui/screenIconCatalog';
import { getScreenIconType } from './screenIcons';
import type { IconType } from 'react-icons';
import {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiLogoutBoxRLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiToolsLine,
  RiBracketsLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiDeleteBin6Line,
  RiSaveLine,
  RiRobot2Line,
  RiAiGenerate,
  RiHourglassLine,
  RiUserFollowLine,
  RiShareLine,
  RiUserAddLine,
  RiUserUnfollowLine,
  RiBarChart2Line,
  RiTimerFlashLine,
} from 'react-icons/ri';

const STEP_ICONS: Record<string, IconType> = {
  RiCalendarEventLine,
  RiNotification3Line,
  RiFileHistoryLine,
  RiBracesLine,
  RiSearchLine,
  RiLogoutBoxRLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiBracketsLine,
  RiGlobalLine,
  RiShieldCheckLine,
  RiDeleteBin6Line,
  RiSaveLine,
  RiRobot2Line,
  RiAiGenerate,
  RiHourglassLine,
  RiUserFollowLine,
  RiShareLine,
  RiUserAddLine,
  RiUserUnfollowLine,
  RiBarChart2Line,
  RiTimerFlashLine,
};

/**
 * O passo do núcleo usa os nomes deste mapa; o de EXTENSÃO declara uma chave do catálogo de ícones de
 * tela (`isScreenIconKey`, conferido na validação do pacote) — o mesmo vocabulário de todo ícone que um
 * pacote escreve.
 */
export const getStepIcon = (icon: string): IconType =>
  STEP_ICONS[icon] ?? (isScreenIconKey(icon) ? getScreenIconType(icon) : RiToolsLine);
