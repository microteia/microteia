import React from 'react';
import { RiCheckDoubleLine, RiExternalLinkLine, RiMailLine, RiMailOpenLine, RiNotification3Line } from 'react-icons/ri';
import { S } from './Notifications.styles';
import { useNotificationsViewModel } from './Notifications.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { getScreenIcon } from '../../shared/screenIcons';
import { useT } from '../../shared/i18n/useT';

/** Todos os avisos da pessoa neste escritório, e como ela quer receber cada tipo. */
export const NotificationsView: React.FC = () => {
  const vm = useNotificationsViewModel();
  const t = useT('core.automation');

  return (
    <S.Page>
      <S.Header>
        <S.HeaderIcon><RiNotification3Line size={22} /></S.HeaderIcon>
        <S.HeaderText>
          <S.Title>{t('page.notifications')}</S.Title>
          <S.Subtitle>{vm.subtitle}</S.Subtitle>
        </S.HeaderText>
        {vm.hasUnread && (
          <S.HeaderActions>
            <S.UnreadPill>{vm.unreadLabel}</S.UnreadPill>
            <S.GhostButton type="button" onClick={vm.markAllRead}>
              <RiCheckDoubleLine size={16} />
              {t('notifications.page.mark-all-read')}
            </S.GhostButton>
          </S.HeaderActions>
        )}
      </S.Header>

      <S.Tabs role="tablist">
        <S.Tab type="button" role="tab" $active={vm.tab === 'inbox'} onClick={() => vm.setTab('inbox')}>
          {t('notifications.page.tab.inbox')}
        </S.Tab>
        <S.Tab type="button" role="tab" $active={vm.tab === 'preferences'} onClick={() => vm.setTab('preferences')}>
          {t('notifications.page.tab.preferences')}
        </S.Tab>
      </S.Tabs>

      {vm.tab === 'inbox' ? (
        <>
          <S.Toolbar>
            <S.Segmented>
              <S.Segment type="button" $active={!vm.unreadOnly} onClick={() => vm.setUnreadOnly(false)}>
                {t('notifications.page.filter.all')}
              </S.Segment>
              <S.Segment type="button" $active={vm.unreadOnly} onClick={() => vm.setUnreadOnly(true)}>
                {t('notifications.page.filter.unread')}
              </S.Segment>
            </S.Segmented>
            <S.Chips>
              {vm.typeFilters.map((filter) => (
                <S.Chip key={filter.id ?? '*'} type="button" $active={vm.category === filter.id} onClick={() => vm.setCategory(filter.id)}>
                  {filter.label}
                </S.Chip>
              ))}
            </S.Chips>
          </S.Toolbar>

          <S.Content>
            {vm.failed ? (
              <S.Empty>
                <S.EmptyTitle>{t('notifications.page.load-failed')}</S.EmptyTitle>
              </S.Empty>
            ) : vm.loading && vm.groups.length === 0 ? (
              <S.Empty><Spinner /></S.Empty>
            ) : vm.groups.length === 0 ? (
              <S.Empty>
                <S.EmptyIcon><RiNotification3Line size={28} /></S.EmptyIcon>
                <S.EmptyTitle>{vm.unreadOnly ? t('notifications.page.empty.unread') : t('notifications.page.empty')}</S.EmptyTitle>
              </S.Empty>
            ) : (
              <S.Feed>
                {vm.groups.map((group) => (
                  <S.Day key={group.key}>
                    <S.DayLabel>{group.label}</S.DayLabel>
                    <S.Cards>
                      {group.items.map((item) => (
                        <S.Card key={item.id} $unread={!item.read}>
                          <S.CardIcon $unread={!item.read}>{getScreenIcon(item.icon, 18)}</S.CardIcon>
                          <S.CardBody
                            type="button"
                            $clickable={item.canOpen}
                            onClick={() => vm.open(item.id)}
                          >
                            <S.CardTitle $unread={!item.read}>{item.title}</S.CardTitle>
                            {item.message && <S.CardMessage>{item.message}</S.CardMessage>}
                            <S.CardMeta>
                              <S.TypeBadge>{item.typeLabel}</S.TypeBadge>
                              <span>{item.time}</span>
                            </S.CardMeta>
                          </S.CardBody>
                          <S.CardActions>
                            {item.canOpen && (
                              <S.IconButton type="button" title={t('notifications.page.open')} onClick={() => vm.open(item.id)}>
                                <RiExternalLinkLine size={16} />
                              </S.IconButton>
                            )}
                            <S.IconButton
                              type="button"
                              title={item.read ? t('notifications.page.mark-unread') : t('notifications.page.mark-read')}
                              onClick={() => vm.toggleRead(item.id)}
                            >
                              {item.read ? <RiMailLine size={16} /> : <RiMailOpenLine size={16} />}
                            </S.IconButton>
                          </S.CardActions>
                        </S.Card>
                      ))}
                    </S.Cards>
                  </S.Day>
                ))}
                {vm.canLoadMore && (
                  <S.LoadMore type="button" onClick={vm.loadMore} disabled={vm.loading}>
                    {vm.loading ? <Spinner size={14} /> : t('notifications.page.load-more')}
                  </S.LoadMore>
                )}
              </S.Feed>
            )}
          </S.Content>
        </>
      ) : (
        <S.Content>
          <S.Preferences>
            <S.SectionHeader>
              <S.SectionTitle>{t('notifications.page.preferences.title')}</S.SectionTitle>
              <S.SectionText>{t('notifications.page.preferences.description')}</S.SectionText>
            </S.SectionHeader>

            {vm.preferences.length === 0 ? (
              <S.Empty><S.EmptyTitle>{t('notifications.page.preferences.empty')}</S.EmptyTitle></S.Empty>
            ) : vm.preferences.map((row) => (
              <S.PrefRow key={row.id}>
                <S.CardIcon $unread={false}>{getScreenIcon(row.icon, 18)}</S.CardIcon>
                <S.PrefText>
                  <S.CardTitle $unread>{row.title}</S.CardTitle>
                  {row.description && <S.CardMessage>{row.description}</S.CardMessage>}
                </S.PrefText>
                <S.PrefChannels>
                  {row.channels.map((channel) => (
                    <S.ChannelToggle
                      key={channel.channel}
                      type="button"
                      role="switch"
                      aria-checked={channel.on && !channel.globallyOff}
                      $on={channel.on && !channel.globallyOff}
                      disabled={channel.globallyOff}
                      title={channel.globallyOff ? t('notifications.page.preferences.channel-off') : undefined}
                      onClick={() => vm.togglePreference(row.id, channel.channel)}
                    >
                      <S.ToggleDot $on={channel.on && !channel.globallyOff} />
                      {channel.label}
                    </S.ChannelToggle>
                  ))}
                </S.PrefChannels>
              </S.PrefRow>
            ))}

            {vm.pushStatus !== 'unsupported' && (
              <S.DeviceCard>
                <S.PrefText>
                  <S.CardTitle $unread>{t('notifications.page.preferences.device')}</S.CardTitle>
                  <S.CardMessage>
                    {vm.pushStatus === 'enabled'
                      ? t('notifications.push.enabled')
                      : vm.pushStatus === 'denied' ? t('notifications.push.blocked') : t('notifications.push.offer')}
                  </S.CardMessage>
                </S.PrefText>
                {vm.pushStatus === 'available' && (
                  <S.GhostButton type="button" onClick={vm.enablePush} disabled={vm.pushBusy}>
                    {t('notifications.push.enable')}
                  </S.GhostButton>
                )}
                {vm.pushStatus === 'enabled' && (
                  <S.GhostButton type="button" onClick={vm.disablePush} disabled={vm.pushBusy}>
                    {t('notifications.push.disable')}
                  </S.GhostButton>
                )}
              </S.DeviceCard>
            )}
          </S.Preferences>
        </S.Content>
      )}
    </S.Page>
  );
};
