import React from 'react';
import type { IconType } from 'react-icons';
import {
  RiApps2Line,
  RiStarLine,
  RiBookmarkLine,
  RiCalendar2Line,
  RiBriefcaseLine,
  RiScalesLine,
  RiBuilding2Line,
  RiCarLine,
  RiHome4Line,
  RiFolderLine,
  RiArchiveLine,
  RiBookOpenLine,
  RiMailLine,
  RiPhoneLine,
  RiMapPinLine,
  RiHeartLine,
  RiShieldLine,
  RiToolsLine,
  RiGlobalLine,
  RiKey2Line,
} from 'react-icons/ri';

const SCREEN_ICONS: Record<string, IconType> = {
  apps: RiApps2Line,
  star: RiStarLine,
  bookmark: RiBookmarkLine,
  calendar: RiCalendar2Line,
  briefcase: RiBriefcaseLine,
  scales: RiScalesLine,
  building: RiBuilding2Line,
  car: RiCarLine,
  home: RiHome4Line,
  folder: RiFolderLine,
  archive: RiArchiveLine,
  book: RiBookOpenLine,
  mail: RiMailLine,
  phone: RiPhoneLine,
  mapPin: RiMapPinLine,
  heart: RiHeartLine,
  shield: RiShieldLine,
  tools: RiToolsLine,
  globe: RiGlobalLine,
  key: RiKey2Line,
};

export const SCREEN_ICON_KEYS = Object.keys(SCREEN_ICONS);

export const getScreenIcon = (key: string, size = 20): React.ReactNode => {
  const Icon = SCREEN_ICONS[key] ?? RiApps2Line;
  return <Icon size={size} />;
};
