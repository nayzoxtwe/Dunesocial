import type { AppRouter } from '@app/api/router';

export declare const MESSAGE_ENVELOPE: {
  version: number;
  fields: string[];
};

export declare function safetyNumber(publicKeyA: string, publicKeyB: string): string;
export declare function applyTeenNightMode(now: Date, startMinutes?: number | null, endMinutes?: number | null): boolean;
export declare function coinPackEuroToCoins(amountEuro: number): number;

export type { AppRouter };
