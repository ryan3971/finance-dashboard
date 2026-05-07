export interface StagingTag {
  name: string;
  color: string;
}

// Each entry maps a tag to the transactions it should be applied to,
// identified by account name + description (same key used in txIdByKey).
export interface StagingTagApplication {
  tagName: string;
  accountName: string;
  description: string;
}

export const STAGING_TAGS: StagingTag[] = [
  { name: 'Tax Deductible', color: '#22c55e' },
  { name: 'Shared',         color: '#3b82f6' },
  { name: 'Recurring',      color: '#8b5cf6' },
];

export const STAGING_TAG_APPLICATIONS: StagingTagApplication[] = [
  // Tax Deductible — pharmacy purchases
  { tagName: 'Tax Deductible', accountName: 'Amex', description: 'city pharmacy' },

  // Shared — transactions that belong to rebalancing groups
  { tagName: 'Shared', accountName: 'Amex',             description: 'city coffee shop'          },
  { tagName: 'Shared', accountName: 'Amex',             description: 'online retailer purchase'  },
  { tagName: 'Shared', accountName: 'CIBC Mastercard',  description: 'restaurant midtown'        },
  { tagName: 'Shared', accountName: 'CIBC Mastercard',  description: 'stream plus subscription'  },

  // Recurring — fixed monthly expenses and subscriptions
  { tagName: 'Recurring', accountName: 'TD Chequing',   description: 'rent payment ref 001'      },
  { tagName: 'Recurring', accountName: 'TD Chequing',   description: 'rent payment ref 002'      },
  { tagName: 'Recurring', accountName: 'TD Chequing',   description: 'rent payment ref 003'      },
  { tagName: 'Recurring', accountName: 'CIBC Mastercard', description: 'stream plus subscription' },
];
