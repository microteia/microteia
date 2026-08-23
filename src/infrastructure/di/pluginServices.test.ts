import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import type { PluginRecord } from '../../kernel';
import {
  DATA_SERVICE_POINT,
  serviceContribution,
} from '../../domain/schema/dataExtensionPoints';
import { resolvePluginService } from './pluginServices';

interface Geocoder {
  locate(address: string): string;
}

const pointDeclarer: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.data',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Dados',
    extensionPoints: [
      {
        id: DATA_SERVICE_POINT,
        apiVersion: '1.0.0',
        title: 'Serviço',
        ownerPluginId: 'core.data',
        allowedImplKinds: ['code'],
        implRequired: true,
        multiple: true,
      },
    ],
  },
};

const geocoderPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    Geocoder: { locate: (address: string) => `geo:${address}` } satisfies Geocoder,
  },
  manifest: {
    id: 'com.acme.geo',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: 'Geocoder Acme',
    dependencies: { 'core.data': '^1.0.0' },
    contributes: [serviceContribution('acme.geocoder', 'Geocoder', 'Geocodificação')],
  },
};

const hostWith = (records: PluginRecord[]) => {
  const host = createPluginHost();
  const result = host.load(records);
  return { host, result };
};

describe('resolvePluginService', () => {
  it('resolve o serviço contribuído por um plugin, por chave', () => {
    const { host, result } = hostWith([pointDeclarer, geocoderPlugin]);
    expect(result.diagnostics).toEqual([]);

    const geocoder = resolvePluginService<Geocoder>(host, 'acme.geocoder');
    expect(geocoder?.locate('Rua X')).toBe('geo:Rua X');
  });

  it('devolve undefined para chave desconhecida', () => {
    const { host } = hostWith([pointDeclarer, geocoderPlugin]);
    expect(resolvePluginService(host, 'inexistente')).toBeUndefined();
  });

  it('devolve undefined quando nenhum plugin registrou serviços', () => {
    const { host } = hostWith([pointDeclarer]);
    expect(resolvePluginService(host, 'acme.geocoder')).toBeUndefined();
    expect(host.contributions.query(DATA_SERVICE_POINT)).toEqual([]);
  });

  it('remover o plugin do serviço torna a chave irresolúvel — sem tocar no container do núcleo', () => {
    const { host } = hostWith([pointDeclarer]);
    expect(resolvePluginService(host, 'acme.geocoder')).toBeUndefined();

    const { host: comPlugin } = hostWith([pointDeclarer, geocoderPlugin]);
    expect(resolvePluginService(comPlugin, 'acme.geocoder')).toBeDefined();
  });

  it('dois plugins podem registrar serviços diferentes lado a lado', () => {
    const outro: PluginRecord = {
      trusted: true,
      implementations: { Translator: { translate: () => 'olá' } },
      manifest: {
        id: 'com.acme.i18n',
        version: '1.0.0',
        kernel: '^2.0.0',
        name: 'i18n',
        dependencies: { 'core.data': '^1.0.0' },
        contributes: [serviceContribution('acme.translator', 'Translator')],
      },
    };

    const { host } = hostWith([pointDeclarer, geocoderPlugin, outro]);
    expect(resolvePluginService<Geocoder>(host, 'acme.geocoder')?.locate('a')).toBe('geo:a');
    expect(resolvePluginService<{ translate: () => string }>(host, 'acme.translator')?.translate()).toBe('olá');
  });
});
