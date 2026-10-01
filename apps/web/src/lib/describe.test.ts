import { describe, expect, it } from 'vitest';
import { analyzeTree, resolveConfiguration } from '@forkcast/engine';
import { buildSnapshot, createDocFromJson, exampleTreeJson } from '@forkcast/doc';
import { describeConfiguration, describeConfigurationText } from './describe';

const tree = buildSnapshot(createDocFromJson(exampleTreeJson()));

describe('describeConfiguration', () => {
  it('lists OR choices and optional inclusions in tree order', () => {
    const config = resolveConfiguration(tree, {
      choices: { psp: 'adyen', hosting: 'container', emails: 'smtp' },
      included: { fraud: false },
    });
    const parts = describeConfiguration(tree, config);
    expect(parts.map((p) => `${p.kind}:${p.label}=${p.detail}`)).toEqual([
      'or:Prestataire de paiement (PSP)=Adyen',
      'or:Hébergement du service de paiement=Conteneur sur l\'infra existante',
      'optional:Détection de fraude=exclu',
      'or:Envoi des e-mails=SMTP interne',
    ]);
    expect(describeConfigurationText(tree, config)).toContain('Prestataire de paiement (PSP) → Adyen');
    expect(describeConfigurationText(tree, config)).toContain('Détection de fraude : exclu');
  });

  it('describes every enumerated configuration without throwing', () => {
    const analysis = analyzeTree(tree);
    expect(analysis.enumerated).toBe(true);
    const texts = new Set(analysis.configurations.map((c) => describeConfigurationText(tree, c)));
    expect(texts.size).toBe(analysis.configurations.length);
  });

  it('handles a tree without alternatives', () => {
    const simple = buildSnapshot(
      createDocFromJson({ format: 'forkcast-tree', version: 1, title: 'T', criteria: [], root: { label: 'Root', children: [{ label: 'A' }] } }),
    );
    expect(describeConfigurationText(simple, { choices: {}, included: {} })).toBe('Aucun choix (arbre sans alternative)');
  });
});
