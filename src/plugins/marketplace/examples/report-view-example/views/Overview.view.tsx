import { Button, InfoBanner } from '@microteia/ui';
import { ReportChart, ReportTable } from '@microteia/report';
import { useOverviewViewModel } from './Overview.viewmodel';
import { S } from './Overview.styles';

/**
 * The body of the "Entries overview" report tab, named by `reports[].view` in the package.
 *
 * Above the line is this extension's: the period buttons and the headline. Below it are the platform's
 * own pieces, `ReportChart` and `ReportTable`, fed with the report's spec and the result the frame ran —
 * composition, not reimplementation. The title, the warnings and Export / Print / Subscribe are drawn
 * by the tab around this view, and are not repeated here.
 */
export default function Overview() {
  const vm = useOverviewViewModel();

  if (!vm.inFrame) return <InfoBanner message={vm.t('overview.outside')} variant="info" />;

  return (
    <S.Wrapper>
      <S.Periods>
        {vm.periods.map((period) => (
          <Button key={period.key} size="sm" variant={period.active ? 'primary' : 'secondary'} onClick={period.onClick}>
            {period.label}
          </Button>
        ))}
      </S.Periods>

      {vm.loading && <S.Muted>{vm.t('overview.loading')}</S.Muted>}

      {vm.headline.length > 0 && (
        <S.Headline>
          {vm.headline.map((item) => (
            <S.Tile key={item.key}>
              <S.TileLabel>{item.label}</S.TileLabel>
              <S.TileValue>{item.value}</S.TileValue>
            </S.Tile>
          ))}
        </S.Headline>
      )}

      <ReportChart spec={vm.spec} result={vm.result} />
      <ReportTable spec={vm.spec} result={vm.result} />
    </S.Wrapper>
  );
}
