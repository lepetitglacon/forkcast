import type { TreeJson } from '@forkcast/shared';

/** Example tree shown on first launch: "Ajouter le paiement en ligne". */
export function exampleTreeJson(): TreeJson {
  return {
    format: 'forkcast-tree',
    version: 1,
    title: 'Ajouter le paiement en ligne',
    criteria: [
      { id: 'cost', label: 'Coût mensuel', unit: '€', aggregation: 'sum', direction: 'minimize', order: 0 },
      { id: 'dev', label: 'Temps de dev', unit: 'j', aggregation: 'sum', direction: 'minimize', order: 1 },
      { id: 'risk', label: 'Risque', aggregation: 'probOr', direction: 'minimize', order: 2 },
    ],
    root: {
      id: 'root',
      label: 'Ajouter le paiement en ligne',
      kind: 'and',
      notes: 'Exploration des options techniques pour encaisser des paiements en ligne.',
      children: [
        {
          id: 'psp',
          label: 'Prestataire de paiement (PSP)',
          kind: 'or',
          children: [
            { id: 'stripe', label: 'Stripe', values: { cost: 25, dev: 5, risk: 0.05 }, notes: 'API très documentée, SDK officiels.' },
            { id: 'adyen', label: 'Adyen', values: { cost: 60, dev: 10, risk: 0.08 }, notes: 'Orienté grands comptes, onboarding plus long.' },
            { id: 'mollie', label: 'Mollie', values: { cost: 15, dev: 6, risk: 0.1 } },
            { id: 'paypal', label: 'PayPal Checkout', values: { cost: 10, dev: 4, risk: 0.15 } },
          ],
        },
        {
          id: 'hosting',
          label: 'Hébergement du service de paiement',
          kind: 'or',
          children: [
            { id: 'serverless', label: 'Fonctions serverless', values: { cost: 20, dev: 8, risk: 0.1 } },
            { id: 'container', label: "Conteneur sur l'infra existante", values: { cost: 5, dev: 3, risk: 0.05 } },
          ],
        },
        {
          id: 'security',
          label: 'Authentification & sécurité',
          kind: 'and',
          children: [
            { id: 'tds', label: '3-D Secure', values: { dev: 3, risk: 0.05 } },
            { id: 'fraud', label: 'Détection de fraude', optional: true, values: { cost: 30, dev: 2, risk: 0.02 } },
          ],
        },
        {
          id: 'billing',
          label: 'Facturation',
          kind: 'and',
          children: [
            { id: 'pdf', label: 'Génération des factures PDF', values: { dev: 4 } },
            {
              id: 'emails',
              label: 'Envoi des e-mails',
              kind: 'or',
              children: [
                { id: 'sendgrid', label: 'SendGrid', values: { cost: 15, dev: 1 } },
                { id: 'smtp', label: 'SMTP interne', values: { cost: 0, dev: 2, risk: 0.1 } },
              ],
            },
          ],
        },
      ],
    },
  };
}
